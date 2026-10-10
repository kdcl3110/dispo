"use client";

// Choix de la ressource dont on saisit les disponibilités (écran admin).
// La ressource choisie vit dans l'URL (?resource=…), à côté du calendrier
// (?calendar=…) : un lien depuis la liste des ressources ouvre la bonne grille.

import { Select } from "antd";
import { useRouter, useSearchParams } from "next/navigation";

const GROUPS = [
  { type: "LOCAL", label: "Locaux" },
  { type: "EQUIPMENT", label: "Équipements" },
  { type: "PERSON", label: "Personnel" },
] as const;

export function ResourcePicker({
  resources,
  selectedId,
}: {
  resources: { id: string; name: string; type: "PERSON" | "LOCAL" | "EQUIPMENT" }[];
  selectedId: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="resource-picker" className="text-[13px] font-semibold">
        Ressource
      </label>
      <Select
        id="resource-picker"
        showSearch={{ optionFilterProp: "label" }}
        value={selectedId}
        onChange={(id: string) => {
          // On garde le calendrier choisi (?calendar=…).
          const next = new URLSearchParams(params.toString());
          next.set("resource", id);
          router.push(`/admin/availability?${next.toString()}`);
        }}
        options={GROUPS.map((group) => ({
          label: group.label,
          title: group.label,
          options: resources.filter((r) => r.type === group.type).map((r) => ({ value: r.id, label: r.name })),
        })).filter((group) => group.options.length > 0)}
        className="w-64!"
      />
    </div>
  );
}
