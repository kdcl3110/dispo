// Écran « Export JSON » (maquette « Admin — Export JSON »).
// Résume le contenu du fichier et en montre le début ; le téléchargement
// passe par la route /admin/export/download.

import { Button } from "antd";
import Link from "next/link";

import { getDefaultCalendar } from "@/lib/calendar";
import { buildExport, exportFileName, type ExportDocument } from "@/lib/export";
import { requireAdmin } from "@/lib/session";
import { calendarDays } from "@/lib/slots";

// Aperçu : la configuration, la grille, puis les deux premières ressources
// avec trois créneaux chacune au plus. Le fichier, lui, contient tout.
function previewOf(document: ExportDocument) {
  return {
    ...document,
    resources: document.resources.slice(0, 2).map((r) => ({ ...r, exceptions: r.exceptions.slice(0, 3) })),
  };
}

// Coloration minimale du JSON : clés en bleu, nombres en brique. Le split
// capture les clés ("…" suivi de « : ») et les nombres nus ; les morceaux
// d'indice impair sont ces captures, le reste est du texte brut.
const TOKENS = /("(?:[^"\\]|\\.)*"(?=:)|(?<=: )-?\d+(?:\.\d+)?(?=,?\n))/;

function Highlighted({ json }: { json: string }) {
  return json.split(TOKENS).map((part, i) => {
    if (i % 2 === 0) return part;
    return (
      <span key={i} className={part.startsWith('"') ? "text-pen" : "text-[#a1461b]"}>
        {part}
      </span>
    );
  });
}

export default async function ExportPage() {
  const admin = await requireAdmin();
  // PROVISOIRE : le calendrier par défaut, jusqu'au choix du calendrier (étape 5).
  const calendarId = (await getDefaultCalendar())?.id;
  const document = calendarId ? await buildExport(calendarId, admin.name ?? "admin") : null;

  if (!document) {
    return (
      <main className="flex flex-1 flex-col gap-2 px-6 py-12 md:px-10">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.015em]">Rien à exporter</h1>
        <p className="max-w-[560px] text-[15px] leading-relaxed text-graphite">
          Configurez d&apos;abord le calendrier : l&apos;export en découle. <Link href="/admin/calendar">Aller à la configuration</Link>
        </p>
      </main>
    );
  }

  const { calendar, slots, resources } = document;
  const days = calendarDays({ ...calendar, holidays: calendar.holidays.map((h) => h.date) }).length;
  const exceptions = resources.reduce((n, r) => n + r.exceptions.length, 0);
  const preview = JSON.stringify(previewOf(document), null, 2);

  const summary: [string, string | number][] = [
    ["Calendrier", calendar.name],
    ["Jours de cours", days],
    ["Créneaux par jour", slots.length],
    ["Jours retirés", calendar.holidays.length],
    ["Ressources", resources.length],
    ["Créneaux signalés", exceptions],
  ];

  return (
    // Grand écran : la page tient exactement dans la fenêtre (h-screen) et seul
    // l'aperçu défile. Sans ça, l'aperçu et la page défilaient l'un dans l'autre.
    // Petit écran : la page défile normalement.
    <main className="flex flex-1 flex-col gap-6 px-6 py-8 md:px-10 lg:h-screen lg:flex-none lg:overflow-hidden">
      <div className="flex shrink-0 flex-col gap-1.5">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.015em]">Export JSON</h1>
        <p className="max-w-[680px] text-[15px] leading-relaxed text-graphite">
          Un fichier avec la configuration du calendrier, la grille des créneaux, les jours retirés et tous les créneaux
          signalés.
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-10 lg:min-h-0 lg:flex-row">
        <div className="flex flex-col gap-6 lg:w-80 lg:shrink-0 lg:overflow-y-auto">
          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">Contenu du fichier</h2>
            <dl className="flex flex-col border-t border-rule">
              {summary.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5">
                  <dt className="text-sm text-graphite">{label}</dt>
                  <dd className="text-right text-sm font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex flex-col gap-2">
            <Button type="primary" size="large" block href={`/admin/export/download?calendar=${calendarId}`}>
              Télécharger le JSON
            </Button>
            <span className="text-center text-[13px] text-graphite">{exportFileName(document)}</span>
          </div>

          <div className="flex flex-col gap-2.5 border-t border-rule pt-5">
            <h2 className="text-base font-semibold">Ce que le fichier ne liste pas</h2>
            <p className="text-sm leading-relaxed text-graphite">
              Les créneaux disponibles. Un créneau absent vaut « available », comme l&apos;indique le champ defaultStatus.
            </p>
            <p className="text-sm leading-relaxed text-graphite">Les jours retirés. Ils ne produisent aucun créneau.</p>
          </div>
        </div>

        <section aria-labelledby="preview-title" className="flex min-h-[420px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-rule bg-[#f6f8fb] lg:min-h-0">
          <div className="flex h-13 shrink-0 items-center justify-between border-b border-rule bg-paper px-5">
            <h2 id="preview-title" className="text-sm font-semibold">
              Aperçu du fichier
            </h2>
            {resources.length > 2 && (
              <span className="text-[13px] text-graphite">Limité aux 2 premières ressources</span>
            )}
          </div>
          <pre className="m-0 min-h-0 flex-1 overflow-auto p-5 font-mono text-[12.5px] leading-relaxed text-graphite">
            <Highlighted json={preview} />
          </pre>
        </section>
      </div>
    </main>
  );
}
