// Cadre de toute la zone ADMIN : vérification du rôle + barre latérale.
// requireAdmin() est la vraie barrière (proxy.ts n'est qu'un raccourci).

import { AdminSidebar } from "@/components/admin/sidebar";
import { requireAdmin } from "@/lib/session";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <AdminSidebar username={user.name ?? "Administrateur"} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
