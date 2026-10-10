// Cadre de la zone USER (personnel connecté via Google) : vérification du
// rôle + en-tête (maquette « Mes disponibilités »).

import { Button, Divider, Tooltip } from "antd";

import { CalendarOutlined, LockOutlined } from "@/components/ui/icons";
import { UserMenu } from "@/components/ui/user-menu";
import { getDefaultCalendar } from "@/lib/calendar";
import { requireUser } from "@/lib/session";

export default async function AvailabilityLayout({ children }: LayoutProps<"/availability">) {
  const user = await requireUser();
  const calendar = await getDefaultCalendar();

  return (
    <div className="flex flex-1 flex-col">
      {/* Collé en haut : l'identité et les actions restent visibles pendant
          qu'on fait défiler la grille. Fond blanc et z-index pour qu'elle passe dessous. */}
      <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-rule bg-paper px-6 py-3 md:px-10">
        <div className="flex items-center gap-4">
          <span className="font-condensed text-2xl leading-none font-semibold tracking-[-0.01em]">dispo</span>
          {calendar?.publishedAt && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-desk px-3 py-1 text-[13px] text-graphite">
              <CalendarOutlined aria-hidden="true" />
              {calendar.name}
            </span>
          )}
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

      {children}
    </div>
  );
}
