"use server";

// Server Actions des imports de la page Ressources : locaux et équipements
// (SPEC §8), et liste du personnel autorisé à se connecter.
// Ordre immuable : droits → contrôle du fichier → lecture → écriture.

import { revalidatePath } from "next/cache";

import { importResources, importStaff, MAX_IMPORT_ROWS, parseResourceSheet, parseStaffSheet, type IgnoredRow } from "@/lib/import";
import { requireAdmin } from "@/lib/session";
import { MAX_IMPORT_BYTES, parseAllowedDomains } from "@/lib/validation/resource";

type Failure = { ok: false; message: string };

export type ImportResult =
  | {
      ok: true;
      created: number;
      updated: number; // locaux déjà connus dont la description a été mise à jour
      alreadyKnown: number; // déjà connus, rien à mettre à jour
      createdRoomTypes: string[]; // ajoutés aux listes par l'import
      createdFeatures: string[];
      ignored: IgnoredRow[];
    }
  | Failure;

export type StaffImportResult =
  | {
      ok: true;
      created: number; // comptes créés
      reactivated: string[]; // adresses dont l'accès a été rouvert
      alreadyKnown: number; // déjà autorisés
      ignored: IgnoredRow[];
    }
  | Failure;

// Contrôles communs aux deux imports. Renvoie le contenu, ou un message.
// Selon le chemin emprunté, le fichier arrive comme File ou comme simple
// Blob (son parent, sans nom) : on accepte les deux.
async function readUpload(formData: FormData, extensions: RegExp, label: string): Promise<ArrayBuffer | Failure> {
  const file = formData.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return { ok: false, message: `Choisissez un fichier ${label}.` };
  }
  const name = file instanceof File ? file.name : "";
  if (name && !extensions.test(name)) {
    return { ok: false, message: `Ce fichier n'est pas au bon format. Utilisez un fichier ${label}.` };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, message: "Le fichier dépasse 1 Mo." };
  }
  return file.arrayBuffer();
}

const UNREADABLE = "Le fichier est illisible. Enregistrez-le à nouveau depuis Excel puis réessayez.";
const TOO_MANY = `Le fichier contient plus de ${MAX_IMPORT_ROWS} lignes. Découpez-le en plusieurs fichiers.`;

export async function importResourcesFile(formData: FormData): Promise<ImportResult> {
  await requireAdmin();

  const buffer = await readUpload(formData, /\.xlsx?$/i, "Excel (.xls ou .xlsx)");
  if (!(buffer instanceof ArrayBuffer)) return buffer;

  let parsed;
  try {
    parsed = parseResourceSheet(buffer);
  } catch {
    return { ok: false, message: UNREADABLE };
  }

  if (parsed.missingColumns.length > 0) {
    return {
      ok: false,
      message: `La première feuille doit avoir une ligne d'en-tête avec les colonnes type et name. Manquante : ${parsed.missingColumns.join(", ")}.`,
    };
  }
  if (parsed.rows.length + parsed.ignored.length === 0) {
    return { ok: false, message: "La première feuille ne contient aucune ligne à importer." };
  }
  if (parsed.rows.length > MAX_IMPORT_ROWS) return { ok: false, message: TOO_MANY };

  const result = await importResources(parsed.rows, parsed.roomColumns);
  revalidatePath("/admin/resources");
  return { ok: true, ...result, ignored: parsed.ignored };
}

// Liste du personnel : crée les comptes absents et rouvre l'accès de ceux qui
// l'avaient perdu. Les comptes absents du fichier ne sont pas touchés.
export async function importStaffFile(formData: FormData): Promise<StaffImportResult> {
  await requireAdmin();

  const buffer = await readUpload(formData, /\.(xlsx?|csv)$/i, "Excel ou CSV (.xls, .xlsx ou .csv)");
  if (!(buffer instanceof ArrayBuffer)) return buffer;

  let parsed;
  try {
    parsed = parseStaffSheet(buffer, parseAllowedDomains(process.env.ALLOWED_EMAIL_DOMAINS));
  } catch {
    return { ok: false, message: UNREADABLE };
  }

  if (parsed.missingColumns.length > 0) {
    return { ok: false, message: "La première feuille doit avoir une ligne d'en-tête avec la colonne email (et, si vous le souhaitez, name)." };
  }
  if (parsed.rows.length + parsed.ignored.length === 0) {
    return { ok: false, message: "La première feuille ne contient aucune adresse à importer." };
  }
  if (parsed.rows.length > MAX_IMPORT_ROWS) return { ok: false, message: TOO_MANY };

  const result = await importStaff(parsed.rows);
  revalidatePath("/admin/resources");
  revalidatePath("/admin/availability");
  return { ok: true, ...result, ignored: [...parsed.ignored, ...result.ignored].sort((a, b) => a.line - b.line) };
}
