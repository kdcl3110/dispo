"use server";

// Server Actions de l'écran « Ressources » : ajouter, modifier ou supprimer un local ou un
// équipement, ajouter un membre du personnel et ouvrir ou couper son accès, et
// gérer les listes (types de local, caractéristiques).
// Ordre immuable : droits → lecture → validation → écriture.

import { revalidatePath } from "next/cache";

import {
  createPerson,
  createResource,
  deleteCatalogEntry,
  deleteResource,
  findCatalogEntryByName,
  findResourceByName,
  findUserByEmail,
  getCatalogEntry,
  getResource,
  renameCatalogEntry,
  setPersonAccess,
  updateResource,
  type CatalogKind,
} from "@/lib/resource";
import { requireAdmin } from "@/lib/session";
import type { ValidationError } from "@/lib/validation/calendar";
import {
  EMPTY_ROOM,
  normalizeEmail,
  parseAllowedDomains,
  validateCatalogName,
  validatePersonInput,
  validateResourceInput,
  type EditableResourceType,
  type RoomDetails,
} from "@/lib/validation/resource";

export type SaveResourceResult = { ok: true } | { ok: false; errors: ValidationError[] };

// Point d'entrée public : la description du local est relue champ par champ.
function readRoom(input: unknown): RoomDetails {
  if (!input || typeof input !== "object") return EMPTY_ROOM;
  const room = input as Record<string, unknown>;
  const capacity = room.capacity === null || room.capacity === undefined || room.capacity === "" ? null : Number(room.capacity);
  return {
    capacity,
    building: String(room.building ?? ""),
    roomType: String(room.roomType ?? ""),
    features: Array.isArray(room.features)
      ? room.features.slice(0, 100).map((f) => ({
          name: String((f as Record<string, unknown>)?.name ?? ""),
          quantity: Number((f as Record<string, unknown>)?.quantity ?? 1),
        }))
      : [],
  };
}

// `id` absent : création. Présent : modification de cette ressource.
export async function saveResource(input: { id?: string; type: string; name: string; room?: RoomDetails }): Promise<SaveResourceResult> {
  await requireAdmin();

  const id = input?.id ? String(input.id) : undefined;
  const values = { type: String(input?.type ?? ""), name: String(input?.name ?? ""), room: readRoom(input?.room) };

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

  if (id) await updateResource(id, { type, name: values.name, room: values.room });
  else await createResource({ type, name: values.name, room: values.room });

  revalidatePath("/admin/resources");
  return { ok: true };
}

// Supprime un local ou un équipement, avec ses créneaux signalés. Les
// personnes ne se suppriment pas : on coupe leur accès (setPersonAccessAction),
// ce qui garde leurs créneaux signalés.
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

// ---------------------------------------------------------------- personnel

// Ajoute un membre du personnel à la liste des adresses autorisées. Il pourra
// se connecter avec Google ; son nom sera alors celui de son compte.
export async function addPerson(input: { email: string; name: string }): Promise<SaveResourceResult> {
  await requireAdmin();

  const values = { email: normalizeEmail(String(input?.email ?? "")), name: String(input?.name ?? "").trim() };
  const errors = validatePersonInput(values, parseAllowedDomains(process.env.ALLOWED_EMAIL_DOMAINS));
  if (errors.length > 0) return { ok: false, errors };

  if (await findUserByEmail(values.email)) {
    return { ok: false, errors: [{ field: "email", message: `${values.email} est déjà dans la liste du personnel.` }] };
  }

  await createPerson(values);
  revalidatePath("/admin/resources");
  revalidatePath("/admin/availability");
  return { ok: true };
}

// Coupe ou rétablit l'accès d'un membre du personnel. Coupé, il est déconnecté
// à sa requête suivante et ne peut plus se connecter ; ses créneaux restent.
export async function setPersonAccessAction(input: { id: string; enabled: boolean }): Promise<SaveResourceResult> {
  await requireAdmin();

  const resource = await getResource(String(input?.id ?? ""));
  if (!resource || resource.type !== "PERSON" || !resource.ownerId) {
    return { ok: false, errors: [{ field: "form", message: "Ce membre du personnel n'existe plus. Rechargez la page." }] };
  }

  await setPersonAccess(resource.id, input?.enabled === true);
  revalidatePath("/admin/resources");
  return { ok: true };
}

// ---------------------------------------------------------------- listes

const KINDS: CatalogKind[] = ["roomType", "feature"];
const LABEL: Record<CatalogKind, string> = { roomType: "type de local", feature: "caractéristique" };

async function loadEntry(kind: unknown, id: unknown) {
  if (!KINDS.includes(kind as CatalogKind)) return null;
  const entry = await getCatalogEntry(kind as CatalogKind, String(id ?? ""));
  return entry ? { kind: kind as CatalogKind, entry } : null;
}

// Renomme un type de local ou une caractéristique : tous les locaux qui
// l'utilisent suivent. Refusé si le nom est déjà pris dans la même liste.
export async function renameCatalogItem(input: { kind: CatalogKind; id: string; name: string }): Promise<SaveResourceResult> {
  await requireAdmin();

  const loaded = await loadEntry(input?.kind, input?.id);
  if (!loaded) return { ok: false, errors: [{ field: "form", message: "Cette entrée n'existe plus. Rechargez la page." }] };
  const name = String(input?.name ?? "");

  const errors = validateCatalogName(name);
  if (errors.length > 0) return { ok: false, errors };

  const duplicate = await findCatalogEntryByName(loaded.kind, name);
  if (duplicate && duplicate.id !== loaded.entry.id) {
    return { ok: false, errors: [{ field: "name", message: `Le ${LABEL[loaded.kind]} « ${duplicate.name} » existe déjà.` }] };
  }

  await renameCatalogEntry(loaded.kind, loaded.entry.id, name);
  revalidatePath("/admin/resources");
  return { ok: true };
}

// Supprime une entrée des listes, seulement si aucun local ne l'utilise.
export async function removeCatalogItem(input: { kind: CatalogKind; id: string }): Promise<SaveResourceResult> {
  await requireAdmin();

  const loaded = await loadEntry(input?.kind, input?.id);
  if (!loaded) return { ok: false, errors: [{ field: "form", message: "Cette entrée n'existe plus. Rechargez la page." }] };
  const uses = loaded.entry._count.resources;
  if (uses > 0) {
    return {
      ok: false,
      errors: [{ field: "form", message: `« ${loaded.entry.name} » est utilisé par ${uses} local${uses > 1 ? "aux" : ""} : retirez-le d'abord de ces locaux.` }],
    };
  }

  await deleteCatalogEntry(loaded.kind, loaded.entry.id);
  revalidatePath("/admin/resources");
  return { ok: true };
}
