// Chargement de la page d'un calendrier.

import { CalendarSummarySkeleton, LoadingRegion } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Chargement du calendrier…">
      <CalendarSummarySkeleton />
    </LoadingRegion>
  );
}
