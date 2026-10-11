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
  slotDuration: number; // en minutes, la même pour tous les créneaux
  slotGap?: number; // intercours entre deux créneaux, en minutes (0 par défaut)
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

// Créneaux d'une journée. Tous ont la même durée ; on enchaîne
//   créneau → intercours → créneau → …
// Si un créneau mordait sur une pause, il repart à la fin de la pause (sans
// intercours en plus : la pause en tient lieu). On s'arrête quand le créneau
// suivant ne tient plus avant la fin de journée.
//
// Exemple HE2B : 08:00–18:00, 2 h, intercours 30 min, pause 12:30–13:30
//   → 08:00–10:00, 10:30–12:30, 13:30–15:30, 16:00–18:00.
//
// Les id (s1, s2…) suivent l'ordre de la journée : ils sont déterministes.
export function generateSlots(config: DayConfig): Slot[] {
  const duration = config.slotDuration;
  const gap = config.slotGap ?? 0;
  // Garde-fous : une durée nulle ou un intercours négatif boucleraient à l'infini.
  if (!(duration > 0)) throw new Error(`Durée de créneau invalide : ${duration}.`);
  if (!(gap >= 0)) throw new Error(`Intercours invalide : ${gap}.`);

  const breaks = (config.breaks ?? []).map((b) => ({ start: toMin(b.start), end: toMin(b.end) }));
  const end = toMin(config.dayEnd);
  const slots: Slot[] = [];

  let t = toMin(config.dayStart);
  while (t + duration <= end) {
    // Une pause chevauche [t, t + durée] : on reprend à sa fin.
    const blocking = breaks.find((b) => t < b.end && t + duration > b.start);
    if (blocking) {
      t = blocking.end;
      continue;
    }
    slots.push({ id: `s${slots.length + 1}`, start: toHHMM(t), end: toHHMM(t + duration) });
    t += duration + gap;
  }
  return slots;
}

// Minutes inutilisées entre la fin du dernier créneau et la fin de journée.
// Ce n'est pas une erreur, juste une information pour l'aperçu.
export function unusedMinutes(config: DayConfig) {
  const slots = generateSlots(config);
  return slots.length ? toMin(config.dayEnd) - toMin(slots.at(-1)!.end) : 0;
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
// endDate, en ne gardant que celles qui ont au moins un jour de cours. Chaque
// semaine liste ses dates par jour de cours, ou null quand la date tombe hors
// de la période (première et dernière semaines incomplètes). C'est aussi le
// nombre de semaines à afficher ; la limite des 15 semaines, elle, se compte
// en semaines calendaires (calendarWeeks, src/lib/validation/calendar.ts).
export function calendarWeekGrid({ startDate, endDate, weekDays }: PeriodConfig) {
  const order: WeekDay[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const days = order.filter((day) => weekDays.includes(day));
  const weeks: { monday: ISODate; dates: (ISODate | null)[] }[] = [];

  for (let monday = mondayOf(startDate); monday <= endDate; monday = addDays(monday, 7)) {
    const dates = days.map((day) => {
      const date = addDays(monday, order.indexOf(day));
      return date >= startDate && date <= endDate ? date : null;
    });
    // Une semaine sans aucun jour de cours dans la période (calendrier qui
    // commence un dimanche, ou finit un lundi avec cours du mardi au vendredi)
    // ne donnerait qu'une colonne vide : on ne la garde pas.
    if (dates.some((date) => date !== null)) weeks.push({ monday, dates });
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

// ---------------------------------------------------------------- changement de grille

export type GridConfig = DayConfig & PeriodConfig;

export interface PlannedException<T> {
  exception: T;
  start: Time; // heure de début dans la nouvelle grille
}

// Effet d'un changement de configuration (horaires, période, jours, jours
// retirés) sur les créneaux déjà signalés. Chaque signalement est :
//  - gardé tel quel : sa date et son heure existent encore ;
//  - déplacé : les horaires ont changé mais pas le nombre de créneaux par
//    jour, il suit son créneau (le 2e reste le 2e : 10:00 → 10:30) ;
//  - supprimé : son jour ne fait plus partie du calendrier, ou son heure n'a
//    plus de créneau (le nombre de créneaux par jour a changé).
export function planGridChange<T extends { date: ISODate; start: Time }>(
  before: GridConfig,
  after: GridConfig,
  exceptions: T[],
): { kept: T[]; moved: PlannedException<T>[]; removed: { exception: T; reason: "day" | "time" }[] } {
  const oldStarts = generateSlots(before).map((s) => s.start);
  const newStarts = generateSlots(after).map((s) => s.start);
  // Même nombre de créneaux : on suit la position. Sinon, seule l'heure exacte compte.
  const byPosition = oldStarts.length === newStarts.length;
  const days = new Set(calendarDays(after));

  const kept: T[] = [];
  const moved: PlannedException<T>[] = [];
  const removed: { exception: T; reason: "day" | "time" }[] = [];

  for (const exception of exceptions) {
    const index = oldStarts.indexOf(exception.start);
    const start = byPosition && index >= 0 ? newStarts[index] : newStarts.includes(exception.start) ? exception.start : null;
    if (!days.has(exception.date)) removed.push({ exception, reason: "day" });
    else if (start === null) removed.push({ exception, reason: "time" });
    else if (start !== exception.start) moved.push({ exception, start });
    else kept.push(exception);
  }
  return { kept, moved, removed };
}
