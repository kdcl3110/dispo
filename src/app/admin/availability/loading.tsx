// Chargement de la saisie admin : en-tête, sélecteurs, grille.

import { GridSkeleton, HeaderSkeleton, LoadingRegion } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Chargement de la grille…">
      <HeaderSkeleton />
      <GridSkeleton />
    </LoadingRegion>
  );
}
