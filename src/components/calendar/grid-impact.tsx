"use client";

// Fenêtre de confirmation quand une modification touche des créneaux déjà
// signalés (horaires, période, jours de cours ou jours retirés) : on annonce
// ce qui est gardé, déplacé ou supprimé avant d'enregistrer.

import type { App } from "antd";

import type { GridImpact } from "@/actions/calendar";

type Modal = ReturnType<typeof App.useApp>["modal"];

const n = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`;

// Résout à true si l'admin confirme.
export function confirmGridImpact(modal: Modal, impact: GridImpact): Promise<boolean> {
  const removed = impact.removedDays + impact.removedTimes;
  return new Promise((resolve) => {
    modal.confirm({
      title: "Ce calendrier a déjà des créneaux signalés",
      content: (
        <div className="flex flex-col gap-2">
          <p>Sur {n(impact.total, "créneau signalé", "créneaux signalés")} :</p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {impact.kept > 0 && <li>{n(impact.kept, "est gardé tel quel", "sont gardés tels quels")} ;</li>}
            {impact.moved > 0 && (
              <li>
                {n(impact.moved, "suit son créneau", "suivent leur créneau")} vers les nouveaux horaires (le 2e créneau reste le 2e) ;
              </li>
            )}
            {impact.removedDays > 0 && (
              <li className="text-unavailable">
                {n(impact.removedDays, "sera supprimé", "seront supprimés")} : leur jour ne fait plus partie du calendrier ;
              </li>
            )}
            {impact.removedTimes > 0 && (
              <li className="text-unavailable">
                {n(impact.removedTimes, "sera supprimé", "seront supprimés")} : le nombre de créneaux par jour a changé,
                leur heure n&apos;existe plus ;
              </li>
            )}
          </ul>
          {removed > 0 && <p>Les commentaires des créneaux supprimés sont perdus.</p>}
        </div>
      ),
      okText: removed > 0 ? "Enregistrer et supprimer" : "Enregistrer",
      okButtonProps: { danger: removed > 0 },
      cancelText: "Annuler",
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}
