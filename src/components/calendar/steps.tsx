// Les trois étapes de préparation du calendrier. C'est une vraie séquence
// (configurer, retirer les jours fériés, publier) : la numérotation a un sens.

const STEPS = ["Configuration", "Jours fériés", "Publication"];

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.4 9.4l3.4 3.4L14.6 4.6" />
    </svg>
  );
}

// `current` : indice de l'étape en cours (0, 1 ou 2). Les précédentes sont
// marquées comme faites.
export function CalendarSteps({ current }: { current: number }) {
  return (
    <ol aria-label="Étapes de préparation" className="flex items-center gap-3">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-3">
            {i > 0 && <span aria-hidden="true" className="h-px w-6 bg-field" />}
            <span
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-2 text-sm ${active ? "font-semibold text-ink" : "font-medium text-graphite"}`}
            >
              <span
                className={`flex size-5.5 items-center justify-center rounded-full text-xs font-semibold ${
                  active
                    ? "bg-pen text-white"
                    : done
                      ? "border-[1.5px] border-pen text-pen"
                      : "border-[1.5px] border-field text-graphite"
                }`}
              >
                {done ? <CheckIcon /> : i + 1}
              </span>
              {label}
              {done && <span className="sr-only">(terminée)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
