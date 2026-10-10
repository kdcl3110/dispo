"use server";

// Server Actions de la grille des disponibilités, partagées par le personnel
// (sa propre fiche) et l'administration (n'importe quelle ressource).
// Ordre immuable : session → chargement → validation (droits compris) → écriture.

import { revalidatePath } from "next/cache";

import { addExceptions, clearExceptions, getExceptions, saveSlots } from "@/lib/availability";
import { getCalendar } from "@/lib/calendar";
import { getResource } from "@/lib/resource";
import { requireSession } from "@/lib/session";
import { calendarDays, calendarWeekGrid, slotKey, weekDayOf, type ISODate, type Time } from "@/lib/slots";
import type { ValidationError } from "@/lib/validation/calendar";
import { checkAccess, validateException, type AvailabilityStatus } from "@/lib/validation/availability";

export interface SaveSlotInput {
  resourceId: string;
  date: ISODate;
  start: Time;
  status: AvailabilityStatus;
  comment: string;
  // « Tous les jeudis de 14:00 à 16:00 » : même statut sur chaque date de ce
  // jour de la semaine (jours retirés exclus).
  repeatWeekly?: boolean;
}

// État d'un créneau après l'enregistrement, pour mettre la grille à jour sans
// la recharger. status AVAILABLE = la ligne a été supprimée.
export interface SlotState {
  date: ISODate;
  start: Time;
  status: AvailabilityStatus;
  comment: string;
}

export type SaveSlotResult = { ok: true; slots: SlotState[] } | { ok: false; errors: ValidationError[] };

export async function saveSlot(input: SaveSlotInput): Promise<SaveSlotResult> {
  const user = await requireSession();

  // Une Server Action est un point d'entrée public : on ne fait pas confiance
  // aux types, on relit chaque valeur.
  const values = {
    date: String(input?.date ?? ""),
    start: String(input?.start ?? ""),
    status: String(input?.status ?? ""),
    comment: String(input?.comment ?? ""),
  };

  const [resource, calendar] = await Promise.all([getResource(String(input?.resourceId ?? "")), getCalendar()]);
  if (!resource || !calendar) {
    return { ok: false, errors: [{ field: "form", message: "Ce créneau n'existe plus. Rechargez la page." }] };
  }

  const errors = validateException({ id: user.id, role: user.role }, resource, calendar, values);
  if (errors.length > 0) return { ok: false, errors };

  const status = values.status as AvailabilityStatus;
  const dates = input.repeatWeekly
    ? calendarDays({ ...calendar, holidays: calendar.holidays.map((h) => h.date) }).filter(
        (date) => weekDayOf(date) === weekDayOf(values.date),
      )
    : [values.date];

  await saveSlots({
    calendarId: calendar.id,
    resourceId: resource.id,
    dates,
    start: values.start,
    status,
    comment: status === "AVAILABLE" ? "" : values.comment,
    updatedById: user.id,
  });

  revalidatePath("/availability");
  revalidatePath("/admin/availability");

  const comment = status === "AVAILABLE" ? "" : values.comment.trim();
  return { ok: true, slots: dates.map((date) => ({ date, start: values.start, status, comment })) };
}

// Charge la ressource et le calendrier, puis vérifie les droits (règles 5 et 6).
async function loadForWrite(resourceId: unknown) {
  const user = await requireSession();
  const [resource, calendar] = await Promise.all([getResource(String(resourceId ?? "")), getCalendar()]);
  if (!resource || !calendar) {
    return { error: { field: "form", message: "Cette grille n'existe plus. Rechargez la page." } as ValidationError };
  }
  const denied = checkAccess({ id: user.id, role: user.role }, resource, calendar);
  if (denied) return { error: denied };
  return { user, resource, calendar };
}

// « Appliquer la semaine N à tout le quadrimestre » : recopie les créneaux
// signalés de la semaine modèle sur les autres semaines, au même jour et à la
// même heure. On COMPLÈTE seulement : un créneau déjà signalé ailleurs est
// gardé tel quel. Les jours retirés ne reçoivent rien.
export async function copyWeekToAll(input: { resourceId: string; weekMonday: ISODate }): Promise<SaveSlotResult> {
  const loaded = await loadForWrite(input?.resourceId);
  if ("error" in loaded) return { ok: false, errors: [loaded.error!] };
  const { user, resource, calendar } = loaded;

  const grid = calendarWeekGrid({ startDate: calendar.startDate, endDate: calendar.endDate, weekDays: calendar.weekDays });
  const model = grid.weeks.find((w) => w.monday === String(input?.weekMonday ?? ""));
  if (!model) return { ok: false, errors: [{ field: "form", message: "Cette semaine ne fait pas partie du calendrier." }] };

  const courseDays = new Set(calendarDays({ ...calendar, holidays: calendar.holidays.map((h) => h.date) }));
  const existing = await getExceptions(calendar.id, resource.id);
  const taken = new Set(existing.map((e) => slotKey(e.date, e.start)));
  const modelDates = new Set(model.dates.filter((d): d is ISODate => d !== null));
  const template = existing.filter((e) => modelDates.has(e.date));

  const rows = grid.weeks
    .filter((week) => week !== model)
    .flatMap((week) =>
      template.map((t) => ({ ...t, date: week.dates[grid.days.indexOf(weekDayOf(t.date))] })),
    )
    .filter((row): row is typeof row & { date: ISODate } => row.date !== null && row.date !== undefined)
    .filter((row) => courseDays.has(row.date) && !taken.has(slotKey(row.date, row.start)))
    .map(({ date, start, status, comment }) => ({ date, start, status, comment }));

  await addExceptions({ calendarId: calendar.id, resourceId: resource.id, updatedById: user.id, rows });

  revalidatePath("/availability");
  revalidatePath("/admin/availability");
  return { ok: true, slots: rows };
}

// « Tout remettre à disponible » : efface tous les créneaux signalés.
export async function resetAll(input: { resourceId: string }): Promise<SaveSlotResult> {
  const loaded = await loadForWrite(input?.resourceId);
  if ("error" in loaded) return { ok: false, errors: [loaded.error!] };
  const { resource, calendar } = loaded;

  const existing = await getExceptions(calendar.id, resource.id);
  await clearExceptions(calendar.id, resource.id);

  revalidatePath("/availability");
  revalidatePath("/admin/availability");
  return {
    ok: true,
    slots: existing.map((e) => ({ date: e.date, start: e.start, status: "AVAILABLE" as const, comment: "" })),
  };
}
