// Chargement de la saisie admin : sélecteurs et outils, puis grille.

import { GridSkeleton, LoadingRegion } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Chargement de la grille…">
      <GridSkeleton />
    </LoadingRegion>
  );
}
