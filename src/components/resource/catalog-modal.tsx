"use client";

// Fenêtre « Types et caractéristiques » de la page Ressources : les deux
// listes qui décrivent les locaux. On y renomme une entrée (tous les locaux
// qui l'utilisent suivent) ou on la supprime si plus aucun local ne s'en sert.
// Les ajouts se font depuis la fiche d'un local ou par l'import Excel.

import { DeleteOutlined } from "@ant-design/icons";
import { App, Button, Modal, Popconfirm, Tabs, Tooltip, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { removeCatalogItem, renameCatalogItem } from "@/actions/resource";
import type { CatalogEntry, CatalogKind } from "@/lib/resource";
import { MAX_CATALOG_NAME_LENGTH } from "@/lib/validation/resource";

import type { Catalog } from "./resources-table";

const plural = (n: number) => `${n} local${n > 1 ? "aux" : ""}`;

export function CatalogModal({ catalog, onClose }: { catalog: Catalog; onClose: () => void }) {
  return (
    <Modal open width={560} title="Types de local et caractéristiques" onCancel={onClose} footer={<Button onClick={onClose}>Fermer</Button>}>
      <p className="pt-1 text-sm text-graphite">
        Ces listes se complètent toutes seules quand vous décrivez un local ou importez un fichier. Ici, vous pouvez corriger un nom
        ou retirer une entrée qui ne sert plus.
      </p>
      <Tabs
        items={[
          { key: "roomType", label: `Types de local (${catalog.roomTypes.length})`, children: <EntryList kind="roomType" entries={catalog.roomTypes} /> },
          { key: "feature", label: `Caractéristiques (${catalog.features.length})`, children: <EntryList kind="feature" entries={catalog.features} /> },
        ]}
      />
    </Modal>
  );
}

function EntryList({ kind, entries }: { kind: CatalogKind; entries: CatalogEntry[] }) {
  if (entries.length === 0) {
    return <p className="py-4 text-graphite">Aucune entrée pour l&apos;instant.</p>;
  }
  return (
    <ul className="flex max-h-[50vh] flex-col overflow-auto border-t border-rule">
      {entries.map((entry) => (
        <Entry key={entry.id} kind={kind} entry={entry} />
      ))}
    </ul>
  );
}

function Entry({ kind, entry }: { kind: CatalogKind; entry: CatalogEntry }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function rename(name: string) {
    if (name.trim() === entry.name) return;
    startTransition(async () => {
      const result = await renameCatalogItem({ kind, id: entry.id, name });
      if (!result.ok) {
        message.error(result.errors[0]?.message ?? "Le renommage a échoué.");
        return;
      }
      message.success("Nom modifié.");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeCatalogItem({ kind, id: entry.id });
      if (!result.ok) {
        message.error(result.errors[0]?.message ?? "La suppression a échoué.");
        return;
      }
      message.success(`« ${entry.name} » a été retiré de la liste.`);
      router.refresh();
    });
  }

  return (
    <li className="flex items-center justify-between gap-3 border-b border-rule py-2">
      <Typography.Text
        editable={{ onChange: rename, maxLength: MAX_CATALOG_NAME_LENGTH, tooltip: "Renommer", triggerType: ["icon"] }}
        className="text-[15px]"
      >
        {entry.name}
      </Typography.Text>
      <div className="flex items-center gap-3">
        <span className="text-sm text-graphite">{entry.uses === 0 ? "Inutilisé" : plural(entry.uses)}</span>
        {entry.uses > 0 ? (
          <Tooltip title="Utilisé par des locaux : retirez-le d'abord de ces locaux.">
            <Button size="small" danger icon={<DeleteOutlined />} disabled aria-label={`Supprimer ${entry.name}`} />
          </Tooltip>
        ) : (
          <Popconfirm
            title={`Retirer « ${entry.name} » de la liste ?`}
            okText="Retirer"
            okButtonProps={{ danger: true }}
            cancelText="Annuler"
            onConfirm={remove}
          >
            <Button size="small" danger icon={<DeleteOutlined />} loading={pending} aria-label={`Supprimer ${entry.name}`} />
          </Popconfirm>
        )}
      </div>
    </li>
  );
}
