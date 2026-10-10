// Liste des ressources (maquette « Admin — Ressources »).
// La page charge toutes les ressources ; recherche, filtre et tri se font
// dans le tableau, côté navigateur (quelques centaines de lignes au plus).

import { ResourcesTable } from "@/components/resource/resources-table";
import { DesktopOutlined, ExclamationCircleOutlined, HomeOutlined, TeamOutlined, UserOutlined } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { countResourcesByType, listResources } from "@/lib/resource";
import { requireAdmin } from "@/lib/session";

export default async function ResourcesPage() {
  await requireAdmin();

  const [resources, totals] = await Promise.all([listResources(), countResourcesByType()]);
  const signaled = resources.reduce((n, r) => n + r.unavailable + r.ifNeeded, 0);

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8 md:px-10">
      <PageHeader
        icon={<TeamOutlined />}
        title="Ressources"
        description="Le personnel, les locaux et les équipements dont on suit les disponibilités."
        figures={[
          { icon: <UserOutlined />, value: totals.PERSON, label: totals.PERSON > 1 ? "personnes" : "personne" },
          { icon: <HomeOutlined />, value: totals.LOCAL, label: totals.LOCAL > 1 ? "locaux" : "local" },
          { icon: <DesktopOutlined />, value: totals.EQUIPMENT, label: totals.EQUIPMENT > 1 ? "équipements" : "équipement" },
          { icon: <ExclamationCircleOutlined />, value: signaled, label: signaled > 1 ? "créneaux signalés" : "créneau signalé" },
        ]}
      />

      <ResourcesTable rows={resources} />
    </main>
  );
}
