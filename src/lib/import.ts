// Import Excel des locaux et équipements — SPEC.md §8.
//
// Format : première feuille, ligne d'en-tête avec les colonnes « type » et
// « name ». type vaut « local » ou « equipment ». L'import est rejouable :
// une ressource déjà connue (même type, même nom sans tenir compte de la
// casse) n'est pas dupliquée. Les personnes ne s'importent pas.

import "server-only";

import * as XLSX from "xlsx";

import { prisma } from "@/lib/prisma";
import { validateResourceInput, type EditableResourceType } from "@/lib/validation/resource";

export const MAX_IMPORT_ROWS = 2000;

const TYPES: Record<string, EditableResourceType> = { local: "LOCAL", equipment: "EQUIPMENT" };

export interface ImportRow {
  line: number; // numéro de ligne dans le fichier (l'en-tête est la ligne 1)
  type: EditableResourceType;
  name: string;
}

export interface IgnoredRow {
  line: number;
  reason: string;
}

// Lit la première feuille et sépare les lignes utilisables des lignes refusées.
// Lève une erreur si le fichier n'est pas un classeur lisible.
export function parseResourceSheet(buffer: ArrayBuffer): { rows: ImportRow[]; ignored: IgnoredRow[]; missingColumns: string[] } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = sheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false }) : [];

  // En-têtes normalisés : « Type », « NAME » ou « name » valent tous la même colonne.
  const records = raw.map((record) =>
    Object.fromEntries(Object.entries(record).map(([key, value]) => [key.trim().toLowerCase(), String(value).trim()])),
  );
  const headers = new Set(records.flatMap((r) => Object.keys(r)));
  const missingColumns = records.length > 0 ? ["type", "name"].filter((h) => !headers.has(h)) : [];

  const rows: ImportRow[] = [];
  const ignored: IgnoredRow[] = [];
  const seen = new Set<string>();

  records.forEach((record, i) => {
    const line = i + 2;
    const typeText = (record.type ?? "").toLowerCase();
    const name = record.name ?? "";

    if (!typeText && !name) return; // ligne vide : ignorée sans bruit

    const type = TYPES[typeText];
    if (!type) {
      ignored.push({ line, reason: typeText ? `type « ${record.type} » inconnu. Utilisez local ou equipment.` : "type manquant." });
      return;
    }
    const errors = validateResourceInput({ type, name });
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
    rows.push({ line, type, name });
  });

  return { rows, ignored, missingColumns };
}

// Crée les ressources absentes, en une écriture. Renvoie le compte des
// ressources créées et de celles qui existaient déjà.
export async function importResources(rows: ImportRow[]) {
  const existing = await prisma.resource.findMany({
    where: { type: { in: ["LOCAL", "EQUIPMENT"] } },
    select: { type: true, name: true },
  });
  const known = new Set(existing.map((r) => `${r.type}|${r.name.toLowerCase()}`));

  const toCreate = rows.filter((r) => !known.has(`${r.type}|${r.name.toLowerCase()}`));
  await prisma.resource.createMany({ data: toCreate.map((r) => ({ type: r.type, name: r.name })) });

  return { created: toCreate.length, alreadyKnown: rows.length - toCreate.length };
}
