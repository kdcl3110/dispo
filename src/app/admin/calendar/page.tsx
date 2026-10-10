// Écran « Configuration du calendrier » (maquette « Admin — Configuration »).
// La page lit l'état en base ; la saisie et l'aperçu en direct sont dans le
// formulaire client.

import { CalendarConfigForm } from "@/components/calendar/config-form";
import { CalendarSteps } from "@/components/calendar/steps";
import { countExceptions, getCalendar } from "@/lib/calendar";
import { requireAdmin } from "@/lib/session";

const dateFormat = new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric" });

export default async function CalendarConfigPage() {
  // Le layout vérifie déjà le rôle, mais page et layout se rendent en
  // parallèle : la page ne doit pas lire la base sans son propre contrôle.
  await requireAdmin();

  const calendar = await getCalendar();
  const exceptions = calendar ? await countExceptions(calendar.id) : 0;
  const state = status(calendar, exceptions);

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.015em]">
            Configuration du calendrier
          </h1>
          <p className="max-w-[680px] text-[15px] leading-relaxed text-graphite">
            Un seul calendrier, partagé par tout le personnel, sur quinze semaines au maximum.
          </p>
        </div>
        <CalendarSteps current={0} />
      </div>

      <CalendarConfigForm
        initial={calendar}
        holidays={calendar?.holidays ?? []}
        locked={exceptions > 0}
        status={
          <div className="flex flex-col gap-1.5">
            <h2 className="text-base font-semibold">{state.title}</h2>
            <p className="text-[13px] leading-normal text-graphite">{state.text}</p>
          </div>
        }
      />
    </main>
  );
}

// État du calendrier, dans l'ordre de gravité : figé > publié > brouillon.
function status(calendar: Awaited<ReturnType<typeof getCalendar>>, exceptions: number) {
  if (!calendar) {
    return {
      title: "Aucun calendrier",
      text: "Remplissez la configuration pour créer le calendrier du quadrimestre.",
    };
  }
  if (exceptions > 0) {
    return {
      title: "Configuration figée",
      text: `${exceptions} ${exceptions > 1 ? "créneaux ont" : "créneau a"} déjà été signalé${exceptions > 1 ? "s" : ""}. Changer la grille les rendrait incohérents.`,
    };
  }
  if (calendar.publishedAt) {
    return {
      title: "Publié",
      text: `Depuis le ${dateFormat.format(calendar.publishedAt)}. Le personnel peut signaler ses créneaux.`,
    };
  }
  return {
    title: "Brouillon",
    text: "Le personnel ne voit rien tant que le calendrier n'est pas publié.",
  };
}
