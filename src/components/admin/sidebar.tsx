"use client";

// Barre latérale de la zone admin (maquettes « Admin — … »), en Layout.Sider
// et Menu d'Ant Design. Composant client : il lit l'URL courante pour marquer
// la page active.

import { Button, Layout, Menu, type MenuProps } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { logout } from "@/actions/auth";

// Regroupée par phase de travail : préparer le calendrier, puis les ressources.
// Les libellés sont des liens : navigation native, préchargement par Next, et
// Ant étend la zone cliquable à toute la ligne.
const items: MenuProps["items"] = [
  {
    type: "group",
    label: "Calendrier",
    children: [
      { key: "/admin/calendar", label: <Link href="/admin/calendar">Configuration</Link> },
      { key: "/admin/calendar/holidays", label: <Link href="/admin/calendar/holidays">Jours fériés et publication</Link> },
    ],
  },
  {
    type: "group",
    label: "Ressources",
    children: [
      { key: "/admin/resources", label: <Link href="/admin/resources">Liste des ressources</Link> },
      { key: "/admin/availability", label: <Link href="/admin/availability">Saisie des disponibilités</Link> },
      { key: "/admin/export", label: <Link href="/admin/export">Export JSON</Link> },
    ],
  },
];

export function AdminSidebar({ username }: { username: string }) {
  const pathname = usePathname();

  return (
    // Hauteur de la fenêtre, collée en haut : la barre ne s'étire pas avec le
    // contenu (une grille de 15 semaines est très haute), et « Se déconnecter »
    // reste visible en bas de l'écran pendant qu'on fait défiler la page.
    <Layout.Sider
      width={232}
      breakpoint="md"
      collapsedWidth={0}
      style={{ position: "sticky", top: 0, height: "100vh", alignSelf: "flex-start", overflowY: "auto" }}
      className="border-r border-rule"
    >
      <div className="flex h-full flex-col justify-between gap-8 py-7">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5 px-7">
            <span className="font-condensed text-2xl leading-none font-semibold tracking-[-0.01em]">dispo</span>
            <span className="text-[13px] text-graphite">Administration</span>
          </div>

          <nav aria-label="Administration">
            <Menu mode="inline" items={items} selectedKeys={[pathname]} className="border-none! px-2" />
          </nav>
        </div>

        <div className="mx-7 flex flex-col items-start gap-0.5 border-t border-rule pt-4">
          <span className="text-sm font-medium">{username}</span>
          <form action={logout}>
            <Button type="link" htmlType="submit" size="small" className="h-auto! p-0! text-[13px]!">
              Se déconnecter
            </Button>
          </form>
        </div>
      </div>
    </Layout.Sider>
  );
}
