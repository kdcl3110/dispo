// Cadre de la zone USER (personnel connecté via Google) : vérification du
// rôle + en-tête (maquette « Mes disponibilités »).

import { Button, Divider, Tooltip } from "antd";
import Link from "next/link";

import { LockOutlined } from "@/components/ui/icons";
import { UserMenu } from "@/components/ui/user-menu";
import { requireUser } from "@/lib/session";

export default async function AvailabilityLayout({ children }: LayoutProps<"/availability">) {
  const user = await requireUser();

  return (
    // La zone occupe exactement la hauteur de l'écran : la page entière ne défile
    // jamais. L'en-tête reste en haut, et seule la zone de contenu en dessous
    // défile quand une page est longue (une grille, elle, défile dans son cadre).
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-rule bg-paper px-6 py-3 md:px-10">
        <div className="flex items-center gap-4">
          <Link href="/availability" className="font-condensed text-2xl leading-none font-semibold tracking-[-0.01em] text-ink no-underline hover:text-pen">
            dispo
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-y-2">
          {/* Changement d'espace : un vrai bouton, séparé du reste, avec un cadenas. */}
          <Tooltip title="Configurer le calendrier et gérer les ressources. Identifiants administrateur requis.">
            <Button href="/login/admin" icon={<LockOutlined />}>
              Mode administrateur
            </Button>
          </Tooltip>

          <Divider orientation="vertical" className="mx-5! h-8! hidden sm:block" />

          {/* Nom de l'utilisateur : un clic ouvre son menu (adresse, déconnexion). */}
          <UserMenu
            name={user.name ?? "Mon compte"}
            caption={user.email}
            reconnectHint="Pour revenir, il faudra vous reconnecter avec votre compte Google."
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
    </div>
  );
}
