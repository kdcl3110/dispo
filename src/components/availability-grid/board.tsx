"use client";

// Tableau de saisie : relie la grille et la fenêtre « Signaler un créneau »,
// et garde les créneaux signalés à jour après chaque enregistrement, sans
// recharger la page. Partagé par le personnel et l'administration.
//
// Option `quickMarking` (écran admin) : un mode « au clic » où chaque clic
// applique directement un statut choisi d'avance, sans ouvrir la fenêtre.

import { ClearOutlined, CopyOutlined, DownOutlined } from "@ant-design/icons";
import { App, Button, Dropdown, Input, Modal, Segmented, Select } from "antd";
import { useState, useTransition, type ReactNode } from "react";

import { copyWeekToAll, resetAll, saveSlot, type SaveSlotResult, type SlotState } from "@/actions/availability";
import { calendarWeekGrid, generateSlots, slotKey, type ISODate, type Time } from "@/lib/slots";
import { MAX_COMMENT_LENGTH, validateExceptionInput } from "@/lib/validation/availability";

import { AvailabilityGrid, type ExceptionMap, type GridCalendar, type SlotStatus } from "./grid";
import { AvailabilityLegend } from "./legend";
import { SlotDialog } from "./slot-dialog";

const time = new Intl.DateTimeFormat("fr-BE", { hour: "2-digit", minute: "2-digit" });
const shortDate = new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short", timeZone: "UTC" });
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

// « dialog » : chaque clic ouvre la fenêtre. Sinon : statut appliqué au clic.
type ClickMode = "dialog" | SlotStatus;

const MODES: { value: ClickMode; label: string; swatch?: string }[] = [
  { value: "dialog", label: "Ouvrir la fenêtre" },
  { value: "UNAVAILABLE", label: "Indisponible", swatch: "border border-unavailable-edge bg-unavailable" },
  { value: "IF_NEEDED", label: "Si nécessaire", swatch: "border border-if-needed-edge bg-if-needed" },
  { value: "AVAILABLE", label: "Disponible", swatch: "border border-available-edge bg-available" },
];

export function AvailabilityBoard({
  resourceId,
  calendar,
  initialExceptions,
  totalSlots,
  quickMarking = false,
  heading,
}: {
  resourceId: string;
  calendar: GridCalendar;
  initialExceptions: ExceptionMap;
  totalSlots: number;
  quickMarking?: boolean;
  heading?: ReactNode; // début de la première ligne : titre de la page, sélecteurs…
}) {
  const [exceptions, setExceptions] = useState(initialExceptions);
  const [selected, setSelected] = useState<{ date: ISODate; start: Time } | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const { message, modal } = App.useApp();
  const [mode, setMode] = useState<ClickMode>("dialog");
  const [quickComment, setQuickComment] = useState("");
  const [commentMissing, setCommentMissing] = useState(false);
  const [, startTransition] = useTransition();
  const [bulk, setBulk] = useState<"copy" | "reset" | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  // Semaine modèle de « Appliquer à tout le quadrimestre » : la 1 par défaut,
  // ou la première qui a des jours de cours (un calendrier peut commencer un
  // samedi : sa semaine 1 est alors vide).
  const { weeks } = calendarWeekGrid({ startDate: calendar.startDate, endDate: calendar.endDate, weekDays: calendar.weekDays });
  const [modelWeek, setModelWeek] = useState((weeks.find((w) => w.dates.some(Boolean)) ?? weeks[0])?.monday ?? "");
  const modelIndex = Math.max(0, weeks.findIndex((w) => w.monday === modelWeek));
  const modelDates = new Set(weeks[modelIndex]?.dates.filter(Boolean));
  const modelCount = Object.keys(exceptions).filter((key) => modelDates.has(key.split("|")[0])).length;

  const slots = generateSlots(calendar);
  const count = Object.keys(exceptions).length;

  // `quiet` : en mode « au clic », pas de message à chaque case (la ligne
  // d'état sous la grille suffit).
  function applySaved(saved: SlotState[], quiet = false) {
    setExceptions((current) => {
      const next = { ...current };
      for (const slot of saved) {
        const key = slotKey(slot.date, slot.start);
        if (slot.status === "AVAILABLE") delete next[key];
        else next[key] = { status: slot.status, comment: slot.comment };
      }
      return next;
    });
    setSavedAt(new Date());
    if (!quiet) message.success(saved.length > 1 ? `${saved.length} créneaux enregistrés.` : "Créneau enregistré.");
  }

  function handleClick(date: ISODate, start: Time) {
    if (mode === "dialog") {
      setSelected({ date, start });
      return;
    }
    // Même règle que partout : pas d'exception sans commentaire.
    const errors = validateExceptionInput({ status: mode, comment: quickComment });
    if (errors.length > 0) {
      setCommentMissing(true);
      message.warning(errors[0].message);
      return;
    }
    startTransition(async () => {
      const result = await saveSlot({ calendarId: calendar.id, resourceId, date, start, status: mode, comment: quickComment });
      if (result.ok) applySaved(result.slots, true);
      else message.error(result.errors[0]?.message ?? "L'enregistrement a échoué.");
    });
  }

  // Actions en lot : recopier la semaine modèle, ou tout effacer.
  function runBulk(kind: "copy" | "reset") {
    setBulk(kind);
    startTransition(async () => {
      const result: SaveSlotResult =
        kind === "copy"
          ? await copyWeekToAll({ calendarId: calendar.id, resourceId, weekMonday: modelWeek })
          : await resetAll({ calendarId: calendar.id, resourceId });
      setBulk(null);
      setCopyOpen(false);
      if (!result.ok) {
        message.error(result.errors[0]?.message ?? "L'opération a échoué.");
        return;
      }
      applySaved(result.slots, true);
      const n = result.slots.length;
      if (kind === "reset") message.success(`${plural(n, "créneau effacé", "créneaux effacés")}.`);
      else if (n === 0) message.info("Rien à ajouter : les autres semaines ont déjà ces créneaux, ou ce sont des jours retirés.");
      else message.success(`${plural(n, "créneau ajouté", "créneaux ajoutés")} sur les autres semaines.`);
    });
  }

  const open = selected && {
    ...selected,
    end: slots.find((s) => s.start === selected.start)?.end ?? selected.start,
    status: exceptions[slotKey(selected.date, selected.start)]?.status ?? "AVAILABLE",
    comment: exceptions[slotKey(selected.date, selected.start)]?.comment ?? "",
  };

  const weekOptions = weeks.map((w, i) => ({
    value: w.monday,
    label: `Semaine ${i + 1}, ${shortDate.format(new Date(`${w.monday}T00:00:00Z`))}`,
  }));

  function confirmReset() {
    modal.confirm({
      title: "Tout remettre à disponible ?",
      content: `${plural(count, "créneau signalé sera effacé", "créneaux signalés seront effacés")}, avec leurs commentaires.`,
      okText: "Tout effacer",
      okButtonProps: { danger: true },
      cancelText: "Annuler",
      onOk: () => runBulk("reset"),
    });
  }

  return (
    // Le tableau prend toute la hauteur que lui laisse la page ; seule la
    // grille défile (voir grid.tsx). Au-dessus, deux lignes compactes :
    //  1. titre (fourni par la page), puis compteur et menu « Actions » ;
    //  2. mode « au clic » (écran admin, ses pastilles servent de légende)
    //     ou légende seule (personnel).
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">{heading}</div>
        <div className="flex items-center gap-3">
          <p role="status" className="text-[13px] text-graphite">
            <strong className="font-semibold text-ink">
              {count} créneau{count > 1 ? "x" : ""} signalé{count > 1 ? "s" : ""}
            </strong>{" "}
            sur {totalSlots}
            {savedAt && `, enregistré à ${time.format(savedAt)}`}
          </p>
          <Dropdown
            trigger={["click"]}
            placement="bottomRight"
            menu={{
              items: [
                { key: "copy", icon: <CopyOutlined />, label: "Recopier une semaine…", onClick: () => setCopyOpen(true) },
                { key: "reset", icon: <ClearOutlined />, label: "Tout remettre à disponible", danger: true, disabled: count === 0, onClick: confirmReset },
              ],
            }}
          >
            <Button loading={bulk !== null}>
              Actions <DownOutlined />
            </Button>
          </Dropdown>
        </div>
      </div>

      {quickMarking ? (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span id="click-mode-label" className="text-[13px] text-graphite">
              Au clic sur un créneau
            </span>
            <Segmented<ClickMode>
              aria-labelledby="click-mode-label"
              value={mode}
              onChange={(value) => {
                setMode(value);
                setCommentMissing(false);
              }}
              options={MODES.map((m) => ({
                value: m.value,
                label: (
                  <span className="inline-flex items-center gap-2">
                    {m.swatch && <span aria-hidden="true" className={`h-3 w-4.5 rounded-[3px] ${m.swatch}`} />}
                    {m.label}
                  </span>
                ),
              }))}
            />
            {(mode === "UNAVAILABLE" || mode === "IF_NEEDED") && (
              <Input
                aria-label="Commentaire appliqué à chaque clic"
                value={quickComment}
                onChange={(e) => {
                  setQuickComment(e.target.value);
                  setCommentMissing(false);
                }}
                maxLength={MAX_COMMENT_LENGTH}
                status={commentMissing ? "error" : undefined}
                placeholder="Commentaire appliqué à chaque clic"
                className="w-75!"
              />
            )}
          </div>
          <AvailabilityLegend only="holiday" />
        </div>
      ) : (
        <AvailabilityLegend note="Cliquez sur un créneau pour signaler un problème." />
      )}

      <Modal
        title="Recopier une semaine sur tout le calendrier"
        open={copyOpen}
        onCancel={() => setCopyOpen(false)}
        okText="Recopier"
        cancelText="Annuler"
        okButtonProps={{ disabled: modelCount === 0 }}
        confirmLoading={bulk === "copy"}
        onOk={() => runBulk("copy")}
      >
        <div className="flex flex-col gap-3">
          <Select aria-label="Semaine modèle" value={modelWeek} onChange={setModelWeek} options={weekOptions} />
          <p className="text-[13px] text-graphite">
            {modelCount === 0
              ? `Aucun créneau signalé en semaine ${modelIndex + 1}.`
              : `Ses ${plural(modelCount, "créneau signalé", "créneaux signalés")} seront ajoutés aux autres semaines. Ce qui y est déjà signalé est gardé.`}
          </p>
        </div>
      </Modal>

      <AvailabilityGrid calendar={calendar} exceptions={exceptions} onSlotClick={handleClick} />

      {open && (
        <SlotDialog
          key={slotKey(open.date, open.start)}
          calendarId={calendar.id}
          resourceId={resourceId}
          slot={open}
          onSaved={applySaved}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
