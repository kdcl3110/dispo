"use client";

// Squelettes affichés pendant le chargement d'un écran (fichiers loading.tsx).
// Chacun reprend la forme de l'écran qu'il annonce, pour que le contenu réel
// prenne sa place sans que la mise en page saute. Composant client : les
// sous-composants de Skeleton (Skeleton.Input…) n'existent pas côté serveur.

import { Skeleton } from "antd";

// Bloc arrondi animé, de la taille demandée.
function Bone({ width, height = 16, round = false }: { width: number | string; height?: number; round?: boolean }) {
  return (
    <Skeleton.Node active style={{ width, height, borderRadius: round ? 999 : 6 }} className="block! overflow-hidden">
      <span />
    </Skeleton.Node>
  );
}

// Zone annoncée aux lecteurs d'écran pendant le chargement.
export function LoadingRegion({ children, label = "Chargement…" }: { children: React.ReactNode; label?: string }) {
  return (
    <main aria-busy="true" aria-label={label} className="flex flex-1 flex-col gap-8 px-6 py-8 md:px-10">
      <span className="sr-only" role="status">
        {label}
      </span>
      {children}
    </main>
  );
}

// En-tête d'écran : pastille, titre, sous-titre, et éventuellement les chiffres clés.
export function HeaderSkeleton({ figures = 0 }: { figures?: number }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-4">
        <Bone width={48} height={48} />
        <div className="flex flex-col gap-2.5 pt-1">
          <Bone width={240} height={26} />
          <Bone width={420} height={14} />
        </div>
      </div>
      {figures > 0 && (
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: figures }, (_, i) => (
            <div key={i} className="flex min-w-44 items-center gap-3 rounded-lg border border-rule px-4 py-3">
              <Bone width={36} height={36} round />
              <div className="flex flex-col gap-1.5">
                <Bone width={44} height={18} />
                <Bone width={90} height={12} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Tableau : barre d'outils puis lignes.
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-4">
          <Bone width={300} height={40} />
          <Bone width={320} height={40} />
        </div>
        <Bone width={180} height={40} />
      </div>
      <div className="flex flex-col">
        <div className="flex gap-6 border-b border-field py-3">
          {[160, 90, 180, 140].map((w, i) => (
            <Bone key={i} width={w} height={12} />
          ))}
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-rule py-4">
            <Bone width={`${30 - (i % 3) * 5}%`} height={16} />
            <Bone width={80} height={14} />
            <Bone width={180} height={14} />
            <Bone width={120} height={14} />
            <div className="ml-auto flex gap-2">
              <Bone width={72} height={24} />
              <Bone width={72} height={24} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Grille des disponibilités : même structure que la vraie (marge rouge,
// lignes Seyès), pour une transition sans saut.
export function GridSkeleton({ weeks = 15, days = 5, slots = 4 }: { weeks?: number; days?: number; slots?: number }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-7">
        {Array.from({ length: 4 }, (_, i) => (
          <Bone key={i} width={150} height={14} />
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-rule px-5 pt-1 pb-4">
        <div className="flex h-13 items-center border-b border-seyes-strong">
          <div className="h-full w-49 shrink-0 border-r-2 border-margin" />
          <div className="flex flex-1 gap-1 pl-2">
            {Array.from({ length: weeks }, (_, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <Bone width={40} height={12} />
                <Bone width={32} height={10} />
              </div>
            ))}
          </div>
        </div>
        {Array.from({ length: days }, (_, d) =>
          Array.from({ length: slots }, (_, s) => (
            <div
              key={`${d}-${s}`}
              className={`flex h-9 items-center border-b ${s === slots - 1 ? "border-seyes-strong" : "border-seyes"}`}
            >
              <div className="w-19 shrink-0">{s === 0 && <Bone width={56} height={14} />}</div>
              <div className="flex h-full w-30 shrink-0 items-center justify-end border-r-2 border-margin pr-3">
                <Bone width={78} height={12} />
              </div>
              <div className="flex flex-1 gap-1 py-1 pl-2">
                {Array.from({ length: weeks }, (_, w) => (
                  <div key={w} className="h-7 flex-1 rounded-[3px] border border-[#e1e7f2] bg-paper" />
                ))}
              </div>
            </div>
          )),
        )}
      </div>
    </div>
  );
}

// Liste de cartes (calendriers côté personnel).
export function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex max-w-[860px] flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-5 rounded-xl border border-rule px-5 py-4">
          <Bone width={44} height={44} />
          <div className="flex flex-1 flex-col gap-2">
            <Bone width={220} height={16} />
            <Bone width={260} height={12} />
          </div>
          <Bone width={110} height={14} />
        </div>
      ))}
    </div>
  );
}

// Résumé d'un calendrier : bloc d'état puis horaires et congés côte à côte.
export function CalendarSummarySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Bone width={160} height={14} />
      <div className="flex flex-col gap-5 rounded-xl border border-rule p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-col gap-2.5">
            <Bone width={90} height={20} />
            <Bone width={260} height={26} />
            <Bone width={460} height={14} />
          </div>
          <div className="flex gap-2.5">
            <Bone width={200} height={32} />
            <Bone width={110} height={32} />
          </div>
        </div>
        <Bone width="100%" height={44} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        {[4, 3].map((lines, i) => (
          <div key={i} className="flex flex-col gap-5 rounded-xl border border-rule p-6">
            <div className="flex items-center justify-between">
              <Bone width={140} height={20} />
              <Bone width={150} height={32} />
            </div>
            {Array.from({ length: lines }, (_, l) => (
              <div key={l} className="flex flex-col gap-1.5">
                <Bone width={100} height={11} />
                <Bone width={`${70 - l * 8}%`} height={15} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
