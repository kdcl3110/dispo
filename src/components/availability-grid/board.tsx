"use client";

// Tableau de saisie : relie la grille et la fenêtre « Signaler un créneau »,
// et garde les créneaux signalés à jour après chaque enregistrement, sans
// recharger la page. Partagé par le personnel et l'administration.
//
// Option `quickMarking` (écran admin) : un mode « au clic » où chaque clic
// applique directement un statut choisi d'avance, sans ouvrir la fenêtre.

import { App, Input, Segmented } from "antd";
import { useState, useTransition } from "react";

import { saveSlot, type SlotState } from "@/actions/availability";
import { generateSlots, slotKey, type ISODate, type Time } from "@/lib/slots";
import { MAX_COMMENT_LENGTH, validateExceptionInput } from "@/lib/validation/availability";

import { AvailabilityGrid, type ExceptionMap, type GridCalendar, type SlotStatus } from "./grid";
import { AvailabilityLegend } from "./legend";
import { SlotDialog } from "./slot-dialog";

const time = new Intl.DateTimeFormat("fr-BE", { hour: "2-digit", minute: "2-digit" });

// « dialog » : chaque clic ouvre la fenêtre. Sinon : statut appliqué au clic.
type ClickMode = "dialog" | SlotStatus;

const MODES: { value: ClickMode; label: string; swatch?: string }[] = [
  { value: "dialog", label: "Ouvrir la fenêtre" },
  { value: "UNAVAILABLE", label: "Indisponible", swatch: "border border-unavailable-edge bg-unavailable" },
  { value: "IF_NEEDED", label: "Si nécessaire", swatch: "border border-if-needed-edge bg-if-needed" },
  { value: "AVAILABLE", label: "Disponible", swatch: "border border-field bg-paper" },
];

export function AvailabilityBoard({
  resourceId,
  calendar,
  initialExceptions,
  totalSlots,
  quickMarking = false,
}: {
  resourceId: string;
  calendar: GridCalendar;
  initialExceptions: ExceptionMap;
  totalSlots: number;
  quickMarking?: boolean;
}) {
  const [exceptions, setExceptions] = useState(initialExceptions);
  const [selected, setSelected] = useState<{ date: ISODate; start: Time } | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const { message } = App.useApp();
  const [mode, setMode] = useState<ClickMode>("dialog");
  const [quickComment, setQuickComment] = useState("");
  const [commentMissing, setCommentMissing] = useState(false);
  const [, startTransition] = useTransition();

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
      const result = await saveSlot({ resourceId, date, start, status: mode, comment: quickComment });
      if (result.ok) applySaved(result.slots, true);
      else message.error(result.errors[0]?.message ?? "L'enregistrement a échoué.");
    });
  }

  const open = selected && {
    ...selected,
    end: slots.find((s) => s.start === selected.start)?.end ?? selected.start,
    status: exceptions[slotKey(selected.date, selected.start)]?.status ?? "AVAILABLE",
    comment: exceptions[slotKey(selected.date, selected.start)]?.comment ?? "",
  };

  return (
    <div className="flex flex-col gap-5">
      {quickMarking && (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-rule pb-5">
          <div className="flex flex-col gap-1.5">
            <span id="click-mode-label" className="text-[13px] font-semibold">
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
          </div>
          {(mode === "UNAVAILABLE" || mode === "IF_NEEDED") && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="quick-comment" className="text-[13px] font-semibold">
                Commentaire appliqué à chaque clic
              </label>
              <Input
                id="quick-comment"
                value={quickComment}
                onChange={(e) => {
                  setQuickComment(e.target.value);
                  setCommentMissing(false);
                }}
                maxLength={MAX_COMMENT_LENGTH}
                status={commentMissing ? "error" : undefined}
                placeholder="Par exemple : maintenance du projecteur"
                className="w-85!"
              />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <AvailabilityLegend />
        <p className="text-[15px]">
          <strong className="font-semibold">
            {count} créneau{count > 1 ? "x" : ""} signalé{count > 1 ? "s" : ""}
          </strong>{" "}
          sur {totalSlots}
        </p>
      </div>

      <AvailabilityGrid calendar={calendar} exceptions={exceptions} onSlotClick={handleClick} />

      <p role="status" className="text-sm text-graphite">
        {savedAt
          ? `Modifications enregistrées à ${time.format(savedAt)}.`
          : "Pour « si nécessaire » et « indisponible », un commentaire est demandé."}
      </p>

      {open && (
        <SlotDialog
          key={slotKey(open.date, open.start)}
          resourceId={resourceId}
          slot={open}
          onSaved={applySaved}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
