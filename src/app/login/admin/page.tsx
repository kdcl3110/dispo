// Connexion administrateur (maquette « Mode administrateur »).
// On y arrive depuis l'application, jamais depuis l'écran d'accueil.

import Link from "next/link";

import { CredentialsForm } from "@/components/auth/credentials-form";

export default function AdminLoginPage() {
  return (
    <div className="relative flex flex-1 flex-col px-6 py-8 md:px-12 md:py-10">
      <div className="flex items-start justify-between gap-6">
        <Link href="/" className="text-sm">
          Retour à l&apos;application
        </Link>
        <div className="flex flex-col items-end gap-1">
          <span className="font-condensed text-[22px] leading-none font-semibold tracking-[-0.01em]">
            dispo
          </span>
          <span className="text-[13px] text-graphite">Administration</span>
        </div>
      </div>

      <main className="flex flex-1 items-center justify-center py-12">
        <div className="flex w-full max-w-[380px] flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.02em]">
              Mode administrateur
            </h1>
            <p className="text-[15px] leading-relaxed text-graphite">
              Ces identifiants sont distincts de votre compte Google. Ils donnent accès
              au calendrier, aux ressources et à l&apos;export.
            </p>
          </div>

          <CredentialsForm />

          <p className="text-sm leading-relaxed text-graphite">
            Pas de compte administrateur ? Demandez-le à l&apos;équipe technique.
          </p>
        </div>
      </main>
    </div>
  );
}
