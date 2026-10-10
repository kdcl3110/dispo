// Écran « Export JSON » (maquette « Admin — Export JSON »).
// Les chiffres du calendrier choisi, le bouton de téléchargement, et un aperçu
// du fichier replié par défaut. Le téléchargement passe par la route
// /admin/export/download.

import { Button, Collapse } from "antd";
import Link from "next/link";

import { CalendarPicker } from "@/components/admin/calendar-picker";
import {
  CarryOutOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  ExportOutlined,
  InfoCircleOutlined,
  TeamOutlined,
} from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { defaultCalendarId, listCalendars } from "@/lib/calendar";
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

export default async function ExportPage({ searchParams }: PageProps<"/admin/export">) {
  const admin = await requireAdmin();

  // Calendrier demandé dans l'URL, sinon celui proposé par défaut.
  const [calendars, params] = await Promise.all([listCalendars(), searchParams]);
  const calendarId = calendars.find((c) => c.id === params.calendar)?.id ?? defaultCalendarId(calendars);
  const document = calendarId ? await buildExport(calendarId, admin.name ?? "admin") : null;

  if (!calendarId || !document) {
    return (
      <main className="flex flex-1 flex-col gap-5 px-6 py-5 md:px-10">
        <PageHeader icon={<ExportOutlined />} title="Export JSON" />
        <p className="max-w-[560px] text-[15px] leading-relaxed text-graphite">
          Créez d&apos;abord un calendrier : l&apos;export en découle. <Link href="/admin/calendars">Aller aux calendriers</Link>
        </p>
      </main>
    );
  }

  const { calendar, slots, resources } = document;
  const days = calendarDays({ ...calendar, holidays: calendar.holidays.map((h) => h.date) }).length;
  const exceptions = resources.reduce((n, r) => n + r.exceptions.length, 0);
  const preview = JSON.stringify(previewOf(document), null, 2);

  return (
    <main className="flex flex-1 flex-col gap-5 px-6 py-5 md:px-10">
      <PageHeader
        icon={<ExportOutlined />}
        title="Export JSON"
        description="Un fichier par calendrier, avec sa configuration, sa grille de créneaux et tous les créneaux signalés."
        figures={[
          { icon: <CarryOutOutlined />, value: days, label: "jours de cours" },
          { icon: <ClockCircleOutlined />, value: slots.length, label: "créneaux par jour" },
          { icon: <TeamOutlined />, value: resources.length, label: resources.length > 1 ? "ressources" : "ressource" },
          { icon: <ExclamationCircleOutlined />, value: exceptions, label: exceptions > 1 ? "créneaux signalés" : "créneau signalé" },
        ]}
      />

      {/* Une seule barre : quoi exporter, et le bouton pour le faire. */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-t border-rule pt-4">
        <CalendarPicker calendars={calendars} selectedId={calendarId} />
        <div className="flex flex-col items-end gap-1.5">
          <Button type="primary" size="large" icon={<DownloadOutlined />} href={`/admin/export/download?calendar=${calendarId}`}>
            Télécharger le JSON
          </Button>
          <span className="text-[13px] text-graphite">{exportFileName(document)}</span>
        </div>
      </div>

      <p className="flex items-start gap-2.5 text-sm leading-relaxed text-graphite">
        <InfoCircleOutlined aria-hidden="true" className="mt-1 text-pen" />
        Le fichier ne liste que les créneaux signalés : un créneau absent vaut « disponible ». Les jours retirés ne
        produisent aucun créneau.
      </p>

      {/* L'aperçu ne prend de la place que si on le demande. */}
      <Collapse
        items={[
          {
            key: "preview",
            label: (
              <span className="font-medium">
                Voir un aperçu du fichier
                {resources.length > 2 && <span className="font-normal text-graphite"> (2 premières ressources)</span>}
              </span>
            ),
            children: (
              <pre className="m-0 max-h-[60vh] overflow-auto rounded-md bg-[#f6f8fb] p-5 font-mono text-[12.5px] leading-relaxed text-graphite">
                <Highlighted json={preview} />
              </pre>
            ),
          },
        ]}
      />
    </main>
  );
}
