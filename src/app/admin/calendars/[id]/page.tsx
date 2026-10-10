// Un calendrier : résumé lisible, publication, et panneaux pour modifier les
// horaires et les congés. Voir components/calendar/overview.tsx.

import Link from "next/link";
import { notFound } from "next/navigation";

import { CalendarOverview } from "@/components/calendar/overview";
import { ArrowLeftOutlined } from "@/components/ui/icons";
import { countExceptions, getCalendar } from "@/lib/calendar";
import { requireAdmin } from "@/lib/session";

export default async function CalendarPage({ params }: PageProps<"/admin/calendars/[id]">) {
  // Le layout vérifie déjà le rôle, mais page et layout se rendent en
  // parallèle : la page ne doit pas lire la base sans son propre contrôle.
  await requireAdmin();

  const { id } = await params;
  const calendar = await getCalendar(id);
  if (!calendar) notFound();
  const exceptions = await countExceptions(calendar.id);

  return (
    <main className="flex flex-1 flex-col gap-5 px-6 py-5 md:px-10">
      <Link href="/admin/calendars" className="inline-flex items-center gap-2 self-start text-sm font-medium">
        <ArrowLeftOutlined aria-hidden="true" />
        Tous les calendriers
      </Link>

      <CalendarOverview
        calendar={{ ...calendar, publishedAt: calendar.publishedAt?.toISOString() ?? null }}
        exceptions={exceptions}
      />
    </main>
  );
}
