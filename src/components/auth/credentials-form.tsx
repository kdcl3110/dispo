"use client";

// Formulaire admin (identifiant + mot de passe). Composant client pour
// afficher l'erreur renvoyée par l'action sans recharger la page.

import { useActionState } from "react";

import { loginWithCredentials } from "@/actions/auth";

const inputClass =
  "h-11 rounded-md border border-field bg-paper px-3 text-sm text-ink aria-invalid:border-2 aria-invalid:border-unavailable";

export function CredentialsForm() {
  const [error, formAction, pending] = useActionState(loginWithCredentials, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4.5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-[13px] font-semibold">
          Identifiant
        </label>
        <input
          id="username"
          name="username"
          required
          autoComplete="username"
          aria-invalid={error ? true : undefined}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-[13px] font-semibold">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          aria-invalid={error ? true : undefined}
          className={inputClass}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-unavailable">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1.5 h-12 rounded-md bg-pen text-sm font-semibold text-white hover:bg-pen-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
