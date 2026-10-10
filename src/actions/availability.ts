"use server";

// Server Action de la grille des disponibilités, partagée par le personnel
// (sa propre fiche) et l'administration (n'importe quelle ressource).
// Ordre immuable : session → chargement → validation (droits compris) → écriture.

import { revalidatePath } from "next/cache";

import { saveSlots } from "@/lib/availability";
import { getCalendar } from "@/lib/calendar";
import { getResource } from "@/lib/resource";
import { requireSession } from "@/lib/session";
import { calendarDays, weekDayOf, type ISODate, type Time } from "@/lib/slots";
import type { ValidationError } from "@/lib/validation/calendar";
import { validateException, type AvailabilityStatus } from "@/lib/validation/availability";

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
