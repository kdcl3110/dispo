"use client";

// Un calendrier : un résumé lisible au lieu de formulaires. L'état et l'action
// principale en haut (publier), avec la prochaine étape en toutes lettres ;
// puis les horaires et les congés, décrits en phrases. Chaque bloc a un bouton
// qui ouvre son formulaire dans un panneau latéral : on ne travaille que sur
// une chose à la fois. La création se fait depuis la liste des calendriers.

import {
  CarryOutOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  EditOutlined,
  ExportOutlined,
  InfoCircleOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { App, Button, Drawer, Popconfirm, Tag } from "antd";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { publish } from "@/actions/calendar";
import type { CalendarConfig } from "@/lib/calendar";
import { calendarDays, generateSlots, holidayPeriods, type ISODate } from "@/lib/slots";
import { calendarWeeks, formatDuration } from "@/lib/validation/calendar";

import { CalendarConfigForm } from "./config-form";
import { describePeriod, HolidaysForm } from "./holidays-form";
import { MonthOverview } from "./month-overview";

export interface OverviewCalendar extends CalendarConfig {
  id: string;
  publishedAt: string | null;
  holidays: { date: ISODate; label: string | null }[];
}

// ---------------------------------------------------------------- phrases

const ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const longDate = new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const longDateYear = new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric" });
const utc = (date: ISODate) => new Date(`${date}T00:00:00Z`);

// "08:00" → « 8 h », "08:30" → « 8 h 30 »
const hour = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
};

// « Du lundi au vendredi », ou « Lundi, mercredi et vendredi »
function describeDays(weekDays: string[]) {
  const idx = ORDER.map((d, i) => (weekDays.includes(d) ? i : -1)).filter((i) => i >= 0);
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (idx.length >= 3 && contiguous) return `Du ${DAY[idx[0]]} au ${DAY[idx.at(-1)!]}`;
  const names = idx.map((i) => DAY[i]);
  const text = names.length > 1 ? `${names.slice(0, -1).join(", ")} et ${names.at(-1)}` : (names[0] ?? "Aucun jour");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------------------------------------------------------------- écran

export function CalendarOverview({ calendar, exceptions }: { calendar: OverviewCalendar; exceptions: number }) {
  const [editing, setEditing] = useState<"config" | "holidays" | null>(null);
  const router = useRouter();
  const locked = exceptions > 0;

  return (
    <>
      <Summary calendar={calendar} exceptions={exceptions} onEdit={setEditing} />

      <Drawer
        open={editing === "config"}
        onClose={() => setEditing(null)}
        title={locked ? "Horaires" : "Modifier les horaires"}
        size="min(960px, 100vw)"
        destroyOnHidden
      >
        <CalendarConfigForm
          initial={calendar}
          holidays={calendar.holidays}
          locked={locked}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      </Drawer>

      <Drawer
        open={editing === "holidays"}
        onClose={() => setEditing(null)}
        title="Congés et jours fériés"
        size="min(1280px, 100vw)"
        destroyOnHidden
      >
        <p className="mb-6 text-[15px] text-graphite">
          Cliquez sur une journée pour la retirer du calendrier : aucun créneau n&apos;y sera proposé. Cliquez à
          nouveau pour la rendre.
        </p>
        <HolidaysForm
          calendarId={calendar.id}
          calendar={{ startDate: calendar.startDate, endDate: calendar.endDate, weekDays: calendar.weekDays }}
          initialHolidays={calendar.holidays}
          slotsPerDay={generateSlots(calendar).length}
          locked={locked}
          onSaved={() => setEditing(null)}
        />
      </Drawer>
    </>
  );
}

// ---------------------------------------------------------------- résumé

function Summary({
  calendar,
  exceptions,
  onEdit,
}: {
  calendar: OverviewCalendar;
  exceptions: number;
  onEdit: (what: "config" | "holidays") => void;
}) {
  const { message } = App.useApp();
  const router = useRouter();
  const [publishing, startTransition] = useTransition();

  const locked = exceptions > 0;
  const slots = generateSlots(calendar);
  const holidayDates = calendar.holidays.map((h) => h.date);
  const days = calendarDays({ ...calendar, holidays: holidayDates }).length;
  const weeks = calendarWeeks(calendar.startDate, calendar.endDate);
  const periods = holidayPeriods(
    { startDate: calendar.startDate, endDate: calendar.endDate, weekDays: calendar.weekDays },
    calendar.holidays,
  );

  const nextStep = locked
    ? `${exceptions} ${exceptions > 1 ? "créneaux ont été signalés" : "créneau a été signalé"} : les horaires et les congés ne peuvent plus changer.`
    : calendar.publishedAt
      ? "Le personnel peut signaler ses créneaux. Les horaires et les congés restent modifiables tant que personne n'a rien signalé."
      : periods.length === 0
        ? "Prochaine étape : retirez les congés et jours fériés, puis publiez le calendrier."
        : "Prochaine étape : vérifiez les horaires et les congés ci-dessous, puis publiez le calendrier.";

  function confirmPublish() {
    startTransition(async () => {
      const result = await publish({ calendarId: calendar.id });
      if (result.status !== "published") {
        message.error(result.errors[0]?.message ?? "La publication a échoué.");
        return;
      }
      message.success("Calendrier publié. Le personnel peut maintenant signaler ses créneaux.");
      router.refresh();
    });
  }

  const editButton = (what: "config" | "holidays", label: string) => (
    <Button icon={<EditOutlined />} onClick={() => onEdit(what)}>
      {locked ? "Voir" : label}
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* --- État et action principale */}
      <section aria-labelledby="calendar-name" className="flex flex-col gap-5 rounded-xl border border-rule p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-col gap-2">
            <Tag color={calendar.publishedAt ? "blue" : undefined} className="me-0! self-start">
              {calendar.publishedAt ? "Publié" : "Brouillon, invisible du personnel"}
            </Tag>
            <h2 id="calendar-name" className="text-2xl leading-tight font-semibold tracking-[-0.01em]">
              {calendar.name}
            </h2>
            <p className="text-[15px] text-graphite">
              Du {longDate.format(utc(calendar.startDate))} au {longDateYear.format(utc(calendar.endDate))}, {weeks}{" "}
              semaine{weeks > 1 ? "s" : ""}. {days} jours de cours, {days * slots.length} créneaux à renseigner.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button icon={<EditOutlined />} href={`/admin/availability?calendar=${calendar.id}`}>
              Saisir des disponibilités
            </Button>
            <Button icon={<ExportOutlined />} href={`/admin/export?calendar=${calendar.id}`}>
              Exporter
            </Button>
          {calendar.publishedAt ? (
            <span className="inline-flex items-center gap-2 text-sm text-pen">
              <CheckCircleFilled aria-hidden="true" />
              Publié le {fullDate.format(new Date(calendar.publishedAt))}
            </span>
          ) : (
            <Popconfirm
              title="Publier le calendrier ?"
              description="Le personnel pourra signaler ses créneaux dès maintenant."
              okText="Publier"
              cancelText="Annuler"
              onConfirm={confirmPublish}
            >
              <Button type="primary" icon={<SendOutlined />} loading={publishing}>
                Publier le calendrier
              </Button>
            </Popconfirm>
          )}
          </div>
        </div>

        <p className="flex items-start gap-3 rounded-lg bg-desk px-4 py-3 text-sm leading-relaxed">
          <InfoCircleOutlined aria-hidden="true" className="mt-1 text-pen" />
          {nextStep}
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        {/* --- Horaires */}
        <section aria-labelledby="hours-title" className="flex flex-col gap-5 rounded-xl border border-rule p-6">
          <div className="flex items-center justify-between gap-4">
            <h3 id="hours-title" className="flex items-center gap-2.5 text-lg font-semibold">
              <ClockCircleOutlined aria-hidden="true" className="text-pen" />
              Horaires
            </h3>
            {editButton("config", "Modifier les horaires")}
          </div>
          <dl className="flex flex-col">
            {[
              ["Jours de cours", describeDays(calendar.weekDays)],
              ["Journée", `De ${hour(calendar.dayStart)} à ${hour(calendar.dayEnd)}`],
              ["Créneaux", `${formatDuration(calendar.slotDuration)}, soit ${slots.length} par jour`],
              [
                calendar.breaks.length > 1 ? "Pauses" : "Pause",
                calendar.breaks.length === 0
                  ? "Aucune"
                  : calendar.breaks.map((b) => `${b.name}, de ${hour(b.start)} à ${hour(b.end)}`).join(" ; "),
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5 border-b border-rule py-3 first:pt-0 last:border-b-0">
                <dt className="text-[13px] text-graphite">{label}</dt>
                <dd className="text-[15px] font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* --- Congés */}
        <section aria-labelledby="holidays-title" className="flex flex-col gap-5 rounded-xl border border-rule p-6">
          <div className="flex items-center justify-between gap-4">
            <h3 id="holidays-title" className="flex items-center gap-2.5 text-lg font-semibold">
              <CarryOutOutlined aria-hidden="true" className="text-pen" />
              Congés et jours fériés
            </h3>
            {editButton("holidays", "Gérer les congés")}
          </div>

          {periods.length === 0 ? (
            <p className="text-[15px] text-graphite">Aucun congé retiré : tous les jours de cours de la période sont proposés.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {periods.map((p) => (
                <li key={p.from} className="flex flex-wrap items-baseline gap-x-2 text-[15px]">
                  <span className="font-medium">{p.label || "Congé"}</span>
                  <span className="text-sm text-graphite">{describePeriod(p.from, p.to, p.dates.length)}</span>
                </li>
              ))}
            </ul>
          )}

          <MonthOverview calendar={calendar} holidays={holidayDates} />
        </section>
      </div>
    </div>
  );
}
