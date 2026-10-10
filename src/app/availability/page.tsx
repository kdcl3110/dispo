// « Mes disponibilités » : les calendriers publiés.
//  - aucun : un message d'attente ;
//  - un seul : on va directement à sa grille ;
//  - plusieurs : on les liste, avec le nombre de créneaux déjà signalés.

import Link from "next/link";
import { redirect } from "next/navigation";

import { CalendarOutlined, RightOutlined } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { countExceptionsByCalendar } from "@/lib/availability";
import { listCalendars } from "@/lib/calendar";
import { getPersonResource } from "@/lib/resource";
import { requireUser } from "@/lib/session";

const shortDate = new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const format = (date: string) => shortDate.format(new Date(`${date}T00:00:00Z`));

export default async function MyCalendarsPage() {
  const user = await requireUser();
  const [calendars, resource] = await Promise.all([listCalendars({ publishedOnly: true }), getPersonResource(user.id)]);

  if (calendars.length === 1) redirect(`/availability/${calendars[0].id}`);

  if (calendars.length === 0) {
    return (
      <main className="flex flex-1 flex-col gap-2 px-6 py-12 md:px-10">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.015em]">Aucun calendrier publié</h1>
        <p className="max-w-[560px] text-[15px] leading-relaxed text-graphite">
          Vous pourrez signaler vos créneaux dès que l&apos;administration aura publié un calendrier.
        </p>
      </main>
    );
  }

  const mine = resource ? await countExceptionsByCalendar(resource.id) : {};

  return (
    <main className="flex flex-1 flex-col gap-8 px-6 py-8 md:px-10">
      <PageHeader
        icon={<CalendarOutlined />}
        title="Mes calendriers"
        description="Choisissez un calendrier pour indiquer vos disponibilités. Tout est disponible par défaut."
      />

      <ul className="flex max-w-[860px] flex-col gap-3">
        {calendars.map((c) => {
          const n = mine[c.id] ?? 0;
          return (
            <li key={c.id}>
              <Link
                href={`/availability/${c.id}`}
                className="flex items-center gap-5 rounded-xl border border-rule px-5 py-4 text-ink no-underline transition-colors hover:border-pen hover:bg-pen-tint hover:text-ink"
              >
                <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-pen-tint text-xl text-pen">
                  <CalendarOutlined />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-base font-semibold">{c.name}</span>
                  <span className="text-sm text-graphite">
                    Du {format(c.startDate)} au {format(c.endDate)}
                    {c.status === "finished" && ", terminé"}
                  </span>
                </span>
                <span className={`text-sm ${n ? "font-medium" : "text-graphite"}`}>
                  {n === 0 ? "Rien de signalé" : `${n} créneau${n > 1 ? "x" : ""} signalé${n > 1 ? "s" : ""}`}
                </span>
                <RightOutlined aria-hidden="true" className="text-graphite" />
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
