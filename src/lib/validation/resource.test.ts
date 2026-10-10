// Local ou équipement saisi à la main.

import { describe, expect, it } from "vitest";

import { validateResourceInput } from "./resource";

const fields = (input: { type: string; name: string }) => validateResourceInput(input).map((e) => e.field);

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
});
