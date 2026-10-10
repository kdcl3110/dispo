// Lecture et écriture des calendriers en base — SPEC.md §5 et §6.
//
// Il peut y avoir plusieurs calendriers (quadrimestres, conférences,
// événements), chacun avec ses horaires, ses congés, sa publication et ses
// créneaux signalés. Ce fichier ne vérifie ni les droits ni la validité :
// c'est le rôle des actions (src/actions/) et de src/lib/validation/calendar.ts.

import "server-only";

import { prisma } from "@/lib/prisma";
import { toISODate, type ISODate, type Time } from "@/lib/slots";

// Configuration saisie dans le formulaire « Horaires » (sans les congés, qui
// ont leur propre panneau).
export interface CalendarConfig {
  name: string;
  startDate: ISODate;
  endDate: ISODate;
  weekDays: string[];
  dayStart: Time;
  dayEnd: Time;
  slotDuration: number;
  slotGap: number; // intercours, en minutes
  breaks: { name: string; start: Time; end: Time }[];
}

// Calendrier tel que les écrans le manipulent : dates en ISO, pauses triées.
export interface Calendar extends CalendarConfig {
  id: string;
  publishedAt: Date | null;
  holidays: { date: ISODate; label: string | null }[];
}

// Brouillon : invisible du personnel. Publié : ouvert à la saisie.
// Terminé : publié, et sa date de fin est passée.
export type CalendarStatus = "draft" | "published" | "finished";

export interface CalendarRow {
  id: string;
  name: string;
  startDate: ISODate;
  endDate: ISODate;
  weekDays: string[];
  publishedAt: Date | null;
  status: CalendarStatus;
  exceptions: number; // créneaux signalés
}

// "YYYY-MM-DD" → Date à minuit UTC, le format attendu par les colonnes @db.Date.
function toDbDate(date: ISODate) {
  return new Date(`${date}T00:00:00Z`);
}

const WITH_DETAILS = {
  breaks: { orderBy: { start: "asc" } },
  holidays: { orderBy: { date: "asc" } },
} as const;

type DbCalendar = NonNullable<Awaited<ReturnType<typeof prisma.calendar.findFirst<{ include: typeof WITH_DETAILS }>>>>;

function toCalendar(calendar: DbCalendar): Calendar {
  return {
    id: calendar.id,
    name: calendar.name,
    startDate: toISODate(calendar.startDate),
    endDate: toISODate(calendar.endDate),
    weekDays: calendar.weekDays,
    dayStart: calendar.dayStart,
    dayEnd: calendar.dayEnd,
    slotDuration: calendar.slotDuration,
    slotGap: calendar.slotGap,
    publishedAt: calendar.publishedAt,
    breaks: calendar.breaks.map(({ name, start, end }) => ({ name, start, end })),
    holidays: calendar.holidays.map((h) => ({ date: toISODate(h.date), label: h.label })),
  };
}

export function statusOf(calendar: { publishedAt: Date | null; endDate: ISODate }, today = toISODate(new Date())): CalendarStatus {
  if (!calendar.publishedAt) return "draft";
  return calendar.endDate < today ? "finished" : "published";
}

// ---------------------------------------------------------------- lecture

export async function getCalendar(id: string): Promise<Calendar | null> {
  const calendar = await prisma.calendar.findUnique({ where: { id }, include: WITH_DETAILS });
  return calendar ? toCalendar(calendar) : null;
}

// Tous les calendriers, du plus récent au plus ancien (date de début), avec
// leur état et leur nombre de créneaux signalés. `publishedOnly` : la vue du
// personnel, qui ne voit que les calendriers publiés.
export async function listCalendars({ publishedOnly = false } = {}): Promise<CalendarRow[]> {
  const calendars = await prisma.calendar.findMany({
    where: publishedOnly ? { publishedAt: { not: null } } : undefined,
    orderBy: { startDate: "desc" },
    include: { _count: { select: { availabilities: true } } },
  });
  return calendars.map((c) => {
    const row = { publishedAt: c.publishedAt, endDate: toISODate(c.endDate) };
    return {
      id: c.id,
      name: c.name,
      startDate: toISODate(c.startDate),
      endDate: row.endDate,
      weekDays: c.weekDays,
      publishedAt: c.publishedAt,
      status: statusOf(row),
      exceptions: c._count.availabilities,
    };
  });
}

// Calendrier proposé quand aucun n'est choisi : le publié le plus récent,
// sinon le plus récent tout court. `rows` vient de listCalendars (déjà trié).
export function defaultCalendarId(rows: CalendarRow[]) {
  return (rows.find((r) => r.status === "published") ?? rows[0])?.id;
}

// Nombre de créneaux déjà signalés sur ce calendrier.
export async function countExceptions(calendarId: string) {
  return prisma.availability.count({ where: { calendarId } });
}

// ---------------------------------------------------------------- écriture

function configData(config: CalendarConfig) {
  return {
    name: config.name.trim(),
    startDate: toDbDate(config.startDate),
    endDate: toDbDate(config.endDate),
    weekDays: config.weekDays,
    dayStart: config.dayStart,
    dayEnd: config.dayEnd,
    slotDuration: config.slotDuration,
    slotGap: config.slotGap,
  };
}

const breaksOf = (config: CalendarConfig) =>
  config.breaks.map((b) => ({ name: b.name.trim(), start: b.start, end: b.end }));

// Crée un calendrier (brouillon) et renvoie son identifiant.
export async function createCalendar(config: CalendarConfig) {
  const calendar = await prisma.calendar.create({
    data: { ...configData(config), breaks: { create: breaksOf(config) } },
    select: { id: true },
  });
  return calendar.id;
}

// Met à jour la configuration. Les pauses sont remplacées en bloc, dans la
// même transaction : jamais d'état intermédiaire où le calendrier aurait ses
// nouvelles heures et ses anciennes pauses.
export async function updateCalendarConfig(id: string, config: CalendarConfig) {
  await prisma.$transaction([
    prisma.break.deleteMany({ where: { calendarId: id } }),
    prisma.calendar.update({ where: { id }, data: { ...configData(config), breaks: { create: breaksOf(config) } } }),
  ]);
}

// Supprime un calendrier avec ses pauses, congés et créneaux signalés
// (cascade du schéma). L'appelant décide si c'est permis.
export async function deleteCalendar(id: string) {
  await prisma.calendar.delete({ where: { id } });
}

// Remplace en bloc les jours retirés du calendrier.
export async function replaceHolidays(calendarId: string, holidays: { date: ISODate; label: string | null }[]) {
  await prisma.$transaction([
    prisma.holiday.deleteMany({ where: { calendarId } }),
    prisma.holiday.createMany({
      data: holidays.map((h) => ({ calendarId, date: toDbDate(h.date), label: h.label })),
    }),
  ]);
}

// Rend le calendrier visible du personnel. Sans effet s'il l'est déjà : la
// date de publication d'origine est conservée.
export async function publishCalendar(calendarId: string) {
  await prisma.calendar.updateMany({
    where: { id: calendarId, publishedAt: null },
    data: { publishedAt: new Date() },
  });
}
