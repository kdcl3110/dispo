// Export JSON complet — SPEC.md §9.
//
// Rassemble la configuration du calendrier, la grille calculée (slots) et
// toutes les ressources avec leurs créneaux signalés. Les créneaux disponibles
// n'y figurent pas : tout couple (date, slotId) absent vaut defaultStatus.
// Le slotId ("s1", "s2"…) n'existe qu'ici : en base, un créneau est rangé par
// son heure de début.

import "server-only";

import { getCalendar } from "@/lib/calendar";
import { prisma } from "@/lib/prisma";
import { generateSlots, toISODate } from "@/lib/slots";

const TYPE = { PERSON: "person", LOCAL: "local", EQUIPMENT: "equipment" } as const;
const STATUS = { UNAVAILABLE: "unavailable", IF_NEEDED: "if_needed", AVAILABLE: "available" } as const;

// Date et heure de Bruxelles avec leur décalage : "2026-09-17T14:32:00+02:00".
function brusselsTimestamp(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Brussels",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZoneName: "longOffset",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const offset = parts.timeZoneName === "GMT" ? "+00:00" : parts.timeZoneName.replace("GMT", "");
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}

export type ExportDocument = NonNullable<Awaited<ReturnType<typeof buildExport>>>;

// null s'il n'y a pas encore de calendrier : rien à exporter.
export async function buildExport(exportedBy: string, now = new Date()) {
  const calendar = await getCalendar();
  if (!calendar) return null;

  const slots = generateSlots(calendar);
  const slotIdByStart = new Map(slots.map((s) => [s.start, s.id]));

  const resources = await prisma.resource.findMany({
    include: {
      owner: { select: { email: true } },
      availabilities: {
        where: { calendarId: calendar.id },
        orderBy: [{ date: "asc" }, { start: "asc" }],
      },
    },
  });
  resources.sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return {
    meta: {
      exportedAt: brusselsTimestamp(now),
      exportedBy,
    },
    calendar: {
      name: calendar.name,
      startDate: calendar.startDate,
      endDate: calendar.endDate,
      weekDays: calendar.weekDays,
      dayStart: calendar.dayStart,
      dayEnd: calendar.dayEnd,
      slotDuration: calendar.slotDuration,
      breaks: calendar.breaks,
      holidays: calendar.holidays.map((h) => ({ date: h.date, label: h.label })),
      defaultStatus: STATUS.AVAILABLE,
    },
    slots,
    resources: resources.map((r) => ({
      id: r.id,
      type: TYPE[r.type],
      name: r.name,
      owner: r.owner?.email ?? null,
      exceptions: r.availabilities
        // Garde-fou : une ligne dont l'heure ne correspond à aucun créneau
        // (impossible tant que la configuration est figée) n'est pas exportée.
        .filter((a) => slotIdByStart.has(a.start))
        .map((a) => ({
          date: toISODate(a.date),
          slotId: slotIdByStart.get(a.start)!,
          status: STATUS[a.status],
          comment: a.comment,
        })),
    })),
  };
}

// Nom du fichier téléchargé : dispo-export-2026-09-29.json
export function exportFileName(document: ExportDocument) {
  return `dispo-export-${document.meta.exportedAt.slice(0, 10)}.json`;
}
