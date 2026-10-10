"use client";

// Choix du calendrier sur les écrans admin qui en dépendent (saisie, export).
// Le calendrier choisi vit dans l'URL (?calendar=…), avec les autres
// paramètres de la page (par exemple ?resource=…), qui sont conservés.

import { Select, Tag } from "antd";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const STATUS = { draft: "Brouillon", published: "Publié", finished: "Terminé" } as const;

export function CalendarPicker({
  calendars,
  selectedId,
}: {
  calendars: { id: string; name: string; status: keyof typeof STATUS }[];
  selectedId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="calendar-picker" className="text-[13px] font-semibold">
        Calendrier
      </label>
      <Select
        id="calendar-picker"
        showSearch={{ optionFilterProp: "title" }}
        value={selectedId}
        onChange={(id: string) => {
          const next = new URLSearchParams(params.toString());
          next.set("calendar", id);
          router.push(`${pathname}?${next.toString()}`);
        }}
        options={calendars.map((c) => ({
          value: c.id,
          title: c.name,
          label: (
            <span className="flex items-center justify-between gap-3">
              <span className="truncate">{c.name}</span>
              <Tag color={c.status === "published" ? "blue" : undefined} className="me-0!">
                {STATUS[c.status]}
              </Tag>
            </span>
          ),
        }))}
        className="w-80!"
      />
    </div>
  );
}
