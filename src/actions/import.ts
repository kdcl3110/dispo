"use server";

// Server Action de l'import Excel des locaux et équipements (SPEC §8).
// Ordre immuable : droits → contrôle du fichier → lecture → écriture.

import { revalidatePath } from "next/cache";

import { importResources, MAX_IMPORT_ROWS, parseResourceSheet, type IgnoredRow } from "@/lib/import";
import { requireAdmin } from "@/lib/session";
import { MAX_IMPORT_BYTES } from "@/lib/validation/resource";

export type ImportResult =
  | { ok: true; created: number; alreadyKnown: number; ignored: IgnoredRow[] }
  | { ok: false; message: string };

export async function importResourcesFile(formData: FormData): Promise<ImportResult> {
  await requireAdmin();

  // Selon le chemin emprunté, le fichier arrive comme File ou comme simple
  // Blob (son parent, sans nom) : on accepte les deux.
  const file = formData.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return { ok: false, message: "Choisissez un fichier Excel (.xls ou .xlsx)." };
  }
  const name = file instanceof File ? file.name : "";
  if (name && !/\.xlsx?$/i.test(name)) {
    return { ok: false, message: "Ce fichier n'est pas un classeur Excel. Utilisez un fichier .xls ou .xlsx." };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, message: "Le fichier dépasse 1 Mo." };
  }

  let parsed;
  try {
    parsed = parseResourceSheet(await file.arrayBuffer());
  } catch {
    return { ok: false, message: "Le fichier est illisible. Enregistrez-le à nouveau depuis Excel puis réessayez." };
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
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    return { ok: false, message: `Le fichier contient plus de ${MAX_IMPORT_ROWS} lignes. Découpez-le en plusieurs fichiers.` };
  }

  const { created, alreadyKnown } = await importResources(parsed.rows);
  revalidatePath("/admin/resources");
  return { ok: true, created, alreadyKnown, ignored: parsed.ignored };
}
