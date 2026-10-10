"use client";

// Formulaire « Jours fériés et publication » (maquette « Admin — Jours fériés »).
//
// La liste des jours retirés vit côté client : on clique dans la grille, on
// nomme les périodes, puis on enregistre le tout d'un coup. La grille reste
// sur mesure (papier Seyès) ; le reste est en composants Ant Design.

import { Alert, App, Button, DatePicker, Form, Input, Modal, Popconfirm, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useState, useTransition } from "react";

import { saveHolidays } from "@/actions/calendar";
import { calendarDays, calendarWeekGrid, holidayPeriods, type ISODate } from "@/lib/slots";
import { MAX_LABEL_LENGTH, type ValidationError } from "@/lib/validation/calendar";

const DAY_NAMES: Record<string, string> = {
  monday: "Lundi",
  tuesday: "Mardi",
  wednesday: "Mercredi",
  thursday: "Jeudi",
  friday: "Vendredi",
  saturday: "Samedi",
  sunday: "Dimanche",
};

const utc = (date: ISODate) => new Date(`${date}T00:00:00Z`);
const shortDate = new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric" });

// « Du 26 octobre au 6 novembre, 10 jours » ou « Mercredi 11 novembre »
function describePeriod(from: ISODate, to: ISODate, count: number) {
  if (from === to) {
    const text = longDate.format(utc(from));
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  return `Du ${dayMonth.format(utc(from))} au ${dayMonth.format(utc(to))}, ${count} jours`;
}

type Period = { startDate: ISODate; endDate: ISODate; weekDays: string[] };

export function HolidaysForm({
  calendar,
  initialHolidays,
  slotsPerDay,
  publishedAt,
  locked,
}: {
  calendar: Period;
  initialHolidays: { date: ISODate; label: string | null }[];
  slotsPerDay: number;
  publishedAt: string | null;
  locked: boolean;
}) {
  const { message } = App.useApp();
  // date → nom de la période ("" si sans nom)
  const [holidays, setHolidays] = useState<Record<ISODate, string>>(() =>
    Object.fromEntries(initialHolidays.map((h) => [h.date, h.label ?? ""])),
  );
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [adding, setAdding] = useState(false);
  const [sending, setSending] = useState<"save" | "publish" | null>(null);
  const [, startTransition] = useTransition();

  const entries = Object.entries(holidays).map(([date, label]) => ({ date, label }));
  const periods = holidayPeriods(calendar, entries);
  const grid = calendarWeekGrid(calendar);
  const courseDays = calendarDays({ ...calendar, holidays: [] }).length;
  const retired = entries.length;
  const remaining = courseDays - periods.reduce((n, p) => n + p.dates.length, 0);

  function toggle(date: ISODate) {
    setHolidays((current) => {
      const next = { ...current };
      if (date in next) delete next[date];
      else next[date] = "";
      return next;
    });
  }

  // label null : remet ces jours dans le calendrier.
  function update(dates: ISODate[], label: string | null) {
    setHolidays((current) => {
      const next = { ...current };
      for (const date of dates) {
        if (label === null) delete next[date];
        else next[date] = label;
      }
      return next;
    });
  }

  function send(intent: "save" | "publish") {
    const data = new FormData();
    data.set("holidays", JSON.stringify(entries));
    data.set("intent", intent);
    setSending(intent);
    startTransition(async () => {
      const result = await saveHolidays({ status: "idle", errors: [] }, data);
      setSending(null);
      setErrors(result.errors);
      if (result.status === "saved") message.success("Jours retirés enregistrés.");
      if (result.status === "published") message.success("Calendrier publié. Le personnel peut maintenant signaler ses créneaux.");
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-10 2xl:flex-row">
      {/* --- Grille : jours de cours × semaines (sur mesure, papier Seyès) */}
      <div className="min-w-0 flex-1 overflow-x-auto">
        <table className="w-full min-w-[1000px] border-separate border-spacing-1.5">
          <thead>
            <tr>
              <th scope="col" className="w-22 border-r-2 border-b border-r-margin border-b-seyes-strong" />
              {grid.weeks.map((week, w) => (
                <th key={week.monday} scope="col" className="border-b border-seyes-strong pb-2 font-normal">
                  <span className="block font-condensed text-sm leading-none font-semibold">Sem. {w + 1}</span>
                  <span className="mt-1 block text-xs leading-none text-graphite">{shortDate.format(utc(week.monday))}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.days.map((day, d) => (
              <tr key={day}>
                <th scope="row" className="border-r-2 border-margin pr-3 text-left text-sm font-semibold">
                  {DAY_NAMES[day]}
                </th>
                {grid.weeks.map((week) => {
                  const date = week.dates[d];
                  if (!date) return <td key={week.monday} />;
                  const isRetired = date in holidays;
                  return (
                    <td key={week.monday} className="h-16">
                      <button
                        type="button"
                        onClick={() => toggle(date)}
                        disabled={locked}
                        aria-pressed={isRetired}
                        aria-label={`${longDate.format(utc(date))}${isRetired ? ", retiré" : ""}`}
                        className={`flex size-full cursor-pointer flex-col items-center justify-center gap-1 rounded border transition-colors disabled:cursor-not-allowed ${
                          isRetired
                            ? "border-[#e0e4ea] bg-hatch text-graphite"
                            : "border-[#e1e7f2] bg-paper text-ink hover:border-pen"
                        }`}
                      >
                        <span className="font-condensed text-[15px] font-medium">{shortDate.format(utc(date))}</span>
                        {isRetired && <span className="text-xs font-semibold">Retiré</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- Colonne : périodes retirées, ajout, publication */}
      <aside className="flex flex-col gap-5 2xl:w-85 2xl:shrink-0 2xl:border-l 2xl:border-rule 2xl:pl-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Jours retirés</h2>
          <span className="text-sm text-graphite">
            {retired} jour{retired > 1 ? "s" : ""}
          </span>
        </div>

        {periods.length === 0 ? (
          <p className="text-sm leading-relaxed text-graphite">
            Aucun jour retiré. Cliquez sur une journée de la grille, ou ajoutez une période.
          </p>
        ) : (
          <ul className="flex flex-col border-t border-rule">
            {periods.map((period) => {
              const description = describePeriod(period.from, period.to, period.dates.length);
              return (
                <li key={period.from} className="flex items-center gap-3 border-b border-rule py-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <Typography.Text
                      strong={Boolean(period.label)}
                      type={period.label ? undefined : "secondary"}
                      editable={
                        locked
                          ? false
                          : {
                              maxLength: MAX_LABEL_LENGTH,
                              tooltip: "Renommer",
                              text: period.label,
                              onChange: (label) => update(period.dates, label.trim()),
                            }
                      }
                    >
                      {period.label || "Sans nom"}
                    </Typography.Text>
                    <span className="text-[13px] text-graphite">{description}</span>
                  </div>
                  {!locked && (
                    <Popconfirm
                      title="Remettre ces jours dans le calendrier ?"
                      description={description}
                      okText="Remettre"
                      cancelText="Annuler"
                      onConfirm={() => update(period.dates, null)}
                    >
                      <Button type="text" size="small" aria-label={`Remettre dans le calendrier : ${period.label || description}`}>
                        Remettre
                      </Button>
                    </Popconfirm>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!locked && (
          <Button onClick={() => setAdding(true)} className="self-start">
            Ajouter une période
          </Button>
        )}

        <p className="text-sm leading-relaxed text-graphite">
          Il reste <strong className="font-semibold text-ink">{remaining} jours de cours</strong> sur {courseDays}, soit{" "}
          {remaining * slotsPerDay} créneaux.
        </p>

        <div className="mt-auto flex flex-col gap-3.5 border-t border-rule pt-5">
          {errors.length > 0 && (
            <Alert type="error" showIcon title={errors.length === 1 ? errors[0].message : "Ces jours ne peuvent pas être retirés :"} description={errors.length > 1 ? errors.map((e) => <div key={e.message}>{e.message}</div>) : undefined} />
          )}

          {locked ? (
            <Alert type="info" showIcon title="Des créneaux ont déjà été signalés : les jours retirés ne peuvent plus changer." />
          ) : publishedAt ? (
            <>
              <p className="text-sm leading-relaxed text-graphite">
                Publié le {fullDate.format(new Date(publishedAt))}. Le personnel voit les changements dès l&apos;enregistrement.
              </p>
              <Button type="primary" size="large" block loading={sending === "save"} onClick={() => send("save")}>
                Enregistrer
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-graphite">
                Publier ouvre la saisie à tout le personnel. Ensuite, les jours retirés ne pourront plus changer dès qu&apos;un créneau sera signalé.
              </p>
              <div className="flex gap-2.5">
                <Button size="large" loading={sending === "save"} onClick={() => send("save")} className="flex-1">
                  Enregistrer
                </Button>
                <Popconfirm
                  title="Publier le calendrier ?"
                  description="Le personnel pourra signaler ses créneaux dès maintenant."
                  okText="Publier"
                  cancelText="Annuler"
                  onConfirm={() => send("publish")}
                >
                  <Button type="primary" size="large" loading={sending === "publish"} className="flex-2">
                    Publier le calendrier
                  </Button>
                </Popconfirm>
              </div>
            </>
          )}
        </div>
      </aside>

      <AddPeriodModal
        open={adding}
        calendar={calendar}
        onClose={() => setAdding(false)}
        onAdd={(dates, label) => {
          update(dates, label);
          setAdding(false);
        }}
      />
    </div>
  );
}

// « Ajouter une période » : retire d'un coup tous les jours de cours d'une plage.
function AddPeriodModal({
  open,
  calendar,
  onClose,
  onAdd,
}: {
  open: boolean;
  calendar: Period;
  onClose: () => void;
  onAdd: (dates: ISODate[], label: string) => void;
}) {
  const [form] = Form.useForm<{ range: [Dayjs, Dayjs] | null; label: string }>();
  const first = dayjs(calendar.startDate);
  const last = dayjs(calendar.endDate);

  function submit(values: { range: [Dayjs, Dayjs] | null; label?: string }) {
    const [from, to] = values.range!.map((d) => d.format("YYYY-MM-DD"));
    const dates = calendarDays({ ...calendar, startDate: from, endDate: to, holidays: [] });
    if (dates.length === 0) {
      form.setFields([{ name: "range", errors: ["Aucun jour de cours dans cette plage."] }]);
      return;
    }
    onAdd(dates, (values.label ?? "").trim());
    form.resetFields();
  }

  return (
    <Modal
      title="Ajouter une période"
      open={open}
      okText="Retirer ces jours"
      cancelText="Annuler"
      onOk={() => form.submit()}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={submit} className="pt-2">
        <Form.Item label="Dates" name="range" rules={[{ required: true, message: "Choisissez une date de début et une date de fin." }]}>
          <DatePicker.RangePicker
            format="DD/MM/YYYY"
            placeholder={["Du", "Au"]}
            defaultPickerValue={[first, first]}
            disabledDate={(d) => d.isBefore(first, "day") || d.isAfter(last, "day")}
            className="w-full"
          />
        </Form.Item>
        <Form.Item label="Nom" name="label">
          <Input maxLength={MAX_LABEL_LENGTH} placeholder="Congé d'automne" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
