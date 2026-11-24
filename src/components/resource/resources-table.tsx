"use client";

// Tableau des ressources (maquette « Admin — Ressources »), en Table d'Ant
// Design : recherche et filtre par type instantanés, tri par colonne, fenêtres
// d'ajout, de modification et d'import Excel des locaux et équipements.
// Le personnel s'ajoute un par un ou par l'import de sa liste ; chaque ligne
// permet de couper ou de rétablir son accès.
// Les locaux ont en plus une description (type, capacité, bâtiment,
// caractéristiques) et deux filtres : type de local et nombre de places.

import {
  CalendarOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  FileExcelOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  StopOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import {
  App,
  AutoComplete,
  Button,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Table,
  Tag,
  Tooltip,
  type TableColumnsType,
} from "antd";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { addPerson, removeResource, saveResource, setPersonAccessAction } from "@/actions/resource";
import type { CatalogEntry, ResourceRow } from "@/lib/resource";
import {
  MAX_BUILDING_LENGTH,
  MAX_CAPACITY,
  MAX_CATALOG_NAME_LENGTH,
  MAX_EMAIL_LENGTH,
  MAX_FEATURE_QUANTITY,
  MAX_RESOURCE_NAME_LENGTH,
  type EditableResourceType,
} from "@/lib/validation/resource";

import { CatalogModal } from "./catalog-modal";
import { ImportModal } from "./import-modal";
import { StaffImportModal } from "./staff-import-modal";

export interface Catalog {
  roomTypes: CatalogEntry[];
  features: CatalogEntry[];
  buildings: string[];
}

// « PC ×30 », ou « Projecteur » pour une quantité de 1.
const featureLabel = (f: { name: string; quantity: number }) => (f.quantity > 1 ? `${f.name} ×${f.quantity}` : f.name);

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

// Accès du personnel, filtre affiché avec « Personnes ».
type AccessFilter = "ALL" | "ENABLED" | "DISABLED" | "NEVER";
const ACCESS_FILTERS: { value: AccessFilter; label: string }[] = [
  { value: "ALL", label: "Tous les accès" },
  { value: "ENABLED", label: "Accès ouvert" },
  { value: "DISABLED", label: "Accès coupé" },
  { value: "NEVER", label: "Jamais connecté" },
];
const matchesAccess = (r: ResourceRow, access: AccessFilter) =>
  access === "ALL" || (access === "ENABLED" && !r.disabled) || (access === "DISABLED" && r.disabled) || (access === "NEVER" && r.neverLoggedIn);

// Valeurs du formulaire d'ajout ou de modification. PERSON : ajout seulement
// (adresse et nom), le reste vient de Google.
interface FormValues {
  type: EditableResourceType | "PERSON";
  name: string;
  email?: string;
  roomType?: string;
  capacity?: number | null;
  building?: string;
  features?: { name: string; quantity: number }[];
}

type Editing = FormValues & { id?: string };

export function ResourcesTable({ rows, catalog, domains }: { rows: ResourceRow[]; catalog: Catalog; domains: string[] }) {
  const [filter, setFilter] = useState<TypeFilter>("ALL");
  const [access, setAccess] = useState<AccessFilter>("ALL");
  const [staffImporting, setStaffImporting] = useState(false);
  const [query, setQuery] = useState("");
  const [roomType, setRoomType] = useState<string | null>(null);
  const [minCapacity, setMinCapacity] = useState<number | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [importing, setImporting] = useState(false);
  const [listsOpen, setListsOpen] = useState(false);
  const router = useRouter();

  // Recherche sans tenir compte des accents ni des majuscules (« equipe »
  // trouve « Équipe ») : nom, adresse, et pour un local sa description.
  const q = normalize(query.trim());
  const searchable = (r: ResourceRow) =>
    [r.name, r.email ?? "", r.building ?? "", r.roomType ?? "", ...r.features.map((f) => f.name)].map(normalize);
  const filtered = rows.filter(
    (r) =>
      (filter === "ALL" || r.type === filter) &&
      (!q || searchable(r).some((text) => text.includes(q))) &&
      (filter !== "LOCAL" || !roomType || r.roomType === roomType) &&
      (filter !== "LOCAL" || minCapacity === null || (r.capacity ?? 0) >= minCapacity) &&
      (filter !== "PERSON" || matchesAccess(r, access)),
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
      title: "Description",
      key: "description",
      width: 320,
      sorter: (a, b) => (a.capacity ?? 0) - (b.capacity ?? 0),
      render: (_, r) => {
        if (r.type === "PERSON") {
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-graphite">{r.email ?? "Pas de compte"}</span>
              {r.disabled && (
                <Tag color="error" className="me-0!">
                  Accès coupé
                </Tag>
              )}
              {r.neverLoggedIn && <Tag className="me-0!">Jamais connecté</Tag>}
            </div>
          );
        }
        if (r.type !== "LOCAL") return <span className="text-graphite">—</span>;
        const summary = [r.roomType, r.capacity !== null && `${r.capacity} place${r.capacity > 1 ? "s" : ""}`, r.building].filter(Boolean);
        if (summary.length === 0 && r.features.length === 0) return <span className="text-graphite">Non décrit</span>;
        return (
          <div className="flex flex-col gap-1">
            {summary.length > 0 && <span>{summary.join(" · ")}</span>}
            {r.features.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {r.features.map((f) => (
                  <Tag key={f.name} className="me-0!">
                    {featureLabel(f)}
                  </Tag>
                ))}
              </div>
            )}
          </div>
        );
      },
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
      // Boutons à icône seule : le libellé est dans l'infobulle et, pour les
      // lecteurs d'écran, dans aria-label (avec le nom de la ressource).
      width: 130,
      align: "right",
      render: (_, r) => (
        <div className="flex items-center justify-end gap-1.5">
          <Tooltip title="Voir la grille">
            <Button
              size="small"
              icon={<CalendarOutlined />}
              aria-label={`Voir la grille de ${r.name}`}
              onClick={() => router.push(`/admin/availability?resource=${r.id}`)}
            />
          </Tooltip>
          {r.type === "PERSON" && r.email && <AccessButton row={r} />}
          {r.type !== "PERSON" && (
            <>
              <Tooltip title="Modifier">
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  aria-label={`Modifier ${r.name}`}
                  onClick={() =>
                    setEditing({
                      id: r.id,
                      type: r.type as EditableResourceType,
                      name: r.name,
                      roomType: r.roomType ?? "",
                      capacity: r.capacity,
                      building: r.building ?? "",
                      features: r.features,
                    })
                  }
                />
              </Tooltip>
              <DeleteButton row={r} />
            </>
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
            placeholder="Rechercher par nom, adresse, bâtiment…"
            aria-label="Rechercher une ressource"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-75!"
          />
          <Segmented<TypeFilter> options={FILTERS} value={filter} onChange={setFilter} aria-label="Filtrer par type" />
          {filter === "PERSON" && (
            <Select<AccessFilter> aria-label="Accès" value={access} onChange={setAccess} options={ACCESS_FILTERS} className="w-44!" />
          )}
          {filter === "LOCAL" && (
            <>
              <Select
                allowClear
                aria-label="Type de local"
                placeholder="Type de local"
                value={roomType}
                onChange={(value) => setRoomType(value ?? null)}
                options={catalog.roomTypes.map((t) => ({ value: t.name, label: t.name }))}
                className="w-48!"
              />
              <InputNumber
                aria-label="Nombre de places minimum"
                placeholder="Places min."
                min={1}
                max={MAX_CAPACITY}
                value={minCapacity}
                onChange={(value) => setMinCapacity(typeof value === "number" ? value : null)}
                className="w-32!"
              />
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button icon={<UnorderedListOutlined />} onClick={() => setListsOpen(true)}>
            Types et caractéristiques
          </Button>
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                { key: "resources", label: "Locaux et équipements", onClick: () => setImporting(true) },
                { key: "staff", label: "Liste du personnel", onClick: () => setStaffImporting(true) },
              ],
            }}
          >
            <Button icon={<FileExcelOutlined />}>
              Importer un fichier <DownOutlined />
            </Button>
          </Dropdown>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({ type: "LOCAL", name: "" })}>
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
              <EmptyState onImport={() => setStaffImporting(true)} />
            ) : (
              <p className="py-6 text-graphite">Aucune ressource ne correspond{query ? ` à « ${query} »` : " à ce filtre"}.</p>
            ),
        }}
      />

      {editing && (
        <ResourceModal key={editing.id ?? "new"} editing={editing} catalog={catalog} domains={domains} onClose={() => setEditing(null)} />
      )}
      {importing && <ImportModal onClose={() => setImporting(false)} />}
      {staffImporting && <StaffImportModal domains={domains} onClose={() => setStaffImporting(false)} />}
      {listsOpen && <CatalogModal catalog={catalog} onClose={() => setListsOpen(false)} />}
    </div>
  );
}

// « Supprimer », avec une confirmation qui annonce les créneaux perdus.
function DeleteButton({ row }: { row: ResourceRow }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const signaled = row.unavailable + row.ifNeeded;

  function confirm() {
    startTransition(async () => {
      const result = await removeResource({ id: row.id });
      if (!result.ok) {
        message.error(result.errors[0]?.message ?? "La suppression a échoué.");
        return;
      }
      message.success(`« ${row.name} » a été supprimé.`);
      router.refresh();
    });
  }

  return (
    <Popconfirm
      title={`Supprimer « ${row.name} » ?`}
      description={
        signaled === 0
          ? "Aucun créneau signalé n'est perdu."
          : signaled === 1
            ? "Son créneau signalé sera supprimé aussi."
            : `Ses ${signaled} créneaux signalés seront supprimés aussi.`
      }
      okText="Supprimer"
      okButtonProps={{ danger: true }}
      cancelText="Annuler"
      onConfirm={confirm}
    >
      <Tooltip title="Supprimer">
        <Button size="small" danger icon={<DeleteOutlined />} loading={pending} aria-label={`Supprimer ${row.name}`} />
      </Tooltip>
    </Popconfirm>
  );
}

// Couper ou rétablir l'accès d'un membre du personnel, avec confirmation.
function AccessButton({ row }: { row: ResourceRow }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const enable = row.disabled;

  function confirm() {
    startTransition(async () => {
      const result = await setPersonAccessAction({ id: row.id, enabled: enable });
      if (!result.ok) {
        message.error(result.errors[0]?.message ?? "La modification a échoué.");
        return;
      }
      message.success(enable ? `${row.name} peut de nouveau se connecter.` : `L'accès de ${row.name} est coupé.`);
      router.refresh();
    });
  }

  return (
    <Popconfirm
      title={enable ? `Rétablir l'accès de ${row.name} ?` : `Couper l'accès de ${row.name} ?`}
      description={
        enable
          ? "Cette personne pourra de nouveau se connecter et modifier ses disponibilités."
          : "Cette personne est déconnectée et ne peut plus se connecter. Ses créneaux signalés sont gardés."
      }
      okText={enable ? "Rétablir" : "Couper l'accès"}
      okButtonProps={{ danger: !enable }}
      cancelText="Annuler"
      onConfirm={confirm}
    >
      <Tooltip title={enable ? "Rétablir l'accès" : "Couper l'accès"}>
        <Button
          size="small"
          danger={!enable}
          icon={enable ? <CheckCircleOutlined /> : <StopOutlined />}
          loading={pending}
          aria-label={enable ? `Rétablir l'accès de ${row.name}` : `Couper l'accès de ${row.name}`}
        />
      </Tooltip>
    </Popconfirm>
  );
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <p className="text-base font-semibold text-ink">Aucune ressource pour l&apos;instant</p>
      <p className="max-w-[480px] text-graphite">
        Commencez par importer la liste du personnel : seules ces adresses pourront se connecter. Les locaux et les
        équipements s&apos;ajoutent un par un, ou depuis un fichier Excel.
      </p>
      <Button type="primary" icon={<FileExcelOutlined />} onClick={onImport} className="mt-2">
        Importer la liste du personnel
      </Button>
    </div>
  );
}

// Fenêtre d'ajout (sans id) ou de modification (avec id) d'un local ou équipement,
// et d'ajout d'un membre du personnel (adresse et nom).
// Pour un local : type, capacité, bâtiment et caractéristiques. Un type ou une
// caractéristique qui n'existe pas encore est ajouté aux listes à l'enregistrement.
function ResourceModal({
  editing,
  catalog,
  domains,
  onClose,
}: {
  editing: Editing;
  catalog: Catalog;
  domains: string[];
  onClose: () => void;
}) {
  const [form] = Form.useForm<FormValues>();
  const type = Form.useWatch("type", form) ?? editing.type;
  const { message } = App.useApp();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  // Champs du formulaire ciblés par les erreurs du serveur ; « room » et
  // « features » n'ont pas de champ propre : message en tête de fenêtre.
  const FIELDS = ["type", "name", "email", "roomType", "capacity", "building"];

  function submit(values: FormValues) {
    if (values.type === "PERSON") {
      startTransition(async () => {
        const result = await addPerson({ email: values.email ?? "", name: values.name ?? "" });
        if (!result.ok) {
          showErrors(result.errors);
          return;
        }
        message.success("Membre du personnel ajouté. Il peut se connecter avec son compte Google.");
        router.refresh();
        onClose();
      });
      return;
    }
    const type = values.type;
    const room =
      values.type === "LOCAL"
        ? {
            roomType: values.roomType ?? "",
            capacity: values.capacity ?? null,
            building: values.building ?? "",
            features: (values.features ?? []).filter((f) => f?.name?.trim()),
          }
        : undefined;
    startTransition(async () => {
      const result = await saveResource({ id: editing.id, type, name: values.name, room });
      if (!result.ok) {
        showErrors(result.errors);
        return;
      }
      message.success(editing.id ? "Ressource modifiée." : "Ressource ajoutée.");
      router.refresh();
      onClose();
    });
  }

  function showErrors(errors: { field: string; message: string }[]) {
    form.setFields(errors.filter((e) => FIELDS.includes(e.field)).map((e) => ({ name: e.field as keyof FormValues, errors: [e.message] })));
    setFormError(errors.find((e) => !FIELDS.includes(e.field))?.message ?? null);
  }

  return (
    <Modal
      open
      width={620}
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
              // Une personne ne devient pas un local : proposé à l'ajout seulement.
              ...(editing.id ? [] : [{ value: "PERSON", label: "Membre du personnel" }]),
            ]}
          />
        </Form.Item>
        {type === "PERSON" ? (
          <>
            <Form.Item
              label="Adresse e-mail"
              name="email"
              extra={`Son compte Google, ${domains.map((d) => `@${d}`).join(" ou ")}. Seules les adresses de la liste peuvent se connecter.`}
              rules={[{ required: true, whitespace: true, message: "Donnez l'adresse e-mail." }]}
            >
              <Input type="email" maxLength={MAX_EMAIL_LENGTH} placeholder={`prenom.nom@${domains[0] ?? "he2b.be"}`} autoFocus />
            </Form.Item>
            <Form.Item label="Nom" name="name" extra="Facultatif : à sa première connexion, le nom de son compte Google le remplace.">
              <Input maxLength={MAX_RESOURCE_NAME_LENGTH} placeholder="Claire Mertens" />
            </Form.Item>
          </>
        ) : (
          <Form.Item label="Nom" name="name" rules={[{ required: true, whitespace: true, message: "Donnez un nom à la ressource." }]}>
            <Input maxLength={MAX_RESOURCE_NAME_LENGTH} placeholder="Salle B12" autoFocus />
          </Form.Item>
        )}

        {type === "LOCAL" && (
          <>
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <Form.Item label="Type de local" name="roomType" extra="Choisissez dans la liste, ou tapez un nouveau type.">
                <AutoComplete
                  allowClear
                  maxLength={MAX_CATALOG_NAME_LENGTH}
                  placeholder="Salle de cours"
                  options={catalog.roomTypes.map((t) => ({ value: t.name }))}
                  filterOption={(input, option) => normalize(String(option?.value ?? "")).includes(normalize(input))}
                />
              </Form.Item>
              <Form.Item label="Capacité" name="capacity">
                <InputNumber min={1} max={MAX_CAPACITY} precision={0} placeholder="40" suffix="places" className="w-full!" />
              </Form.Item>
            </div>
            <Form.Item label="Bâtiment" name="building">
              <AutoComplete
                allowClear
                maxLength={MAX_BUILDING_LENGTH}
                placeholder="Bâtiment B"
                options={catalog.buildings.map((b) => ({ value: b }))}
                filterOption={(input, option) => normalize(String(option?.value ?? "")).includes(normalize(input))}
              />
            </Form.Item>

            <p className="mb-2 text-sm">Caractéristiques</p>
            <Form.List name="features">
              {(fields, { add, remove }) => (
                <div className="flex flex-col gap-2">
                  {fields.map((field) => (
                    <div key={field.key} className="flex items-start gap-2">
                      <Form.Item
                        name={[field.name, "name"]}
                        className="mb-0! flex-1"
                        rules={[{ required: true, whitespace: true, message: "Nommez la caractéristique, ou retirez la ligne." }]}
                      >
                        <AutoComplete
                          aria-label="Caractéristique"
                          maxLength={MAX_CATALOG_NAME_LENGTH}
                          placeholder="Projecteur"
                          options={catalog.features.map((f) => ({ value: f.name }))}
                          filterOption={(input, option) => normalize(String(option?.value ?? "")).includes(normalize(input))}
                        />
                      </Form.Item>
                      <Form.Item name={[field.name, "quantity"]} className="mb-0!" rules={[{ required: true, message: "Quantité ?" }]}>
                        <InputNumber aria-label="Quantité" min={1} max={MAX_FEATURE_QUANTITY} precision={0} prefix="×" className="w-24!" />
                      </Form.Item>
                      <Button
                        type="text"
                        icon={<MinusCircleOutlined />}
                        aria-label="Retirer cette caractéristique"
                        onClick={() => remove(field.name)}
                      />
                    </div>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ name: "", quantity: 1 })} className="self-start">
                    Ajouter une caractéristique
                  </Button>
                </div>
              )}
            </Form.List>
          </>
        )}
      </Form>
    </Modal>
  );
}
