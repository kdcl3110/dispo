"use client";

// Barre latérale de la zone admin (maquettes « Admin — … »), en Layout.Sider
// et Menu d'Ant Design. Composant client : il lit l'URL courante pour marquer
// la page active.

import {
  CalendarOutlined,
  EditOutlined,
  ExportOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Button, Layout, Menu, Tooltip, type MenuProps } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { switchToStaff } from "@/actions/auth";
import { UserMenu } from "@/components/ui/user-menu";

// Regroupée par phase de travail : préparer le calendrier, puis les ressources.
// Les libellés sont des liens : navigation native, préchargement par Next, et
// Ant étend la zone cliquable à toute la ligne.
const items: MenuProps["items"] = [
  {
    type: "group",
    label: "Calendrier",
    children: [
      { key: "/admin/calendars", icon: <CalendarOutlined />, label: <Link href="/admin/calendars">Calendriers</Link> },
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
  // Entrée active : celle dont l'adresse commence la page courante
  // (/admin/calendars/abc → « Calendriers »).
  const selected = ["/admin/calendars", "/admin/resources", "/admin/availability", "/admin/export"].find(
    (key) => pathname === key || pathname.startsWith(`${key}/`),
  );

  return (
    // Hauteur de l'écran (le cadre admin ne défile jamais) : le menu du compte
    // reste toujours visible en bas. Si l'écran est très bas, la barre défile seule.
    <Layout.Sider
      width={232}
      breakpoint="md"
      collapsedWidth={0}
      style={{ height: "100%", overflowY: "auto" }}
      className="border-r border-rule"
    >
      <div className="flex h-full flex-col justify-between gap-8 py-7">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5 px-7">
            <span className="font-condensed text-2xl leading-none font-semibold tracking-[-0.01em]">dispo</span>
            <span className="text-[13px] text-graphite">Administration</span>
          </div>

          <nav aria-label="Administration">
            <Menu mode="inline" items={items} selectedKeys={selected ? [selected] : []} className="border-none! px-2" />
          </nav>
        </div>

        <div className="mx-3 flex flex-col gap-3 border-t border-rule pt-3">
          {/* Symétrique du bouton « Mode administrateur » de l'espace personnel. */}
          <Tooltip title="Quitter le mode administrateur et revenir à vos disponibilités (connexion Google)." placement="right">
            <form action={switchToStaff}>
              <Button htmlType="submit" icon={<UserOutlined />} block>
                Espace personnel
              </Button>
            </form>
          </Tooltip>

          {/* Nom de l'administrateur : un clic ouvre son menu, vers le haut. */}
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
