// Page de connexion du personnel (maquette « Connexion »).
// Une seule porte d'entrée : Google, réservé aux adresses HE2B. Le mode
// administrateur a son propre écran, /login/admin.

import { Alert } from "antd";

import { loginWithGoogle } from "@/actions/auth";
import { GoogleButton } from "@/components/auth/google-button";
import { SampleSheet, SheetLegend } from "@/components/auth/sample-sheet";

// Erreurs renvoyées par Auth.js dans l'URL (/login?error=…).
const errorMessages: Record<string, string> = {
  AccessDenied:
    "Cette adresse n'est pas acceptée. Connectez-vous avec votre compte @he2b.be.",
};
const defaultError = "La connexion a échoué. Réessayez.";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const errorMessage =
    typeof error === "string" ? (errorMessages[error] ?? defaultError) : null;

  return (
    <div className="grid flex-1 md:grid-cols-2">
      <main className="flex flex-col justify-between gap-16 px-6 py-12 short:gap-8 md:px-18 md:py-16 short:md:py-8">
        <div className="flex flex-col gap-1.5">
          <span className="font-condensed text-[28px] leading-none font-semibold tracking-[-0.01em]">
            dispo
          </span>
          <span className="text-[13px] text-graphite">Haute École Bruxelles-Brabant</span>
        </div>

        <div className="flex flex-col gap-8 short:gap-6">
          <div className="flex flex-col gap-5 short:gap-4">
            <h1 className="max-w-[500px] text-4xl leading-[1.05] font-semibold tracking-[-0.025em] md:text-5xl short:md:text-4xl">
              Vos disponibilités pour tout le quadrimestre.
            </h1>
            <p className="max-w-[460px] text-[17px] leading-relaxed text-graphite">
              Quinze semaines sur une seule grille. Par défaut, vous êtes disponible
              partout : vous ne notez que les créneaux qui posent problème.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3.5">
            {errorMessage && (
              <Alert type="error" showIcon title={errorMessage} className="max-w-[460px]" />
            )}
            <form action={loginWithGoogle}>
              <GoogleButton />
            </form>
            <p className="max-w-[420px] text-sm leading-relaxed text-graphite">
              Réservé aux adresses <strong className="font-semibold text-ink">@he2b.be</strong>.
              Votre compte est créé à la première connexion.
            </p>
          </div>
        </div>

        {/* Espace réservé au nom du calendrier publié, quand le domaine calendar existera. */}
        <div />
      </main>

      <aside className="hidden flex-col justify-center gap-7 bg-desk px-16 py-18 short:gap-4 short:py-8 md:flex">
        <SampleSheet />
        <SheetLegend />
      </aside>
    </div>
  );
}
