// Écran « Jours fériés et congés » + publication (étape 2 et 3 du calendrier).

import { redirect } from "next/navigation";

import { HolidaysForm } from "@/components/calendar/holidays-form";
import { CalendarSteps } from "@/components/calendar/steps";
import { countExceptions, getCalendar } from "@/lib/calendar";
import { requireAdmin } from "@/lib/session";
import { generateSlots } from "@/lib/slots";

export default async function HolidaysPage() {
  await requireAdmin();

  // Pas de calendrier : rien à retirer, on renvoie vers la configuration.
  const calendar = await getCalendar();
  if (!calendar) redirect("/admin/calendar");

  const exceptions = await countExceptions(calendar.id);

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.015em]">Jours fériés et congés</h1>
          <p className="max-w-[680px] text-[15px] leading-relaxed text-graphite">
            Cliquez sur une journée pour la retirer du calendrier : aucun créneau n&apos;y sera proposé.
          </p>
        </div>
        {/* Publié : les trois étapes sont faites. */}
        <CalendarSteps current={calendar.publishedAt ? 3 : 1} />
      </div>

      <HolidaysForm
        calendar={{ startDate: calendar.startDate, endDate: calendar.endDate, weekDays: calendar.weekDays }}
        initialHolidays={calendar.holidays}
        slotsPerDay={generateSlots(calendar).length}
        publishedAt={calendar.publishedAt?.toISOString() ?? null}
        locked={exceptions > 0}
      />
    </main>
  );
}
