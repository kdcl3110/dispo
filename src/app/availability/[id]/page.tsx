// La grille d'un calendrier publié, pour le membre du personnel connecté.

import Link from "next/link";
import { notFound } from "next/navigation";

import { AvailabilityBoard } from "@/components/availability-grid/board";
import type { ExceptionMap } from "@/components/availability-grid/grid";
import { ArrowLeftOutlined } from "@/components/ui/icons";
import { getExceptions } from "@/lib/availability";
import { getCalendar, listCalendars } from "@/lib/calendar";
import { getPersonResource } from "@/lib/resource";
import { requireUser } from "@/lib/session";
import { calendarDays, generateSlots, slotKey } from "@/lib/slots";

const longDate = new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const format = (date: string) => longDate.format(new Date(`${date}T00:00:00Z`));

export default async function CalendarGridPage({ params }: PageProps<"/availability/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const [calendar, resource, published] = await Promise.all([
    getCalendar(id),
    getPersonResource(user.id),
    listCalendars({ publishedOnly: true }),
  ]);

  // Un brouillon n'existe pas pour le personnel (SPEC §10, règle 5).
  if (!calendar?.publishedAt) notFound();

  // Ne devrait pas arriver : la fiche est créée à la première connexion.
  if (!resource) {
    return (
      <main className="flex flex-1 flex-col gap-2 px-6 py-12 md:px-10">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.015em]">Votre fiche est introuvable</h1>
        <p className="max-w-[560px] text-[15px] leading-relaxed text-graphite">
          Déconnectez-vous puis reconnectez-vous avec votre compte Google pour la recréer.
        </p>
      </main>
    );
  }

  const exceptions = await getExceptions(calendar.id, resource.id);
  const initialExceptions: ExceptionMap = Object.fromEntries(
    exceptions.map((e) => [slotKey(e.date, e.start), { status: e.status, comment: e.comment }]),
  );
  const days = calendarDays({ ...calendar, holidays: calendar.holidays.map((h) => h.date) });

  return (
    <main className="flex flex-1 flex-col gap-5 px-6 py-7 md:px-10">
      {/* Retour à la liste seulement s'il y en a une (plusieurs calendriers publiés). */}
      {published.length > 1 && (
        <Link href="/availability" className="inline-flex items-center gap-2 self-start text-sm font-medium">
          <ArrowLeftOutlined aria-hidden="true" />
          Tous mes calendriers
        </Link>
      )}

      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.015em]">{calendar.name}</h1>
        <p className="max-w-[760px] text-[15px] leading-relaxed text-graphite">
          Du {format(calendar.startDate)} au {format(calendar.endDate)}. Tout est disponible par défaut : cliquez sur
          un créneau pour signaler un problème.
        </p>
      </div>

      <AvailabilityBoard
        resourceId={resource.id}
        calendar={calendar}
        initialExceptions={initialExceptions}
        totalSlots={days.length * generateSlots(calendar).length}
      />
    </main>
  );
}
