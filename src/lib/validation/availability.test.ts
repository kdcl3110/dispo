// Créneau signalé — SPEC §10, règles 1 à 6.

import { describe, expect, it } from "vitest";

import {
  checkAccess,
  validateException,
  validateExceptionInput,
  validateSlot,
  type CalendarForValidation,
} from "./availability";

const published = new Date("2026-09-01T08:00:00Z");

// Calendrier HE2B publié, avec l'Armistice retiré.
const calendar: CalendarForValidation = {
  startDate: "2026-09-14",
  endDate: "2026-12-25",
  weekDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  dayStart: "08:00",
  dayEnd: "18:00",
  slotDuration: 120,
  slotGap: 30,
  breaks: [{ start: "12:30", end: "13:30" }],
  holidays: [{ date: "2026-11-11" }],
  publishedAt: published,
};

const user = { id: "u1", role: "USER" as const };
const admin = { id: "a1", role: "ADMIN" as const };
const own = { ownerId: "u1" };

describe("validateExceptionInput", () => {
  it("n'exige pas de commentaire pour « disponible »", () => {
    expect(validateExceptionInput({ status: "AVAILABLE", comment: "" })).toEqual([]);
  });

  it("exige un commentaire pour toute exception", () => {
    expect(validateExceptionInput({ status: "IF_NEEDED", comment: "  " })[0].field).toBe("comment");
    expect(validateExceptionInput({ status: "UNAVAILABLE", comment: "Conseil de section" })).toEqual([]);
  });

  it("limite le commentaire à 500 caractères, espaces de bord exclus", () => {
    expect(validateExceptionInput({ status: "UNAVAILABLE", comment: ` ${"x".repeat(500)} ` })).toEqual([]);
    expect(validateExceptionInput({ status: "UNAVAILABLE", comment: "x".repeat(501) })[0].field).toBe("comment");
  });

  it("refuse un statut inconnu", () => {
    expect(validateExceptionInput({ status: "MAYBE", comment: "?" })[0].field).toBe("status");
  });
});

describe("validateSlot", () => {
  it("accepte un vrai créneau, intercours compris", () => {
    expect(validateSlot(calendar, { date: "2026-09-14", start: "10:30" })).toEqual([]);
  });

  it("refuse une heure qui n'est pas un début de créneau", () => {
    // 10:00 serait le 2e créneau sans intercours.
    expect(validateSlot(calendar, { date: "2026-09-14", start: "10:00" })).toHaveLength(1);
  });

  it("refuse un jour hors calendrier : week-end, jour retiré, hors période", () => {
    for (const date of ["2026-09-19", "2026-11-11", "2027-01-04"]) {
      expect(validateSlot(calendar, { date, start: "08:00" })).toHaveLength(1);
    }
  });
});

describe("checkAccess", () => {
  it("laisse le personnel modifier sa propre fiche une fois le calendrier publié", () => {
    expect(checkAccess(user, own, calendar)).toBeNull();
  });

  it("refuse au personnel la fiche d'un autre", () => {
    expect(checkAccess(user, { ownerId: "u2" }, calendar)).not.toBeNull();
    expect(checkAccess(user, { ownerId: null }, calendar)).not.toBeNull();
  });

  it("refuse au personnel un calendrier non publié", () => {
    expect(checkAccess(user, own, { publishedAt: null })).not.toBeNull();
  });

  it("laisse l'administrateur agir partout, même avant publication", () => {
    expect(checkAccess(admin, own, { publishedAt: null })).toBeNull();
    expect(checkAccess(admin, { ownerId: null }, calendar)).toBeNull();
  });

  it("refuse à l'administrateur une fiche qui lui serait rattachée", () => {
    expect(checkAccess(admin, { ownerId: "a1" }, calendar)).not.toBeNull();
  });
});

describe("validateException", () => {
  it("s'arrête au refus d'accès sans détailler la saisie", () => {
    const errors = validateException(user, { ownerId: "u2" }, calendar, {
      date: "2026-09-19",
      start: "10:00",
      status: "UNAVAILABLE",
      comment: "",
    });
    expect(errors.map((e) => e.field)).toEqual(["form"]);
  });

  it("cumule les erreurs de saisie et de créneau", () => {
    const errors = validateException(user, own, calendar, {
      date: "2026-09-19",
      start: "10:00",
      status: "UNAVAILABLE",
      comment: "",
    });
    expect(errors.map((e) => e.field)).toEqual(["comment", "slot", "slot"]);
  });
});
