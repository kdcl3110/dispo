"use server";

// Server Actions de connexion / déconnexion, appelées par les formulaires.
// Elles ne font que transmettre à Auth.js : les règles (rôle, domaine,
// mot de passe) sont dans src/auth.ts.

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";

// Après connexion, « / » aiguille vers la zone du rôle.
const AFTER_LOGIN = "/";

export async function loginWithGoogle() {
  await signIn("google", { redirectTo: AFTER_LOGIN });
}

// Signature imposée par useActionState : (état précédent, données du
// formulaire) → nouvel état. Ici l'état est le message d'erreur à afficher.
export async function loginWithCredentials(
  _previousError: string | undefined,
  formData: FormData,
) {
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: AFTER_LOGIN,
    });
  } catch (error) {
    // Identifiants refusés : Auth.js lève une AuthError, on renvoie un message.
    if (error instanceof AuthError) {
      return "Identifiant ou mot de passe incorrect.";
    }
    // Tout le reste doit remonter — y compris la redirection en cas de
    // succès, qui passe elle aussi par une exception interne à Next.js.
    throw error;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

// Mode administrateur → espace personnel. Les deux rôles sont séparés (SPEC §3) :
// on ferme la session admin, puis on lance tout de suite la connexion Google.
// Si le compte Google est déjà ouvert dans le navigateur, Google renvoie
// directement vers les disponibilités, sans rien à saisir.
export async function switchToStaff() {
  await signOut({ redirect: false });
  await signIn("google", { redirectTo: AFTER_LOGIN });
}
