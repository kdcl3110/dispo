// Lecture du fichier Excel d'import — SPEC §8. Seule la lecture est testée :
// Prisma est remplacé par un objet vide, aucun test ne touche la base.

import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

import { parseResourceSheet, parseStaffSheet } from "./import";
import { EMPTY_ROOM } from "./validation/resource";

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
        { line: 2, type: "LOCAL", name: "A.201", room: EMPTY_ROOM },
        { line: 3, type: "EQUIPMENT", name: "Projecteur 3", room: EMPTY_ROOM },
      ],
      ignored: [],
      missingColumns: [],
      roomColumns: [],
    });
  });

  it("lit la description des locaux", () => {
    const result = parseResourceSheet(
      sheet([
        ["type", "name", "Room type", "capacity", "building", "features"],
        ["local", "Labo 2.04", "Labo informatique", "30", " Bâtiment A ", "PC (30), Projecteur"],
        ["local", "B12", "", "", "", ""],
      ]),
    );
    expect(result.roomColumns).toEqual(["room_type", "capacity", "building", "features"]);
    expect(result.rows[0].room).toEqual({
      roomType: "Labo informatique",
      capacity: 30,
      building: "Bâtiment A",
      features: [
        { name: "PC", quantity: 30 },
        { name: "Projecteur", quantity: 1 },
      ],
    });
    expect(result.rows[1].room).toEqual(EMPTY_ROOM);
  });

  it("refuse une description sur un équipement, une capacité ou une quantité illisibles", () => {
    const { rows, ignored } = parseResourceSheet(
      sheet([
        ["type", "name", "capacity", "features"],
        ["equipment", "Projecteur 01", "4", ""],
        ["local", "B12", "quarante", ""],
        ["local", "B13", "", "PC (trente)"],
        ["local", "B14", "0", ""],
        ["local", "B15", "40", "PC (2), pc"],
        ["local", "B16", "40", "PC (2)"],
      ]),
    );
    expect(rows.map((r) => r.name)).toEqual(["B16"]);
    expect(ignored.map((r) => r.line)).toEqual([2, 3, 4, 5, 6]);
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
    expect(parseResourceSheet(sheet([]))).toEqual({ rows: [], ignored: [], missingColumns: [], roomColumns: [] });
  });
});

describe("parseStaffSheet", () => {
  const domains = ["he2b.be"];

  it("lit les adresses en minuscules, nom facultatif", () => {
    const result = parseStaffSheet(
      sheet([
        ["Email", "Name"],
        [" Claire.Mertens@HE2B.be ", " Claire Mertens "],
        ["jean.dupont@he2b.be", ""],
        ["", ""],
      ]),
      domains,
    );
    expect(result).toEqual({
      rows: [
        { line: 2, email: "claire.mertens@he2b.be", name: "Claire Mertens" },
        { line: 3, email: "jean.dupont@he2b.be", name: "" },
      ],
      ignored: [],
      missingColumns: [],
    });
  });

  it("refuse les adresses vides, invalides, hors domaine ou en double", () => {
    const { rows, ignored } = parseStaffSheet(
      sheet([
        ["email", "name"],
        ["", "Sans adresse"],
        ["pas-une-adresse", ""],
        ["etudiant@etu.he2b.be", ""],
        ["perso@gmail.com", ""],
        ["claire@he2b.be", ""],
        ["CLAIRE@he2b.be", "Doublon"],
      ]),
      domains,
    );
    expect(rows.map((r) => r.email)).toEqual(["claire@he2b.be"]);
    expect(ignored.map((r) => r.line)).toEqual([2, 3, 4, 5, 7]);
  });

  it("lit aussi un fichier CSV", () => {
    const csv = new TextEncoder().encode("email;name\nclaire@he2b.be;Claire\n");
    expect(parseStaffSheet(csv.buffer as ArrayBuffer, domains).rows).toEqual([{ line: 2, email: "claire@he2b.be", name: "Claire" }]);
  });

  it("signale la colonne email manquante", () => {
    expect(parseStaffSheet(sheet([["mail"], ["claire@he2b.be"]]), domains).missingColumns).toEqual(["email"]);
  });
});
