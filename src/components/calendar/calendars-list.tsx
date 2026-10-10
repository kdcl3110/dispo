"use client";

// Liste des calendriers (quadrimestres, conférences, événements…) : un clic
// ouvre le calendrier ; « Nouveau calendrier » ouvre le formulaire dans un
// panneau, puis mène au calendrier créé.

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, Drawer, Popconfirm, Table, Tag, Tooltip, type TableColumnsType } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { removeCalendar } from "@/actions/calendar";
import type { CalendarRow, CalendarStatus } from "@/lib/calendar";

import { CalendarConfigForm } from "./config-form";

const STATUS: Record<CalendarStatus, { label: string; color?: string }> = {
  draft: { label: "Brouillon" },
  published: { label: "Publié", color: "blue" },
  finished: { label: "Terminé" },
};

const shortDate = new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const period = (r: CalendarRow) =>
  `${shortDate.format(new Date(`${r.startDate}T00:00:00Z`))} – ${shortDate.format(new Date(`${r.endDate}T00:00:00Z`))}`;

export function CalendarsList({ rows }: { rows: CalendarRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const columns: TableColumnsType<CalendarRow> = [
    {
      title: "Calendrier",
      dataIndex: "name",
      render: (name: string, r) => (
        <Link href={`/admin/calendars/${r.id}`} className="text-[15px] font-semibold">
          {name}
        </Link>
      ),
    },
    { title: "Période", key: "period", width: 260, render: (_, r) => <span className="text-graphite">{period(r)}</span> },
    {
      title: "État",
      dataIndex: "status",
      width: 130,
      render: (status: CalendarStatus) => <Tag color={STATUS[status].color}>{STATUS[status].label}</Tag>,
    },
    {
      title: "Créneaux signalés",
      dataIndex: "exceptions",
      width: 170,
      render: (n: number) => <span className={n ? "" : "text-graphite"}>{n || "Aucun"}</span>,
    },
    {
      title: <span className="sr-only">Actions</span>,
      key: "actions",
      width: 220,
      align: "right",
      render: (_, r) => (
        <div className="flex items-center justify-end gap-2">
          <Button size="small" href={`/admin/calendars/${r.id}`}>
            Ouvrir
          </Button>
          <DeleteCalendarButton row={r} />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          Nouveau calendrier
        </Button>
      </div>

      <Table<CalendarRow>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
        scroll={{ x: 860 }}
        locale={{
          emptyText: (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <p className="text-base font-semibold text-ink">Aucun calendrier pour l&apos;instant</p>
              <p className="max-w-[460px] text-graphite">
                Un calendrier par quadrimestre, conférence ou événement. Commencez par sa période et ses horaires.
              </p>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)} className="mt-2">
                Créer un calendrier
              </Button>
            </div>
          ),
        }}
      />

      <Drawer open={creating} onClose={() => setCreating(false)} title="Nouveau calendrier" size="min(960px, 100vw)" destroyOnHidden>
        <CalendarConfigForm
          initial={null}
          holidays={[]}
          locked={false}
          onSaved={(id) => {
            setCreating(false);
            router.push(`/admin/calendars/${id}`);
          }}
        />
      </Drawer>
    </div>
  );
}

// « Supprimer », seulement tant que personne n'a rien signalé dans le calendrier.
function DeleteCalendarButton({ row }: { row: CalendarRow }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (row.exceptions > 0) {
    return (
      <Tooltip title="Des créneaux ont été signalés : ce calendrier ne peut plus être supprimé.">
        <Button size="small" danger icon={<DeleteOutlined />} disabled>
          Supprimer
        </Button>
      </Tooltip>
    );
  }

  return (
    <Popconfirm
      title={`Supprimer « ${row.name} » ?`}
      description="Sa configuration et ses congés seront perdus."
      okText="Supprimer"
      okButtonProps={{ danger: true }}
      cancelText="Annuler"
      onConfirm={() =>
        startTransition(async () => {
          const result = await removeCalendar({ calendarId: row.id });
          if (result.status === "invalid") {
            message.error(result.errors[0]?.message ?? "La suppression a échoué.");
            return;
          }
          message.success(`« ${row.name} » a été supprimé.`);
          router.refresh();
        })
      }
    >
      <Button size="small" danger icon={<DeleteOutlined />} loading={pending}>
        Supprimer
      </Button>
    </Popconfirm>
  );
}
