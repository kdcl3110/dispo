"use server";

// Server Actions de l'écran « Configuration du calendrier ».
// Ordre immuable : droits → lecture du formulaire → validation → écriture.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { countExceptions, getCalendar, saveCalendarConfig, type CalendarConfig } from "@/lib/calendar";
import { requireAdmin } from "@/lib/session";
import { validateCalendarForm, type ValidationError } from "@/lib/validation/calendar";

// État renvoyé au formulaire (signature de useActionState).
// `values` permet de réafficher la saisie : React vide le formulaire après
// chaque envoi, y compris quand il est refusé.
export interface CalendarFormState {
  status: "idle" | "saved" | "invalid";
  errors: ValidationError[];
  values?: CalendarConfig;
}

// Lit le formulaire. Les pauses arrivent sous la forme breaks.0.name,
// breaks.0.start, breaks.1.name… : on les regroupe par indice.
function readForm(formData: FormData): CalendarConfig {
  const text = (key: string) => String(formData.get(key) ?? "").trim();

  const breaks: CalendarConfig["breaks"] = [];
  for (const [key, value] of formData.entries()) {
    const match = /^breaks\.(\d+)\.(name|start|end)$/.exec(key);
    if (!match) continue;
    const index = Number(match[1]);
    breaks[index] ??= { name: "", start: "", end: "" };
    breaks[index][match[2] as "name" | "start" | "end"] = String(value).trim();
  }

  return {
    name: text("name"),
    startDate: text("startDate"),
    endDate: text("endDate"),
    weekDays: formData.getAll("weekDays").map(String),
    dayStart: text("dayStart"),
    dayEnd: text("dayEnd"),
    slotDuration: Number(text("slotDuration")),
    // Une ligne de pause supprimée côté client laisse un trou dans les indices.
    breaks: breaks.filter(Boolean),
  };
}

export async function saveCalendar(
  _previous: CalendarFormState,
  formData: FormData,
): Promise<CalendarFormState> {
  await requireAdmin();

  const values = readForm(formData);
  const current = await getCalendar();

  // Les jours fériés ne sont pas dans ce formulaire, mais ils doivent rester
  // dans la période (règle 11) : on valide avec ceux déjà enregistrés.
  const errors = validateCalendarForm(values, current?.holidays ?? []);

  // Garde-fou : les créneaux signalés sont rangés par heure de début. Changer
  // la grille après coup laisserait des signalements sur des créneaux qui
  // n'existent plus. Tant qu'il y en a, la configuration est figée.
  if (current && (await countExceptions(current.id)) > 0) {
    errors.push({
      field: "form",
      message: "Des créneaux ont déjà été signalés : la configuration ne peut plus changer.",
    });
  }

  if (errors.length > 0) return { status: "invalid", errors, values };

  await saveCalendarConfig(values);
  revalidatePath("/admin", "layout");

  // Bouton « Enregistrer et continuer » : on enchaîne sur l'étape 2.
  if (formData.get("intent") === "continue") redirect("/admin/calendar/holidays");
  return { status: "saved", errors: [], values };
}
