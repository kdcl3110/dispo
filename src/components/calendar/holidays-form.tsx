"use client";

// Formulaire « Jours fériés et publication » (maquette « Admin — Jours fériés »).
//
// La liste des jours retirés vit côté client : on clique dans la grille, on
// nomme les périodes, puis on enregistre le tout d'un coup. Elle part vers le
// serveur en JSON, dans un champ caché.

import { useActionState, useState } from "react";

import { saveHolidays, type HolidaysFormState } from "@/actions/calendar";
import { calendarDays, calendarWeekGrid, holidayPeriods, type ISODate } from "@/lib/slots";
import { MAX_LABEL_LENGTH } from "@/lib/validation/calendar";

const INITIAL_STATE: HolidaysFormState = { status: "idle", errors: [] };

const DAY_NAMES: Record<string, string> = {
  monday: "Lundi",
  tuesday: "Mardi",
  wednesday: "Mercredi",
  thursday: "Jeudi",
  friday: "Vendredi",
  saturday: "Samedi",
  sunday: "Dimanche",
};

const utc = (date: ISODate) => new Date(`${date}T00:00:00Z`);
const shortDate = new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric" });

const inputClass =
  "h-9 rounded-md border border-field bg-paper px-2.5 text-sm text-ink disabled:bg-desk disabled:text-graphite";

// « Du 26 octobre au 6 novembre, 10 jours » ou « Mercredi 11 novembre »
function describePeriod(from: ISODate, to: ISODate, count: number) {
  if (from === to) {
    const text = longDate.format(utc(from));
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  return `Du ${dayMonth.format(utc(from))} au ${dayMonth.format(utc(to))}, ${count} jours`;
}

export function HolidaysForm({
  calendar,
  initialHolidays,
  slotsPerDay,
  publishedAt,
  locked,
}: {
  calendar: { startDate: ISODate; endDate: ISODate; weekDays: string[] };
  initialHolidays: { date: ISODate; label: string | null }[];
  slotsPerDay: number;
  publishedAt: string | null;
  locked: boolean;
}) {
  // date → nom de la période ("" si sans nom)
  const [holidays, setHolidays] = useState<Record<ISODate, string>>(() =>
    Object.fromEntries(initialHolidays.map((h) => [h.date, h.label ?? ""])),
  );
  const [state, formAction, pending] = useActionState(saveHolidays, INITIAL_STATE);

  const entries = Object.entries(holidays).map(([date, label]) => ({ date, label }));
  const periods = holidayPeriods(calendar, entries);
  const grid = calendarWeekGrid(calendar);
  const courseDays = calendarDays({ ...calendar, holidays: [] }).length;
  const remaining = courseDays - periods.reduce((n, p) => n + p.dates.length, 0);

  function toggle(date: ISODate) {
    setHolidays((current) => {
      const next = { ...current };
      if (date in next) delete next[date];
      else next[date] = "";
      return next;
    });
  }

  function update(dates: ISODate[], label: string | null) {
    setHolidays((current) => {
      const next = { ...current };
      for (const date of dates) {
        if (label === null) delete next[date];
        else next[date] = label;
      }
      return next;
    });
  }

  const formErrors = state.status === "invalid" ? state.errors : [];

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-10 2xl:flex-row">
      <input type="hidden" name="holidays" value={JSON.stringify(entries)} />

      {/* --- Grille : jours de cours × semaines */}
      <div className="min-w-0 flex-1 overflow-x-auto">
        <table className="w-full min-w-[1000px] border-separate border-spacing-1.5">
          <thead>
            <tr>
              <th scope="col" className="w-22 border-r-2 border-b border-r-margin border-b-seyes-strong" />
              {grid.weeks.map((week, w) => (
                <th key={week.monday} scope="col" className="border-b border-seyes-strong pb-2 font-normal">
                  <span className="block font-condensed text-sm leading-none font-semibold">Sem. {w + 1}</span>
                  <span className="mt-1 block text-xs leading-none text-graphite">{shortDate.format(utc(week.monday))}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.days.map((day, d) => (
              <tr key={day}>
                <th scope="row" className="border-r-2 border-margin pr-3 text-left text-sm font-semibold">
                  {DAY_NAMES[day]}
                </th>
                {grid.weeks.map((week) => {
                  const date = week.dates[d];
                  if (!date) return <td key={week.monday} />;
                  const retired = date in holidays;
                  return (
                    <td key={week.monday} className="h-16">
                      <button
                        type="button"
                        onClick={() => toggle(date)}
                        disabled={locked}
                        aria-pressed={retired}
                        aria-label={`${longDate.format(utc(date))}${retired ? ", retiré" : ""}`}
                        className={`flex size-full cursor-pointer flex-col items-center justify-center gap-1 rounded border disabled:cursor-not-allowed ${
                          retired
                            ? "border-[#e0e4ea] bg-hatch text-graphite"
                            : "border-[#e1e7f2] bg-paper text-ink hover:border-pen"
                        }`}
                      >
                        <span className="font-condensed text-[15px] font-medium">{shortDate.format(utc(date))}</span>
                        {retired && <span className="text-xs font-semibold">Retiré</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- Colonne : périodes retirées, ajout, publication */}
      <aside className="flex flex-col gap-5 2xl:w-85 2xl:shrink-0 2xl:border-l 2xl:border-rule 2xl:pl-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Jours retirés</h2>
          <span className="text-sm text-graphite">
            {Object.keys(holidays).length} jour{Object.keys(holidays).length > 1 ? "s" : ""}
          </span>
        </div>

        {periods.length === 0 ? (
          <p className="text-sm leading-relaxed text-graphite">
            Aucun jour retiré. Cliquez sur une journée de la grille, ou ajoutez une période.
          </p>
        ) : (
          <ul className="flex flex-col border-t border-rule">
            {periods.map((period) => (
              <li key={period.from} className="flex items-center gap-3 border-b border-rule py-3">
                <div className="flex flex-1 flex-col gap-1">
                  <input
                    value={period.label}
                    onChange={(e) => update(period.dates, e.target.value)}
                    disabled={locked}
                    maxLength={MAX_LABEL_LENGTH}
                    placeholder="Nom de la période"
                    aria-label={`Nom de la période : ${describePeriod(period.from, period.to, period.dates.length)}`}
                    className="-mx-1.5 rounded px-1.5 py-0.5 text-sm font-semibold placeholder:font-normal placeholder:text-graphite hover:bg-desk focus:bg-paper disabled:hover:bg-transparent"
                  />
                  <span className="text-[13px] text-graphite">{describePeriod(period.from, period.to, period.dates.length)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => update(period.dates, null)}
                  disabled={locked}
                  aria-label={`Remettre dans le calendrier : ${period.label || describePeriod(period.from, period.to, period.dates.length)}`}
                  className="flex size-8 cursor-pointer items-center justify-center rounded-md text-graphite hover:bg-desk disabled:cursor-not-allowed"
                >
                  <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                    <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        {!locked && <AddPeriod calendar={calendar} onAdd={update} />}

        <p className="text-sm leading-relaxed text-graphite">
          Il reste <strong className="font-semibold text-ink">{remaining} jours de cours</strong> sur {courseDays}, soit{" "}
          {remaining * slotsPerDay} créneaux.
        </p>

        <div className="mt-auto flex flex-col gap-3.5 border-t border-rule pt-5">
          {formErrors.length > 0 && (
            <div role="alert" className="flex flex-col gap-1 rounded-md bg-error-tint px-4 py-3 text-sm text-unavailable">
              {formErrors.map((e) => (
                <p key={e.message}>{e.message}</p>
              ))}
            </div>
          )}
          {state.status === "saved" && <p role="status" className="text-sm text-pen">Jours retirés enregistrés.</p>}
          {state.status === "published" && (
            <p role="status" className="text-sm text-pen">
              Calendrier publié. Le personnel peut maintenant signaler ses créneaux.
            </p>
          )}

          {locked ? (
            <p className="text-sm leading-relaxed text-graphite">
              Des créneaux ont déjà été signalés : les jours retirés ne peuvent plus changer.
            </p>
          ) : publishedAt ? (
            <>
              <p className="text-sm leading-relaxed text-graphite">
                Publié le {fullDate.format(new Date(publishedAt))}. Le personnel voit les changements dès l&apos;enregistrement.
              </p>
              <button type="submit" name="intent" value="save" disabled={pending} className="h-12 w-full cursor-pointer rounded-md bg-pen text-sm font-semibold text-white hover:bg-pen-dark disabled:cursor-wait disabled:opacity-60">
                Enregistrer
              </button>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-graphite">
                Publier ouvre la saisie à tout le personnel. Ensuite, les jours retirés ne pourront plus changer dès qu&apos;un créneau sera signalé.
              </p>
              <div className="flex gap-2.5">
                <button type="submit" name="intent" value="save" disabled={pending} className="h-12 flex-1 cursor-pointer rounded-md border border-field bg-paper text-sm font-semibold hover:bg-desk disabled:cursor-wait disabled:opacity-60">
                  Enregistrer
                </button>
                <button type="submit" name="intent" value="publish" disabled={pending} className="h-12 flex-[2] cursor-pointer rounded-md bg-pen text-sm font-semibold text-white hover:bg-pen-dark disabled:cursor-wait disabled:opacity-60">
                  Publier le calendrier
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </form>
  );
}

// « Ajouter une période » : retire d'un coup tous les jours de cours d'une plage.
function AddPeriod({
  calendar,
  onAdd,
}: {
  calendar: { startDate: ISODate; endDate: ISODate; weekDays: string[] };
  onAdd: (dates: ISODate[], label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-9.5 cursor-pointer rounded-md border border-field text-[13px] font-semibold hover:bg-desk">
        Ajouter une période
      </button>
    );
  }

  function add() {
    if (!from || !to || from > to) {
      setError("Choisissez une date de début et une date de fin, dans cet ordre.");
      return;
    }
    const dates = calendarDays({
      ...calendar,
      startDate: from > calendar.startDate ? from : calendar.startDate,
      endDate: to < calendar.endDate ? to : calendar.endDate,
      holidays: [],
    });
    if (dates.length === 0) {
      setError("Aucun jour de cours dans cette plage.");
      return;
    }
    onAdd(dates, label.trim());
    setOpen(false);
    setFrom("");
    setTo("");
    setLabel("");
    setError(null);
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-rule p-3.5">
      <div className="flex gap-2.5">
        <label className="flex flex-1 flex-col gap-1 text-[13px] font-semibold">
          Du
          <input type="date" value={from} min={calendar.startDate} max={calendar.endDate} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-[13px] font-semibold">
          Au
          <input type="date" value={to} min={from || calendar.startDate} max={calendar.endDate} onChange={(e) => setTo(e.target.value)} className={inputClass} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-[13px] font-semibold">
        Nom
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={MAX_LABEL_LENGTH} placeholder="Congé d'automne" className={inputClass} />
      </label>
      {error && <p className="text-sm text-unavailable">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => { setOpen(false); setError(null); }} className="h-9 cursor-pointer rounded-md px-3 text-[13px] font-semibold text-graphite hover:bg-desk">
          Annuler
        </button>
        <button type="button" onClick={add} className="h-9 cursor-pointer rounded-md border border-pen bg-pen-tint px-3.5 text-[13px] font-semibold text-pen">
          Retirer ces jours
        </button>
      </div>
    </div>
  );
}
