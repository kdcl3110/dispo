// Chargement d'un écran admin (par défaut : en-tête, chiffres clés, tableau).
// La barre latérale reste affichée et utilisable pendant ce temps.

import { HeaderSkeleton, LoadingRegion, TableSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion>
      <HeaderSkeleton figures={4} />
      <TableSkeleton />
    </LoadingRegion>
  );
}
