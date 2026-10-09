// Page de connexion : deux voies, deux rôles (SPEC §3).
//  - Google        → personnel HE2B (USER)
//  - identifiant   → administrateur (ADMIN)

import { loginWithGoogle } from "@/actions/auth";
import { CredentialsForm } from "@/components/auth/credentials-form";

// Erreurs renvoyées par Auth.js dans l'URL (/login?error=…).
const errorMessages: Record<string, string> = {
  AccessDenied: "Accès refusé : seules les adresses du personnel HE2B sont acceptées.",
};
const defaultError = "La connexion a échoué. Réessayez.";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const errorMessage =
    typeof error === "string" ? (errorMessages[error] ?? defaultError) : null;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <h1 className="text-2xl font-semibold">Connexion</h1>

        {errorMessage && (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {errorMessage}
          </p>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-500">Personnel HE2B</h2>
          <form action={loginWithGoogle}>
            <button
              type="submit"
              className="w-full rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
            >
              Se connecter avec Google
            </button>
          </form>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-500">Administration</h2>
          <CredentialsForm />
        </section>
      </div>
    </main>
  );
}
