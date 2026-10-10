// Génération de la grille — voir SPEC.md §6.
//
// Les créneaux ne sont JAMAIS stockés : ils se recalculent à partir de la
// configuration du calendrier. Ces fonctions servent à l'affichage des grilles,
// à la validation serveur et à l'export ; elles doivent donc rester pures
// (aucun accès base, aucune dépendance à l'heure locale).
//
// Conventions :
//  - une heure est une chaîne "HH:MM" ;
//  - une date est une chaîne ISO "YYYY-MM-DD", calculée en UTC. Prisma
//    stocke les colonnes @db.Date à minuit UTC : travailler en heure locale
//    (Bruxelles, UTC+1/+2) décalerait certaines dates d'un jour.

export type Time = string;
export type ISODate = string;

export type WeekDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface BreakRange {
  start: Time;
  end: Time;
}

export interface DayConfig {
  dayStart: Time;
  dayEnd: Time;
  slotDuration: number; // en minutes
  breaks?: BreakRange[];
}

export interface PeriodConfig {
  startDate: ISODate;
  endDate: ISODate;
  weekDays: string[];
  holidays?: ISODate[];
}

export interface Slot {
  id: string; // "s1", "s2"… — n'existe que dans l'export (SPEC §9)
  start: Time;
  end: Time;
}

// ---------------------------------------------------------------- heures

export function toMin(time: Time): number {
  const [hh, mm] = time.split(":").map(Number);
  return hh * 60 + mm;
}

export function toHHMM(minutes: number): Time {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Découpe la journée en segments [début, fin] (en minutes), séparés par les
// pauses. Une journée sans pause donne un seul segment.
export function daySegments({ dayStart, dayEnd, breaks = [] }: DayConfig): [number, number][] {
  const sorted = [...breaks].sort((a, b) => toMin(a.start) - toMin(b.start));
  const segments: [number, number][] = [];
  let cursor = toMin(dayStart);
  for (const b of sorted) {
    segments.push([cursor, toMin(b.start)]);
    cursor = toMin(b.end);
  }
  segments.push([cursor, toMin(dayEnd)]);
  return segments;
}

// Créneaux d'une journée, pauses exclues. Les id sont déterministes : la
// numérotation court sur toute la journée en sautant les pauses.
export function generateSlots(config: DayConfig): Slot[] {
  // Garde-fou : une durée nulle ou négative bouclerait à l'infini.
  if (!(config.slotDuration > 0)) {
    throw new Error(`Durée de créneau invalide : ${config.slotDuration}.`);
  }

  const slots: Slot[] = [];
  let i = 1;
  for (const [from, to] of daySegments(config)) {
    for (let t = from; t + config.slotDuration <= to; t += config.slotDuration) {
      slots.push({ id: `s${i++}`, start: toHHMM(t), end: toHHMM(t + config.slotDuration) });
    }
  }
  return slots;
}

// Clé d'un créneau précis : "2026-09-24|14:00". Sert d'index aux créneaux
// signalés, côté serveur comme côté navigateur.
export const slotKey = (date: ISODate, start: Time) => `${date}|${start}`;

// ---------------------------------------------------------------- dates

const WEEK_DAYS: WeekDay[] = [
  "sunday", // getUTCDay() = 0
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

// Date Prisma (@db.Date, minuit UTC) → "YYYY-MM-DD".
export function toISODate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

// "YYYY-MM-DD" → nom du jour ("monday"…), calculé en UTC.
export function weekDayOf(date: ISODate): WeekDay {
  return WEEK_DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

// "YYYY-MM-DD" décalé de `days` jours.
export function addDays(date: ISODate, days: number): ISODate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

// Lundi de la semaine qui contient `date`.
export function mondayOf(date: ISODate): ISODate {
  const d = new Date(`${date}T00:00:00Z`);
  return addDays(date, -((d.getUTCDay() + 6) % 7));
}

// Semaines du calendrier, du lundi de la semaine de startDate jusqu'à celle de
// endDate. Chaque semaine liste ses dates par jour de cours, ou null quand la
// date tombe hors de la période (première et dernière semaines incomplètes).
export function calendarWeekGrid({ startDate, endDate, weekDays }: PeriodConfig) {
  const order: WeekDay[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const days = order.filter((day) => weekDays.includes(day));
  const weeks: { monday: ISODate; dates: (ISODate | null)[] }[] = [];

  for (let monday = mondayOf(startDate); monday <= endDate; monday = addDays(monday, 7)) {
    weeks.push({
      monday,
      dates: days.map((day) => {
        const date = addDays(monday, order.indexOf(day));
        return date >= startDate && date <= endDate ? date : null;
      }),
    });
  }
  return { days, weeks };
}

// Regroupe des jours retirés en périodes : deux jours retirés sont dans la
// même période s'il n'y a aucun jour de cours entre eux (un congé du lundi au
// vendredi suivant le week-end reste une seule période).
export function holidayPeriods(
  period: PeriodConfig,
  holidays: { date: ISODate; label?: string | null }[],
) {
  const courseDays = calendarDays({ ...period, holidays: [] });
  const position = new Map(courseDays.map((date, i) => [date, i]));
  const sorted = [...holidays]
    .filter((h) => position.has(h.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  const periods: { from: ISODate; to: ISODate; dates: ISODate[]; label: string }[] = [];
  for (const h of sorted) {
    const last = periods.at(-1);
    if (last && position.get(h.date) === position.get(last.to)! + 1) {
      last.to = h.date;
      last.dates.push(h.date);
      last.label ||= h.label ?? "";
    } else {
      periods.push({ from: h.date, to: h.date, dates: [h.date], label: h.label ?? "" });
    }
  }
  return periods;
}

// Jours retenus par le calendrier, dans l'ordre : compris entre startDate et
// endDate, sur un jour de weekDays, et absents des jours fériés.
export function calendarDays({ startDate, endDate, weekDays, holidays = [] }: PeriodConfig): ISODate[] {
  const holidaySet = new Set(holidays);
  const days: ISODate[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const last = new Date(`${endDate}T00:00:00Z`);

  while (cursor <= last) {
    const date = toISODate(cursor);
    if (weekDays.includes(weekDayOf(date)) && !holidaySet.has(date)) {
      days.push(date);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
