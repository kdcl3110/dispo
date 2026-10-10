// Chargement de « Mes calendriers ». L'en-tête du personnel reste affiché.

import { CardsSkeleton, HeaderSkeleton, LoadingRegion } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Chargement de vos calendriers…">
      <HeaderSkeleton />
      <CardsSkeleton />
    </LoadingRegion>
  );
}
