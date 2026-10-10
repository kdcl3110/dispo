"use client";

// Barre latérale de la zone admin (maquettes « Admin — … »), en Layout.Sider
// et Menu d'Ant Design. Composant client : il lit l'URL courante pour marquer
// la page active.

import {
  CalendarOutlined,
  EditOutlined,
  ExportOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Layout, Menu, type MenuProps } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { UserMenu } from "@/components/ui/user-menu";

// Regroupée par phase de travail : préparer le calendrier, puis les ressources.
// Les libellés sont des liens : navigation native, préchargement par Next, et
// Ant étend la zone cliquable à toute la ligne.
const items: MenuProps["items"] = [
  {
    type: "group",
    label: "Calendrier",
    children: [
      { key: "/admin/calendar", icon: <CalendarOutlined />, label: <Link href="/admin/calendar">Préparer le calendrier</Link> },
    ],
  },
  {
    type: "group",
    label: "Ressources",
    children: [
      { key: "/admin/resources", icon: <TeamOutlined />, label: <Link href="/admin/resources">Liste des ressources</Link> },
      { key: "/admin/availability", icon: <EditOutlined />, label: <Link href="/admin/availability">Saisie des disponibilités</Link> },
      { key: "/admin/export", icon: <ExportOutlined />, label: <Link href="/admin/export">Export JSON</Link> },
    ],
  },
];

export function AdminSidebar({ username }: { username: string }) {
  const pathname = usePathname();

  return (
    // Hauteur de la fenêtre, collée en haut : la barre ne s'étire pas avec le
    // contenu (une grille de 15 semaines est très haute), et le menu du compte
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

        {/* Nom de l'administrateur : un clic ouvre son menu, vers le haut. */}
        <div className="mx-3 border-t border-rule pt-3">
          <UserMenu
            name={username}
            caption="Administrateur"
            placement="topLeft"
            reconnectHint="Pour revenir, il faudra saisir à nouveau vos identifiants administrateur."
          />
        </div>
      </div>
    </Layout.Sider>
  );
}
