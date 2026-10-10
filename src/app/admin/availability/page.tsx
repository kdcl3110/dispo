// « Disponibilités d'une ressource » (maquette « Admin — Disponibilités »).
// L'administrateur saisit pour un local, un équipement ou un membre du
// personnel, avec la même grille et la même fenêtre que le personnel.

import Link from "next/link";

import { ResourcePicker } from "@/components/admin/resource-picker";
import { AvailabilityBoard } from "@/components/availability-grid/board";
import type { ExceptionMap } from "@/components/availability-grid/grid";
import { getExceptions } from "@/lib/availability";
import { getCalendar } from "@/lib/calendar";
import { listResources } from "@/lib/resource";
import { requireAdmin } from "@/lib/session";
import { calendarDays, generateSlots, slotKey } from "@/lib/slots";

export default async function AdminAvailabilityPage({ searchParams }: PageProps<"/admin/availability">) {
  await requireAdmin();

  const [calendar, resources] = await Promise.all([getCalendar(), listResources()]);

  if (!calendar) {
    return (
      <Message title="Aucun calendrier">
        Configurez d&apos;abord le calendrier : la grille en découle.{" "}
        <Link href="/admin/calendar">Aller à la configuration</Link>
      </Message>
    );
  }
  if (resources.length === 0) {
    return (
      <Message title="Aucune ressource">
        Ajoutez ou importez des locaux et équipements, ou attendez la première connexion du personnel.{" "}
        <Link href="/admin/resources">Aller aux ressources</Link>
      </Message>
    );
  }

  // Ressource demandée dans l'URL, sinon la première de la liste.
  const { resource: requested } = await searchParams;
  const resource = resources.find((r) => r.id === requested) ?? resources[0];

  const exceptions = await getExceptions(calendar.id, resource.id);
  const initialExceptions: ExceptionMap = Object.fromEntries(
    exceptions.map((e) => [slotKey(e.date, e.start), { status: e.status, comment: e.comment }]),
  );
  const days = calendarDays({ ...calendar, holidays: calendar.holidays.map((h) => h.date) });

  return (
    <main className="flex flex-1 flex-col gap-5 px-6 py-8 md:px-10">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.015em]">Disponibilités d&apos;une ressource</h1>
        <p className="max-w-[680px] text-[15px] leading-relaxed text-graphite">
          Signalez les créneaux où un local, un équipement ou un membre du personnel n&apos;est pas disponible.
          {!calendar.publishedAt && " Le calendrier n'est pas encore publié : seule l'administration peut saisir."}
        </p>
      </div>

      <ResourcePicker resources={resources} selectedId={resource.id} />

      {/* key : changer de ressource repart d'un état propre. */}
      <AvailabilityBoard
        key={resource.id}
        resourceId={resource.id}
        calendar={calendar}
        initialExceptions={initialExceptions}
        totalSlots={days.length * generateSlots(calendar).length}
      />
    </main>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col gap-2 px-6 py-12 md:px-10">
      <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.015em]">{title}</h1>
      <p className="max-w-[560px] text-[15px] leading-relaxed text-graphite">{children}</p>
    </main>
  );
}
