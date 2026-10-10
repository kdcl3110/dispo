"use client";

// Formulaire « Configuration du calendrier » (maquette « Admin — Configuration »),
// en composants Ant Design.
//
// Ant gère la saisie (dates et heures en objets dayjs) ; à l'envoi, on
// convertit en chaînes ("2026-09-14", "08:00") et on appelle la Server Action.
// Les règles sont celles du serveur (src/lib/validation/calendar.ts) : vérifiées
// avant l'envoi, puis en direct à chaque modification après un premier refus.

import { Alert, App, Button, Checkbox, DatePicker, Form, Input, Select, TimePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useState, useTransition } from "react";

import { saveCalendar } from "@/actions/calendar";
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
  { value: "monday", label: "lun." },
  { value: "tuesday", label: "mar." },
  { value: "wednesday", label: "mer." },
  { value: "thursday", label: "jeu." },
  { value: "friday", label: "ven." },
  { value: "saturday", label: "sam." },
  { value: "sunday", label: "dim." },
];

const DURATIONS = [
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 heure" },
  { value: 90, label: "1 h 30" },
  { value: 120, label: "2 heures" },
];

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

// ---------------------------------------------------------------- conversions

interface FormValues {
  name: string;
  period: [Dayjs, Dayjs] | null;
  weekDays: string[];
  dayStart: Dayjs | null;
  dayEnd: Dayjs | null;
  slotDuration: number;
  breaks: { name: string; start: Dayjs | null; end: Dayjs | null }[];
}

const toTime = (time: string) => (time ? dayjs(`1970-01-01T${time}:00`) : null);

function toValues(config: CalendarConfig): FormValues {
  return {
    name: config.name,
    period: config.startDate && config.endDate ? [dayjs(config.startDate), dayjs(config.endDate)] : null,
    weekDays: config.weekDays,
    dayStart: toTime(config.dayStart),
    dayEnd: toTime(config.dayEnd),
    slotDuration: config.slotDuration,
    breaks: config.breaks.map((b) => ({ name: b.name, start: toTime(b.start), end: toTime(b.end) })),
  };
}

function toConfig(values: Partial<FormValues>): CalendarConfig {
  return {
    name: values.name ?? "",
    startDate: values.period?.[0]?.format("YYYY-MM-DD") ?? "",
    endDate: values.period?.[1]?.format("YYYY-MM-DD") ?? "",
    weekDays: values.weekDays ?? [],
    dayStart: values.dayStart?.format("HH:mm") ?? "",
    dayEnd: values.dayEnd?.format("HH:mm") ?? "",
    slotDuration: values.slotDuration ?? 0,
    breaks: (values.breaks ?? []).map((b) => ({
      name: b?.name ?? "",
      start: b?.start?.format("HH:mm") ?? "",
      end: b?.end?.format("HH:mm") ?? "",
    })),
  };
}

// Même format que le <form> d'origine : l'action serveur n'a pas changé.
function toFormData(config: CalendarConfig) {
  const data = new FormData();
  data.set("name", config.name);
  data.set("startDate", config.startDate);
  data.set("endDate", config.endDate);
  config.weekDays.forEach((day) => data.append("weekDays", day));
  data.set("dayStart", config.dayStart);
  data.set("dayEnd", config.dayEnd);
  data.set("slotDuration", String(config.slotDuration));
  config.breaks.forEach((b, i) => {
    data.set(`breaks.${i}.name`, b.name);
    data.set(`breaks.${i}.start`, b.start);
    data.set(`breaks.${i}.end`, b.end);
  });
  return data;
}

// Champ d'erreur côté serveur → chemin du champ Ant ("breaks.0.end" → ["breaks", 0, "end"]).
// Les deux dates n'ont qu'un champ ici : la plage « Période ».
function fieldPath(field: string): (string | number)[] | null {
  if (field === "form") return null;
  if (field === "startDate" || field === "endDate" || field === "period") return ["period"];
  return field.split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

const timePicker = { format: "HH:mm", minuteStep: 15, needConfirm: false, showNow: false } as const;

// ---------------------------------------------------------------- formulaire

export function CalendarConfigForm({
  initial,
  holidays,
  locked,
  onSaved,
}: {
  initial: CalendarConfig | null;
  holidays: { date: string }[];
  locked: boolean;
  onSaved?: () => void;
}) {
  const [form] = Form.useForm<FormValues>();
  const { message } = App.useApp();
  const [initialValues] = useState(() => toValues(initial ?? DEFAULTS));
  const watched = Form.useWatch([], form) as Partial<FormValues> | undefined;
  const config = toConfig(watched ?? initialValues);

  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [checking, setChecking] = useState(false); // vrai après un premier envoi refusé
  const [pending, startTransition] = useTransition();

  // Affiche les erreurs sous leurs champs, et efface celles qui sont corrigées.
  function showErrors(errors: ValidationError[]) {
    const fields = form.getFieldsError().map((f) => ({ name: f.name as (string | number)[], errors: [] as string[] }));
    for (const error of errors) {
      const path = fieldPath(error.field);
      if (!path) continue;
      let field = fields.find((f) => f.name.join(".") === path.join("."));
      if (!field) fields.push((field = { name: path, errors: [] }));
      field.errors.push(error.message);
    }
    form.setFields(fields as Parameters<typeof form.setFields>[0]);
    setFormErrors(errors.filter((e) => e.field === "form").map((e) => e.message));
  }

  function revalidate() {
    showErrors(validateCalendarForm(toConfig(form.getFieldsValue(true)), holidays));
  }

  function submit(values: FormValues) {
    const next = toConfig(values);
    const local = validateCalendarForm(next, holidays);
    if (local.length > 0) {
      setChecking(true);
      showErrors(local);
      return;
    }
    startTransition(async () => {
      const result = await saveCalendar({ status: "idle", errors: [] }, toFormData(next));
      if (result.status === "invalid") {
        setChecking(true);
        showErrors(result.errors);
      } else {
        setChecking(false);
        showErrors([]);
        message.success("Configuration enregistrée.");
        onSaved?.();
      }
    });
  }

  // --- Calculs en direct pour l'aperçu, seulement sur des données cohérentes.
  const liveErrors = validateCalendarForm(config, holidays);
  const hasError = (test: (field: string) => boolean) => liveErrors.some((e) => test(e.field));
  const gridOk = !hasError((f) => ["dayStart", "dayEnd", "slotDuration"].includes(f) || f.startsWith("breaks."));
  const periodOk = !hasError((f) => ["startDate", "endDate", "weekDays"].includes(f));
  const datesOk = Boolean(config.startDate && config.endDate && config.startDate <= config.endDate);

  const weeks = datesOk ? calendarWeeks(config.startDate, config.endDate) : null;
  const slots = gridOk ? generateSlots(config) : [];
  const dayCount = periodOk && datesOk ? calendarDays({ ...config, holidays: holidays.map((h) => h.date) }).length : null;

  const preview = [
    ...slots.map((s) => ({ start: s.start, label: `${s.start}–${s.end}`, isBreak: false })),
    ...config.breaks.map((b) => ({ start: b.start, label: `${b.name || "Pause"}, ${b.start}–${b.end}`, isBreak: true })),
  ].sort((a, b) => toMin(a.start) - toMin(b.start));

  return (
    <div className="flex flex-1 flex-col gap-10 lg:flex-row">
      <Form<FormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        disabled={locked}
        initialValues={initialValues}
        onFinish={submit}
        onValuesChange={() => checking && revalidate()}
        className="flex flex-1 flex-col"
      >
        {formErrors.length > 0 && <Alert type="error" showIcon title={formErrors.join(" ")} className="mb-6" />}

        <Form.Item label="Nom du calendrier" name="name">
          <Input size="large" placeholder="Quadrimestre 1, 2026-2027" />
        </Form.Item>

        <Form.Item
          label="Période"
          name="period"
          extra={
            weeks !== null && (
              <span className={weeks > MAX_WEEKS ? "text-unavailable" : undefined}>
                {weeks} semaine{weeks > 1 ? "s" : ""} sur {MAX_WEEKS}
              </span>
            )
          }
        >
          <DatePicker.RangePicker format="DD/MM/YYYY" placeholder={["Date de début", "Date de fin"]} className="w-full max-w-[420px]" />
        </Form.Item>

        <Form.Item label="Jours de cours" name="weekDays">
          <Checkbox.Group options={WEEK_DAYS} />
        </Form.Item>

        <div className="flex flex-wrap gap-x-4">
          <Form.Item label="Début de journée" name="dayStart" className="min-w-40 flex-1">
            <TimePicker {...timePicker} className="w-full" />
          </Form.Item>
          <Form.Item label="Fin de journée" name="dayEnd" className="min-w-40 flex-1">
            <TimePicker {...timePicker} className="w-full" />
          </Form.Item>
          <Form.Item label="Durée d'un créneau" name="slotDuration" className="min-w-40 flex-1">
            <Select options={DURATIONS} />
          </Form.Item>
        </div>

        <Form.Item label="Pauses" extra="Aucun créneau n'est proposé pendant une pause.">
          <Form.List name="breaks">
            {(fields, { add, remove }) => (
              <div className="flex flex-col gap-3">
                {fields.map(({ key, name }) => {
                  const endInvalid = checking && liveErrors.some((e) => e.field === `breaks.${name}.end`);
                  const suggestions = endInvalid ? breakEndSuggestions(config, name) : [];
                  return (
                    <div key={key} className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-start gap-2.5">
                        <Form.Item name={[name, "name"]} className="mb-0! min-w-40 flex-1">
                          <Input placeholder="Pause déjeuner" aria-label={`Nom de la pause ${name + 1}`} />
                        </Form.Item>
                        <Form.Item name={[name, "start"]} className="mb-0! w-30">
                          <TimePicker {...timePicker} placeholder="Début" aria-label={`Début de la pause ${name + 1}`} />
                        </Form.Item>
                        <span className="leading-10 text-graphite">à</span>
                        <Form.Item name={[name, "end"]} className="mb-0! w-30">
                          <TimePicker {...timePicker} placeholder="Fin" aria-label={`Fin de la pause ${name + 1}`} />
                        </Form.Item>
                        <Button onClick={() => remove(name)} aria-label={`Supprimer la pause ${name + 1}`}>
                          Supprimer
                        </Button>
                      </div>
                      {suggestions.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-graphite">Fins de pause qui fonctionnent :</span>
                          {suggestions.map((time) => (
                            <Button
                              key={time}
                              size="small"
                              onClick={() => {
                                form.setFieldValue(["breaks", name, "end"], toTime(time));
                                revalidate();
                              }}
                            >
                              {time}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <Button onClick={() => add({ name: "", start: null, end: null })} className="self-start">
                  Ajouter une pause
                </Button>
              </div>
            )}
          </Form.List>
        </Form.Item>

        <div className="mt-auto flex flex-wrap items-center justify-end gap-3 border-t border-rule pt-5">
          {locked ? (
            <Alert type="info" showIcon title="Des créneaux ont déjà été signalés : la configuration ne peut plus changer." className="w-full" />
          ) : (
            <Button type="primary" size="large" htmlType="submit" loading={pending}>
              Enregistrer la configuration
            </Button>
          )}
        </div>
      </Form>

      <aside className="flex flex-col gap-5 lg:w-75 lg:shrink-0 lg:border-l lg:border-rule lg:pl-8">
        <div className="flex flex-col gap-2.5">
          <h3 className="text-base font-semibold">Aperçu d&apos;une journée</h3>
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

        {gridOk && <Alert type="success" showIcon title="La journée se découpe sans reste : aucun créneau n'est coupé." />}
      </aside>
    </div>
  );
}
