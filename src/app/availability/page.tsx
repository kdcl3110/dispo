// « Mes disponibilités » : la grille du membre du personnel connecté.

import { AvailabilityBoard } from "@/components/availability-grid/board";
import type { ExceptionMap } from "@/components/availability-grid/grid";
import { getExceptions } from "@/lib/availability";
import { getCalendar } from "@/lib/calendar";
import { getPersonResource } from "@/lib/resource";
import { requireUser } from "@/lib/session";
import { calendarDays, generateSlots, slotKey } from "@/lib/slots";

export default async function MyAvailabilityPage() {
  const user = await requireUser();
  const [calendar, resource] = await Promise.all([getCalendar(), getPersonResource(user.id)]);

  // Avant publication, le personnel ne voit rien (SPEC §10, règle 5).
  if (!calendar?.publishedAt) {
    return (
      <Message title="Le calendrier n'est pas encore publié">
        Vous pourrez signaler vos créneaux dès que l&apos;administration l&apos;aura publié.
      </Message>
    );
  }

  // Ne devrait pas arriver : la fiche est créée à la première connexion.
  if (!resource) {
    return (
      <Message title="Votre fiche est introuvable">
        Déconnectez-vous puis reconnectez-vous avec votre compte Google pour la recréer.
      </Message>
    );
  }

  const exceptions = await getExceptions(calendar.id, resource.id);
  const initialExceptions: ExceptionMap = Object.fromEntries(
    exceptions.map((e) => [slotKey(e.date, e.start), { status: e.status, comment: e.comment }]),
  );
  const days = calendarDays({ ...calendar, holidays: calendar.holidays.map((h) => h.date) });

  return (
    <main className="flex flex-1 flex-col gap-5 px-6 py-7 md:px-10">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.015em]">Mes disponibilités</h1>
        <p className="max-w-[680px] text-[15px] leading-relaxed text-graphite">
          Tout est disponible par défaut. Cliquez sur un créneau pour signaler un problème.
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

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col gap-2 px-6 py-12 md:px-10">
      <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.015em]">{title}</h1>
      <p className="max-w-[560px] text-[15px] leading-relaxed text-graphite">{children}</p>
    </main>
  );
}
