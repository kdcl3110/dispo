"use client";

// Fenêtre « Signaler un créneau » (maquette « User — Signaler une exception »).
//
// Le parent la monte quand on clique sur un créneau et la démonte à la
// fermeture : chaque ouverture repart donc d'un état propre. L'élément natif
// <dialog> gère le focus, la touche Échap et l'arrière-plan.

import { useEffect, useRef, useState, useTransition } from "react";

import { saveSlot, type SlotState } from "@/actions/availability";
import { weekDayOf, type ISODate, type Time } from "@/lib/slots";
import type { ValidationError } from "@/lib/validation/calendar";
import { MAX_COMMENT_LENGTH, validateExceptionInput } from "@/lib/validation/availability";

import type { SlotStatus } from "./grid";

const OPTIONS: { value: SlotStatus; title: string; hint: string; swatch: string }[] = [
  { value: "AVAILABLE", title: "Disponible", hint: "Rien à justifier", swatch: "border border-field bg-paper" },
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
  resourceId,
  slot,
  onSaved,
  onClose,
}: {
  resourceId: string;
  slot: { date: ISODate; start: Time; end: Time; status: SlotStatus; comment: string };
  onSaved: (slots: SlotState[]) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<SlotStatus>(slot.status === "AVAILABLE" ? "UNAVAILABLE" : slot.status);
  const [comment, setComment] = useState(slot.comment);
  const [repeat, setRepeat] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [pending, startTransition] = useTransition();

  // Ouverture en mode modal dès le montage.
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const needsComment = status !== "AVAILABLE";
  const commentErrors = errors.filter((e) => e.field === "comment");
  const otherErrors = errors.filter((e) => e.field !== "comment");
  const heading = title.format(new Date(`${slot.date}T00:00:00Z`));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const local = validateExceptionInput({ status, comment });
    if (local.length > 0) {
      setErrors(local);
      return;
    }
    startTransition(async () => {
      const result = await saveSlot({ resourceId, date: slot.date, start: slot.start, status, comment, repeatWeekly: repeat });
      if (result.ok) {
        onSaved(result.slots);
        dialog.current?.close();
      } else {
        setErrors(result.errors);
      }
    });
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="slot-dialog-title"
      className="m-auto w-[540px] max-w-[calc(100vw-32px)] rounded-[10px] bg-paper p-0 text-ink shadow-[0_24px_60px_-20px_rgba(29,36,51,0.5)] backdrop:bg-ink/45"
    >
      <form onSubmit={submit} className="flex flex-col gap-6 p-8">
        <div className="flex flex-col gap-1.5">
          <h2 id="slot-dialog-title" className="text-[22px] font-semibold tracking-[-0.01em]">
            {heading.charAt(0).toUpperCase() + heading.slice(1)}, {slot.start}–{slot.end}
          </h2>
          <p className="text-sm text-graphite">Choisissez le statut de ce créneau.</p>
        </div>

        {otherErrors.length > 0 && (
          <div role="alert" className="rounded-md bg-error-tint px-4 py-3 text-sm text-unavailable">
            {otherErrors.map((e) => (
              <p key={e.message}>{e.message}</p>
            ))}
          </div>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13px] font-semibold">Statut</legend>
          {OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex h-13 cursor-pointer items-center gap-3 rounded-lg border border-rule px-3.5 has-checked:border-2 has-checked:border-pen has-checked:bg-pen-tint"
            >
              <input
                type="radio"
                name="status"
                value={option.value}
                checked={status === option.value}
                onChange={() => {
                  setStatus(option.value);
                  setErrors([]);
                }}
                className="size-4 accent-pen"
              />
              <span aria-hidden="true" className={`h-3.5 w-5.5 rounded-[3px] ${option.swatch}`} />
              <span className="text-[15px] font-medium">{option.title}</span>
              <span className="ml-auto text-[13px] text-graphite">{option.hint}</span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="slot-comment" className="text-[13px] font-semibold">
            Commentaire
          </label>
          <textarea
            id="slot-comment"
            rows={3}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              setErrors((current) => current.filter((err) => err.field !== "comment"));
            }}
            disabled={!needsComment}
            maxLength={MAX_COMMENT_LENGTH}
            placeholder={needsComment ? "Par exemple : réunion de département" : "Pas de commentaire pour un créneau disponible"}
            aria-invalid={commentErrors.length > 0 || undefined}
            aria-describedby="slot-comment-help"
            className="resize-none rounded-md border border-field bg-paper px-3 py-2.5 text-sm leading-normal disabled:bg-desk aria-invalid:border-2 aria-invalid:border-unavailable"
          />
          <p id="slot-comment-help" className={`text-[13px] leading-normal ${commentErrors.length ? "text-unavailable" : "text-graphite"}`}>
            {commentErrors.length
              ? commentErrors[0].message
              : "Obligatoire pour « si nécessaire » et « indisponible ». L'administration le voit dans l'export."}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-5">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="size-4 accent-pen" />
            Tous les {PLURAL_DAYS[weekDayOf(slot.date)]} de {slot.start} à {slot.end}
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="h-11 cursor-pointer rounded-md border border-field bg-paper px-5 text-sm font-semibold hover:bg-desk"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-11 cursor-pointer rounded-md bg-pen px-5 text-sm font-semibold text-white hover:bg-pen-dark disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
