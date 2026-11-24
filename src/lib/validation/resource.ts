// Validation d'une ressource saisie à la main ou importée : un local ou un
// équipement, ou un membre du personnel (son adresse Google et son nom).

import type { ValidationError } from "@/lib/validation/calendar";

export const MAX_RESOURCE_NAME_LENGTH = 120;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_BUILDING_LENGTH = 120;
export const MAX_CATALOG_NAME_LENGTH = 60; // type de local, caractéristique
export const MAX_CAPACITY = 10_000;
export const MAX_FEATURE_QUANTITY = 10_000;
export const MAX_FEATURES = 30;

// Taille maximale d'un fichier d'import : 1 Mo, la limite par défaut des
// Server Actions. Une liste de locaux pèse quelques kilo-octets.
export const MAX_IMPORT_BYTES = 1024 * 1024;

// Types qu'un administrateur peut créer ou modifier.
export type EditableResourceType = "LOCAL" | "EQUIPMENT";
export const EDITABLE_TYPES: EditableResourceType[] = ["LOCAL", "EQUIPMENT"];

// Description d'un local. Le type et les caractéristiques sont donnés par leur
// nom : un nom inconnu est ajouté aux listes à l'enregistrement.
export interface RoomDetails {
  capacity: number | null;
  building: string; // vide = non renseigné
  roomType: string; // vide = non renseigné
  features: { name: string; quantity: number }[];
}

export const EMPTY_ROOM: RoomDetails = { capacity: null, building: "", roomType: "", features: [] };

export function isEmptyRoom(room: RoomDetails) {
  return room.capacity === null && !room.building.trim() && !room.roomType.trim() && room.features.length === 0;
}

export function validateResourceInput(input: { type: string; name: string; room?: RoomDetails }): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!EDITABLE_TYPES.includes(input.type as EditableResourceType)) {
    errors.push({ field: "type", message: "Choisissez « local » ou « équipement »." });
  }

  const name = input.name.trim();
  if (!name) {
    errors.push({ field: "name", message: "Donnez un nom à la ressource." });
  } else if (name.length > MAX_RESOURCE_NAME_LENGTH) {
    errors.push({ field: "name", message: `Le nom dépasse ${MAX_RESOURCE_NAME_LENGTH} caractères.` });
  }

  const room = input.room ?? EMPTY_ROOM;
  if (input.type !== "LOCAL") {
    if (!isEmptyRoom(room)) {
      errors.push({ field: "room", message: "Capacité, bâtiment, type de local et caractéristiques sont réservés aux locaux." });
    }
    return errors;
  }
  return [...errors, ...validateRoom(room)];
}

function validateRoom(room: RoomDetails): ValidationError[] {
  const errors: ValidationError[] = [];

  if (room.capacity !== null && !(Number.isInteger(room.capacity) && room.capacity >= 1 && room.capacity <= MAX_CAPACITY)) {
    errors.push({ field: "capacity", message: `La capacité est un nombre de places entier, de 1 à ${MAX_CAPACITY}.` });
  }
  if (room.building.trim().length > MAX_BUILDING_LENGTH) {
    errors.push({ field: "building", message: `Le bâtiment dépasse ${MAX_BUILDING_LENGTH} caractères.` });
  }
  if (room.roomType.trim().length > MAX_CATALOG_NAME_LENGTH) {
    errors.push({ field: "roomType", message: `Le type de local dépasse ${MAX_CATALOG_NAME_LENGTH} caractères.` });
  }

  if (room.features.length > MAX_FEATURES) {
    errors.push({ field: "features", message: `${MAX_FEATURES} caractéristiques au plus.` });
    return errors;
  }
  const seen = new Set<string>();
  for (const feature of room.features) {
    const name = feature.name.trim();
    if (!name) {
      errors.push({ field: "features", message: "Une caractéristique n'a pas de nom." });
      break;
    }
    if (name.length > MAX_CATALOG_NAME_LENGTH) {
      errors.push({ field: "features", message: `« ${name.slice(0, 20)}… » dépasse ${MAX_CATALOG_NAME_LENGTH} caractères.` });
      break;
    }
    if (!(Number.isInteger(feature.quantity) && feature.quantity >= 1 && feature.quantity <= MAX_FEATURE_QUANTITY)) {
      errors.push({ field: "features", message: `La quantité de « ${name} » doit être un entier de 1 à ${MAX_FEATURE_QUANTITY}.` });
      break;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      errors.push({ field: "features", message: `« ${name} » est cité deux fois.` });
      break;
    }
    seen.add(key);
  }
  return errors;
}

// ---------------------------------------------------------------- personnel

// Domaines d'ALLOWED_EMAIL_DOMAINS (« he2b.be, autre.be »), en minuscules.
export function parseAllowedDomains(text: string | undefined): string[] {
  return (text ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

// Domaine comparé à l'identique : « he2b.be » autorisé n'ouvre PAS
// « etu.he2b.be » (les étudiants).
export function isAllowedEmail(email: string, domains: string[]) {
  const at = email.lastIndexOf("@");
  return at > 0 && domains.includes(email.slice(at + 1).toLowerCase());
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

// Membre du personnel ajouté par l'admin. Le nom est facultatif : sans nom,
// l'adresse en tient lieu jusqu'à la première connexion, où Google donne le vrai.
export function validatePersonInput(input: { email: string; name: string }, domains: string[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const email = normalizeEmail(input.email);

  if (!email) {
    errors.push({ field: "email", message: "Donnez l'adresse e-mail." });
  } else if (email.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: "email", message: `« ${email} » n'est pas une adresse e-mail valide.` });
  } else if (!isAllowedEmail(email, domains)) {
    const list = domains.map((d) => `@${d}`).join(", ") || "(aucun domaine configuré)";
    errors.push({ field: "email", message: `Seules les adresses ${list} sont acceptées.` });
  }

  if (input.name.trim().length > MAX_RESOURCE_NAME_LENGTH) {
    errors.push({ field: "name", message: `Le nom dépasse ${MAX_RESOURCE_NAME_LENGTH} caractères.` });
  }
  return errors;
}

// Nom d'une entrée des listes (type de local, caractéristique), à la création
// ou au renommage.
export function validateCatalogName(name: string): ValidationError[] {
  const trimmed = name.trim();
  if (!trimmed) return [{ field: "name", message: "Donnez un nom." }];
  if (trimmed.length > MAX_CATALOG_NAME_LENGTH) {
    return [{ field: "name", message: `Le nom dépasse ${MAX_CATALOG_NAME_LENGTH} caractères.` }];
  }
  return [];
}

// Cellule « caractéristiques » de l'import : « Projecteur, PC (30), Tableau blanc ».
// La quantité se met entre parenthèses ; « PC x30 » est aussi compris.
// Renvoie null si une quantité est illisible (« PC (trente) »).
export function parseFeatures(text: string): { name: string; quantity: number }[] | null {
  const features: { name: string; quantity: number }[] = [];
  for (const part of text.split(/[,;\n]/)) {
    const item = part.trim();
    if (!item) continue;
    // « x30 » doit être précédé d'une espace : « Box30 » reste un nom.
    const match = /^(.*?)(?:\s*\(\s*([^)]*?)\s*\)|\s+[x×]\s*(\d+))$/i.exec(item);
    if (!match) {
      features.push({ name: item, quantity: 1 });
      continue;
    }
    const quantity = Number(match[2] ?? match[3]);
    if (!Number.isInteger(quantity) || !match[1].trim()) return null;
    features.push({ name: match[1].trim(), quantity });
  }
  return features;
}
