// Lecture des ressources (personnes, locaux, équipements) — SPEC.md §5.
// Ne vérifie aucun droit : c'est le rôle de l'appelant.

import "server-only";

import type { ResourceType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

// Fiche PERSON d'un membre du personnel, créée à sa première connexion Google.
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

export async function createResource(input: { type: "LOCAL" | "EQUIPMENT"; name: string }) {
  return prisma.resource.create({ data: { type: input.type, name: input.name.trim() } });
}

export async function updateResource(id: string, input: { type: "LOCAL" | "EQUIPMENT"; name: string }) {
  return prisma.resource.update({ where: { id }, data: { type: input.type, name: input.name.trim() } });
}

export interface ResourceRow {
  id: string;
  type: ResourceType;
  name: string;
  email: string | null; // compte Google, pour une PERSON
  unavailable: number; // créneaux signalés « indisponible »
  ifNeeded: number; // créneaux signalés « si nécessaire »
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
      include: { owner: { select: { email: true } } },
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
      unavailable: count(r.id, "UNAVAILABLE"),
      ifNeeded: count(r.id, "IF_NEEDED"),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

// Nombre de ressources par type, pour le résumé en tête de liste.
export async function countResourcesByType() {
  const groups = await prisma.resource.groupBy({ by: ["type"], _count: true });
  const of = (type: ResourceType) => groups.find((g) => g.type === type)?._count ?? 0;
  return { PERSON: of("PERSON"), LOCAL: of("LOCAL"), EQUIPMENT: of("EQUIPMENT") };
}
