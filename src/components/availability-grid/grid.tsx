"use client";

// Grille des disponibilités sur tout le calendrier (maquettes « Mes
// disponibilités » et « Admin — Disponibilités d'une ressource »).
//
// Purement affichage : elle reçoit les créneaux signalés et prévient le parent
// quand on clique sur un créneau. C'est le parent qui ouvre la fenêtre de
// saisie et met à jour les données.
//
// Sélection comme dans Excel : à la souris, on part d'une case et on glisse.
// Le rectangle couvert (semaines × créneaux, les jours se suivant de haut en
// bas) est remis au parent au relâchement, jours retirés exclus. Un clic sans
// glisser reste un clic. Au doigt, glisser fait défiler la grille.
//
// Vocabulaire visuel (papier Seyès) :
//  - vert très clair = disponible (valeur par défaut, rien en base)
//  - case blanche    = pas de cours ce jour-là (hors période, jour non coché)
//  - surligné jaune  = si nécessaire
//  - stylo rouge     = indisponible
//  - hachuré         = jour retiré (férié, congé) : pas de créneau

import { LoadingOutlined } from "@ant-design/icons";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { calendarWeekGrid, generateSlots, slotKey, type BreakRange, type ISODate, type Time } from "@/lib/slots";

export type SlotStatus = "AVAILABLE" | "IF_NEEDED" | "UNAVAILABLE";

export interface GridCalendar {
  id: string;
  startDate: ISODate;
  endDate: ISODate;
  weekDays: string[];
  dayStart: Time;
  dayEnd: Time;
  slotDuration: number;
  breaks: (BreakRange & { name: string })[];
  holidays: { date: ISODate }[];
}

// Créneaux signalés, indexés par slotKey(date, start) (src/lib/slots.ts).
export type ExceptionMap = Record<string, { status: SlotStatus; comment: string }>;

export type Cell = { date: ISODate; start: Time };

// Position d'une case : colonne (semaine) et ligne. Les lignes de tous les
// jours se suivent : ligne = jour × créneaux par jour + créneau.
type Pos = { w: number; r: number };

const DAY_NAMES: Record<string, string> = {
  monday: "Lundi",
  tuesday: "Mardi",
  wednesday: "Mercredi",
  thursday: "Jeudi",
  friday: "Vendredi",
  saturday: "Samedi",
  sunday: "Dimanche",
};

const STATUS_LABEL: Record<SlotStatus, string> = {
  AVAILABLE: "disponible",
  IF_NEEDED: "si nécessaire",
  UNAVAILABLE: "indisponible",
};

const utc = (date: ISODate) => new Date(`${date}T00:00:00Z`);
const shortDate = new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

const cellClass: Record<SlotStatus, string> = {
  AVAILABLE: "border-available-edge bg-available text-ink hover:border-pen",
  IF_NEEDED: "border-if-needed-edge bg-if-needed text-if-needed-ink",
  UNAVAILABLE: "border-unavailable-edge bg-unavailable text-white",
};

export function AvailabilityGrid({
  calendar,
  exceptions,
  onSlotClick,
  onDayClick,
  onRangeSelect,
  saving,
}: {
  calendar: GridCalendar;
  exceptions: ExceptionMap;
  onSlotClick?: (date: ISODate, start: Time) => void;
  onDayClick?: (day: string) => void; // clic sur « Lundi » : tous les lundis
  onRangeSelect?: (cells: Cell[], origin: Cell) => void; // sélection glissée
  saving?: ReadonlySet<string>; // créneaux en cours d'enregistrement (clés slotKey)
}) {
  const { days, weeks } = calendarWeekGrid({
    startDate: calendar.startDate,
    endDate: calendar.endDate,
    weekDays: calendar.weekDays,
  });
  const slots = generateSlots(calendar);
  const holidays = new Set(calendar.holidays.map((h) => h.date));
  const slotIndex = new Map(slots.map((s, i) => [s.start, i]));

  // ---- sélection glissée
  // La ref sert aux écouteurs de la fenêtre ; l'état, à redessiner la zone.
  const dragRef = useRef<{ anchor: Pos; current: Pos } | null>(null);
  const [drag, setDragState] = useState<{ anchor: Pos; current: Pos } | null>(null);
  const setDrag = (next: { anchor: Pos; current: Pos } | null) => {
    dragRef.current = next;
    setDragState(next);
  };

  const cellAt = ({ w, r }: Pos): Cell | null => {
    const date = weeks[w]?.dates[Math.floor(r / slots.length)];
    const slot = slots[r % slots.length];
    return date && slot && !holidays.has(date) ? { date, start: slot.start } : null;
  };

  const bounds = (d: { anchor: Pos; current: Pos }) => ({
    w0: Math.min(d.anchor.w, d.current.w),
    w1: Math.max(d.anchor.w, d.current.w),
    r0: Math.min(d.anchor.r, d.current.r),
    r1: Math.max(d.anchor.r, d.current.r),
  });

  const cellsIn = (d: { anchor: Pos; current: Pos }) => {
    const { w0, w1, r0, r1 } = bounds(d);
    const cells: Cell[] = [];
    for (let r = r0; r <= r1; r++) {
      for (let w = w0; w <= w1; w++) {
        const cell = cellAt({ w, r });
        if (cell) cells.push(cell);
      }
    }
    return cells;
  };

  const moved = drag !== null && (drag.anchor.w !== drag.current.w || drag.anchor.r !== drag.current.r);
  const box = moved ? bounds(drag) : null;
  const selected = (pos: Pos) => box !== null && pos.w >= box.w0 && pos.w <= box.w1 && pos.r >= box.r0 && pos.r <= box.r1;
  const selectedCount = moved ? cellsIn(drag).length : 0;

  // Case survolée : retrouvée sous le pointeur (data-cell="semaine:ligne"),
  // ce qui marche aussi entre deux cases ou sur un jour retiré.
  const onMove = useEffectEvent((e: PointerEvent) => {
    const current = dragRef.current;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-cell]");
    if (!current || !el?.dataset.cell) return;
    const [w, r] = el.dataset.cell.split(":").map(Number);
    if (w !== current.current.w || r !== current.current.r) setDrag({ ...current, current: { w, r } });
  });

  // Relâchement : sans déplacement, c'est le clic du bouton qui agit.
  const onUp = useEffectEvent(() => {
    const current = dragRef.current;
    setDrag(null);
    if (!current || (current.anchor.w === current.current.w && current.anchor.r === current.current.r)) return;
    const origin = cellAt(current.anchor);
    const cells = cellsIn(current);
    if (origin && cells.length > 0) onRangeSelect?.(cells, origin);
  });

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const cancel = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [dragging]);

  // Lignes d'une journée : les créneaux, et une ligne fine pour chaque vraie
  // pause. Les intercours (trous courts entre deux créneaux) ne prennent pas
  // de ligne : seule une pause configurée qui tombe entre deux créneaux en a une.
  const rows: ({ kind: "slot"; start: Time; end: Time } | { kind: "break"; label: string })[] = [];
  slots.forEach((slot, i) => {
    const previous = slots[i - 1];
    if (previous) {
      calendar.breaks
        .filter((b) => b.start >= previous.end && b.start < slot.start)
        .sort((a, b) => a.start.localeCompare(b.start))
        .forEach((b) => rows.push({ kind: "break", label: `${b.name || "Pause"}, ${b.start}–${b.end}` }));
    }
    rows.push({ kind: "slot", start: slot.start, end: slot.end });
  });
  const lastSlot = rows.findLastIndex((r) => r.kind === "slot");

  // Le cadre défile dans les deux sens ; la ligne des semaines reste figée en
  // haut, et les colonnes jour / horaire restent figées à gauche (sticky).
  // Le parent décide de la hauteur : la grille prend la place restante.
  const stickyLeft = "sticky z-10 bg-paper";
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {moved && (
        <p
          role="status"
          className="pointer-events-none absolute bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-medium text-white shadow-lg"
        >
          {selectedCount} créneau{selectedCount > 1 ? "x" : ""} sélectionné{selectedCount > 1 ? "s" : ""}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-rule">
        <table className={`w-full min-w-[1100px] border-separate border-spacing-0 ${dragging ? "select-none" : ""}`}>
          <thead>
            <tr>
              <th
                scope="col"
                colSpan={2}
                className="sticky top-0 left-0 z-30 w-49 border-r-2 border-b border-r-margin border-b-seyes-strong bg-paper"
              >
                <span className="sr-only">Jour et horaire</span>
              </th>
              {weeks.map((week, w) => (
                <th key={week.monday} scope="col" className="sticky top-0 z-20 h-10 border-b border-seyes-strong bg-paper px-0.5 font-normal">
                  <span className="block font-condensed text-[13px] leading-none font-semibold">Sem. {w + 1}</span>
                  <span className="mt-0.5 block text-[11px] leading-none text-graphite">{shortDate.format(utc(week.monday))}</span>
                </th>
              ))}
            </tr>
          </thead>

          {days.map((day, d) => (
            <tbody key={day}>
              {rows.map((row, r) => {
                const isLastOfDay = r === lastSlot;
                const rule = isLastOfDay ? "border-b-seyes-strong" : "border-b-seyes";

                if (row.kind === "break") {
                  return (
                    <tr key={`break-${r}`} className="h-4">
                      <td className={`${stickyLeft} left-0 border-b ${rule}`} />
                      <td className={`${stickyLeft} left-19 border-r-2 border-b border-r-margin ${rule} pr-3 text-right text-[11px] leading-none text-graphite`}>
                        {row.label}
                      </td>
                      <td colSpan={weeks.length} className={`border-b ${rule}`} />
                    </tr>
                  );
                }

                return (
                  <tr key={row.start} className="h-[30px]">
                    <th scope="row" className={`${stickyLeft} left-0 w-19 border-b ${rule} pl-4 text-left align-middle text-[13px] font-semibold`}>
                      {r === 0 &&
                        (onDayClick ? (
                          <button
                            type="button"
                            onClick={() => onDayClick(day)}
                            title={`Signaler tous les ${DAY_NAMES[day].toLowerCase()}s`}
                            className="cursor-pointer rounded-[3px] text-left font-semibold text-pen underline decoration-dotted underline-offset-4 hover:decoration-solid"
                          >
                            {DAY_NAMES[day]}
                          </button>
                        ) : (
                          DAY_NAMES[day]
                        ))}
                    </th>
                    <th scope="row" className={`${stickyLeft} left-19 w-30 border-r-2 border-b border-r-margin ${rule} pr-3 text-right font-condensed text-[13px] font-medium text-graphite`}>
                      {row.start}–{row.end}
                    </th>
                    {weeks.map((week, w) => {
                      const date = week.dates[d];
                      const pos = { w, r: d * slots.length + (slotIndex.get(row.start) ?? 0) };
                      const dataCell = `${pos.w}:${pos.r}`;
                      const cell = `border-b ${rule} px-0.5 py-[3px] ${weeks[0] === week ? "pl-2" : ""} ${weeks.at(-1) === week ? "pr-3" : ""}`;

                      if (!date) return <td key={week.monday} data-cell={dataCell} className={cell} />;

                      if (holidays.has(date)) {
                        return (
                          <td key={week.monday} data-cell={dataCell} className={cell}>
                            <span className="flex h-6 items-center justify-center rounded-[3px] border border-[#e0e4ea] bg-hatch text-[11px] font-semibold text-graphite">
                              Férié
                            </span>
                          </td>
                        );
                      }

                      const exception = exceptions[slotKey(date, row.start)];
                      const busy = saving?.has(slotKey(date, row.start)) ?? false;
                      const status: SlotStatus = exception?.status ?? "AVAILABLE";
                      const description = `${longDate.format(utc(date))}, ${row.start}–${row.end} : ${STATUS_LABEL[status]}${exception?.comment ? ` (${exception.comment})` : ""}`;

                      return (
                        <td key={week.monday} data-cell={dataCell} className={cell}>
                          <button
                            type="button"
                            onClick={() => onSlotClick?.(date, row.start)}
                            onPointerDown={(e) => {
                              // Souris ou stylet seulement : au doigt, glisser fait défiler.
                              if (!onRangeSelect || busy || e.pointerType === "touch" || e.button !== 0) return;
                              e.preventDefault(); // pas de sélection de texte pendant le glissé
                              setDrag({ anchor: pos, current: pos });
                            }}
                            disabled={!onSlotClick || busy}
                            aria-label={description}
                            aria-busy={busy || undefined}
                            title={exception?.comment || undefined}
                            className={`flex h-6 w-full cursor-pointer items-center justify-center gap-1.5 rounded-[3px] border text-[11px] font-semibold disabled:cursor-default ${cellClass[status]} ${busy ? "animate-pulse" : ""} ${selected(pos) ? "outline-2 outline-offset-1 outline-pen" : ""}`}
                          >
                            {/* En cours d'enregistrement : la case a déjà sa nouvelle couleur. */}
                            {busy && <LoadingOutlined aria-hidden="true" className="text-[11px]" />}
                            {status === "IF_NEEDED" && "Si nécessaire"}
                            {status === "UNAVAILABLE" && "Indisponible"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
