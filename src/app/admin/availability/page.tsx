// « Disponibilités d'une ressource » (maquette « Admin — Disponibilités »).
// L'administrateur saisit pour un local, un équipement ou un membre du
// personnel, avec la même grille et la même fenêtre que le personnel.

import Link from "next/link";

import { CalendarPicker } from "@/components/admin/calendar-picker";
import { ResourcePicker } from "@/components/admin/resource-picker";
import { AvailabilityBoard } from "@/components/availability-grid/board";
import type { ExceptionMap } from "@/components/availability-grid/grid";
import { getExceptions } from "@/lib/availability";
import { defaultCalendarId, getCalendar, listCalendars } from "@/lib/calendar";
import { listResources } from "@/lib/resource";
import { requireAdmin } from "@/lib/session";
import { calendarDays, generateSlots, slotKey } from "@/lib/slots";

export default async function AdminAvailabilityPage({ searchParams }: PageProps<"/admin/availability">) {
  await requireAdmin();

  const [calendars, resources, params] = await Promise.all([listCalendars(), listResources(), searchParams]);

  if (calendars.length === 0) {
    return (
      <Message title="Aucun calendrier">
        Créez d&apos;abord un calendrier : la grille en découle.{" "}
        <Link href="/admin/calendars">Aller aux calendriers</Link>
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

  // Calendrier et ressource demandés dans l'URL, sinon ceux proposés par défaut.
  const calendarId = calendars.find((c) => c.id === params.calendar)?.id ?? defaultCalendarId(calendars)!;
  const calendar = (await getCalendar(calendarId))!;
  const resource = resources.find((r) => r.id === params.resource) ?? resources[0];

  const exceptions = await getExceptions(calendar.id, resource.id);
  const initialExceptions: ExceptionMap = Object.fromEntries(
    exceptions.map((e) => [slotKey(e.date, e.start), { status: e.status, comment: e.comment }]),
  );
  const days = calendarDays({ ...calendar, holidays: calendar.holidays.map((h) => h.date) });

  return (
    // Grand écran : la page tient dans la fenêtre et seule la grille défile.
    <main className="flex flex-1 flex-col gap-3 px-6 py-4 md:px-10 lg:h-dvh lg:flex-none lg:overflow-hidden">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-xl leading-tight font-semibold tracking-[-0.01em]">Saisie des disponibilités</h1>
        <span className="text-sm text-graphite">
          Pour un local, un équipement ou un membre du personnel.
          {!calendar.publishedAt && " Ce calendrier n'est pas encore publié : seule l'administration peut saisir."}
        </span>
      </div>

      {/* key : changer de calendrier ou de ressource repart d'un état propre. */}
      <AvailabilityBoard
        key={`${calendar.id}-${resource.id}`}
        resourceId={resource.id}
        calendar={calendar}
        initialExceptions={initialExceptions}
        totalSlots={days.length * generateSlots(calendar).length}
        quickMarking
        leading={
          <>
            <CalendarPicker calendars={calendars} selectedId={calendar.id} />
            <ResourcePicker resources={resources} selectedId={resource.id} />
          </>
        }
      />
    </main>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col gap-2 px-6 py-8 md:px-10">
      <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.015em]">{title}</h1>
      <p className="max-w-[560px] text-[15px] leading-relaxed text-graphite">{children}</p>
    </main>
  );
}
