"use client";

// Tableau de saisie : relie la grille et la fenêtre « Signaler un créneau »,
// et garde les créneaux signalés à jour après chaque enregistrement, sans
// recharger la page. Partagé par le personnel et l'administration.
//
// Option `quickMarking` (écran admin) : un mode « au clic » où chaque clic
// applique directement un statut choisi d'avance, sans ouvrir la fenêtre.
//
// Option `readOnly` (personnel, calendrier clôturé) : la grille s'affiche
// sans rien de cliquable. Le serveur refuse de toute façon l'écriture.

import { ClearOutlined, CopyOutlined, DownOutlined, LockOutlined } from "@ant-design/icons";
import { Alert, App, Button, Dropdown, Input, Modal, Segmented, Select } from "antd";
import { useState, useTransition, type ReactNode } from "react";

import { copyWeekToAll, resetAll, saveCells, type SaveSlotResult, type SlotState } from "@/actions/availability";
import { calendarDays, calendarWeekGrid, generateSlots, slotKey, weekDayOf, type ISODate, type Time } from "@/lib/slots";
import { MAX_COMMENT_LENGTH, validateExceptionInput } from "@/lib/validation/availability";

import { AvailabilityGrid, type Cell, type ExceptionMap, type GridCalendar, type SlotStatus } from "./grid";
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
  readOnly = false,
  heading,
}: {
  resourceId: string;
  calendar: GridCalendar;
  initialExceptions: ExceptionMap;
  totalSlots: number;
  quickMarking?: boolean;
  readOnly?: boolean;
  heading?: ReactNode; // début de la première ligne : titre de la page, sélecteurs…
}) {
  const [exceptions, setExceptions] = useState(initialExceptions);
  // `scope` : fenêtre ouverte depuis le nom d'un jour, sur « tous les lundis,
  // toute la journée ». `range` : ouverte sur une zone glissée. Sinon, sur le
  // créneau cliqué.
  const [selected, setSelected] = useState<{
    date: ISODate;
    start: Time;
    scope?: { wholeDay: boolean; weekly: boolean };
    range?: Cell[];
  } | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const { message, modal } = App.useApp();
  const [mode, setMode] = useState<ClickMode>("dialog");
  const [quickComment, setQuickComment] = useState("");
  const [commentMissing, setCommentMissing] = useState(false);
  const [, startTransition] = useTransition();
  const [bulk, setBulk] = useState<"copy" | "reset" | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  // Mode « au clic » : créneaux affichés avec leur nouveau statut mais pas
  // encore confirmés par le serveur (icône de chargement dans la case).
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());

  // Semaine modèle de « Appliquer à tout le quadrimestre » : la 1 par défaut,
  // ou la première qui a des jours de cours (un calendrier peut commencer un
  // samedi : sa semaine 1 est alors vide).
  const { weeks } = calendarWeekGrid({ startDate: calendar.startDate, endDate: calendar.endDate, weekDays: calendar.weekDays });
  const [modelWeek, setModelWeek] = useState((weeks.find((w) => w.dates.some(Boolean)) ?? weeks[0])?.monday ?? "");
  const modelIndex = Math.max(0, weeks.findIndex((w) => w.monday === modelWeek));
  const modelDates = new Set(weeks[modelIndex]?.dates.filter(Boolean));
  const modelCount = Object.keys(exceptions).filter((key) => modelDates.has(key.split("|")[0])).length;

  const slots = generateSlots(calendar);
  const courseDays = calendarDays({ ...calendar, holidays: calendar.holidays.map((h) => h.date) });
  const count = Object.keys(exceptions).length;

  // Clic sur « Lundi » dans la grille : la fenêtre s'ouvre sur tous les lundis,
  // toute la journée, à partir du premier lundi de cours.
  function handleDayClick(day: string) {
    const first = courseDays.find((date) => weekDayOf(date) === day);
    if (!first || slots.length === 0) {
      message.info("Aucun jour de cours ce jour de la semaine.");
      return;
    }
    setSelected({ date: first, start: slots[0].start, scope: { wholeDay: true, weekly: true } });
  }

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

  // Applique un statut à des cases sans ouvrir la fenêtre (mode « au clic »,
  // recopie d'une case par glissé). Affichage immédiat du nouveau statut ;
  // retour à l'état d'avant si le serveur refuse. Plusieurs enregistrements
  // peuvent avancer en même temps ; une case déjà en cours est laissée de côté.
  // `quiet` : pas de message de succès (le mode « au clic » en ferait un par case).
  function applyCells(cells: Cell[], status: SlotStatus, comment: string, quiet: boolean) {
    const todo = cells.filter((c) => !saving.has(slotKey(c.date, c.start)));
    if (todo.length === 0) return;
    const keys = todo.map((c) => slotKey(c.date, c.start));
    const previous = Object.fromEntries(keys.map((key) => [key, exceptions[key]]));

    const setCells = (value: (key: string) => ExceptionMap[string] | undefined) =>
      setExceptions((current) => {
        const next = { ...current };
        for (const key of keys) {
          const v = value(key);
          if (v) next[key] = v;
          else delete next[key];
        }
        return next;
      });
    const setBusy = (busy: boolean) =>
      setSaving((current) => {
        const next = new Set(current);
        for (const key of keys) {
          if (busy) next.add(key);
          else next.delete(key);
        }
        return next;
      });

    const optimistic = status === "AVAILABLE" ? undefined : { status, comment: comment.trim() };
    setCells(() => optimistic);
    setBusy(true);
    saveCells({ calendarId: calendar.id, resourceId, cells: todo, status, comment })
      .then((result) => {
        if (result.ok) {
          applySaved(result.slots, quiet);
          return;
        }
        setCells((key) => previous[key]);
        message.error(result.errors[0]?.message ?? "L'enregistrement a échoué.");
      })
      .catch(() => {
        setCells((key) => previous[key]);
        message.error("L'enregistrement a échoué. Vérifiez votre connexion.");
      })
      .finally(() => setBusy(false));
  }

  // Mode « au clic » : même règle que partout, pas d'exception sans commentaire.
  function quickCommentOk() {
    const errors = validateExceptionInput({ status: mode, comment: quickComment });
    if (errors.length === 0) return true;
    setCommentMissing(true);
    message.warning(errors[0].message);
    return false;
  }

  function handleClick(date: ISODate, start: Time) {
    if (mode === "dialog") {
      setSelected({ date, start });
      return;
    }
    if (quickCommentOk()) applyCells([{ date, start }], mode, quickComment, true);
  }

  // Zone glissée sur la grille, comme dans Excel :
  //  - mode « au clic » : le statut choisi est peint sur toute la zone ;
  //  - départ d'une case signalée : son statut et son commentaire sont recopiés ;
  //  - départ d'une case disponible : la fenêtre s'ouvre pour toute la zone.
  function handleRange(cells: Cell[], origin: Cell) {
    if (mode !== "dialog") {
      if (quickCommentOk()) applyCells(cells, mode, quickComment, true);
      return;
    }
    const source = exceptions[slotKey(origin.date, origin.start)];
    if (source) {
      applyCells(cells, source.status, source.comment, false);
      return;
    }
    setSelected({ ...origin, range: cells });
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

  // Depuis le nom d'un jour ou une zone, la fenêtre part vierge : le statut
  // d'un seul créneau ne dit rien des autres.
  const openException =
    selected && !selected.scope && !selected.range ? exceptions[slotKey(selected.date, selected.start)] : undefined;
  const open = selected && {
    date: selected.date,
    start: selected.start,
    end: slots.find((s) => s.start === selected.start)?.end ?? selected.start,
    status: openException?.status ?? "AVAILABLE",
    comment: openException?.comment ?? "",
  };
  const openDay = selected && {
    slots: slots.length,
    weeks: courseDays.filter((date) => weekDayOf(date) === weekDayOf(selected.date)).length,
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
          {!readOnly && (
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
          )}
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
      ) : readOnly ? (
        <>
          <Alert
            type="info"
            showIcon
            icon={<LockOutlined />}
            title="L'administration a validé ce calendrier : vos disponibilités ne sont plus modifiables. Contactez-la pour toute correction."
          />
          <AvailabilityLegend />
        </>
      ) : (
        <AvailabilityLegend note="Cliquez sur un créneau pour signaler un problème, ou glissez sur plusieurs cases comme dans Excel." />
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

      <AvailabilityGrid
        calendar={calendar}
        exceptions={exceptions}
        onSlotClick={readOnly ? undefined : handleClick}
        onDayClick={readOnly ? undefined : handleDayClick}
        onRangeSelect={readOnly ? undefined : handleRange}
        saving={saving}
      />

      {open && openDay && (
        <SlotDialog
          key={`${slotKey(open.date, open.start)}|${selected?.range ? "range" : selected?.scope ? "day" : "slot"}`}
          calendarId={calendar.id}
          resourceId={resourceId}
          slot={open}
          day={openDay}
          initialScope={selected?.scope}
          range={selected?.range}
          onSaved={applySaved}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
