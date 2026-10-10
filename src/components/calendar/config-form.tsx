"use client";

// Formulaire « Configuration du calendrier » (maquette « Admin — Configuration »).
//
// Les champs sont contrôlés : l'aperçu d'une journée et le compte des semaines
// se recalculent à chaque frappe. Les erreurs n'apparaissent qu'après un
// premier envoi refusé ; elles suivent ensuite la saisie en direct, avec les
// mêmes règles que le serveur (src/lib/validation/calendar.ts).

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";

import { saveCalendar, type CalendarFormState } from "@/actions/calendar";
import type { CalendarConfig } from "@/lib/calendar";
import { calendarDays, generateSlots, toMin } from "@/lib/slots";
import {
  breakEndSuggestions,
  calendarWeeks,
  MAX_WEEKS,
  validateCalendarForm,
  type ValidationError,
} from "@/lib/validation/calendar";

const WEEK_DAYS = [
  ["monday", "lun."],
  ["tuesday", "mar."],
  ["wednesday", "mer."],
  ["thursday", "jeu."],
  ["friday", "ven."],
  ["saturday", "sam."],
  ["sunday", "dim."],
] as const;

const DURATIONS = [
  [30, "30 minutes"],
  [60, "1 heure"],
  [90, "1 h 30"],
  [120, "2 heures"],
] as const;

// Valeurs proposées tant qu'aucun calendrier n'existe.
const DEFAULTS: CalendarConfig = {
  name: "",
  startDate: "",
  endDate: "",
  weekDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  dayStart: "08:00",
  dayEnd: "18:00",
  slotDuration: 120,
  breaks: [{ name: "Pause déjeuner", start: "12:00", end: "14:00" }],
};

const INITIAL_STATE: CalendarFormState = { status: "idle", errors: [] };

const inputClass =
  "h-10 rounded-md border border-field bg-paper px-3 text-sm text-ink disabled:bg-desk disabled:text-graphite aria-invalid:border-2 aria-invalid:border-unavailable";
const labelClass = "text-[13px] font-semibold";
const legendClass = "mb-2 text-[13px] font-semibold";

// `key` ne sert qu'à React pour suivre les lignes de pause ajoutées/retirées.
type BreakRow = CalendarConfig["breaks"][number] & { key: number };

export function CalendarConfigForm({
  initial,
  holidays,
  locked,
  status,
}: {
  initial: CalendarConfig | null;
  holidays: { date: string }[];
  locked: boolean;
  status: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(saveCalendar, INITIAL_STATE);

  // Après un envoi refusé sans JavaScript, la page est rendue à nouveau avec
  // l'état de l'action : on repart alors de la saisie, pas de la base.
  const source = state.values ?? initial ?? DEFAULTS;
  const [fields, setFields] = useState(() => ({
    name: source.name,
    startDate: source.startDate,
    endDate: source.endDate,
    weekDays: source.weekDays,
    dayStart: source.dayStart,
    dayEnd: source.dayEnd,
    slotDuration: source.slotDuration,
  }));
  const [breaks, setBreaks] = useState<BreakRow[]>(() => source.breaks.map((b, key) => ({ ...b, key })));

  const config: CalendarConfig = { ...fields, breaks: breaks.map(({ name, start, end }) => ({ name, start, end })) };
  const set = <K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) =>
    setFields((f) => ({ ...f, [key]: value }));
  const setBreak = (key: number, patch: Partial<BreakRow>) =>
    setBreaks((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  // --- Erreurs : en direct, mais seulement après un premier envoi refusé.
  const liveErrors = validateCalendarForm(config, holidays);
  const errors: ValidationError[] =
    state.status === "invalid" ? [...liveErrors, ...state.errors.filter((e) => e.field === "form")] : [];
  const errorsFor = (field: string) => errors.filter((e) => e.field === field).map((e) => e.message);

  // --- Calculs en direct pour l'aperçu, seulement sur des données cohérentes.
  const hasError = (test: (field: string) => boolean) => liveErrors.some((e) => test(e.field));
  const gridOk = !hasError((f) => ["dayStart", "dayEnd", "slotDuration"].includes(f) || f.startsWith("breaks."));
  const periodOk = !hasError((f) => ["startDate", "endDate", "weekDays"].includes(f));
  const datesOk = /^\d{4}-\d{2}-\d{2}$/.test(config.startDate) && /^\d{4}-\d{2}-\d{2}$/.test(config.endDate) && config.startDate <= config.endDate;

  const weeks = datesOk ? calendarWeeks(config.startDate, config.endDate) : null;
  const slots = gridOk ? generateSlots(config) : [];
  const dayCount = periodOk && datesOk ? calendarDays({ ...config, holidays: holidays.map((h) => h.date) }).length : null;

  const preview = [
    ...slots.map((s) => ({ start: s.start, label: `${s.start}–${s.end}`, isBreak: false })),
    ...config.breaks.map((b) => ({ start: b.start, label: `${b.name || "Pause"}, ${b.start}–${b.end}`, isBreak: true })),
  ].sort((a, b) => toMin(a.start) - toMin(b.start));

  const formErrors = errorsFor("form");

  return (
    <div className="flex flex-1 flex-col gap-10 lg:flex-row">
      <form action={formAction} noValidate className="flex flex-1 flex-col gap-6">
        {formErrors.length > 0 && (
          <p role="alert" className="rounded-md bg-error-tint px-4 py-3 text-sm text-unavailable">
            {formErrors.join(" ")}
          </p>
        )}

        {/* disabled sur le fieldset : tous les champs suivent d'un coup. */}
        <fieldset disabled={locked} className="flex flex-col gap-6">
          <Field id="name" label="Nom du calendrier" errors={errorsFor("name")}>
            {(props) => (
              <input
                {...props}
                name="name"
                value={fields.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Quadrimestre 1, 2026-2027"
                className={`${inputClass} h-11 text-[15px]`}
              />
            )}
          </Field>

          <fieldset>
            <legend className={legendClass}>Période</legend>
            <div className="flex flex-wrap items-start gap-4">
              <Field id="startDate" label="Date de début" errors={errorsFor("startDate")} grow>
                {(props) => (
                  <input {...props} type="date" name="startDate" value={fields.startDate} onChange={(e) => set("startDate", e.target.value)} className={inputClass} />
                )}
              </Field>
              <Field id="endDate" label="Date de fin" errors={errorsFor("endDate")} grow>
                {(props) => (
                  <input {...props} type="date" name="endDate" value={fields.endDate} onChange={(e) => set("endDate", e.target.value)} className={inputClass} />
                )}
              </Field>
              <p aria-live="polite" className={`mt-7 flex h-10 w-40 items-center text-sm ${weeks !== null && weeks > MAX_WEEKS ? "text-unavailable" : "text-graphite"}`}>
                {weeks !== null && `${weeks} semaine${weeks > 1 ? "s" : ""} sur ${MAX_WEEKS}`}
              </p>
            </div>
            <Errors id="period-error" messages={errorsFor("period")} />
          </fieldset>

          <fieldset aria-describedby={errorsFor("weekDays").length ? "weekDays-error" : undefined}>
            <legend className={legendClass}>Jours de cours</legend>
            <div className="flex flex-wrap gap-2">
              {WEEK_DAYS.map(([value, label]) => (
                <label
                  key={value}
                  className="flex h-10 min-w-16 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-field text-sm font-semibold text-graphite has-checked:border-pen has-checked:bg-pen-tint has-checked:text-pen has-disabled:cursor-not-allowed"
                >
                  <input
                    type="checkbox"
                    name="weekDays"
                    value={value}
                    checked={fields.weekDays.includes(value)}
                    onChange={(e) =>
                      set(
                        "weekDays",
                        e.target.checked ? [...fields.weekDays, value] : fields.weekDays.filter((d) => d !== value),
                      )
                    }
                    className="size-3.5 accent-pen"
                  />
                  {label}
                </label>
              ))}
            </div>
            <Errors id="weekDays-error" messages={errorsFor("weekDays")} />
          </fieldset>

          <fieldset>
            <legend className={legendClass}>Horaires</legend>
            <div className="flex flex-wrap items-start gap-4">
              <Field id="dayStart" label="Début de journée" errors={errorsFor("dayStart")} grow>
                {(props) => (
                  <input {...props} type="time" name="dayStart" value={fields.dayStart} onChange={(e) => set("dayStart", e.target.value)} className={inputClass} />
                )}
              </Field>
              <Field id="dayEnd" label="Fin de journée" errors={errorsFor("dayEnd")} grow>
                {(props) => (
                  <input {...props} type="time" name="dayEnd" value={fields.dayEnd} onChange={(e) => set("dayEnd", e.target.value)} className={inputClass} />
                )}
              </Field>
              <Field id="slotDuration" label="Durée d'un créneau" errors={errorsFor("slotDuration")} grow>
                {(props) => (
                  <select {...props} name="slotDuration" value={fields.slotDuration} onChange={(e) => set("slotDuration", Number(e.target.value))} className={inputClass}>
                    {DURATIONS.map(([minutes, label]) => (
                      <option key={minutes} value={minutes}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2.5">
            <legend className={legendClass}>Pauses</legend>
            <p className="-mt-1 text-[13px] text-graphite">Aucun créneau n&apos;est proposé pendant une pause.</p>

            {breaks.map((row, i) => {
              const messages = [...errorsFor(`breaks.${i}.name`), ...errorsFor(`breaks.${i}.start`), ...errorsFor(`breaks.${i}.end`)];
              const endInvalid = errorsFor(`breaks.${i}.end`).length > 0;
              const suggestions = endInvalid ? breakEndSuggestions(config, i) : [];
              const errorId = `breaks-${i}-error`;
              return (
                <div key={row.key} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <input
                      name={`breaks.${i}.name`}
                      value={row.name}
                      onChange={(e) => setBreak(row.key, { name: e.target.value })}
                      aria-label={`Nom de la pause ${i + 1}`}
                      aria-invalid={errorsFor(`breaks.${i}.name`).length > 0 || undefined}
                      aria-describedby={messages.length ? errorId : undefined}
                      placeholder="Pause déjeuner"
                      className={`${inputClass} min-w-40 flex-1`}
                    />
                    <input
                      type="time"
                      name={`breaks.${i}.start`}
                      value={row.start}
                      onChange={(e) => setBreak(row.key, { start: e.target.value })}
                      aria-label={`Début de la pause ${i + 1}`}
                      aria-invalid={errorsFor(`breaks.${i}.start`).length > 0 || undefined}
                      aria-describedby={messages.length ? errorId : undefined}
                      className={`${inputClass} w-29`}
                    />
                    <span className="text-sm text-graphite">à</span>
                    <input
                      type="time"
                      name={`breaks.${i}.end`}
                      value={row.end}
                      onChange={(e) => setBreak(row.key, { end: e.target.value })}
                      aria-label={`Fin de la pause ${i + 1}`}
                      aria-invalid={endInvalid || undefined}
                      aria-describedby={messages.length ? errorId : undefined}
                      className={`${inputClass} w-29`}
                    />
                    <button
                      type="button"
                      onClick={() => setBreaks((rows) => rows.filter((r) => r.key !== row.key))}
                      aria-label={`Supprimer la pause ${row.name || i + 1}`}
                      className="flex size-10 cursor-pointer items-center justify-center rounded-md border border-field text-graphite hover:bg-desk disabled:cursor-not-allowed"
                    >
                      <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                        <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" />
                      </svg>
                    </button>
                  </div>
                  <Errors id={errorId} messages={messages} />
                  {suggestions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-sm text-graphite">Fins de pause qui fonctionnent :</span>
                      {suggestions.map((time) => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => setBreak(row.key, { end: time })}
                          className="h-8.5 cursor-pointer rounded-md border border-field px-3.5 text-sm hover:bg-desk"
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={() =>
                setBreaks((rows) => [...rows, { name: "", start: "", end: "", key: Math.max(-1, ...rows.map((r) => r.key)) + 1 }])
              }
              className="h-9 cursor-pointer self-start rounded-md border border-field px-3.5 text-[13px] font-semibold hover:bg-desk disabled:cursor-not-allowed"
            >
              Ajouter une pause
            </button>
          </fieldset>
        </fieldset>

        <div className="mt-auto flex flex-wrap items-center justify-end gap-3 border-t border-rule pt-5">
          {state.status === "saved" && (
            <p role="status" className="mr-auto text-sm text-pen">
              Configuration enregistrée.
            </p>
          )}
          {locked ? (
            <Link href="/admin/calendar/holidays" className="inline-flex h-11 items-center rounded-md bg-pen px-5 text-sm font-semibold text-white no-underline hover:bg-pen-dark hover:text-white">
              Aller aux jours fériés
            </Link>
          ) : (
            <>
              <button type="submit" name="intent" value="save" disabled={pending} className="h-11 cursor-pointer rounded-md border border-field bg-paper px-5 text-sm font-semibold hover:bg-desk disabled:cursor-wait disabled:opacity-60">
                Enregistrer le brouillon
              </button>
              <button type="submit" name="intent" value="continue" disabled={pending} className="h-11 cursor-pointer rounded-md bg-pen px-5 text-sm font-semibold text-white hover:bg-pen-dark disabled:cursor-wait disabled:opacity-60">
                Enregistrer et continuer
              </button>
            </>
          )}
        </div>
      </form>

      <aside className="flex flex-col gap-5 lg:w-75 lg:shrink-0 lg:border-l lg:border-rule lg:pl-8">
        {status}

        <div className="flex flex-col gap-2.5">
          <h2 className="text-base font-semibold">Aperçu d&apos;une journée</h2>
          {gridOk ? (
            <ul className="flex flex-col border-t border-seyes-strong">
              {preview.map((row) => (
                <li
                  key={`${row.isBreak ? "b" : "s"}-${row.start}`}
                  className={`flex h-9 items-center border-b border-seyes px-2.5 font-condensed text-sm font-medium ${row.isBreak ? "bg-hatch text-graphite" : "text-ink"}`}
                >
                  {row.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-graphite">Corrigez les horaires pour voir la journée.</p>
          )}
          {gridOk && dayCount !== null && (
            <p className="text-[13px] leading-normal text-graphite">
              {dayCount} jours de cours, {slots.length} créneaux par jour, {dayCount * slots.length} créneaux en tout.
            </p>
          )}
        </div>

        {gridOk && (
          <p className="flex gap-2 text-[13px] leading-normal text-pen">
            <svg className="mt-0.5 shrink-0" width="12" height="12" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3.4 9.4l3.4 3.4L14.6 4.6" />
            </svg>
            La journée se découpe sans reste : aucun créneau n&apos;est coupé.
          </p>
        )}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------- petites pièces

// Un champ : libellé + contrôle + erreurs. Le contrôle reçoit les attributs
// d'accessibilité (id, aria-invalid, aria-describedby) par `props`.
function Field({
  id,
  label,
  errors,
  grow,
  children,
}: {
  id: string;
  label: string;
  errors: string[];
  grow?: boolean;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const errorId = `${id}-error`;
  return (
    <div className={`flex flex-col gap-1.5 ${grow ? "min-w-40 flex-1" : ""}`}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children({
        id,
        "aria-invalid": errors.length > 0 || undefined,
        "aria-describedby": errors.length > 0 ? errorId : undefined,
      })}
      <Errors id={errorId} messages={errors} />
    </div>
  );
}

function Errors({ id, messages }: { id: string; messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div id={id} className="mt-1 flex flex-col gap-1">
      {messages.map((message) => (
        <p key={message} className="flex gap-2 text-sm leading-normal text-unavailable">
          <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <circle cx="9" cy="9" r="6.9" />
            <path d="M9 5.4v4.2M9 12.3h.01" />
          </svg>
          {message}
        </p>
      ))}
    </div>
  );
}
