"use server";

// Server Actions de l'écran « Ressources » : ajouter, modifier ou supprimer un local ou un
// équipement. Ordre immuable : droits → lecture → validation → écriture.

import { revalidatePath } from "next/cache";

import { createResource, deleteResource, findResourceByName, getResource, updateResource } from "@/lib/resource";
import { requireAdmin } from "@/lib/session";
import type { ValidationError } from "@/lib/validation/calendar";
import { validateResourceInput, type EditableResourceType } from "@/lib/validation/resource";

export type SaveResourceResult = { ok: true } | { ok: false; errors: ValidationError[] };

// `id` absent : création. Présent : modification de cette ressource.
export async function saveResource(input: { id?: string; type: string; name: string }): Promise<SaveResourceResult> {
  await requireAdmin();

  // Point d'entrée public : on relit chaque valeur.
  const id = input?.id ? String(input.id) : undefined;
  const values = { type: String(input?.type ?? ""), name: String(input?.name ?? "") };

  const errors = validateResourceInput(values);
  if (errors.length > 0) return { ok: false, errors };
  const type = values.type as EditableResourceType;

  if (id) {
    const existing = await getResource(id);
    if (!existing) {
      return { ok: false, errors: [{ field: "form", message: "Cette ressource n'existe plus. Rechargez la page." }] };
    }
    // Le nom d'une personne vient de son compte Google.
    if (existing.type === "PERSON") {
      return { ok: false, errors: [{ field: "form", message: "Le nom d'un membre du personnel vient de son compte Google." }] };
    }
  }

  const duplicate = await findResourceByName(type, values.name);
  if (duplicate && duplicate.id !== id) {
    return {
      ok: false,
      errors: [{ field: "name", message: `« ${duplicate.name} » existe déjà dans les ${type === "LOCAL" ? "locaux" : "équipements"}.` }],
    };
  }

  if (id) await updateResource(id, { type, name: values.name });
  else await createResource({ type, name: values.name });

  revalidatePath("/admin/resources");
  return { ok: true };
}

// Supprime un local ou un équipement, avec ses créneaux signalés. Les
// personnes ne se suppriment pas ici : leur fiche est liée à leur compte
// Google et serait recréée à leur prochaine connexion.
export async function removeResource(input: { id: string }): Promise<SaveResourceResult> {
  await requireAdmin();

  const resource = await getResource(String(input?.id ?? ""));
  if (!resource) {
    return { ok: false, errors: [{ field: "form", message: "Cette ressource n'existe plus. Rechargez la page." }] };
  }
  if (resource.type === "PERSON") {
    return { ok: false, errors: [{ field: "form", message: "Un membre du personnel ne se supprime pas depuis cette page." }] };
  }

  await deleteResource(resource.id);
  revalidatePath("/admin/resources");
  revalidatePath("/admin/availability");
  return { ok: true };
}
