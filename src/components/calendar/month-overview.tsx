// Aperçu du calendrier mois par mois : les jours de cours en blanc, les
// congés hachurés, le reste effacé. Purement visuel (aria-hidden) : la liste
// des congés à côté porte l'information pour les lecteurs d'écran.

import { addDays, weekDayOf, type ISODate } from "@/lib/slots";

const monthName = new Intl.DateTimeFormat("fr-BE", { month: "long", year: "numeric", timeZone: "UTC" });
const HEADERS = ["L", "M", "M", "J", "V", "S", "D"];

type DayKind = "course" | "holiday" | "off";

export function MonthOverview({
  calendar,
  holidays,
}: {
  calendar: { startDate: ISODate; endDate: ISODate; weekDays: string[] };
  holidays: ISODate[];
}) {
  const retired = new Set(holidays);

  // Premiers jours de chaque mois couvert par la période.
  const months: ISODate[] = [];
  for (let m = `${calendar.startDate.slice(0, 7)}-01`; m <= calendar.endDate; ) {
    months.push(m);
    const d = new Date(`${m}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 1);
    m = d.toISOString().slice(0, 10);
  }

  const kindOf = (date: ISODate): DayKind => {
    if (date < calendar.startDate || date > calendar.endDate) return "off";
    if (!calendar.weekDays.includes(weekDayOf(date))) return "off";
    return retired.has(date) ? "holiday" : "course";
  };

  return (
    <div aria-hidden="true" className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-x-6 gap-y-5">
      {months.map((first) => {
        // Cases vides avant le 1er (semaine commençant le lundi).
        const offset = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
        const days: ISODate[] = [];
        for (let d = first; d.slice(0, 7) === first.slice(0, 7); d = addDays(d, 1)) days.push(d);

        return (
          <div key={first} className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold capitalize">{monthName.format(new Date(`${first}T00:00:00Z`))}</span>
            <div className="grid grid-cols-7 gap-1 text-center">
              {HEADERS.map((h, i) => (
                <span key={i} className="font-condensed text-[11px] text-graphite">
                  {h}
                </span>
              ))}
              {Array.from({ length: offset }, (_, i) => (
                <span key={`empty-${i}`} />
              ))}
              {days.map((date) => {
                const kind = kindOf(date);
                return (
                  <span
                    key={date}
                    className={`flex h-5.5 items-center justify-center rounded-[3px] font-condensed text-[11px] ${
                      kind === "course"
                        ? "border border-[#e1e7f2] bg-paper text-ink"
                        : kind === "holiday"
                          ? "border border-[#e0e4ea] bg-hatch text-graphite"
                          : "text-graphite/40"
                    }`}
                  >
                    {Number(date.slice(8))}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
