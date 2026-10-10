// Écran « Calendrier » : un résumé lisible du calendrier, avec l'action
// principale (créer, puis publier) et des panneaux pour modifier les horaires
// et les congés. Voir components/calendar/overview.tsx.

import { CalendarOverview } from "@/components/calendar/overview";
import { CalendarOutlined } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { countExceptions, getCalendar } from "@/lib/calendar";
import { requireAdmin } from "@/lib/session";

export default async function CalendarPage() {
  // Le layout vérifie déjà le rôle, mais page et layout se rendent en
  // parallèle : la page ne doit pas lire la base sans son propre contrôle.
  await requireAdmin();

  const calendar = await getCalendar();
  const exceptions = calendar ? await countExceptions(calendar.id) : 0;

  return (
    <main className="flex flex-1 flex-col gap-8 px-6 py-8 md:px-10">
      <PageHeader
        icon={<CalendarOutlined />}
        title="Calendrier"
        description="La période, les horaires et les congés du quadrimestre, communs à tout le personnel."
      />

      <CalendarOverview
        calendar={calendar && { ...calendar, publishedAt: calendar.publishedAt?.toISOString() ?? null }}
        exceptions={exceptions}
      />
    </main>
  );
}
