// Liste des ressources (maquette « Admin — Ressources »).
// Recherche et filtre passent par l'URL (?q=…&type=…) : ils fonctionnent sans
// JavaScript et une liste filtrée peut se partager par lien.

import Link from "next/link";

import type { ResourceType } from "@/generated/prisma/enums";
import { countResourcesByType, listResources } from "@/lib/resource";
import { requireAdmin } from "@/lib/session";

const TYPES: { value: ResourceType | undefined; label: string }[] = [
  { value: undefined, label: "Toutes" },
  { value: "PERSON", label: "Personnes" },
  { value: "LOCAL", label: "Locaux" },
  { value: "EQUIPMENT", label: "Équipements" },
];

const TYPE_LABEL: Record<ResourceType, string> = {
  PERSON: "Personne",
  LOCAL: "Local",
  EQUIPMENT: "Équipement",
};

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

// « 38 indisponibles, 12 si nécessaire » ou « Aucun »
function describeExceptions(unavailable: number, ifNeeded: number) {
  const parts = [];
  if (unavailable > 0) parts.push(plural(unavailable, "indisponible", "indisponibles"));
  if (ifNeeded > 0) parts.push(`${ifNeeded} si nécessaire`);
  return parts.join(", ") || "Aucun";
}

export default async function ResourcesPage({ searchParams }: PageProps<"/admin/resources">) {
  await requireAdmin();

  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const type = TYPES.find((t) => t.value === params.type)?.value;

  const [resources, totals] = await Promise.all([listResources({ type, query }), countResourcesByType()]);
  const total = totals.PERSON + totals.LOCAL + totals.EQUIPMENT;

  // Lien vers la même liste avec un autre filtre, en gardant la recherche.
  const hrefFor = (value: ResourceType | undefined) => {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (value) search.set("type", value);
    const qs = search.toString();
    return qs ? `/admin/resources?${qs}` : "/admin/resources";
  };

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8 md:px-10">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.015em]">Ressources</h1>
        <p className="max-w-[680px] text-[15px] leading-relaxed text-graphite">
          {plural(total, "ressource", "ressources")} : {plural(totals.PERSON, "personne", "personnes")},{" "}
          {plural(totals.LOCAL, "local", "locaux")} et {plural(totals.EQUIPMENT, "équipement", "équipements")}.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <form method="get" role="search" className="flex gap-2">
          {type && <input type="hidden" name="type" value={type} />}
          <label htmlFor="q" className="sr-only">
            Rechercher une ressource
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Rechercher par nom ou adresse"
            className="h-10 w-75 rounded-md border border-field bg-paper px-3 text-sm"
          />
          <button type="submit" className="h-10 cursor-pointer rounded-md border border-field px-4 text-sm font-semibold hover:bg-desk">
            Rechercher
          </button>
        </form>

        <nav aria-label="Filtrer par type" className="flex gap-1">
          {TYPES.map((t) => {
            const active = t.value === type;
            return (
              <Link
                key={t.label}
                href={hrefFor(t.value)}
                aria-current={active ? "page" : undefined}
                className={`flex h-9 items-center rounded-md border px-3.5 text-sm font-medium no-underline ${
                  active ? "border-pen bg-pen-tint text-pen" : "border-field text-ink hover:bg-desk"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {resources.length === 0 ? (
        <EmptyState total={total} query={query} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-b border-field text-[13px] text-graphite">
                <th scope="col" className="h-10 font-medium">Nom</th>
                <th scope="col" className="w-30 font-medium">Type</th>
                <th scope="col" className="w-60 font-medium">Compte Google</th>
                <th scope="col" className="w-62 font-medium">Créneaux signalés</th>
                <th scope="col" className="w-30">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => (
                <tr key={r.id} className="h-13.5 border-b border-rule">
                  <td className="text-[15px] font-medium">{r.name}</td>
                  <td className="text-sm text-graphite">{TYPE_LABEL[r.type]}</td>
                  <td className="text-sm text-graphite">{r.email ?? "Pas de compte"}</td>
                  <td className={`text-sm ${r.unavailable + r.ifNeeded > 0 ? "text-ink" : "text-graphite"}`}>
                    {describeExceptions(r.unavailable, r.ifNeeded)}
                  </td>
                  <td className="text-right">
                    <Link href={`/admin/availability?resource=${r.id}`} className="text-sm font-medium">
                      Voir la grille
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function EmptyState({ total, query }: { total: number; query: string }) {
  if (total > 0) {
    return (
      <p className="text-[15px] text-graphite">
        Aucune ressource ne correspond{query ? ` à « ${query} »` : " à ce filtre"}.
      </p>
    );
  }
  return (
    <div className="flex max-w-[560px] flex-col gap-2">
      <h2 className="text-base font-semibold">Aucune ressource pour l&apos;instant</h2>
      <p className="text-[15px] leading-relaxed text-graphite">
        Les membres du personnel apparaissent ici à leur première connexion. Les locaux et les équipements
        s&apos;ajoutent depuis un fichier Excel.
      </p>
      <Link href="/admin/resources/import" className="text-[15px] font-medium">
        Importer des locaux et équipements
      </Link>
    </div>
  );
}
