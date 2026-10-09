"use client";

// Formulaire admin (identifiant + mot de passe). Composant client pour
// afficher l'erreur renvoyée par l'action sans recharger la page.

import { useActionState } from "react";

import { loginWithCredentials } from "@/actions/auth";

export function CredentialsForm() {
  const [error, formAction, pending] = useActionState(loginWithCredentials, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Identifiant
        <input
          name="username"
          required
          autoComplete="username"
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Mot de passe
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
