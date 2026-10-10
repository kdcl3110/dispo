// Cadre de toute la zone ADMIN : vérification du rôle + barre latérale.
// requireAdmin() est la vraie barrière (proxy.ts n'est qu'un raccourci).

import { AdminShell } from "@/components/admin/shell";
import { requireAdmin } from "@/lib/session";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();

  return <AdminShell username={user.name ?? "Administrateur"}>{children}</AdminShell>;
}
