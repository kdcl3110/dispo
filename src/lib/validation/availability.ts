// Validation d'un créneau signalé — SPEC.md §10, règles 1 à 6.
//
// Les créneaux n'étant pas une table, aucune clé étrangère ne garantit qu'un
// signalement tombe sur un créneau réel : ces règles sont le garde-fou.
// Fonctions pures : la fenêtre « Signaler un créneau » peut réutiliser
// validateExceptionInput pour vérifier le commentaire avant l'envoi.

import { calendarDays, generateSlots, type BreakRange, type ISODate, type Time } from "@/lib/slots";
import type { ValidationError } from "@/lib/validation/calendar";

// Mêmes valeurs que l'enum Prisma AvailabilityStatus.
export type AvailabilityStatus = "AVAILABLE" | "IF_NEEDED" | "UNAVAILABLE";
const STATUSES: AvailabilityStatus[] = ["AVAILABLE", "IF_NEEDED", "UNAVAILABLE"];

export const MAX_COMMENT_LENGTH = 500;

export interface ExceptionInput {
  date: ISODate;
  start: Time;
  status: string; // non typé : vient d'un formulaire
  comment: string;
}

export interface CalendarForValidation {
  startDate: ISODate;
  endDate: ISODate;
  weekDays: string[];
  dayStart: Time;
  dayEnd: Time;
  slotDuration: number;
  slotGap?: number;
  breaks: BreakRange[];
  holidays: { date: ISODate }[];
  publishedAt: Date | null;
}

export interface Actor {
  id: string;
  role: "USER" | "ADMIN";
}

export interface ResourceForValidation {
  ownerId: string | null;
}

// ---------------------------------------------------------------- règles 1 et 2

// Statut connu, et commentaire présent pour toute exception.
// « Disponible » n'a pas besoin de commentaire : il ne sera jamais écrit, la
// ligne sera supprimée (règle 2, appliquée par l'appelant).
export function validateExceptionInput(input: { status: string; comment: string }): ValidationError[] {
  if (!STATUSES.includes(input.status as AvailabilityStatus)) {
    return [{ field: "status", message: "Choisissez un statut." }];
  }
  if (input.status === "AVAILABLE") return [];

  const comment = input.comment.trim();
  if (!comment) {
    return [{ field: "comment", message: "Expliquez en quelques mots pourquoi ce créneau pose problème." }];
  }
  if (comment.length > MAX_COMMENT_LENGTH) {
    return [{ field: "comment", message: `Le commentaire dépasse ${MAX_COMMENT_LENGTH} caractères.` }];
  }
  return [];
}

// ---------------------------------------------------------------- règles 3 et 4

// Le créneau existe dans la grille générée : bonne heure de début (hors pause)
// et jour retenu par le calendrier (période, jour de cours, pas un jour retiré).
export function validateSlot(calendar: CalendarForValidation, slot: { date: ISODate; start: Time }): ValidationError[] {
  const errors: ValidationError[] = [];

  const starts = generateSlots(calendar).map((s) => s.start);
  if (!starts.includes(slot.start)) {
    errors.push({ field: "slot", message: "Ce créneau n'existe pas dans la grille du calendrier." });
  }

  const days = calendarDays({ ...calendar, holidays: calendar.holidays.map((h) => h.date) });
  if (!days.includes(slot.date)) {
    errors.push({ field: "slot", message: "Ce jour ne fait pas partie du calendrier." });
  }
  return errors;
}

// ---------------------------------------------------------------- règles 5 et 6

// Qui peut écrire sur quelle ressource, et quand. Renvoie null si l'accès est
// accordé, sinon le motif du refus.
export function checkAccess(
  actor: Actor,
  resource: ResourceForValidation,
  calendar: { publishedAt: Date | null },
): ValidationError | null {
  if (actor.role === "USER") {
    // Règle 6 : un membre du personnel n'agit que sur sa propre fiche.
    if (resource.ownerId !== actor.id) {
      return { field: "form", message: "Vous ne pouvez modifier que vos propres disponibilités." };
    }
    // Règle 5 : rien n'est modifiable avant la publication.
    if (!calendar.publishedAt) {
      return { field: "form", message: "Le calendrier n'est pas encore publié." };
    }
    return null;
  }

  // ADMIN : n'importe quelle ressource, jamais la sienne. Il n'en a pas (SPEC
  // §4) ; le contrôle protège contre une fiche qui lui aurait été rattachée.
  if (resource.ownerId === actor.id) {
    return { field: "form", message: "Un administrateur ne déclare pas ses propres disponibilités." };
  }
  return null;
}

// ---------------------------------------------------------------- tout ensemble

// Ordre : droits d'abord (inutile de détailler les erreurs d'un refus), puis
// la saisie, puis l'existence du créneau.
export function validateException(
  actor: Actor,
  resource: ResourceForValidation,
  calendar: CalendarForValidation,
  input: ExceptionInput,
): ValidationError[] {
  const denied = checkAccess(actor, resource, calendar);
  if (denied) return [denied];
  return [...validateExceptionInput(input), ...validateSlot(calendar, input)];
}
