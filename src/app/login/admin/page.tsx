// Connexion administrateur (maquette « Mode administrateur »).
// On y arrive depuis l'espace personnel (bouton « Mode administrateur »),
// jamais depuis l'écran d'accueil. Même construction en deux colonnes que la
// connexion du personnel : à gauche ce que l'on peut faire, à droite le formulaire.

import Link from "next/link";

import { CredentialsForm } from "@/components/auth/credentials-form";
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CarryOutOutlined,
  ExportOutlined,
  LockOutlined,
  QuestionCircleOutlined,
  TeamOutlined,
} from "@/components/ui/icons";

const CAPABILITIES = [
  { icon: <CalendarOutlined />, title: "Configurer le calendrier", text: "Période, jours de cours, horaires et pauses." },
  { icon: <CarryOutOutlined />, title: "Retirer les jours fériés et publier", text: "Le personnel ne voit la grille qu'après publication." },
  { icon: <TeamOutlined />, title: "Gérer les ressources", text: "Locaux et équipements, à la main ou par fichier Excel." },
  { icon: <ExportOutlined />, title: "Exporter les disponibilités", text: "Un fichier JSON avec tous les créneaux signalés." },
];

function Logo() {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-condensed text-[28px] leading-none font-semibold tracking-[-0.01em]">dispo</span>
      <span className="text-[13px] text-graphite">Administration</span>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="grid flex-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* --- Ce que permet le mode administrateur */}
      <aside className="hidden flex-col justify-between gap-12 bg-desk px-14 py-14 md:flex">
        <Logo />

        <div className="flex flex-col gap-8">
          <h2 className="max-w-[380px] text-[26px] leading-tight font-semibold tracking-[-0.015em]">
            Préparer le quadrimestre pour tout le personnel.
          </h2>
          <ul className="flex flex-col gap-5">
            {CAPABILITIES.map((c) => (
              <li key={c.title} className="flex items-start gap-4">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-paper text-lg text-pen">
                  {c.icon}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">{c.title}</span>
                  <span className="text-sm leading-relaxed text-graphite">{c.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[13px] text-graphite">Haute École Bruxelles-Brabant</p>
      </aside>

      {/* --- Formulaire */}
      <main className="flex flex-col gap-10 px-6 py-8 md:px-16 md:py-12">
        <div className="flex items-center justify-between gap-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium">
            <ArrowLeftOutlined aria-hidden="true" />
            Retour à l&apos;espace personnel
          </Link>
          <div className="md:hidden">
            <Logo />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-[400px] flex-col gap-8">
            <div className="flex flex-col gap-4">
              <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-xl bg-pen-tint text-[22px] text-pen">
                <LockOutlined />
              </span>
              <div className="flex flex-col gap-2">
                <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.02em]">Mode administrateur</h1>
                <p className="text-[15px] leading-relaxed text-graphite">
                  Ces identifiants sont distincts de votre compte Google.
                </p>
              </div>
            </div>

            <CredentialsForm />

            <p className="flex items-start gap-2 text-sm leading-relaxed text-graphite">
              <QuestionCircleOutlined aria-hidden="true" className="mt-1" />
              Pas de compte administrateur ? Demandez-le à l&apos;équipe technique.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
