// Local ou équipement saisi à la main, description des locaux, et membre du personnel.

import { describe, expect, it } from "vitest";

import {
  EMPTY_ROOM,
  isAllowedEmail,
  parseAllowedDomains,
  parseFeatures,
  validateCatalogName,
  validatePersonInput,
  validateResourceInput,
  type RoomDetails,
} from "./resource";

const fields = (input: { type: string; name: string; room?: RoomDetails }) => validateResourceInput(input).map((e) => e.field);
const room = (details: Partial<RoomDetails>) => ({ ...EMPTY_ROOM, ...details });

describe("validateResourceInput", () => {
  it("accepte un local et un équipement", () => {
    expect(fields({ type: "LOCAL", name: "A.201" })).toEqual([]);
    expect(fields({ type: "EQUIPMENT", name: "Projecteur 3" })).toEqual([]);
  });

  it("refuse le type personne : les fiches viennent de Google", () => {
    expect(fields({ type: "PERSON", name: "Dupont" })).toEqual(["type"]);
  });

  it("exige un nom de 120 caractères au plus", () => {
    expect(fields({ type: "LOCAL", name: "   " })).toEqual(["name"]);
    expect(fields({ type: "LOCAL", name: "x".repeat(120) })).toEqual([]);
    expect(fields({ type: "LOCAL", name: "x".repeat(121) })).toEqual(["name"]);
  });

  it("accepte un local décrit", () => {
    const details = room({ roomType: "Labo", capacity: 30, building: "Bâtiment A", features: [{ name: "PC", quantity: 30 }] });
    expect(fields({ type: "LOCAL", name: "Labo 2.04", room: details })).toEqual([]);
  });

  it("réserve la description aux locaux", () => {
    expect(fields({ type: "EQUIPMENT", name: "Projecteur 3", room: room({ capacity: 4 }) })).toEqual(["room"]);
    expect(fields({ type: "EQUIPMENT", name: "Projecteur 3", room: EMPTY_ROOM })).toEqual([]);
  });

  it("veut une capacité entière et positive", () => {
    expect(fields({ type: "LOCAL", name: "B12", room: room({ capacity: 0 }) })).toEqual(["capacity"]);
    expect(fields({ type: "LOCAL", name: "B12", room: room({ capacity: 12.5 }) })).toEqual(["capacity"]);
  });

  it("refuse une caractéristique sans nom, citée deux fois, ou de quantité nulle", () => {
    const check = (features: RoomDetails["features"]) => fields({ type: "LOCAL", name: "B12", room: room({ features }) });
    expect(check([{ name: " ", quantity: 1 }])).toEqual(["features"]);
    expect(check([{ name: "PC", quantity: 1 }, { name: "pc", quantity: 2 }])).toEqual(["features"]);
    expect(check([{ name: "PC", quantity: 0 }])).toEqual(["features"]);
  });
});

describe("validateCatalogName", () => {
  it("exige un nom de 60 caractères au plus", () => {
    expect(validateCatalogName("  ")).toHaveLength(1);
    expect(validateCatalogName("x".repeat(61))).toHaveLength(1);
    expect(validateCatalogName("Auditoire")).toEqual([]);
  });
});

describe("parseFeatures", () => {
  it("lit les noms et les quantités", () => {
    expect(parseFeatures("Projecteur, PC (30); Tableau blanc x2")).toEqual([
      { name: "Projecteur", quantity: 1 },
      { name: "PC", quantity: 30 },
      { name: "Tableau blanc", quantity: 2 },
    ]);
  });

  it("garde « Box30 » comme un nom et ignore les cases vides", () => {
    expect(parseFeatures(" , Box30 ,")).toEqual([{ name: "Box30", quantity: 1 }]);
    expect(parseFeatures("")).toEqual([]);
  });

  it("refuse une quantité illisible", () => {
    expect(parseFeatures("PC (trente)")).toBeNull();
    expect(parseFeatures("(30)")).toBeNull();
  });
});

describe("adresses du personnel", () => {
  const domains = parseAllowedDomains(" he2b.be , Autre.BE ,");

  it("lit la liste des domaines", () => {
    expect(domains).toEqual(["he2b.be", "autre.be"]);
    expect(parseAllowedDomains(undefined)).toEqual([]);
  });

  it("compare le domaine à l'identique : les étudiants restent dehors", () => {
    expect(isAllowedEmail("claire.mertens@he2b.be", domains)).toBe(true);
    expect(isAllowedEmail("Claire@HE2B.be", domains)).toBe(true);
    expect(isAllowedEmail("etudiant@etu.he2b.be", domains)).toBe(false);
    expect(isAllowedEmail("pirate@he2b.be.evil.com", domains)).toBe(false);
    expect(isAllowedEmail("he2b.be", domains)).toBe(false);
  });

  it("valide l'adresse, le domaine et le nom facultatif", () => {
    const fieldsOf = (email: string, name = "") => validatePersonInput({ email, name }, domains).map((e) => e.field);
    expect(fieldsOf(" Claire.Mertens@he2b.be ")).toEqual([]);
    expect(fieldsOf("claire@he2b.be", "Claire Mertens")).toEqual([]);
    expect(fieldsOf("")).toEqual(["email"]);
    expect(fieldsOf("claire mertens@he2b.be")).toEqual(["email"]);
    expect(fieldsOf("claire@gmail.com")).toEqual(["email"]);
    expect(fieldsOf("claire@etu.he2b.be")).toEqual(["email"]);
    expect(fieldsOf("claire@he2b.be", "x".repeat(121))).toEqual(["name"]);
  });
});
