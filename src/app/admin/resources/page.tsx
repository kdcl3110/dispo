// Liste des ressources (maquette « Admin — Ressources »).
// La page charge toutes les ressources ; recherche, filtre et tri se font
// dans le tableau, côté navigateur (quelques centaines de lignes au plus).

import { ResourcesTable } from "@/components/resource/resources-table";
import { countResourcesByType, listResources } from "@/lib/resource";
import { requireAdmin } from "@/lib/session";

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export default async function ResourcesPage() {
  await requireAdmin();

  const [resources, totals] = await Promise.all([listResources(), countResourcesByType()]);
  const total = totals.PERSON + totals.LOCAL + totals.EQUIPMENT;

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8 md:px-10">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.015em]">Ressources</h1>
        <p className="max-w-[680px] text-[15px] leading-relaxed text-graphite">
          {plural(total, "ressource", "ressources")} : {plural(totals.PERSON, "personne", "personnes")},{" "}
          {plural(totals.LOCAL, "local", "locaux")} et {plural(totals.EQUIPMENT, "équipement", "équipements")}.
        </p>
      </div>

      <ResourcesTable rows={resources} />
    </main>
  );
}
