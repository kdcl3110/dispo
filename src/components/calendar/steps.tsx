// Les trois étapes de préparation du calendrier, en Steps d'Ant Design. C'est
// une vraie séquence (configurer, retirer les jours fériés, publier) : la
// numérotation a un sens.
//
// Utilisable depuis une page serveur : Steps est un composant client d'Ant,
// mais on ne lui passe que des données simples (pas de sous-composant).

import { Steps } from "antd";

const STEPS = ["Configuration", "Jours fériés", "Publication"];

// `current` : indice de l'étape en cours (0, 1 ou 2), 3 quand tout est fait.
export function CalendarSteps({ current }: { current: number }) {
  return (
    <Steps
      size="small"
      current={current}
      responsive={false}
      aria-label="Étapes de préparation"
      className="w-auto! min-w-[420px]"
      items={STEPS.map((title) => ({ title }))}
    />
  );
}
