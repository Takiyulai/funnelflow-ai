// lib/import/xlsx.ts
// 🆕 MODULE 3 — Lecteur .xlsx MINIMAL, sans dépendance dédiée (le projet n'a
// pas de lib xlsx installée et l'environnement de build n'était pas
// accessible pour en ajouter une). Un fichier .xlsx est une archive ZIP de
// fichiers XML : on la décompresse avec `fflate` (déjà une dépendance du
// projet) et on parse le XML avec `cheerio` (idem) en mode XML.
//
// Limites assumées (suffisant pour un import de leads) : lit la PREMIÈRE
// feuille uniquement, valeurs texte/nombre/date basiques (pas de formules
// calculées — la valeur mise en cache par Excel est lue telle quelle).

import { unzipSync, strFromU8 } from "fflate";
import * as cheerio from "cheerio";
import type { ParsedTable } from "./csv";

/** Convertit une référence de colonne ("A", "B", ..., "AA") en index 0-based. */
function colLetterToIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) {
    n = n * 26 + (ch.charCodeAt(0) - 64); // 'A' → 1
  }
  return n - 1;
}

/** Extrait les lettres de colonne d'une référence de cellule ("B12" → "B"). */
function cellColLetters(cellRef: string): string {
  const m = cellRef.match(/^([A-Z]+)/);
  return m ? m[1] : "A";
}

function readSharedStrings($sst: cheerio.CheerioAPI): string[] {
  const out: string[] = [];
  $sst("si").each((_, si) => {
    // Un <si> peut contenir soit un <t> direct, soit plusieurs <r><t> (texte enrichi).
    const direct = $sst(si).children("t").first();
    if (direct.length > 0) {
      out.push(direct.text());
      return;
    }
    const runs = $sst(si).find("r > t");
    out.push(runs.toArray().map((t) => $sst(t).text()).join(""));
  });
  return out;
}

export function parseXlsx(buffer: Uint8Array): ParsedTable {
  const files = unzipSync(buffer);

  const sheetPath = Object.keys(files)
    .filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(p))
    .sort()[0];
  if (!sheetPath) {
    throw new Error("Aucune feuille trouvée dans ce fichier .xlsx (fichier invalide ou corrompu).");
  }

  let sharedStrings: string[] = [];
  const sstPath = "xl/sharedStrings.xml";
  if (files[sstPath]) {
    const $sst = cheerio.load(strFromU8(files[sstPath]), { xmlMode: true });
    sharedStrings = readSharedStrings($sst);
  }

  const $sheet = cheerio.load(strFromU8(files[sheetPath]), { xmlMode: true });
  const rows: string[][] = [];

  $sheet("row").each((_, rowEl) => {
    const cells: string[] = [];
    $sheet(rowEl)
      .children("c")
      .each((__, cellEl) => {
        const $c = $sheet(cellEl);
        const ref = $c.attr("r") || "";
        const colIdx = ref ? colLetterToIndex(cellColLetters(ref)) : cells.length;
        const type = $c.attr("t");

        let value = "";
        if (type === "inlineStr") {
          value = $c.find("is t").text();
        } else {
          const vEl = $c.children("v").first();
          const raw = vEl.length > 0 ? vEl.text() : "";
          if (type === "s") {
            const idx = Number(raw);
            value = Number.isFinite(idx) ? (sharedStrings[idx] ?? "") : "";
          } else if (type === "b") {
            value = raw === "1" ? "VRAI" : "FAUX";
          } else {
            value = raw; // nombre ou date sérielle Excel — laissé brut
          }
        }

        // Complète les colonnes vides sautées (cellules réellement absentes).
        while (cells.length < colIdx) cells.push("");
        cells[colIdx] = value;
      });
    rows.push(cells);
  });

  if (rows.length === 0) return { headers: [], rows: [] };
  const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const normalized = rows.map((r) => {
    const padded = r.slice(0, width);
    while (padded.length < width) padded.push("");
    return padded;
  });

  const [headerRow, ...dataRows] = normalized;
  return {
    headers: headerRow.map((h) => (h ?? "").trim()),
    rows: dataRows,
  };
}
