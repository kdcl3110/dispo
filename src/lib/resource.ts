// Lecture des ressources (personnes, locaux, équipements) — SPEC.md §5.
// Ne vérifie aucun droit : c'est le rôle de l'appelant.

import "server-only";

import { prisma } from "@/lib/prisma";

// Fiche PERSON d'un membre du personnel, créée à sa première connexion Google.
// null pour un administrateur, qui n'en a pas (SPEC §4).
export async function getPersonResource(userId: string) {
  return prisma.resource.findUnique({ where: { ownerId: userId } });
}

export async function getResource(id: string) {
  return prisma.resource.findUnique({ where: { id } });
}
