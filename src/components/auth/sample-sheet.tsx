// Feuille d'exemple de la page de connexion : deux semaines sur papier Seyès,
// annotées comme le ferait un enseignant. Purement illustrative (aria-hidden) :
// la légende qui l'accompagne porte l'information.

type Mark = "free" | "if-needed" | "unavailable";

const markClass: Record<Mark, string> = {
  free: "",
  "if-needed": "bg-if-needed",
  unavailable: "bg-unavailable",
};

const days = ["lun.", "mar.", "mer.", "jeu.", "ven."];
const times = ["08:00", "10:00", "Midi", "14:00", "16:00"];

const _ = "free";
const J = "if-needed";
const R = "unavailable";

const weeks: { title: string; rows: Mark[][] }[] = [
  {
    title: "Semaine du 14 septembre",
    rows: [
      [R, _, _, _, _],
      [R, _, J, _, _],
      [_, _, _, _, _],
      [_, _, _, R, _],
      [_, J, _, R, _],
    ],
  },
  {
    title: "Semaine du 21 septembre",
    rows: [
      [_, _, _, _, J],
      [_, _, _, _, _],
      [_, _, _, _, _],
      [_, R, _, _, _],
      [_, R, _, _, _],
    ],
  },
];

export function SampleSheet() {
  return (
    <div
      aria-hidden="true"
      className="relative w-full max-w-[512px] rounded border border-rule bg-seyes pt-4 pr-6 pb-6"
    >
      {/* Marge rouge : là où s'arrêtent les heures, comme dans un cahier */}
      <div className="absolute inset-y-0 left-24 w-0.5 bg-margin" />

      {weeks.map((week) => (
        <div key={week.title}>
          <div className="flex h-8 items-end pb-1.5 pl-28 text-sm font-semibold">
            {week.title}
          </div>
          <div className="flex h-8 items-end pb-1.5">
            <div className="w-28 shrink-0" />
            {days.map((day) => (
              <span
                key={day}
                className="flex-1 text-center font-condensed text-[13px] font-medium text-graphite"
              >
                {day}
              </span>
            ))}
          </div>
          {week.rows.map((marks, i) => (
            <div key={times[i]} className="flex h-8 items-center">
              <span className="w-24 shrink-0 pr-3 text-right font-condensed text-[13px] font-medium text-graphite">
                {times[i]}
              </span>
              <div className="-mt-1 flex h-[22px] flex-1 gap-1.5 pl-4">
                {marks.map((mark, j) => (
                  <span key={j} className={`flex-1 rounded-sm ${markClass[mark]}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Légende de la feuille : le vocabulaire des statuts, réutilisé partout.
export function SheetLegend() {
  const items = [
    { swatch: "border border-field bg-paper", label: "Case vide : disponible" },
    { swatch: "border border-if-needed-edge bg-if-needed", label: "Surligné : si nécessaire" },
    { swatch: "border border-unavailable-edge bg-unavailable", label: "En rouge : indisponible" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {items.map((item) => (
          <li key={item.label} className="inline-flex items-center gap-2">
            <span aria-hidden="true" className={`h-3.5 w-[22px] rounded-[3px] ${item.swatch}`} />
            {item.label}
          </li>
        ))}
      </ul>
      {/* <p className="max-w-[480px] text-sm leading-relaxed text-graphite">
        Un créneau surligné ou en rouge demande toujours un mot d&apos;explication.
      </p> */}
    </div>
  );
}
