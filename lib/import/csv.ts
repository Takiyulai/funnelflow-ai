// lib/import/csv.ts
// 🆕 MODULE 3 — Parseur CSV pur JS (aucune dépendance externe : le projet n'a
// pas de lib CSV installée et l'environnement de build n'était pas accessible
// pour en ajouter une). Gère les champs entre guillemets (virgules/retours à
// la ligne à l'intérieur), les guillemets échappés (""), CRLF/LF, et détecte
// automatiquement le séparateur (virgule ou point-virgule — Excel FR exporte
// souvent en point-virgule).

export type ParsedTable = {
  headers: string[];
  rows: string[][];
};

/** Détecte le séparateur le plus probable sur la première ligne non vide. */
function detectDelimiter(sample: string): "," | ";" | "\t" {
  const firstLine = sample.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const counts = {
    ",": (firstLine.match(/,/g) ?? []).length,
    ";": (firstLine.match(/;/g) ?? []).length,
    "\t": (firstLine.match(/\t/g) ?? []).length,
  };
  const best = (Object.keys(counts) as Array<"," | ";" | "\t">).reduce((a, b) =>
    counts[b] > counts[a] ? b : a,
  );
  return counts[best] > 0 ? best : ",";
}

/** Parse un CSV complet en mémoire (adapté aux fichiers de leads — quelques
 *  dizaines de milliers de lignes max, pas de streaming). */
export function parseCsv(text: string): ParsedTable {
  // Retire un BOM UTF-8 éventuel (Excel en ajoute un systématiquement).
  const clean = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(clean);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = clean.length;

  function pushField() {
    row.push(field);
    field = "";
  }
  function pushRow() {
    pushField();
    // Ignore les lignes totalement vides (fin de fichier, ligne blanche isolée).
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  }

  while (i < len) {
    const c = clean[i];

    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === delimiter) {
      pushField();
      i++;
      continue;
    }
    if (c === "\r") {
      // \r\n ou \r seul : les deux terminent la ligne.
      if (clean[i + 1] === "\n") i++;
      pushRow();
      i++;
      continue;
    }
    if (c === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }
  // Dernier champ/ligne (pas de retour à la ligne final).
  if (field !== "" || row.length > 0) pushRow();

  if (rows.length === 0) return { headers: [], rows: [] };
  const [headerRow, ...dataRows] = rows;
  return {
    headers: headerRow.map((h) => h.trim()),
    rows: dataRows,
  };
}
