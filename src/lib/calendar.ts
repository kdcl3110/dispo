// Lecture et écriture du calendrier en base — SPEC.md §5 et §6.
//
// Il n'existe qu'UN calendrier, partagé par tout le personnel. Ce fichier ne
// vérifie ni les droits ni la validité : c'est le rôle de l'action appelante
// (src/actions/calendar.ts) et de src/lib/validation/calendar.ts.

import "server-only";

import { prisma } from "@/lib/prisma";
import { toISODate, type ISODate, type Time } from "@/lib/slots";

// Configuration saisie dans l'écran « Configuration » (sans les jours fériés,
// qui ont leur propre écran).
export interface CalendarConfig {
  name: string;
  startDate: ISODate;
  endDate: ISODate;
  weekDays: string[];
  dayStart: Time;
  dayEnd: Time;
  slotDuration: number;
  breaks: { name: string; start: Time; end: Time }[];
}

// Calendrier tel que les écrans le manipulent : dates en ISO, pauses triées.
export interface Calendar extends CalendarConfig {
  id: string;
  publishedAt: Date | null;
  holidays: { date: ISODate; label: string | null }[];
}

// "YYYY-MM-DD" → Date à minuit UTC, le format attendu par les colonnes @db.Date.
function toDbDate(date: ISODate) {
  return new Date(`${date}T00:00:00Z`);
}

export async function getCalendar(): Promise<Calendar | null> {
  const calendar = await prisma.calendar.findFirst({
    orderBy: { createdAt: "asc" },
    include: {
      breaks: { orderBy: { start: "asc" } },
      holidays: { orderBy: { date: "asc" } },
    },
  });
  if (!calendar) return null;

  return {
    id: calendar.id,
    name: calendar.name,
    startDate: toISODate(calendar.startDate),
    endDate: toISODate(calendar.endDate),
    weekDays: calendar.weekDays,
    dayStart: calendar.dayStart,
    dayEnd: calendar.dayEnd,
    slotDuration: calendar.slotDuration,
    publishedAt: calendar.publishedAt,
    breaks: calendar.breaks.map(({ name, start, end }) => ({ name, start, end })),
    holidays: calendar.holidays.map((h) => ({ date: toISODate(h.date), label: h.label })),
  };
}

// Nombre de créneaux déjà signalés sur ce calendrier.
export async function countExceptions(calendarId: string) {
  return prisma.availability.count({ where: { calendarId } });
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

// Crée le calendrier s'il n'existe pas, sinon le met à jour. Les pauses sont
// remplacées en bloc, dans la même transaction : jamais d'état intermédiaire
// où le calendrier aurait ses nouvelles heures et ses anciennes pauses.
export async function saveCalendarConfig(config: CalendarConfig) {
  const data = {
    name: config.name.trim(),
    startDate: toDbDate(config.startDate),
    endDate: toDbDate(config.endDate),
    weekDays: config.weekDays,
    dayStart: config.dayStart,
    dayEnd: config.dayEnd,
    slotDuration: config.slotDuration,
  };
  const breaks = config.breaks.map((b) => ({ name: b.name.trim(), start: b.start, end: b.end }));

  return prisma.$transaction(async (tx) => {
    const existing = await tx.calendar.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });

    if (!existing) {
      return tx.calendar.create({ data: { ...data, breaks: { create: breaks } } });
    }

    await tx.break.deleteMany({ where: { calendarId: existing.id } });
    return tx.calendar.update({
      where: { id: existing.id },
      data: { ...data, breaks: { create: breaks } },
    });
  });
}
