// Lecture du fichier Excel d'import — SPEC §8. Seule la lecture est testée :
// Prisma est remplacé par un objet vide, aucun test ne touche la base.

import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

import { parseResourceSheet } from "./import";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

// Classeur d'une feuille, la première ligne servant d'en-tête.
function sheet(lines: string[][]): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(lines), "Ressources");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

describe("parseResourceSheet", () => {
  it("lit les lignes avec des en-têtes en casse quelconque", () => {
    const result = parseResourceSheet(
      sheet([
        [" Type ", "NAME"],
        ["local", " A.201 "],
        ["Equipment", "Projecteur 3"],
      ]),
    );
    expect(result).toEqual({
      rows: [
        { line: 2, type: "LOCAL", name: "A.201" },
        { line: 3, type: "EQUIPMENT", name: "Projecteur 3" },
      ],
      ignored: [],
      missingColumns: [],
    });
  });

  it("ignore les lignes vides sans les signaler", () => {
    const { rows, ignored } = parseResourceSheet(sheet([["type", "name"], ["local", "A.201"], ["", ""], ["local", "A.202"]]));
    expect(rows.map((r) => r.line)).toEqual([2, 4]);
    expect(ignored).toEqual([]);
  });

  it("écarte les lignes fautives en donnant leur numéro", () => {
    const { rows, ignored } = parseResourceSheet(
      sheet([
        ["type", "name"],
        ["person", "Dupont"],
        ["", "Sans type"],
        ["local", ""],
        ["local", "A.201"],
        ["LOCAL", "a.201"],
      ]),
    );
    expect(rows.map((r) => r.name)).toEqual(["A.201"]);
    expect(ignored.map((r) => r.line)).toEqual([2, 3, 4, 6]);
  });

  it("garde un même nom pour deux types différents", () => {
    const { rows } = parseResourceSheet(sheet([["type", "name"], ["local", "Labo"], ["equipment", "Labo"]]));
    expect(rows).toHaveLength(2);
  });

  it("signale les colonnes manquantes", () => {
    expect(parseResourceSheet(sheet([["type", "nom"], ["local", "A.201"]])).missingColumns).toEqual(["name"]);
  });

  it("ne signale rien pour une feuille vide", () => {
    expect(parseResourceSheet(sheet([]))).toEqual({ rows: [], ignored: [], missingColumns: [] });
  });
});
