// Lecture des ressources (personnes, locaux, équipements) — SPEC.md §5.
// Ne vérifie aucun droit : c'est le rôle de l'appelant.

import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { ResourceType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { EMPTY_ROOM, type RoomDetails } from "@/lib/validation/resource";

type Tx = Prisma.TransactionClient;

// Fiche PERSON d'un membre du personnel, créée avec son compte par l'admin.
// null pour un administrateur, qui n'en a pas (SPEC §4).
export async function getPersonResource(userId: string) {
  return prisma.resource.findUnique({ where: { ownerId: userId } });
}

export async function getResource(id: string) {
  return prisma.resource.findUnique({ where: { id } });
}

// Local ou équipement portant déjà ce nom (sans tenir compte de la casse).
// Sert à éviter deux « Salle B12 » : l'import ne saurait plus lequel mettre à jour.
export async function findResourceByName(type: "LOCAL" | "EQUIPMENT", name: string) {
  return prisma.resource.findFirst({ where: { type, name: { equals: name.trim(), mode: "insensitive" } } });
}

// ---------------------------------------------------------------- listes (types de local, caractéristiques)

// Retrouve des entrées d'une liste par leur nom, sans tenir compte de la
// casse, et crée celles qui manquent (avec l'écriture du premier nom cité).
// Les listes sont courtes : on les lit en entier.
async function resolveNames(
  names: string[],
  findAll: () => Promise<{ id: string; name: string }[]>,
  createMany: (data: { name: string }[]) => Promise<unknown>,
) {
  const wanted = new Map<string, string>();
  for (const raw of names) {
    const name = raw.trim();
    if (name && !wanted.has(name.toLowerCase())) wanted.set(name.toLowerCase(), name);
  }
  if (wanted.size === 0) return { ids: new Map<string, string>(), created: [] as string[] };

  let entries = await findAll();
  const known = new Set(entries.map((e) => e.name.toLowerCase()));
  const created = [...wanted.entries()].filter(([key]) => !known.has(key)).map(([, name]) => name);
  if (created.length > 0) {
    await createMany(created.map((name) => ({ name })));
    entries = await findAll();
  }
  return { ids: new Map(entries.map((e) => [e.name.toLowerCase(), e.id])), created };
}

// Identifiants des types de local et caractéristiques cités, créés au besoin.
// `created` : noms ajoutés aux listes, pour le compte rendu de l'import.
export async function resolveCatalog(tx: Tx, roomTypes: string[], features: string[]) {
  const types = await resolveNames(
    roomTypes,
    () => tx.roomType.findMany({ select: { id: true, name: true } }),
    (data) => tx.roomType.createMany({ data, skipDuplicates: true }),
  );
  const feats = await resolveNames(
    features,
    () => tx.feature.findMany({ select: { id: true, name: true } }),
    (data) => tx.feature.createMany({ data, skipDuplicates: true }),
  );
  return {
    roomTypeId: (name: string) => types.ids.get(name.trim().toLowerCase()) ?? null,
    featureId: (name: string) => feats.ids.get(name.trim().toLowerCase())!,
    created: { roomTypes: types.created, features: feats.created },
  };
}

type Catalog = Awaited<ReturnType<typeof resolveCatalog>>;

// Colonnes d'un local (toutes vides pour un équipement), et ses caractéristiques.
export function roomData(room: RoomDetails, catalog: Catalog) {
  return {
    columns: {
      capacity: room.capacity,
      building: room.building.trim() || null,
      roomTypeId: room.roomType.trim() ? catalog.roomTypeId(room.roomType) : null,
    },
    features: room.features.map((f) => ({ featureId: catalog.featureId(f.name), quantity: f.quantity })),
  };
}

// ---------------------------------------------------------------- écriture

// Crée un local ou un équipement. Un type de local ou une caractéristique
// inconnus sont ajoutés aux listes dans la même transaction.
export async function createResource(input: { type: "LOCAL" | "EQUIPMENT"; name: string; room?: RoomDetails }) {
  const room = input.type === "LOCAL" ? (input.room ?? EMPTY_ROOM) : EMPTY_ROOM;
  return prisma.$transaction(async (tx) => {
    const catalog = await resolveCatalog(tx, [room.roomType], room.features.map((f) => f.name));
    const { columns, features } = roomData(room, catalog);
    return tx.resource.create({
      data: { type: input.type, name: input.name.trim(), ...columns, features: { create: features } },
    });
  });
}

// Modifie une ressource. Ses caractéristiques sont remplacées en bloc ; un
// local qui devient équipement perd sa description.
export async function updateResource(id: string, input: { type: "LOCAL" | "EQUIPMENT"; name: string; room?: RoomDetails }) {
  const room = input.type === "LOCAL" ? (input.room ?? EMPTY_ROOM) : EMPTY_ROOM;
  return prisma.$transaction(async (tx) => {
    const catalog = await resolveCatalog(tx, [room.roomType], room.features.map((f) => f.name));
    const { columns, features } = roomData(room, catalog);
    return tx.resource.update({
      where: { id },
      data: { type: input.type, name: input.name.trim(), ...columns, features: { deleteMany: {}, create: features } },
    });
  });
}

// ---------------------------------------------------------------- personnel

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
}

// Crée le compte d'un membre du personnel et sa fiche PERSON, ensemble
// (écriture imbriquée, donc atomique) : un compte n'existe jamais sans sa fiche.
// Sans nom, l'adresse en tient lieu jusqu'à la première connexion.
export async function createPerson(input: { email: string; name: string }, tx: Tx = prisma) {
  const name = input.name.trim() || input.email;
  return tx.user.create({
    data: { email: input.email, name, role: "USER", resource: { create: { type: "PERSON", name } } },
  });
}

// Ouvre ou coupe l'accès d'un membre du personnel, à partir de sa fiche.
// Ses créneaux signalés sont gardés dans les deux cas.
export async function setPersonAccess(resourceId: string, enabled: boolean) {
  return prisma.resource.update({
    where: { id: resourceId },
    data: { owner: { update: { disabledAt: enabled ? null : new Date() } } },
  });
}

// Supprime une ressource. Ses créneaux signalés partent avec elle (cascade
// définie dans le schéma, Availability.resource onDelete: Cascade).
export async function deleteResource(id: string) {
  return prisma.resource.delete({ where: { id } });
}

export interface ResourceRow {
  id: string;
  type: ResourceType;
  name: string;
  email: string | null; // compte Google, pour une PERSON
  disabled: boolean; // PERSON dont l'accès est coupé
  neverLoggedIn: boolean; // PERSON qui ne s'est encore jamais connectée
  unavailable: number; // créneaux signalés « indisponible »
  ifNeeded: number; // créneaux signalés « si nécessaire »
  // Description d'un LOCAL (vide sinon)
  capacity: number | null;
  building: string | null;
  roomType: string | null;
  features: { name: string; quantity: number }[];
}

// Liste des ressources, triée par nom, avec le nombre de créneaux signalés par
// statut sur le calendrier courant. Filtres optionnels : type et texte (nom ou
// adresse, sans tenir compte de la casse).
export async function listResources(filters: { type?: ResourceType; query?: string } = {}): Promise<ResourceRow[]> {
  const query = filters.query?.trim();
  const calendar = await prisma.calendar.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });

  const [resources, counts] = await Promise.all([
    prisma.resource.findMany({
      where: {
        type: filters.type,
        ...(query && {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { owner: { email: { contains: query, mode: "insensitive" } } },
          ],
        }),
      },
      include: {
        owner: { select: { email: true, disabledAt: true, lastLoginAt: true } },
        roomType: { select: { name: true } },
        features: { include: { feature: { select: { name: true } } } },
      },
    }),
    calendar
      ? prisma.availability.groupBy({ by: ["resourceId", "status"], where: { calendarId: calendar.id }, _count: true })
      : Promise.resolve([]),
  ]);

  const count = (resourceId: string, status: "UNAVAILABLE" | "IF_NEEDED") =>
    counts.find((c) => c.resourceId === resourceId && c.status === status)?._count ?? 0;

  return resources
    .map((r) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      email: r.owner?.email ?? null,
      disabled: Boolean(r.owner?.disabledAt),
      neverLoggedIn: r.owner !== null && r.owner.lastLoginAt === null,
      unavailable: count(r.id, "UNAVAILABLE"),
      ifNeeded: count(r.id, "IF_NEEDED"),
      capacity: r.capacity,
      building: r.building,
      roomType: r.roomType?.name ?? null,
      features: r.features
        .map((f) => ({ name: f.feature.name, quantity: f.quantity }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

// ---------------------------------------------------------------- gestion des listes

export type CatalogKind = "roomType" | "feature";

export interface CatalogEntry {
  id: string;
  name: string;
  uses: number; // nombre de locaux qui l'utilisent
}

// Types de local et caractéristiques avec leur nombre d'utilisations, et les
// bâtiments déjà saisis (pour proposer les mêmes écritures).
export async function listCatalog(): Promise<{ roomTypes: CatalogEntry[]; features: CatalogEntry[]; buildings: string[] }> {
  const [roomTypes, features, buildings] = await Promise.all([
    prisma.roomType.findMany({ include: { _count: { select: { resources: true } } } }),
    prisma.feature.findMany({ include: { _count: { select: { resources: true } } } }),
    prisma.resource.findMany({ where: { building: { not: null } }, distinct: ["building"], select: { building: true } }),
  ]);
  const entry = (e: { id: string; name: string; _count: { resources: number } }) => ({ id: e.id, name: e.name, uses: e._count.resources });
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "fr");
  return {
    roomTypes: roomTypes.map(entry).sort(byName),
    features: features.map(entry).sort(byName),
    buildings: buildings.map((b) => b.building!).sort((a, b) => a.localeCompare(b, "fr")),
  };
}

export async function getCatalogEntry(kind: CatalogKind, id: string) {
  const select = { id: true, name: true, _count: { select: { resources: true } } } as const;
  return kind === "roomType"
    ? prisma.roomType.findUnique({ where: { id }, select })
    : prisma.feature.findUnique({ where: { id }, select });
}

// Autre entrée de la même liste portant déjà ce nom (sans tenir compte de la casse).
export async function findCatalogEntryByName(kind: CatalogKind, name: string) {
  const where = { name: { equals: name.trim(), mode: "insensitive" as const } };
  return kind === "roomType" ? prisma.roomType.findFirst({ where }) : prisma.feature.findFirst({ where });
}

export async function renameCatalogEntry(kind: CatalogKind, id: string, name: string) {
  const data = { name: name.trim() };
  return kind === "roomType" ? prisma.roomType.update({ where: { id }, data }) : prisma.feature.update({ where: { id }, data });
}

// Refusé par la base (onDelete: Restrict) si l'entrée est encore utilisée :
// l'appelant vérifie avant.
export async function deleteCatalogEntry(kind: CatalogKind, id: string) {
  return kind === "roomType" ? prisma.roomType.delete({ where: { id } }) : prisma.feature.delete({ where: { id } });
}

// Nombre de ressources par type, pour le résumé en tête de liste.
export async function countResourcesByType() {
  const groups = await prisma.resource.groupBy({ by: ["type"], _count: true });
  const of = (type: ResourceType) => groups.find((g) => g.type === type)?._count ?? 0;
  return { PERSON: of("PERSON"), LOCAL: of("LOCAL"), EQUIPMENT: of("EQUIPMENT") };
}
