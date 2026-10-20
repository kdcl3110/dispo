"use server";

// Server Actions de l'écran « Calendrier » : configuration, jours retirés, publication.
// Ordre immuable : droits → lecture du formulaire → validation → écriture.

import { revalidatePath } from "next/cache";

import {
  countExceptions,
  deleteCalendar,
  getCalendar,
  listCalendarExceptions,
  publishCalendar,
  replaceHolidays,
  createCalendar,
  setCalendarLock,
  updateCalendarConfig,
  type Calendar,
  type CalendarConfig,
  type GridChange,
} from "@/lib/calendar";
import { requireAdmin } from "@/lib/session";
import { planGridChange, type GridConfig, type ISODate } from "@/lib/slots";
import { validateCalendarForm, validateHolidays, type ValidationError } from "@/lib/validation/calendar";

// État renvoyé au formulaire (signature de useActionState).
// `values` permet de réafficher la saisie : React vide le formulaire après
// chaque envoi, y compris quand il est refusé.
export interface CalendarFormState {
  status: "idle" | "saved" | "invalid" | "confirm";
  errors: ValidationError[];
  values?: CalendarConfig;
  calendarId?: string; // après une création : l'identifiant du nouveau calendrier
  impact?: GridImpact; // status "confirm" : effet sur les créneaux signalés
}

// État renvoyé au formulaire « Jours fériés et publication ».
export interface HolidaysFormState {
  status: "idle" | "saved" | "published" | "invalid" | "confirm";
  errors: ValidationError[];
  impact?: GridImpact;
}

// Effet d'une modification sur les créneaux déjà signalés, annoncé avant
// d'enregistrer. Rien n'est écrit tant que l'admin n'a pas confirmé.
export interface GridImpact {
  total: number;
  kept: number;
  moved: number;
  removedDays: number; // jour sorti du calendrier
  removedTimes: number; // heure qui n'a plus de créneau
}

// ---------------------------------------------------------------- changement de grille

const gridOf = (calendar: Calendar | (CalendarConfig & { holidays: { date: ISODate }[] })): GridConfig => ({
  ...calendar,
  holidays: calendar.holidays.map((h) => h.date),
});

// Calcule l'effet du passage de `before` à `after` sur les créneaux signalés.
// `needsConfirm` : au moins un créneau serait déplacé ou supprimé.
async function planChange(calendarId: string, before: GridConfig, after: GridConfig) {
  const exceptions = await listCalendarExceptions(calendarId);
  const plan = planGridChange(before, after, exceptions);
  const impact: GridImpact = {
    total: exceptions.length,
    kept: plan.kept.length,
    moved: plan.moved.length,
    removedDays: plan.removed.filter((r) => r.reason === "day").length,
    removedTimes: plan.removed.filter((r) => r.reason === "time").length,
  };
  const change: GridChange = {
    removedIds: plan.removed.map((r) => r.exception.id),
    startMap: [...new Map(plan.moved.map((m) => [m.exception.start, m.start])).entries()],
  };
  return { impact, change, needsConfirm: plan.moved.length + plan.removed.length > 0 };
}

// Lit le formulaire. Les pauses arrivent sous la forme breaks.0.name,
// breaks.0.start, breaks.1.name… : on les regroupe par indice.
function readForm(formData: FormData): CalendarConfig {
  const text = (key: string) => String(formData.get(key) ?? "").trim();

  const breaks: CalendarConfig["breaks"] = [];
  for (const [key, value] of formData.entries()) {
    const match = /^breaks\.(\d+)\.(name|start|end)$/.exec(key);
    if (!match) continue;
    const index = Number(match[1]);
    breaks[index] ??= { name: "", start: "", end: "" };
    breaks[index][match[2] as "name" | "start" | "end"] = String(value).trim();
  }

  return {
    name: text("name"),
    startDate: text("startDate"),
    endDate: text("endDate"),
    weekDays: formData.getAll("weekDays").map(String),
    dayStart: text("dayStart"),
    dayEnd: text("dayEnd"),
    slotDuration: Number(text("slotDuration")),
    slotGap: Number(text("slotGap") || 0),
    // Une ligne de pause supprimée côté client laisse un trou dans les indices.
    breaks: breaks.filter(Boolean),
  };
}

export async function saveCalendar(
  _previous: CalendarFormState,
  formData: FormData,
): Promise<CalendarFormState> {
  await requireAdmin();

  const values = readForm(formData);

  // Champ « calendarId » absent : création. Présent : modification.
  const calendarId = String(formData.get("calendarId") ?? "");
  const current = calendarId ? await getCalendar(calendarId) : null;
  if (calendarId && !current) {
    return { status: "invalid", errors: [{ field: "form", message: "Ce calendrier n'existe plus. Rechargez la page." }], values };
  }

  // Les jours fériés ne sont pas dans ce formulaire, mais ils doivent rester
  // dans la période (règle 11) : on valide avec ceux déjà enregistrés.
  const errors = validateCalendarForm(values, current?.holidays ?? []);

  if (errors.length > 0) return { status: "invalid", errors, values };

  // Créneaux déjà signalés : ils suivent la nouvelle grille quand c'est
  // possible, sinon ils sont supprimés. L'admin voit le bilan et confirme
  // (champ « confirmed ») avant toute écriture.
  if (current) {
    const { impact, change, needsConfirm } = await planChange(current.id, gridOf(current), gridOf({ ...values, holidays: current.holidays }));
    if (needsConfirm && formData.get("confirmed") !== "1") return { status: "confirm", errors: [], values, impact };
    await updateCalendarConfig(current.id, values, change);
  }

  const id = current ? current.id : await createCalendar(values);
  revalidatePath("/", "layout");
  return { status: "saved", errors: [], values, calendarId: id };
}

// Le formulaire envoie la liste complète des jours retirés en JSON, dans un
// champ caché "holidays" : [{ "date": "2026-10-26", "label": "Congé d'automne" }, …].
function readHolidays(formData: FormData): { date: string; label: string | null }[] | null {
  try {
    const parsed: unknown = JSON.parse(String(formData.get("holidays") ?? "[]"));
    if (!Array.isArray(parsed)) return null;
    return parsed.map((item) => ({
      date: String(item?.date ?? ""),
      label: String(item?.label ?? "").trim() || null,
    }));
  } catch {
    return null;
  }
}

export async function saveHolidays(
  _previous: HolidaysFormState,
  formData: FormData,
): Promise<HolidaysFormState> {
  await requireAdmin();

  const calendar = await getCalendar(String(formData.get("calendarId") ?? ""));
  if (!calendar) {
    return { status: "invalid", errors: [{ field: "form", message: "Ce calendrier n'existe plus. Rechargez la page." }] };
  }

  const holidays = readHolidays(formData);
  if (!holidays) {
    return { status: "invalid", errors: [{ field: "form", message: "La liste des jours retirés est illisible. Rechargez la page." }] };
  }

  const errors = validateHolidays(calendar, holidays);
  if (errors.length > 0) return { status: "invalid", errors };

  // Un jour retiré emporte les créneaux qui y étaient signalés : bilan et
  // confirmation d'abord, comme pour la configuration.
  const { impact, change, needsConfirm } = await planChange(calendar.id, gridOf(calendar), gridOf({ ...calendar, holidays }));
  if (needsConfirm && formData.get("confirmed") !== "1") return { status: "confirm", errors: [], impact };

  await replaceHolidays(calendar.id, holidays, change);
  revalidatePath("/", "layout");
  return { status: "saved", errors: [] };
}

// Rend un calendrier visible du personnel, tel qu'il est enregistré
// (configuration et jours retirés).
export async function publish(input: { calendarId: string }): Promise<HolidaysFormState> {
  await requireAdmin();

  const calendar = await getCalendar(String(input?.calendarId ?? ""));
  if (!calendar) {
    return { status: "invalid", errors: [{ field: "form", message: "Ce calendrier n'existe plus. Rechargez la page." }] };
  }

  await publishCalendar(calendar.id);
  revalidatePath("/", "layout");
  return { status: "published", errors: [] };
}

// Clôture la saisie une fois les disponibilités validées : le personnel garde
// sa grille sous les yeux mais ne peut plus rien modifier. L'admin, lui, peut
// encore corriger. `locked: false` rouvre la saisie.
export async function lock(input: { calendarId: string; locked: boolean }): Promise<HolidaysFormState> {
  await requireAdmin();

  const calendar = await getCalendar(String(input?.calendarId ?? ""));
  if (!calendar) {
    return { status: "invalid", errors: [{ field: "form", message: "Ce calendrier n'existe plus. Rechargez la page." }] };
  }
  const locked = input?.locked === true;
  if (locked && !calendar.publishedAt) {
    return { status: "invalid", errors: [{ field: "form", message: "Publiez le calendrier avant de clôturer la saisie." }] };
  }

  await setCalendarLock(calendar.id, locked);
  revalidatePath("/", "layout");
  return { status: "saved", errors: [] };
}

// Supprime un calendrier créé par erreur. Refusé dès qu'un créneau y a été
// signalé : on ne détruit pas ce que le personnel a saisi.
export async function removeCalendar(input: { calendarId: string }): Promise<HolidaysFormState> {
  await requireAdmin();

  const calendar = await getCalendar(String(input?.calendarId ?? ""));
  if (!calendar) {
    return { status: "invalid", errors: [{ field: "form", message: "Ce calendrier n'existe plus. Rechargez la page." }] };
  }
  if ((await countExceptions(calendar.id)) > 0) {
    return {
      status: "invalid",
      errors: [{ field: "form", message: "Des créneaux ont été signalés dans ce calendrier : il ne peut plus être supprimé." }],
    };
  }

  await deleteCalendar(calendar.id);
  revalidatePath("/", "layout");
  return { status: "saved", errors: [] };
}
