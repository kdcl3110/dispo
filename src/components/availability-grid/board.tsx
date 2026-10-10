"use client";

// Tableau de saisie : relie la grille et la fenêtre « Signaler un créneau »,
// et garde les créneaux signalés à jour après chaque enregistrement, sans
// recharger la page. Partagé par le personnel et l'administration.

import { useState } from "react";

import type { SlotState } from "@/actions/availability";
import { generateSlots, slotKey, type ISODate, type Time } from "@/lib/slots";

import { AvailabilityGrid, type ExceptionMap, type GridCalendar } from "./grid";
import { AvailabilityLegend } from "./legend";
import { SlotDialog } from "./slot-dialog";

const time = new Intl.DateTimeFormat("fr-BE", { hour: "2-digit", minute: "2-digit" });

export function AvailabilityBoard({
  resourceId,
  calendar,
  initialExceptions,
  totalSlots,
}: {
  resourceId: string;
  calendar: GridCalendar;
  initialExceptions: ExceptionMap;
  totalSlots: number;
}) {
  const [exceptions, setExceptions] = useState(initialExceptions);
  const [selected, setSelected] = useState<{ date: ISODate; start: Time } | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const slots = generateSlots(calendar);
  const count = Object.keys(exceptions).length;

  function applySaved(saved: SlotState[]) {
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
  }

  const open = selected && {
    ...selected,
    end: slots.find((s) => s.start === selected.start)?.end ?? selected.start,
    status: exceptions[slotKey(selected.date, selected.start)]?.status ?? "AVAILABLE",
    comment: exceptions[slotKey(selected.date, selected.start)]?.comment ?? "",
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <AvailabilityLegend />
        <p className="text-[15px]">
          <strong className="font-semibold">
            {count} créneau{count > 1 ? "x" : ""} signalé{count > 1 ? "s" : ""}
          </strong>{" "}
          sur {totalSlots}
        </p>
      </div>

      <AvailabilityGrid calendar={calendar} exceptions={exceptions} onSlotClick={(date, start) => setSelected({ date, start })} />

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
