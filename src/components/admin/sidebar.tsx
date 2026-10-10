"use client";

// Barre latérale de la zone admin (maquettes « Admin — … »).
// Composant client : il lit l'URL courante pour marquer la page active.

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logout } from "@/actions/auth";

// Regroupée par phase de travail : préparer le calendrier, puis les ressources.
const navigation = [
  {
    title: "Calendrier",
    links: [
      { href: "/admin/calendar", label: "Configuration" },
      { href: "/admin/calendar/holidays", label: "Jours fériés et publication" },
    ],
  },
  {
    title: "Ressources",
    links: [
      { href: "/admin/resources", label: "Liste des ressources" },
      { href: "/admin/resources/import", label: "Import des locaux" },
      { href: "/admin/availability", label: "Saisie des disponibilités" },
      { href: "/admin/export", label: "Export JSON" },
    ],
  },
];

export function AdminSidebar({ username }: { username: string }) {
  const pathname = usePathname();

  return (
    <div className="flex shrink-0 flex-col justify-between gap-8 border-b border-rule px-4 py-6 md:w-58 md:border-r md:border-b-0 md:pt-7">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-1.5 px-3">
          <span className="font-condensed text-2xl leading-none font-semibold tracking-[-0.01em]">
            dispo
          </span>
          <span className="text-[13px] text-graphite">Administration</span>
        </div>

        <nav aria-label="Administration" className="flex flex-col gap-6">
          {navigation.map((group) => (
            <div key={group.title} className="flex flex-col gap-0.5">
              <span className="px-3 pb-1.5 text-xs font-medium text-graphite">{group.title}</span>
              {group.links.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-9.5 items-center rounded-md px-3 text-sm no-underline ${
                      active ? "bg-pen-tint font-semibold text-pen" : "text-ink hover:bg-desk"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      <div className="mx-3 flex flex-col items-start gap-0.5 border-t border-rule pt-4">
        <span className="text-sm font-medium">{username}</span>
        <form action={logout}>
          <button type="submit" className="cursor-pointer text-[13px] text-pen hover:text-pen-dark">
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  );
}
