// Liste des calendriers : quadrimestres, conférences, événements… Chacun a
// ses horaires, ses congés, sa publication et ses créneaux signalés.

import { CalendarsList } from "@/components/calendar/calendars-list";
import { CalendarOutlined } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { listCalendars } from "@/lib/calendar";
import { requireAdmin } from "@/lib/session";

export default async function CalendarsPage() {
  await requireAdmin();
  const calendars = await listCalendars();

  return (
    <main className="flex flex-1 flex-col gap-5 px-6 py-5 md:px-10">
      <PageHeader
        icon={<CalendarOutlined />}
        title="Calendriers"
        description="Un calendrier par quadrimestre, conférence ou événement. Le personnel voit tous les calendriers publiés."
      />
      <CalendarsList rows={calendars} />
    </main>
  );
}
