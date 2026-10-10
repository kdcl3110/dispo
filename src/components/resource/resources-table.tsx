"use client";

// Tableau des ressources (maquette « Admin — Ressources »), en Table d'Ant
// Design : recherche et filtre par type instantanés, tri par colonne, fenêtres
// d'ajout, de modification et d'import Excel des locaux et équipements.

import { App, Button, Form, Input, Modal, Segmented, Select, Table, type TableColumnsType } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveResource } from "@/actions/resource";
import type { ResourceRow } from "@/lib/resource";
import { MAX_RESOURCE_NAME_LENGTH, type EditableResourceType } from "@/lib/validation/resource";

import { ImportModal } from "./import-modal";

type TypeFilter = "ALL" | ResourceRow["type"];

const TYPE_LABEL: Record<ResourceRow["type"], string> = {
  PERSON: "Personne",
  LOCAL: "Local",
  EQUIPMENT: "Équipement",
};

const FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "ALL", label: "Toutes" },
  { value: "PERSON", label: "Personnes" },
  { value: "LOCAL", label: "Locaux" },
  { value: "EQUIPMENT", label: "Équipements" },
];

// « 38 indisponibles, 12 si nécessaire » ou « Aucun »
function describeExceptions(unavailable: number, ifNeeded: number) {
  const parts = [];
  if (unavailable > 0) parts.push(`${unavailable} indisponible${unavailable > 1 ? "s" : ""}`);
  if (ifNeeded > 0) parts.push(`${ifNeeded} si nécessaire`);
  return parts.join(", ") || "Aucun";
}

const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

type Editing = { id?: string; type: EditableResourceType; name: string };

export function ResourcesTable({ rows }: { rows: ResourceRow[] }) {
  const [filter, setFilter] = useState<TypeFilter>("ALL");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [importing, setImporting] = useState(false);

  // Recherche sans tenir compte des accents ni des majuscules (« equipe » trouve « Équipe »).
  const q = normalize(query.trim());
  const filtered = rows.filter(
    (r) =>
      (filter === "ALL" || r.type === filter) &&
      (!q || normalize(r.name).includes(q) || normalize(r.email ?? "").includes(q)),
  );

  const columns: TableColumnsType<ResourceRow> = [
    {
      title: "Nom",
      dataIndex: "name",
      sorter: (a, b) => a.name.localeCompare(b.name, "fr"),
      defaultSortOrder: "ascend",
      render: (name: string) => <span className="text-[15px] font-medium">{name}</span>,
    },
    {
      title: "Type",
      dataIndex: "type",
      width: 130,
      render: (type: ResourceRow["type"]) => <span className="text-graphite">{TYPE_LABEL[type]}</span>,
    },
    {
      title: "Compte Google",
      dataIndex: "email",
      width: 260,
      render: (email: string | null) => <span className="text-graphite">{email ?? "Pas de compte"}</span>,
    },
    {
      title: "Créneaux signalés",
      key: "exceptions",
      width: 250,
      sorter: (a, b) => a.unavailable + a.ifNeeded - (b.unavailable + b.ifNeeded),
      render: (_, r) => (
        <span className={r.unavailable + r.ifNeeded > 0 ? "" : "text-graphite"}>{describeExceptions(r.unavailable, r.ifNeeded)}</span>
      ),
    },
    {
      title: <span className="sr-only">Actions</span>,
      key: "actions",
      width: 200,
      align: "right",
      render: (_, r) => (
        <div className="flex items-center justify-end gap-2">
          <Link href={`/admin/availability?resource=${r.id}`} className="text-sm font-medium">
            Voir la grille
          </Link>
          {r.type !== "PERSON" && (
            <Button size="small" onClick={() => setEditing({ id: r.id, type: r.type as EditableResourceType, name: r.name })}>
              Modifier
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Input.Search
            allowClear
            placeholder="Rechercher par nom ou adresse"
            aria-label="Rechercher une ressource"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-75!"
          />
          <Segmented<TypeFilter> options={FILTERS} value={filter} onChange={setFilter} aria-label="Filtrer par type" />
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button onClick={() => setImporting(true)}>Importer un fichier Excel</Button>
          <Button type="primary" onClick={() => setEditing({ type: "LOCAL", name: "" })}>
            Ajouter une ressource
          </Button>
        </div>
      </div>

      <Table<ResourceRow>
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        pagination={{ pageSize: 25, hideOnSinglePage: true, showSizeChanger: false }}
        scroll={{ x: 900 }}
        locale={{
          emptyText:
            rows.length === 0 ? (
              <EmptyState onImport={() => setImporting(true)} />
            ) : (
              <p className="py-6 text-graphite">Aucune ressource ne correspond{query ? ` à « ${query} »` : " à ce filtre"}.</p>
            ),
        }}
      />

      {editing && <ResourceModal key={editing.id ?? "new"} editing={editing} onClose={() => setEditing(null)} />}
      {importing && <ImportModal onClose={() => setImporting(false)} />}
    </div>
  );
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <p className="text-base font-semibold text-ink">Aucune ressource pour l&apos;instant</p>
      <p className="max-w-[480px] text-graphite">
        Les membres du personnel apparaissent ici à leur première connexion. Les locaux et les équipements s&apos;ajoutent
        un par un, ou depuis un fichier Excel.
      </p>
      <Button type="primary" onClick={onImport} className="mt-2">
        Importer un fichier Excel
      </Button>
    </div>
  );
}

// Fenêtre d'ajout (sans id) ou de modification (avec id) d'un local ou équipement.
function ResourceModal({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const [form] = Form.useForm<{ type: EditableResourceType; name: string }>();
  const { message } = App.useApp();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  function submit(values: { type: EditableResourceType; name: string }) {
    startTransition(async () => {
      const result = await saveResource({ id: editing.id, ...values });
      if (!result.ok) {
        form.setFields(
          result.errors.filter((e) => e.field !== "form").map((e) => ({ name: e.field as "type" | "name", errors: [e.message] })),
        );
        setFormError(result.errors.find((e) => e.field === "form")?.message ?? null);
        return;
      }
      message.success(editing.id ? "Ressource modifiée." : "Ressource ajoutée.");
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal
      open
      title={editing.id ? "Modifier la ressource" : "Ajouter une ressource"}
      okText={editing.id ? "Enregistrer" : "Ajouter"}
      cancelText="Annuler"
      confirmLoading={pending}
      onOk={() => form.submit()}
      onCancel={onClose}
    >
      <Form form={form} layout="vertical" requiredMark={false} initialValues={editing} onFinish={submit} className="pt-2">
        {formError && <p className="mb-4 text-unavailable">{formError}</p>}
        <Form.Item label="Type" name="type">
          <Select
            options={[
              { value: "LOCAL", label: "Local" },
              { value: "EQUIPMENT", label: "Équipement" },
            ]}
          />
        </Form.Item>
        <Form.Item label="Nom" name="name" rules={[{ required: true, whitespace: true, message: "Donnez un nom à la ressource." }]}>
          <Input maxLength={MAX_RESOURCE_NAME_LENGTH} placeholder="Salle B12" autoFocus />
        </Form.Item>
      </Form>
    </Modal>
  );
}
