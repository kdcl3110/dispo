"use client";

// Grille des disponibilités sur tout le calendrier (maquettes « Mes
// disponibilités » et « Admin — Disponibilités d'une ressource »).
//
// Purement affichage : elle reçoit les créneaux signalés et prévient le parent
// quand on clique sur un créneau. C'est le parent qui ouvre la fenêtre de
// saisie et met à jour les données.
//
// Vocabulaire visuel (papier Seyès) :
//  - case vide       = disponible (valeur par défaut, rien en base)
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
  AVAILABLE: "border-[#e1e7f2] bg-paper text-ink hover:border-pen",
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

  // Lignes d'une journée : les créneaux, et une ligne fine pour chaque pause.
  const rows: ({ kind: "slot"; start: Time; end: Time } | { kind: "break"; label: string })[] = [];
  slots.forEach((slot, i) => {
    const previous = slots[i - 1];
    if (previous && previous.end !== slot.start) {
      const pause = calendar.breaks.find((b) => b.start === previous.end);
      rows.push({ kind: "break", label: pause?.name || "Pause" });
    }
    rows.push({ kind: "slot", start: slot.start, end: slot.end });
  });
  const lastSlot = rows.findLastIndex((r) => r.kind === "slot");

  return (
    <div className="overflow-x-auto rounded-lg border border-rule px-5 pt-1 pb-4">
      <table className="w-full min-w-[1100px] border-separate border-spacing-0">
        <thead>
          <tr>
            <th scope="col" colSpan={2} className="w-49 border-r-2 border-b border-r-margin border-b-seyes-strong">
              <span className="sr-only">Jour et horaire</span>
            </th>
            {weeks.map((week, w) => (
              <th key={week.monday} scope="col" className="h-13 border-b border-seyes-strong px-0.5 font-normal">
                <span className="block font-condensed text-sm leading-none font-semibold">Sem. {w + 1}</span>
                <span className="mt-1 block text-xs leading-none text-graphite">{shortDate.format(utc(week.monday))}</span>
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
                  <tr key={`break-${r}`} className="h-5.5">
                    <td className={`border-b ${rule}`} />
                    <td className={`border-r-2 border-b border-r-margin ${rule} pr-3 text-right text-xs text-graphite`}>{row.label}</td>
                    <td colSpan={weeks.length} className={`border-b ${rule}`} />
                  </tr>
                );
              }

              return (
                <tr key={row.start} className="h-9">
                  <th scope="row" className={`w-19 border-b ${rule} text-left align-middle text-sm font-semibold`}>
                    {r === 0 && DAY_NAMES[day]}
                  </th>
                  <th scope="row" className={`w-30 border-r-2 border-b border-r-margin ${rule} pr-3 text-right font-condensed text-sm font-medium text-graphite`}>
                    {row.start}–{row.end}
                  </th>
                  {weeks.map((week) => {
                    const date = week.dates[d];
                    const cell = `border-b ${rule} px-0.5 py-1 ${weeks[0] === week ? "pl-2" : ""}`;

                    if (!date) return <td key={week.monday} className={cell} />;

                    if (holidays.has(date)) {
                      return (
                        <td key={week.monday} className={cell}>
                          <span className="flex h-7 items-center justify-center rounded-[3px] border border-[#e0e4ea] bg-hatch text-xs font-semibold text-graphite">
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
                          className={`flex h-7 w-full cursor-pointer items-center justify-center rounded-[3px] border text-xs font-semibold disabled:cursor-default ${cellClass[status]}`}
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
