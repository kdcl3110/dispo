// Chargement de la grille d'un calendrier, côté personnel.

import { GridSkeleton, LoadingRegion } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Chargement de la grille…">
      <GridSkeleton />
    </LoadingRegion>
  );
}
