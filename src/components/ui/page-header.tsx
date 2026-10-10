// En-tête commun des écrans : icône sur pastille bleue, titre, sous-titre,
// un emplacement à droite (étapes, bouton…) et une rangée de chiffres clés.
// Utilisable depuis une page serveur : on ne lui passe que des éléments.

import type { ReactNode } from "react";

export interface KeyFigure {
  icon: ReactNode;
  value: ReactNode;
  label: string;
}

export function PageHeader({
  icon,
  title,
  description,
  extra,
  figures,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  extra?: ReactNode;
  figures?: KeyFigure[];
}) {
  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-pen-tint text-[22px] text-pen">
            {icon}
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.015em]">{title}</h1>
            {description && <p className="max-w-[680px] text-[15px] leading-relaxed text-graphite">{description}</p>}
          </div>
        </div>
        {extra}
      </div>

      {figures && figures.length > 0 && (
        <dl className="flex flex-wrap gap-3">
          {figures.map((figure) => (
            <div key={figure.label} className="flex min-w-44 items-center gap-3 rounded-lg border border-rule bg-paper px-4 py-3">
              <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-desk text-base text-pen">
                {figure.icon}
              </span>
              {/* dt avant dd dans le HTML (ordre lu à voix haute), chiffre au-dessus à l'écran. */}
              <div className="flex flex-col-reverse">
                <dt className="text-[13px] text-graphite">{figure.label}</dt>
                <dd className="text-xl leading-tight font-semibold">{figure.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}
