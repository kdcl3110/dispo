// Import Excel des locaux et équipements — SPEC.md §8.
//
// Format : première feuille, ligne d'en-tête. Colonnes obligatoires « type »
// (local ou equipment) et « name » ; colonnes facultatives, pour les locaux
// seulement : « room_type », « capacity », « building », « features »
// (« Projecteur, PC (30) »).
//
// L'import est rejouable : une ressource déjà connue (même type, même nom sans
// tenir compte de la casse) n'est pas dupliquée. Pour un local déjà connu, les
// colonnes facultatives présentes dans le fichier remplacent sa description
// (une case vide efface la valeur) ; les colonnes absentes n'y touchent pas.
// Un type de local ou une caractéristique inconnus sont ajoutés aux listes.
//
// La liste du personnel s'importe à part (parseStaffSheet / importStaff) :
// colonnes « email » (obligatoire) et « name ». Seules les adresses de cette
// liste peuvent se connecter.

import "server-only";

import * as XLSX from "xlsx";

import { prisma } from "@/lib/prisma";
import { createPerson, resolveCatalog, roomData } from "@/lib/resource";
import {
  normalizeEmail,
  parseFeatures,
  validatePersonInput,
  validateResourceInput,
  type EditableResourceType,
  type RoomDetails,
} from "@/lib/validation/resource";

export const MAX_IMPORT_ROWS = 2000;

const TYPES: Record<string, EditableResourceType> = { local: "LOCAL", equipment: "EQUIPMENT" };

export const ROOM_COLUMNS = ["room_type", "capacity", "building", "features"] as const;
export type RoomColumn = (typeof ROOM_COLUMNS)[number];

export interface ImportRow {
  line: number; // numéro de ligne dans le fichier (l'en-tête est la ligne 1)
  type: EditableResourceType;
  name: string;
  room: RoomDetails;
}

export interface IgnoredRow {
  line: number;
  reason: string;
}

// Lignes de la première feuille, en-têtes normalisés : « Type », « NAME » ou
// « name » valent tous la même colonne, et « Room type » vaut « room_type ».
// Lève une erreur si le fichier n'est pas un classeur lisible.
function readSheet(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = sheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false }) : [];
  const records = raw.map((record) =>
    Object.fromEntries(
      Object.entries(record).map(([key, value]) => [key.trim().toLowerCase().replace(/\s+/g, "_"), String(value).trim()]),
    ),
  );
  return { records, headers: new Set(records.flatMap((r) => Object.keys(r))) };
}

// Lit la première feuille et sépare les lignes utilisables des lignes refusées.
// `roomColumns` : colonnes facultatives présentes dans le fichier.
// Lève une erreur si le fichier n'est pas un classeur lisible.
export function parseResourceSheet(buffer: ArrayBuffer): {
  rows: ImportRow[];
  ignored: IgnoredRow[];
  missingColumns: string[];
  roomColumns: RoomColumn[];
} {
  const { records, headers } = readSheet(buffer);
  const missingColumns = records.length > 0 ? ["type", "name"].filter((h) => !headers.has(h)) : [];
  const roomColumns = ROOM_COLUMNS.filter((h) => headers.has(h));

  const rows: ImportRow[] = [];
  const ignored: IgnoredRow[] = [];
  const seen = new Set<string>();

  records.forEach((record, i) => {
    const line = i + 2;
    const typeText = (record.type ?? "").toLowerCase();
    const name = record.name ?? "";
    const details = ROOM_COLUMNS.map((c) => record[c] ?? "");

    if (!typeText && !name && details.every((d) => !d)) return; // ligne vide : ignorée sans bruit

    const type = TYPES[typeText];
    if (!type) {
      ignored.push({ line, reason: typeText ? `type « ${record.type} » inconnu. Utilisez local ou equipment.` : "type manquant." });
      return;
    }

    const capacityText = record.capacity ?? "";
    const capacity = capacityText ? Number(capacityText.replace(/\s/g, "")) : null;
    if (capacity !== null && !Number.isInteger(capacity)) {
      ignored.push({ line, reason: `capacité « ${capacityText} » illisible : donnez un nombre de places.` });
      return;
    }
    const features = parseFeatures(record.features ?? "");
    if (!features) {
      ignored.push({ line, reason: `caractéristiques illisibles : écrivez la quantité en chiffres, par exemple « PC (30) ».` });
      return;
    }
    const room: RoomDetails = { capacity, building: record.building ?? "", roomType: record.room_type ?? "", features };

    const errors = validateResourceInput({ type, name, room });
    if (errors.length > 0) {
      ignored.push({ line, reason: errors[0].field === "name" && !name ? "le nom est vide." : errors[0].message });
      return;
    }
    const key = `${type}|${name.toLowerCase()}`;
    if (seen.has(key)) {
      ignored.push({ line, reason: `« ${name} » apparaît déjà plus haut dans le fichier.` });
      return;
    }
    seen.add(key);
    rows.push({ line, type, name, room: { ...room, building: room.building.trim(), roomType: room.roomType.trim() } });
  });

  return { rows, ignored, missingColumns, roomColumns };
}

// Crée les ressources absentes et met à jour la description des locaux déjà
// connus, en une transaction : tout est écrit, ou rien.
export async function importResources(rows: ImportRow[], roomColumns: RoomColumn[]) {
  const present = new Set(roomColumns);

  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.resource.findMany({
        where: { type: { in: ["LOCAL", "EQUIPMENT"] } },
        select: { id: true, type: true, name: true },
      });
      const known = new Map(existing.map((r) => [`${r.type}|${r.name.toLowerCase()}`, r.id]));

      const locals = rows.filter((r) => r.type === "LOCAL");
      const catalog = await resolveCatalog(
        tx,
        locals.map((r) => r.room.roomType),
        locals.flatMap((r) => r.room.features.map((f) => f.name)),
      );

      let created = 0;
      let updated = 0;
      let unchanged = 0;
      for (const row of rows) {
        const id = known.get(`${row.type}|${row.name.toLowerCase()}`);
        const { columns, features } = roomData(row.room, catalog);

        if (!id) {
          await tx.resource.create({ data: { type: row.type, name: row.name, ...columns, features: { create: features } } });
          created++;
          continue;
        }
        if (row.type !== "LOCAL" || present.size === 0) {
          unchanged++;
          continue;
        }
        await tx.resource.update({
          where: { id },
          data: {
            ...(present.has("capacity") && { capacity: columns.capacity }),
            ...(present.has("building") && { building: columns.building }),
            ...(present.has("room_type") && { roomTypeId: columns.roomTypeId }),
            ...(present.has("features") && { features: { deleteMany: {}, create: features } }),
          },
        });
        updated++;
      }

      return { created, updated, alreadyKnown: unchanged, createdRoomTypes: catalog.created.roomTypes, createdFeatures: catalog.created.features };
    },
    // Jusqu'à 2000 lignes, une écriture chacune : au-delà des 5 s par défaut.
    { timeout: 60_000 },
  );
}

// ---------------------------------------------------------------- liste du personnel

export interface StaffRow {
  line: number;
  email: string; // en minuscules
  name: string; // vide = non renseigné
}

// Lit la liste du personnel : une adresse par ligne, nom facultatif. Une
// adresse hors des domaines autorisés (ou d'étudiant) est refusée.
export function parseStaffSheet(
  buffer: ArrayBuffer,
  domains: string[],
): { rows: StaffRow[]; ignored: IgnoredRow[]; missingColumns: string[] } {
  const { records, headers } = readSheet(buffer);
  const missingColumns = records.length > 0 && !headers.has("email") ? ["email"] : [];

  const rows: StaffRow[] = [];
  const ignored: IgnoredRow[] = [];
  const seen = new Set<string>();

  records.forEach((record, i) => {
    const line = i + 2;
    const email = normalizeEmail(record.email ?? "");
    const name = (record.name ?? "").trim();
    if (!email && !name) return; // ligne vide : ignorée sans bruit

    const errors = validatePersonInput({ email, name }, domains);
    if (errors.length > 0) {
      ignored.push({ line, reason: !email ? "l'adresse e-mail est vide." : errors[0].message });
      return;
    }
    if (seen.has(email)) {
      ignored.push({ line, reason: `${email} apparaît déjà plus haut dans le fichier.` });
      return;
    }
    seen.add(email);
    rows.push({ line, email, name });
  });

  return { rows, ignored, missingColumns };
}

// Crée les comptes absents et rouvre l'accès de ceux de la liste qui l'avaient
// perdu, en une transaction. Le nom du fichier n'est appliqué qu'à un compte
// jamais connecté : ensuite, c'est Google qui le donne.
// Les comptes absents du fichier ne sont pas touchés.
export async function importStaff(rows: StaffRow[]) {
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.user.findMany({
        where: { email: { in: rows.map((r) => r.email) } },
        select: { id: true, email: true, role: true, name: true, disabledAt: true, lastLoginAt: true },
      });
      const known = new Map(existing.map((u) => [u.email!, u]));

      let created = 0;
      let alreadyKnown = 0;
      const reactivated: string[] = [];
      const ignored: IgnoredRow[] = [];

      for (const row of rows) {
        const user = known.get(row.email);
        if (!user) {
          await createPerson(row, tx);
          created++;
          continue;
        }
        if (user.role !== "USER") {
          ignored.push({ line: row.line, reason: `${row.email} est un compte administrateur.` });
          continue;
        }
        const rename = user.lastLoginAt === null && row.name !== "" && row.name !== user.name;
        if (user.disabledAt || rename) {
          await tx.user.update({
            where: { id: user.id },
            data: {
              disabledAt: null,
              ...(rename && { name: row.name, resource: { update: { name: row.name } } }),
            },
          });
        }
        if (user.disabledAt) reactivated.push(row.email);
        else alreadyKnown++;
      }

      return { created, reactivated, alreadyKnown, ignored };
    },
    { timeout: 60_000 },
  );
}
