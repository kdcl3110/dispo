// Accueil : aucun contenu, seulement un aiguillage selon le rôle.
// C'est aussi la destination après connexion (voir src/actions/auth.ts).

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  redirect(user.role === "ADMIN" ? "/admin" : "/availability");
}
