"use client";

// Fenêtre « Signaler un créneau » (maquette « User — Signaler une exception »),
// en Modal d'Ant Design.
//
// Le parent la monte quand on clique sur un créneau et la démonte à la
// fermeture : chaque ouverture repart donc d'un état propre.
//
// Portée : le créneau cliqué, ou le même créneau tous les lundis (case à
// cocher). Un clic sur le nom du jour dans la grille ouvre la fenêtre sur
// tous les lundis, toute la journée. Avec `range` (zone glissée sur la
// grille), la portée est la sélection et la case à cocher disparaît.

import { Alert, Checkbox, Input, Modal, Radio } from "antd";
import { useState, useTransition } from "react";

import { saveCells, saveSlot, type SlotState } from "@/actions/availability";
import { weekDayOf, type ISODate, type Time } from "@/lib/slots";
import type { ValidationError } from "@/lib/validation/calendar";
import { MAX_COMMENT_LENGTH, validateExceptionInput } from "@/lib/validation/availability";

import type { SlotStatus } from "./grid";

const OPTIONS: { value: SlotStatus; title: string; hint: string; swatch: string }[] = [
  { value: "AVAILABLE", title: "Disponible", hint: "Rien à justifier", swatch: "border border-available-edge bg-available" },
  { value: "IF_NEEDED", title: "Si nécessaire", hint: "À éviter, mais possible", swatch: "border border-if-needed-edge bg-if-needed" },
  { value: "UNAVAILABLE", title: "Indisponible", hint: "Ce créneau ne convient pas", swatch: "border border-unavailable-edge bg-unavailable" },
];

const PLURAL_DAYS: Record<string, string> = {
  monday: "lundis",
  tuesday: "mardis",
  wednesday: "mercredis",
  thursday: "jeudis",
  friday: "vendredis",
  saturday: "samedis",
  sunday: "dimanches",
};

const title = new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export function SlotDialog({
  calendarId,
  resourceId,
  slot,
  day,
  initialScope = { wholeDay: false, weekly: false },
  range,
  onSaved,
  onClose,
}: {
  calendarId: string;
  resourceId: string;
  slot: { date: ISODate; start: Time; end: Time; status: SlotStatus; comment: string };
  // Nombre de créneaux par jour, et de jours de cours qui tombent ce jour de la semaine.
  day: { slots: number; weeks: number };
  initialScope?: { wholeDay: boolean; weekly: boolean };
  range?: { date: ISODate; start: Time }[];
  onSaved: (slots: SlotState[]) => void;
  onClose: () => void;
}) {
  // Un créneau disponible s'ouvre sur « Indisponible » : c'est le cas courant.
  const [status, setStatus] = useState<SlotStatus>(slot.status === "AVAILABLE" ? "UNAVAILABLE" : slot.status);
  const [comment, setComment] = useState(slot.comment);
  const [weekly, setWeekly] = useState(initialScope.weekly);
  // Toute la journée : seulement depuis le nom du jour (plus de case à cocher,
  // une zone glissée sur la grille fait mieux).
  const wholeDay = initialScope.wholeDay;
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [pending, startTransition] = useTransition();

  const needsComment = status !== "AVAILABLE";
  const commentError = errors.find((e) => e.field === "comment")?.message;
  const otherErrors = errors.filter((e) => e.field !== "comment");

  // Titre selon la portée : « Lundi 14 septembre, 08:00–10:00 », « Tous les
  // lundis, toute la journée »…
  const when = weekly ? `Tous les ${PLURAL_DAYS[weekDayOf(slot.date)]}` : title.format(new Date(`${slot.date}T00:00:00Z`));
  const heading = range
    ? `${range.length} créneau${range.length > 1 ? "x" : ""} sélectionné${range.length > 1 ? "s" : ""}`
    : `${when.charAt(0).toUpperCase() + when.slice(1)}, ${wholeDay ? "toute la journée" : `${slot.start}–${slot.end}`}`;
  const affected = range ? range.length : (weekly ? day.weeks : 1) * (wholeDay ? day.slots : 1);

  function submit() {
    const local = validateExceptionInput({ status, comment });
    if (local.length > 0) {
      setErrors(local);
      return;
    }
    startTransition(async () => {
      const result = range
        ? await saveCells({ calendarId, resourceId, cells: range, status, comment })
        : await saveSlot({
            calendarId,
            resourceId,
            date: slot.date,
            start: slot.start,
            status,
            comment,
            repeatWeekly: weekly,
            wholeDay,
          });
      if (result.ok) {
        onSaved(result.slots);
        onClose();
      } else {
        setErrors(result.errors);
      }
    });
  }

  return (
    <Modal
      open
      width={560}
      title={heading}
      okText="Enregistrer"
      cancelText="Annuler"
      confirmLoading={pending}
      onOk={submit}
      onCancel={onClose}
    >
      <div className="flex flex-col gap-6 pt-2">
        <p className="text-sm text-graphite">
          {affected > 1 ? `Choisissez le statut de ces ${affected} créneaux.` : "Choisissez le statut de ce créneau."}
        </p>

        {otherErrors.length > 0 && <Alert type="error" showIcon title={otherErrors.map((e) => e.message).join(" ")} />}

        <Radio.Group
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setErrors([]);
          }}
          aria-label="Statut"
          className="flex! flex-col gap-2"
        >
          {OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex h-13 cursor-pointer items-center gap-3 rounded-lg border border-rule px-3.5 has-checked:border-2 has-checked:border-pen has-checked:bg-pen-tint"
            >
              <Radio value={option.value} className="me-0!" />
              <span aria-hidden="true" className={`h-3.5 w-5.5 rounded-[3px] ${option.swatch}`} />
              <span className="text-[15px] font-medium">{option.title}</span>
              <span className="ml-auto text-[13px] text-graphite">{option.hint}</span>
            </label>
          ))}
        </Radio.Group>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="slot-comment" className="text-[13px] font-semibold">
            Commentaire
          </label>
          <Input.TextArea
            id="slot-comment"
            rows={3}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              setErrors((current) => current.filter((err) => err.field !== "comment"));
            }}
            disabled={!needsComment}
            maxLength={MAX_COMMENT_LENGTH}
            showCount={needsComment}
            status={commentError ? "error" : undefined}
            placeholder={needsComment ? "Par exemple : réunion de département" : "Pas de commentaire pour un créneau disponible"}
            aria-describedby="slot-comment-help"
            className="resize-none!"
          />
          <p id="slot-comment-help" className={`text-[13px] leading-normal ${commentError ? "text-unavailable" : "text-graphite"}`}>
            {commentError ?? "Obligatoire pour « si nécessaire » et « indisponible ». L'administration le voit dans l'export."}
          </p>
        </div>

        {range ? (
          <p className="text-[13px] text-graphite">Ce qui était déjà signalé sur ces créneaux est remplacé.</p>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-[13px] font-semibold">Appliquer aussi à</legend>
            <Checkbox checked={weekly} onChange={(e) => setWeekly(e.target.checked)}>
              Tous les {PLURAL_DAYS[weekDayOf(slot.date)]} du calendrier ({day.weeks} au total, jours retirés exclus)
            </Checkbox>
            {affected > 1 && (
              <p className="text-[13px] text-graphite">
                {affected} créneaux seront modifiés. Ce qui y était déjà signalé est remplacé.
              </p>
            )}
          </fieldset>
        )}
      </div>
    </Modal>
  );
}
