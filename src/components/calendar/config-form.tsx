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
import { confirmGridImpact } from "@/components/calendar/grid-impact";
import type { CalendarConfig } from "@/lib/calendar";
import { calendarDays, generateSlots, toMin, unusedMinutes } from "@/lib/slots";
import {
  calendarWeeks,
  formatDuration,
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
  { value: 45, label: "45 minutes" },
  { value: 60, label: "1 heure" },
  { value: 90, label: "1 h 30" },
  { value: 120, label: "2 heures" },
  { value: 180, label: "3 heures" },
];

const GAPS = [
  { value: 0, label: "Aucun" },
  { value: 5, label: "5 minutes" },
  { value: 10, label: "10 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 20, label: "20 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "1 heure" },
];

// Horaires types de la HE2B : 4 créneaux de 2 h (08:00, 10:30, 13:30, 16:00).
// Point de départ d'un nouveau calendrier, et bouton « Horaires HE2B ».
const HE2B_HOURS = {
  dayStart: "08:00",
  dayEnd: "18:00",
  slotDuration: 120,
  slotGap: 30,
  breaks: [{ name: "Pause de midi", start: "12:30", end: "13:30" }],
};

// Valeurs proposées tant qu'aucun calendrier n'existe.
const DEFAULTS: CalendarConfig = {
  name: "",
  startDate: "",
  endDate: "",
  weekDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  ...HE2B_HOURS,
};

// ---------------------------------------------------------------- conversions

interface FormValues {
  name: string;
  period: [Dayjs, Dayjs] | null;
  weekDays: string[];
  dayStart: Dayjs | null;
  dayEnd: Dayjs | null;
  slotDuration: number;
  slotGap: number;
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
    slotGap: config.slotGap,
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
    slotGap: values.slotGap ?? 0,
    breaks: (values.breaks ?? []).map((b) => ({
      name: b?.name ?? "",
      start: b?.start?.format("HH:mm") ?? "",
      end: b?.end?.format("HH:mm") ?? "",
    })),
  };
}

// Même format que le <form> d'origine : l'action serveur n'a pas changé.
function toFormData(config: CalendarConfig, calendarId?: string, confirmed = false) {
  const data = new FormData();
  if (calendarId) data.set("calendarId", calendarId);
  if (confirmed) data.set("confirmed", "1"); // bilan des créneaux signalés accepté
  data.set("name", config.name);
  data.set("startDate", config.startDate);
  data.set("endDate", config.endDate);
  config.weekDays.forEach((day) => data.append("weekDays", day));
  data.set("dayStart", config.dayStart);
  data.set("dayEnd", config.dayEnd);
  data.set("slotDuration", String(config.slotDuration));
  data.set("slotGap", String(config.slotGap));
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
  onSaved,
}: {
  initial: (CalendarConfig & { id?: string }) | null;
  holidays: { date: string }[];
  onSaved?: (calendarId: string) => void;
}) {
  const [form] = Form.useForm<FormValues>();
  const { message, modal } = App.useApp();
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
    send(next, false);
  }

  // `confirmed` : second envoi, après que l'admin a accepté le bilan des
  // créneaux déjà signalés (déplacés ou supprimés).
  function send(next: CalendarConfig, confirmed: boolean) {
    startTransition(async () => {
      const result = await saveCalendar({ status: "idle", errors: [] }, toFormData(next, initial?.id, confirmed));
      if (result.status === "confirm") {
        if (result.impact && (await confirmGridImpact(modal, result.impact))) send(next, true);
        return;
      }
      if (result.status === "invalid") {
        setChecking(true);
        showErrors(result.errors);
      } else {
        setChecking(false);
        showErrors([]);
        message.success("Configuration enregistrée.");
        if (result.calendarId) onSaved?.(result.calendarId);
      }
    });
  }

  // --- Calculs en direct pour l'aperçu, seulement sur des données cohérentes.
  const liveErrors = validateCalendarForm(config, holidays);
  const hasError = (test: (field: string) => boolean) => liveErrors.some((e) => test(e.field));
  const gridOk = !hasError((f) => ["dayStart", "dayEnd", "slotDuration", "slotGap"].includes(f) || f.startsWith("breaks."));
  const periodOk = !hasError((f) => ["startDate", "endDate", "weekDays"].includes(f));
  const datesOk = Boolean(config.startDate && config.endDate && config.startDate <= config.endDate);

  const weeks = datesOk ? calendarWeeks(config.startDate, config.endDate) : null;
  const slots = gridOk ? generateSlots(config) : [];
  const dayCount = periodOk && datesOk ? calendarDays({ ...config, holidays: holidays.map((h) => h.date) }).length : null;

  // Déroulé d'une journée : les créneaux, et entre eux soit une pause (si une
  // pause y tombe), soit l'intercours.
  type Row = { key: string; label: string; kind: "slot" | "break" | "gap" };
  const sortedBreaks = [...config.breaks].sort((a, b) => toMin(a.start) - toMin(b.start));
  const preview: Row[] = [];
  slots.forEach((slot, i) => {
    const from = i === 0 ? toMin(config.dayStart) : toMin(slots[i - 1].end);
    const to = toMin(slot.start);
    const between = sortedBreaks.filter((b) => toMin(b.start) >= from && toMin(b.start) < to);
    between.forEach((b) => preview.push({ key: `b-${b.start}`, label: `${b.name || "Pause"}, ${b.start}–${b.end}`, kind: "break" }));
    if (i > 0 && between.length === 0 && to > from) {
      preview.push({ key: `g-${slot.start}`, label: `Intercours, ${formatDuration(to - from)}`, kind: "gap" });
    }
    preview.push({ key: `s-${slot.start}`, label: `${slot.start}–${slot.end}`, kind: "slot" });
  });
  const unused = gridOk ? unusedMinutes(config) : 0;

  // « Horaires HE2B » : ne touche qu'aux horaires (pas au nom ni à la période).
  function applyHe2b() {
    form.setFieldsValue({
      dayStart: toTime(HE2B_HOURS.dayStart),
      dayEnd: toTime(HE2B_HOURS.dayEnd),
      slotDuration: HE2B_HOURS.slotDuration,
      slotGap: HE2B_HOURS.slotGap,
      breaks: HE2B_HOURS.breaks.map((b) => ({ name: b.name, start: toTime(b.start), end: toTime(b.end) })),
    });
    if (checking) revalidate();
  }

  return (
    <div className="flex flex-1 flex-col gap-10 lg:flex-row">
      <Form<FormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
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

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-desk px-4 py-3">
          <span className="text-sm text-graphite">
            Horaires HE2B : 4 créneaux de 2 h, intercours de 30 min, pause de midi 12:30–13:30.
          </span>
          <Button size="small" onClick={applyHe2b}>
            Appliquer les horaires HE2B
          </Button>
        </div>

        <div className="flex flex-wrap gap-x-4">
          <Form.Item label="Début de journée" name="dayStart" className="min-w-40 flex-1">
            <TimePicker {...timePicker} className="w-full" />
          </Form.Item>
          <Form.Item label="Fin de journée" name="dayEnd" className="min-w-40 flex-1">
            <TimePicker {...timePicker} className="w-full" />
          </Form.Item>
        </div>
        <div className="flex flex-wrap gap-x-4">
          <Form.Item label="Durée d'un créneau" name="slotDuration" extra="La même pour tous les créneaux." className="min-w-40 flex-1">
            <Select options={DURATIONS} />
          </Form.Item>
          <Form.Item label="Intercours" name="slotGap" extra="Temps libre entre deux créneaux." className="min-w-40 flex-1">
            <Select options={GAPS} />
          </Form.Item>
        </div>

        <Form.Item label="Pauses" extra="Aucun créneau n'est proposé pendant une pause.">
          <Form.List name="breaks">
            {(fields, { add, remove }) => (
              <div className="flex flex-col gap-3">
                {fields.map(({ key, name }) => {
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
          <Button type="primary" size="large" htmlType="submit" loading={pending}>
            Enregistrer la configuration
          </Button>
        </div>
      </Form>

      <aside className="flex flex-col gap-5 lg:w-75 lg:shrink-0 lg:border-l lg:border-rule lg:pl-8">
        <div className="flex flex-col gap-2.5">
          <h3 className="text-base font-semibold">Aperçu d&apos;une journée</h3>
          {gridOk ? (
            <ul className="flex flex-col border-t border-seyes-strong">
              {preview.map((row) => (
                <li
                  key={row.key}
                  className={`flex items-center border-b border-seyes px-2.5 font-condensed ${
                    row.kind === "slot"
                      ? "h-9 text-sm font-medium text-ink"
                      : row.kind === "break"
                        ? "h-9 bg-hatch text-sm font-medium text-graphite"
                        : "h-6 text-xs text-graphite"
                  }`}
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

        {gridOk &&
          (unused > 0 ? (
            <Alert
              type="info"
              showIcon
              title={`${formatDuration(unused)} non utilisée${unused > 1 ? "s" : ""} en fin de journée.`}
              description="Le créneau suivant ne tiendrait plus avant la fin. Ce n'est pas une erreur."
            />
          ) : (
            <Alert type="success" showIcon title={`Chaque jour : ${slots.length} créneaux de ${formatDuration(config.slotDuration)}.`} />
          ))}
      </aside>
    </div>
  );
}
