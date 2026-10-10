// Vérification des droits côté serveur — la vraie barrière (SPEC §4).
//
// proxy.ts ne fait qu'une redirection rapide, contournable. Chaque layout
// protégé et chaque Server Action appelle donc l'une de ces fonctions avant
// de faire quoi que ce soit.

import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/auth";

// `cache` : pendant le rendu d'une même requête, la session n'est lue qu'une
// fois, même si le layout, la page et plusieurs composants la demandent.
const getSession = cache(() => auth());

// Utilisateur connecté, ou null. Ne redirige pas : pour les pages qui
// décident elles-mêmes quoi faire d'un visiteur anonyme.
export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

// Utilisateur connecté, quel que soit son rôle. Sinon → page de connexion.
// Pour ce qui est permis aux deux rôles (ex. signaler un créneau) ; le détail
// des droits est alors vérifié par la règle métier.
export async function requireSession() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Zone ADMIN. Un USER connecté est renvoyé vers l'accueil, qui l'aiguille
// vers sa propre zone.
export async function requireAdmin() {
  const user = await requireSession();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

// Zone USER (personnel connecté via Google). Un ADMIN n'y a pas sa place :
// il n'a pas de fiche PERSON, donc pas de disponibilités à lui.
export async function requireUser() {
  const user = await requireSession();
  if (user.role !== "USER") redirect("/");
  return user;
}
