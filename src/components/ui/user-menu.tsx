"use client";

// Menu de l'utilisateur connecté (personnel et administration) : un clic sur
// son nom ouvre un menu avec « Se déconnecter », qui demande confirmation.
// La déconnexion n'est accessible que d'ici.

import { DownOutlined, LogoutOutlined, UpOutlined } from "@ant-design/icons";
import { App, Avatar, Dropdown, type MenuProps } from "antd";

import { logout } from "@/actions/auth";

// « Claire Mertens » → « CM »
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.at(-1)?.[0] ?? "")).toUpperCase() || "?";
}

export function UserMenu({
  name,
  caption,
  placement = "bottomRight",
  reconnectHint,
}: {
  name: string;
  caption?: string | null; // sous le nom dans le menu : adresse, ou « Administrateur »
  placement?: "bottomRight" | "topLeft";
  reconnectHint: string; // ce qu'il faudra pour revenir, affiché dans la confirmation
}) {
  const { modal } = App.useApp();
  const opensUp = placement.startsWith("top");

  function confirmLogout() {
    modal.confirm({
      title: "Se déconnecter ?",
      icon: <LogoutOutlined />,
      content: reconnectHint,
      okText: "Se déconnecter",
      cancelText: "Annuler",
      // La fenêtre attend la fin de l'action ; logout redirige vers /login.
      onOk: () => logout(),
    });
  }

  const items: MenuProps["items"] = [
    ...(caption ? [{ key: "caption", label: <span className="text-[13px] text-graphite">{caption}</span>, disabled: true }] : []),
    ...(caption ? [{ type: "divider" as const }] : []),
    { key: "logout", icon: <LogoutOutlined />, label: "Se déconnecter" },
  ];

  return (
    <Dropdown
      trigger={["click"]}
      placement={placement}
      menu={{ items, onClick: ({ key }) => key === "logout" && confirmLogout() }}
    >
      <button
        type="button"
        aria-label={`Menu de ${name}`}
        className={`flex cursor-pointer items-center ${opensUp ? "w-full" : ""} gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-desk`}
      >
        <Avatar className="shrink-0 bg-pen! font-semibold">{initials(name)}</Avatar>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
        {opensUp ? (
          <UpOutlined aria-hidden="true" className="text-xs text-graphite" />
        ) : (
          <DownOutlined aria-hidden="true" className="text-xs text-graphite" />
        )}
      </button>
    </Dropdown>
  );
}
