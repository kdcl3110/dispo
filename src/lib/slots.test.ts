// Découpage de la journée, semaines de la grille, jours de cours, congés.

import { describe, expect, it } from "vitest";

import {
  addDays,
  calendarDays,
  calendarWeekGrid,
  generateSlots,
  holidayPeriods,
  mondayOf,
  planGridChange,
  unusedMinutes,
  weekDayOf,
} from "./slots";

const MON_FRI = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const times = (slots: { start: string; end: string }[]) => slots.map((s) => `${s.start}-${s.end}`);

// Horaires HE2B (SPEC §6).
const HE2B = {
  dayStart: "08:00",
  dayEnd: "18:00",
  slotDuration: 120,
  slotGap: 30,
  breaks: [{ start: "12:30", end: "13:30" }],
};

describe("generateSlots", () => {
  it("découpe la journée HE2B en 4 créneaux de 2 h", () => {
    expect(times(generateSlots(HE2B))).toEqual(["08:00-10:00", "10:30-12:30", "13:30-15:30", "16:00-18:00"]);
    expect(unusedMinutes(HE2B)).toBe(0);
  });

  it("numérote les créneaux dans l'ordre de la journée", () => {
    expect(generateSlots(HE2B).map((s) => s.id)).toEqual(["s1", "s2", "s3", "s4"]);
  });

  it("sans intercours, garde le découpage « collé » d'origine", () => {
    const config = { dayStart: "08:00", dayEnd: "18:00", slotDuration: 120, breaks: [{ start: "12:00", end: "14:00" }] };
    expect(times(generateSlots(config))).toEqual(["08:00-10:00", "10:00-12:00", "14:00-16:00", "16:00-18:00"]);
    expect(generateSlots({ ...config, slotGap: 0 })).toEqual(generateSlots(config));
  });

  it("fait repartir un créneau après une pause qu'il chevaucherait", () => {
    // 10:30 + 2 h + 30 min → 13:00, en pleine pause : on repart à 13:30.
    expect(generateSlots(HE2B)[2].start).toBe("13:30");
  });

  it("accepte des pauses données dans le désordre", () => {
    const config = {
      dayStart: "08:00",
      dayEnd: "18:00",
      slotDuration: 90,
      slotGap: 15,
      breaks: [
        { start: "15:00", end: "15:30" },
        { start: "12:00", end: "13:00" },
      ],
    };
    expect(times(generateSlots(config))).toEqual(["08:00-09:30", "09:45-11:15", "13:00-14:30", "15:30-17:00"]);
  });

  it("signale le temps non utilisé en fin de journée", () => {
    const config = { ...HE2B, dayEnd: "17:45" };
    expect(generateSlots(config)).toHaveLength(3);
    expect(unusedMinutes(config)).toBe(135);
  });

  it("ne renvoie aucun créneau si rien ne tient", () => {
    expect(generateSlots({ dayStart: "08:00", dayEnd: "10:00", slotDuration: 180 })).toEqual([]);
  });

  it("refuse une durée nulle ou un intercours négatif (boucle infinie)", () => {
    expect(() => generateSlots({ ...HE2B, slotDuration: 0 })).toThrow();
    expect(() => generateSlots({ ...HE2B, slotGap: -10 })).toThrow();
  });
});

describe("dates", () => {
  it("donne le jour de la semaine sans décalage horaire", () => {
    expect(weekDayOf("2026-09-14")).toBe("monday");
    expect(weekDayOf("2026-03-29")).toBe("sunday"); // passage à l'heure d'été
    expect(weekDayOf("2026-10-25")).toBe("sunday"); // passage à l'heure d'hiver
  });

  it("calcule le lundi d'une semaine et ajoute des jours", () => {
    expect(mondayOf("2026-09-16")).toBe("2026-09-14");
    expect(mondayOf("2026-09-13")).toBe("2026-09-07");
    expect(addDays("2026-10-24", 3)).toBe("2026-10-27");
  });
});

describe("calendarDays", () => {
  it("garde les jours de cours de la période, jours fériés exclus", () => {
    const days = calendarDays({
      startDate: "2026-09-14",
      endDate: "2026-12-25",
      weekDays: MON_FRI,
      holidays: ["2026-10-26", "2026-11-11"],
    });
    expect(days).toHaveLength(73);
    expect(days).not.toContain("2026-10-26");
    expect(days.every((d) => !["saturday", "sunday"].includes(weekDayOf(d)))).toBe(true);
  });
});

describe("calendarWeekGrid", () => {
  it("n'affiche pas de semaine vide quand la période commence un dimanche", () => {
    const { weeks } = calendarWeekGrid({ startDate: "2026-09-13", endDate: "2026-12-25", weekDays: MON_FRI });
    expect(weeks).toHaveLength(15);
    expect(weeks[0].monday).toBe("2026-09-14");
  });

  it("n'affiche pas de semaine vide en fin de période", () => {
    const { weeks } = calendarWeekGrid({
      startDate: "2026-09-15",
      endDate: "2026-12-21", // un lundi, cours du mardi au vendredi
      weekDays: ["tuesday", "wednesday", "thursday", "friday"],
    });
    expect(weeks.at(-1)!.monday).toBe("2026-12-14");
  });

  it("garde une semaine partielle, avec ses jours hors période à null", () => {
    const { weeks } = calendarWeekGrid({ startDate: "2026-09-16", endDate: "2026-12-25", weekDays: MON_FRI });
    expect(weeks[0].dates).toEqual([null, null, "2026-09-16", "2026-09-17", "2026-09-18"]);
  });
});

describe("holidayPeriods", () => {
  it("regroupe les jours retirés sans jour de cours entre eux (week-end compris)", () => {
    const period = { startDate: "2026-09-14", endDate: "2026-12-25", weekDays: MON_FRI };
    const autumn = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-11-02", "2026-11-03"];
    const periods = holidayPeriods(period, [
      ...autumn.map((date) => ({ date, label: "Congé d'automne" })),
      { date: "2026-11-11", label: "Armistice" },
    ]);
    expect(periods.map((p) => [p.from, p.to, p.dates.length, p.label])).toEqual([
      ["2026-10-26", "2026-11-03", 7, "Congé d'automne"],
      ["2026-11-11", "2026-11-11", 1, "Armistice"],
    ]);
  });
});

describe("planGridChange", () => {
  const before = { ...HE2B, startDate: "2026-09-14", endDate: "2026-12-25", weekDays: MON_FRI, holidays: [] };
  const exceptions = [
    { id: "a", date: "2026-09-14", start: "08:00" }, // lundi, 1er créneau
    { id: "b", date: "2026-09-15", start: "10:30" }, // mardi, 2e créneau
    { id: "c", date: "2026-11-11", start: "13:30" }, // mercredi, 3e créneau
  ];
  const ids = (list: { id: string }[]) => list.map((e) => e.id);

  it("garde tout quand seuls le nom ou la fin de période changent", () => {
    const plan = planGridChange(before, { ...before, endDate: "2026-12-27" }, exceptions);
    expect(ids(plan.kept)).toEqual(["a", "b", "c"]);
    expect(plan.moved).toEqual([]);
    expect(plan.removed).toEqual([]);
  });

  it("déplace chaque signalement avec son créneau si les horaires glissent", () => {
    // Journée décalée de 30 min : toujours 4 créneaux, 08:30, 11:00, 14:00, 16:30.
    const after = { ...before, dayStart: "08:30", dayEnd: "18:30", breaks: [{ start: "13:00", end: "14:00" }] };
    const plan = planGridChange(before, after, exceptions);
    expect(plan.moved.map((m) => [m.exception.id, m.start])).toEqual([["a", "08:30"], ["b", "11:00"], ["c", "14:00"]]);
    expect(plan.kept).toEqual([]);
  });

  it("ne garde que les heures exactes si le nombre de créneaux change", () => {
    // Sans intercours ni pause : 5 créneaux de 2 h, 08:00, 10:00, 12:00, 14:00, 16:00.
    const after = { ...before, slotGap: 0, breaks: [] };
    const plan = planGridChange(before, after, exceptions);
    expect(ids(plan.kept)).toEqual(["a"]);
    expect(plan.removed.map((r) => [r.exception.id, r.reason])).toEqual([["b", "time"], ["c", "time"]]);
  });

  it("supprime les signalements des jours qui sortent du calendrier", () => {
    const after = { ...before, weekDays: ["monday", "wednesday", "thursday", "friday"], holidays: ["2026-11-11"] };
    const plan = planGridChange(before, after, exceptions);
    expect(ids(plan.kept)).toEqual(["a"]);
    expect(plan.removed.map((r) => [r.exception.id, r.reason])).toEqual([["b", "day"], ["c", "day"]]);
  });
});
