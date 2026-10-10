// Légende de la grille des disponibilités : le même vocabulaire partout.

const items = [
  { swatch: "border border-field bg-paper", label: "Case vide : disponible" },
  { swatch: "border border-if-needed-edge bg-if-needed", label: "Surligné : si nécessaire" },
  { swatch: "border border-unavailable-edge bg-unavailable", label: "En rouge : indisponible" },
  { swatch: "border border-[#e0e4ea] bg-hatch", label: "Hachuré : férié" },
];

export function AvailabilityLegend({ note }: { note?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-7 gap-y-2">
      <ul className="flex flex-wrap items-center gap-x-7 gap-y-2 text-sm">
        {items.map((item) => (
          <li key={item.label} className="inline-flex items-center gap-2">
            <span aria-hidden="true" className={`h-3.5 w-5.5 rounded-[3px] ${item.swatch}`} />
            {item.label}
          </li>
        ))}
      </ul>
      {note && <p className="text-sm text-graphite">{note}</p>}
    </div>
  );
}
