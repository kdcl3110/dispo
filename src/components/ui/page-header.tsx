// En-tête commun des écrans, compact : pastille, titre et sous-titre à gauche ;
// à droite, les chiffres clés en petites étiquettes et un éventuel élément
// (bouton…). Le tout tient sur une ligne en grand écran pour laisser la place
// au contenu. Utilisable depuis une page serveur : on ne lui passe que des éléments.

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
    <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-pen-tint text-lg text-pen">
          {icon}
        </span>
        <div className="flex min-w-0 flex-col">
          <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.015em]">{title}</h1>
          {description && <p className="text-sm leading-snug text-graphite">{description}</p>}
        </div>
      </div>

      {((figures && figures.length > 0) || extra) && (
        <div className="flex flex-wrap items-center gap-2">
          {figures && figures.length > 0 && (
            <dl className="flex flex-wrap gap-2">
              {figures.map((figure) => (
                <div key={figure.label} className="flex h-9 items-center gap-2 rounded-md border border-rule bg-paper px-3">
                  <span aria-hidden="true" className="text-sm text-pen">
                    {figure.icon}
                  </span>
                  {/* dt avant dd dans le HTML (ordre lu à voix haute), chiffre en premier à l'écran. */}
                  <div className="flex flex-row-reverse items-baseline gap-1.5">
                    <dt className="text-[13px] text-graphite">{figure.label}</dt>
                    <dd className="text-[15px] font-semibold">{figure.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          )}
          {extra}
        </div>
      )}
    </header>
  );
}
