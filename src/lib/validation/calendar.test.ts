// Configuration du calendrier — SPEC §10, règles 7 à 11.

import { describe, expect, it } from "vitest";

import {
  calendarWeeks,
  formatDuration,
  lastAllowedDate,
  validateCalendarConfig,
  validateCalendarForm,
  validateHolidays,
  type CalendarConfigInput,
} from "./calendar";

const MON_FRI = ["monday", "tuesday", "wednesday", "thursday", "friday"];

// Configuration HE2B valide, que chaque test abîme d'une seule façon.
const valid: CalendarConfigInput = {
  name: "Q1 2026-2027",
  startDate: "2026-09-14",
  endDate: "2026-12-25",
  weekDays: MON_FRI,
  dayStart: "08:00",
  dayEnd: "18:00",
  slotDuration: 120,
  slotGap: 30,
  breaks: [{ name: "Midi", start: "12:30", end: "13:30" }],
  holidays: [{ date: "2026-11-11", label: "Armistice" }],
};

const fields = (input: Partial<CalendarConfigInput>) =>
  validateCalendarConfig({ ...valid, ...input }).map((e) => e.field);

describe("validateCalendarConfig", () => {
  it("accepte la configuration HE2B", () => {
    expect(validateCalendarConfig(valid)).toEqual([]);
  });

  it("exige un nom", () => {
    expect(fields({ name: "   " })).toEqual(["name"]);
  });

  it("refuse les dates impossibles et une fin avant le début", () => {
    expect(fields({ startDate: "2026-02-31" })).toEqual(["startDate"]);
    expect(fields({ endDate: "2026-09-01" })).toEqual(["endDate"]);
  });

  it("limite la période à 15 semaines calendaires", () => {
    expect(fields({ endDate: "2026-12-27" })).toEqual([]); // dimanche de la 15e semaine
    const errors = validateCalendarConfig({ ...valid, endDate: "2026-12-28" });
    expect(errors.map((e) => e.field)).toEqual(["endDate"]);
    expect(errors[0].message).toContain("27 décembre 2026");
  });

  it("exige des jours de cours connus", () => {
    expect(fields({ weekDays: [] })).toEqual(["weekDays"]);
    expect(fields({ weekDays: ["monday", "funday"] })).toEqual(["weekDays"]);
  });

  it("refuse des horaires invalides ou inversés", () => {
    expect(fields({ dayStart: "8h" })).toEqual(["dayStart"]);
    expect(fields({ dayStart: "18:00", dayEnd: "08:00" })).toEqual(["dayEnd"]);
  });

  it("borne la durée et l'intercours", () => {
    expect(fields({ slotDuration: 0 })).toEqual(["slotDuration"]);
    expect(fields({ slotGap: -5 })).toEqual(["slotGap"]);
    expect(fields({ slotGap: 241 })).toEqual(["slotGap"]);
    expect(fields({ slotGap: undefined })).toEqual([]);
  });

  it("vérifie les pauses, en rattachant l'erreur à la bonne ligne", () => {
    expect(fields({ breaks: [{ name: "", start: "12:30", end: "13:30" }] })).toEqual(["breaks.0.name"]);
    expect(fields({ breaks: [{ name: "Midi", start: "13:30", end: "12:30" }] })).toEqual(["breaks.0.end"]);
    expect(fields({ breaks: [{ name: "Tôt", start: "07:00", end: "08:30" }] })).toEqual(["breaks.0.start"]);
    expect(
      fields({
        breaks: [
          { name: "Midi", start: "12:00", end: "13:00" },
          { name: "Matin", start: "10:00", end: "12:30" },
        ],
      }),
    ).toEqual(["breaks.0.start"]); // triée après « Matin », c'est elle qui chevauche
  });

  it("exige au moins un créneau, sans exiger que la journée tombe juste", () => {
    expect(fields({ dayEnd: "17:45" })).toEqual([]);
    expect(fields({ dayStart: "08:00", dayEnd: "09:00", breaks: [] })).toEqual(["slotDuration"]);
  });

  it("vérifie que les jours retirés sont dans la période et uniques", () => {
    expect(fields({ holidays: [{ date: "2027-01-04" }] })).toEqual(["holidays.0"]);
    expect(fields({ holidays: [{ date: "2026-11-11" }, { date: "2026-11-11" }] })).toEqual(["holidays.1"]);
  });
});

describe("validateCalendarForm", () => {
  it("ramène les jours retirés hors période sur le champ « period »", () => {
    const { holidays, ...config } = valid;
    expect(validateCalendarForm(config, holidays)).toEqual([]);
    const errors = validateCalendarForm({ ...config, endDate: "2026-11-06" }, holidays);
    expect(errors.map((e) => e.field)).toEqual(["period"]);
    expect(errors[0].message).toContain("11 novembre 2026");
  });
});

describe("validateHolidays", () => {
  const calendar = { startDate: valid.startDate, endDate: valid.endDate, weekDays: MON_FRI };

  it("accepte des jours de cours de la période", () => {
    expect(validateHolidays(calendar, [{ date: "2026-11-11", label: "Armistice" }])).toEqual([]);
  });

  it("refuse hors période, hors jour de cours, doublon et nom trop long", () => {
    const errors = validateHolidays(calendar, [
      { date: "2027-01-04" },
      { date: "2026-11-14" }, // un samedi
      { date: "2026-11-11" },
      { date: "2026-11-11" },
      { date: "2026-11-12", label: "x".repeat(81) },
    ]);
    expect(errors).toHaveLength(4);
    expect(errors.every((e) => e.field === "holidays")).toBe(true);
  });
});

describe("outils", () => {
  it("compte les semaines depuis le lundi de la semaine de début", () => {
    expect(calendarWeeks("2026-09-14", "2026-09-20")).toBe(1);
    expect(calendarWeeks("2026-09-13", "2026-09-14")).toBe(2); // dimanche puis lundi
    expect(lastAllowedDate("2026-09-16")).toBe("2026-12-27");
  });

  it("met les durées en forme", () => {
    expect(formatDuration(30)).toBe("30 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(270)).toBe("4 h 30");
  });
});
