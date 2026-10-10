// Validation de la configuration du calendrier — SPEC.md §10, règles 7 à 11.
//
// Au lieu de s'arrêter à la première erreur, on les renvoie toutes, chacune
// rattachée au champ concerné : le formulaire peut ainsi les afficher sous
// leurs champs respectifs, en une fois.

import { daySegments, toHHMM, toMin, weekDayOf, type ISODate, type Time } from "@/lib/slots";

export const MAX_WEEKS = 15;

const WEEK_DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export interface CalendarConfigInput {
  name: string;
  startDate: ISODate;
  endDate: ISODate;
  weekDays: string[];
  dayStart: Time;
  dayEnd: Time;
  slotDuration: number;
  breaks: { name: string; start: Time; end: Time }[];
  holidays: { date: ISODate; label?: string | null }[];
}

// `field` reprend le nom du champ du formulaire : "endDate", "breaks.0.end",
// "holidays.2"…
export interface ValidationError {
  field: string;
  message: string;
}

// ---------------------------------------------------------------- outils

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isTime(value: string) {
  return TIME_RE.test(value);
}

// Refuse aussi les dates impossibles, comme le 31 février.
function isISODate(value: string) {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function utc(date: ISODate) {
  return new Date(`${date}T00:00:00Z`);
}

const DAY_MS = 86_400_000;

// « 14 septembre 2026 »
export function formatDate(date: ISODate) {
  return new Intl.DateTimeFormat("fr-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(utc(date));
}

// 270 → « 4 h 30 », 120 → « 2 h », 30 → « 30 min »
export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

// Nombre de semaines calendaires couvertes, comptées depuis le lundi de la
// semaine de startDate (SPEC §6, règle 2).
export function calendarWeeks(startDate: ISODate, endDate: ISODate) {
  const monday = utc(startDate);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const days = Math.floor((utc(endDate).getTime() - monday.getTime()) / DAY_MS) + 1;
  return Math.ceil(days / 7);
}

// Dernière date acceptée : le dimanche de la 15e semaine.
export function lastAllowedDate(startDate: ISODate): ISODate {
  const monday = utc(startDate);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  monday.setUTCDate(monday.getUTCDate() + MAX_WEEKS * 7 - 1);
  return monday.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- formulaire

// Validation du formulaire « Configuration » : les jours fériés n'y sont pas
// saisis, mais ceux déjà enregistrés doivent rester dans la période. Leurs
// erreurs sont regroupées sur le champ "period", le seul visible ici.
export function validateCalendarForm(
  config: Omit<CalendarConfigInput, "holidays">,
  holidays: { date: ISODate }[],
): ValidationError[] {
  return validateCalendarConfig({ ...config, holidays }).map((error) => {
    if (!error.field.startsWith("holidays.")) return error;
    const holiday = holidays[Number(error.field.split(".")[1])];
    return {
      field: "period",
      message:
        `Le ${formatDate(holiday.date)} est retiré du calendrier mais tomberait hors de la période. ` +
        "Remettez-le dans le calendrier ou élargissez la période.",
    };
  });
}

// Fins possibles pour la pause n° `index` : celles qui laissent après elle une
// plage multiple de la durée d'un créneau. Renvoie les 3 plus proches de la
// fin actuelle, dans l'ordre chronologique ([] si les horaires sont invalides).
export function breakEndSuggestions(config: Omit<CalendarConfigInput, "holidays">, index: number): Time[] {
  const { breaks, dayEnd, slotDuration } = config;
  if (!isTime(dayEnd) || !(slotDuration > 0) || breaks.some((b) => !isTime(b.start) || !isTime(b.end))) {
    return [];
  }

  const sorted = breaks.map((b, i) => ({ ...b, i })).sort((a, b) => toMin(a.start) - toMin(b.start));
  const position = sorted.findIndex((b) => b.i === index);
  const from = toMin(sorted[position].start);
  const limit = position + 1 < sorted.length ? toMin(sorted[position + 1].start) : toMin(dayEnd);
  const current = toMin(sorted[position].end);

  const candidates: number[] = [];
  for (let t = limit - slotDuration; t > from; t -= slotDuration) candidates.push(t);

  return candidates
    .sort((a, b) => Math.abs(a - current) - Math.abs(b - current))
    .slice(0, 3)
    .sort((a, b) => a - b)
    .map(toHHMM);
}

// ---------------------------------------------------------------- jours retirés

export const MAX_LABEL_LENGTH = 80;

// Jours retirés (écran « Jours fériés ») : chacun doit être un jour de cours
// de la période, sans doublon. Les erreurs portent sur le champ "holidays".
export function validateHolidays(
  calendar: { startDate: ISODate; endDate: ISODate; weekDays: string[] },
  holidays: { date: ISODate; label?: string | null }[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const seen = new Set<string>();

  for (const h of holidays) {
    if (!isISODate(h.date)) {
      errors.push({ field: "holidays", message: `« ${h.date} » n'est pas une date valide.` });
    } else if (h.date < calendar.startDate || h.date > calendar.endDate) {
      errors.push({ field: "holidays", message: `Le ${formatDate(h.date)} tombe en dehors de la période du calendrier.` });
    } else if (!calendar.weekDays.includes(weekDayOf(h.date))) {
      errors.push({ field: "holidays", message: `Le ${formatDate(h.date)} n'est pas un jour de cours.` });
    } else if (seen.has(h.date)) {
      errors.push({ field: "holidays", message: `Le ${formatDate(h.date)} est retiré deux fois.` });
    }
    if ((h.label ?? "").length > MAX_LABEL_LENGTH) {
      errors.push({ field: "holidays", message: `Le nom « ${h.label!.slice(0, 20)}… » dépasse ${MAX_LABEL_LENGTH} caractères.` });
    }
    seen.add(h.date);
  }
  return errors;
}

// ---------------------------------------------------------------- validation

export function validateCalendarConfig(input: CalendarConfigInput): ValidationError[] {
  const errors: ValidationError[] = [];
  const add = (field: string, message: string) => errors.push({ field, message });

  // --- Nom
  if (!input.name.trim()) add("name", "Donnez un nom au calendrier.");

  // --- Période (règles 9, 10)
  const startOk = isISODate(input.startDate);
  const endOk = isISODate(input.endDate);
  if (!startOk) add("startDate", "Indiquez une date de début valide.");
  if (!endOk) add("endDate", "Indiquez une date de fin valide.");

  const periodOk = startOk && endOk && input.startDate <= input.endDate;
  if (startOk && endOk && !periodOk) {
    add("endDate", "La date de fin doit suivre la date de début.");
  }
  if (periodOk) {
    const weeks = calendarWeeks(input.startDate, input.endDate);
    if (weeks > MAX_WEEKS) {
      add(
        "endDate",
        `La période couvre ${weeks} semaines, le maximum est ${MAX_WEEKS}. ` +
          `Choisissez une date de fin au plus tard le ${formatDate(lastAllowedDate(input.startDate))}.`,
      );
    }
  }

  // --- Jours (règle 10)
  if (input.weekDays.length === 0) {
    add("weekDays", "Cochez au moins un jour de cours.");
  } else if (input.weekDays.some((day) => !WEEK_DAY_NAMES.includes(day))) {
    add("weekDays", "Un des jours cochés est inconnu.");
  }

  // --- Horaires (règle 10)
  const dayStartOk = isTime(input.dayStart);
  const dayEndOk = isTime(input.dayEnd);
  if (!dayStartOk) add("dayStart", "Indiquez une heure de début valide.");
  if (!dayEndOk) add("dayEnd", "Indiquez une heure de fin valide.");

  const hoursOk = dayStartOk && dayEndOk && toMin(input.dayStart) < toMin(input.dayEnd);
  if (dayStartOk && dayEndOk && !hoursOk) {
    add("dayEnd", "La journée doit finir après avoir commencé.");
  }

  const durationOk = Number.isInteger(input.slotDuration) && input.slotDuration > 0;
  if (!durationOk) add("slotDuration", "Choisissez la durée d'un créneau.");

  // --- Pauses (règle 8) : nommées, bien formées, dans la journée, disjointes
  let breaksOk = true;
  input.breaks.forEach((b, i) => {
    if (!b.name.trim()) add(`breaks.${i}.name`, "Donnez un nom à cette pause.");
    if (!isTime(b.start)) {
      add(`breaks.${i}.start`, "Indiquez une heure de début valide.");
      breaksOk = false;
    }
    if (!isTime(b.end)) {
      add(`breaks.${i}.end`, "Indiquez une heure de fin valide.");
      breaksOk = false;
    }
  });

  // On garde l'indice d'origine de chaque pause : après le tri, c'est lui qui
  // permet de rattacher l'erreur au bon champ du formulaire.
  const sorted = input.breaks
    .map((b, index) => ({ ...b, index }))
    .sort((a, b) => (breaksOk ? toMin(a.start) - toMin(b.start) : 0));

  if (breaksOk && hoursOk) {
    let cursor = toMin(input.dayStart);
    for (const b of sorted) {
      const from = toMin(b.start);
      const to = toMin(b.end);
      if (to <= from) {
        add(`breaks.${b.index}.end`, "La pause doit finir après avoir commencé.");
        breaksOk = false;
      } else if (from < toMin(input.dayStart) || to > toMin(input.dayEnd)) {
        add(`breaks.${b.index}.start`, `La pause doit tenir entre ${input.dayStart} et ${input.dayEnd}.`);
        breaksOk = false;
      } else if (from < cursor) {
        add(`breaks.${b.index}.start`, "Cette pause chevauche la précédente.");
        breaksOk = false;
      }
      cursor = Math.max(cursor, to);
    }
  }

  // --- Segments multiples de la durée (règle 7) : seulement si tout le reste
  // de la journée est cohérent, sinon le message n'aurait pas de sens.
  if (hoursOk && durationOk && breaksOk) {
    const segments = daySegments(input);
    const last = segments.length - 1;
    segments.forEach(([from, to], k) => {
      const length = to - from;
      // Un segment commence au début de la journée, ou à la fin d'une pause.
      const field = k === 0 ? "dayStart" : `breaks.${sorted[k - 1].index}.end`;

      // Segment vide : une pause touche un bord de la journée ou une autre
      // pause. Le message propose la correction plutôt que « de 8 h à 8 h ».
      if (length <= 0 && k === 0) {
        const b = sorted[0];
        add(`breaks.${b.index}.start`, `Cette pause commence avec la journée. Faites plutôt commencer la journée à ${b.end}.`);
      } else if (length <= 0 && k === last) {
        const b = sorted[k - 1];
        add(`breaks.${b.index}.end`, `Cette pause finit avec la journée. Faites plutôt finir la journée à ${b.start}.`);
      } else if (length <= 0) {
        add(`breaks.${sorted[k].index}.start`, "Cette pause suit directement la précédente. Réunissez-les en une seule.");
      } else if (length % input.slotDuration !== 0) {
        add(
          field,
          `De ${toHHMM(from)} à ${toHHMM(to)}, la plage dure ${formatDuration(length)}. ` +
            `Ce n'est pas un multiple de ${formatDuration(input.slotDuration)} : le dernier créneau serait coupé.`,
        );
      }
    });
  }

  // --- Jours fériés (règle 11) : dans la période, sans doublon
  const seen = new Set<string>();
  input.holidays.forEach((h, i) => {
    if (!isISODate(h.date)) {
      add(`holidays.${i}`, "Indiquez une date valide.");
    } else if (periodOk && (h.date < input.startDate || h.date > input.endDate)) {
      add(`holidays.${i}`, "Ce jour tombe en dehors de la période du calendrier.");
    } else if (seen.has(h.date)) {
      add(`holidays.${i}`, "Ce jour est déjà retiré.");
    }
    seen.add(h.date);
  });

  return errors;
}
