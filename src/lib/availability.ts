// Lecture et écriture des créneaux signalés — SPEC.md §5 et §7.
//
// La table Availability ne contient QUE des exceptions : un créneau sans ligne
// est disponible. On n'écrit donc jamais AVAILABLE : revenir à « disponible »,
// c'est supprimer la ligne (voir saveSlots).
//
// Ce fichier ne vérifie rien : droits et validité sont contrôlés en amont
// (src/actions/availability.ts, src/lib/validation/availability.ts).

import "server-only";

import type { AvailabilityStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { toISODate, type ISODate, type Time } from "@/lib/slots";

// Les deux seuls statuts qui existent en base.
export type ExceptionStatus = Exclude<AvailabilityStatus, "AVAILABLE">;

export interface Exception {
  date: ISODate;
  start: Time;
  status: ExceptionStatus;
  comment: string;
  updatedAt: Date;
}

function toDbDate(date: ISODate) {
  return new Date(`${date}T00:00:00Z`);
}

// Créneaux signalés d'une ressource, dans l'ordre chronologique.
export async function getExceptions(calendarId: string, resourceId: string): Promise<Exception[]> {
  const rows = await prisma.availability.findMany({
    where: { calendarId, resourceId },
    orderBy: [{ date: "asc" }, { start: "asc" }],
  });
  return rows.map((row) => ({
    date: toISODate(row.date),
    start: row.start,
    status: row.status as ExceptionStatus,
    comment: row.comment,
    updatedAt: row.updatedAt,
  }));
}

// Applique un même statut à un créneau (heure de début) sur une ou plusieurs
// dates, en une transaction : tout est écrit, ou rien.
//  - IF_NEEDED / UNAVAILABLE : la ligne est créée, ou mise à jour si elle
//    existe (la contrainte unique ressource × date × heure l'impose) ;
//  - AVAILABLE : la ligne est supprimée, jamais écrite.
export async function saveSlots(input: {
  calendarId: string;
  resourceId: string;
  dates: ISODate[];
  start: Time;
  status: AvailabilityStatus;
  comment: string;
  updatedById: string;
}) {
  const { calendarId, resourceId, start, status, updatedById } = input;
  const comment = input.comment.trim();

  await prisma.$transaction(
    input.dates.map((iso) => {
      const date = toDbDate(iso);
      if (status === "AVAILABLE") {
        return prisma.availability.deleteMany({ where: { resourceId, date, start } });
      }
      const data = { calendarId, status, comment, updatedById };
      return prisma.availability.upsert({
        where: { resourceId_date_start: { resourceId, date, start } },
        update: data,
        create: { ...data, resourceId, date, start },
      });
    }),
  );
}
