"use client";

// Grille des disponibilités sur tout le calendrier (maquettes « Mes
// disponibilités » et « Admin — Disponibilités d'une ressource »).
//
// Purement affichage : elle reçoit les créneaux signalés et prévient le parent
// quand on clique sur un créneau. C'est le parent qui ouvre la fenêtre de
// saisie et met à jour les données.
//
// Vocabulaire visuel (papier Seyès) :
//  - vert très clair = disponible (valeur par défaut, rien en base)
//  - case blanche    = pas de cours ce jour-là (hors période, jour non coché)
//  - surligné jaune  = si nécessaire
//  - stylo rouge     = indisponible
//  - hachuré         = jour retiré (férié, congé) : pas de créneau

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
}: {
  calendar: GridCalendar;
  exceptions: ExceptionMap;
  onSlotClick?: (date: ISODate, start: Time) => void;
}) {
  const { days, weeks } = calendarWeekGrid({
    startDate: calendar.startDate,
    endDate: calendar.endDate,
    weekDays: calendar.weekDays,
  });
  const slots = generateSlots(calendar);
  const holidays = new Set(calendar.holidays.map((h) => h.date));

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
    <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-rule">
      <table className="w-full min-w-[1100px] border-separate border-spacing-0">
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
                    {r === 0 && DAY_NAMES[day]}
                  </th>
                  <th scope="row" className={`${stickyLeft} left-19 w-30 border-r-2 border-b border-r-margin ${rule} pr-3 text-right font-condensed text-[13px] font-medium text-graphite`}>
                    {row.start}–{row.end}
                  </th>
                  {weeks.map((week) => {
                    const date = week.dates[d];
                    const cell = `border-b ${rule} px-0.5 py-[3px] ${weeks[0] === week ? "pl-2" : ""} ${weeks.at(-1) === week ? "pr-3" : ""}`;

                    if (!date) return <td key={week.monday} className={cell} />;

                    if (holidays.has(date)) {
                      return (
                        <td key={week.monday} className={cell}>
                          <span className="flex h-6 items-center justify-center rounded-[3px] border border-[#e0e4ea] bg-hatch text-[11px] font-semibold text-graphite">
                            Férié
                          </span>
                        </td>
                      );
                    }

                    const exception = exceptions[slotKey(date, row.start)];
                    const status: SlotStatus = exception?.status ?? "AVAILABLE";
                    const description = `${longDate.format(utc(date))}, ${row.start}–${row.end} : ${STATUS_LABEL[status]}${exception?.comment ? ` (${exception.comment})` : ""}`;

                    return (
                      <td key={week.monday} className={cell}>
                        <button
                          type="button"
                          onClick={() => onSlotClick?.(date, row.start)}
                          disabled={!onSlotClick}
                          aria-label={description}
                          title={exception?.comment || undefined}
                          className={`flex h-6 w-full cursor-pointer items-center justify-center rounded-[3px] border text-[11px] font-semibold disabled:cursor-default ${cellClass[status]}`}
                        >
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
  );
}
