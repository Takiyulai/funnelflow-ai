// lib/import/leadsImport.ts
// 🆕 MODULE 3 — Logique partagée par l'aperçu (parse) et la validation
// (commit) de l'import de leads : suggestion de mapping colonne → champ, et
// construction des lignes prêtes à insérer. Pur (aucun accès réseau/DB) —
// la déduplication contre la base et l'insertion vivent dans la route commit.

import type { ParsedTable } from "./csv";
import type { LeadStatus } from "@/lib/crm/types";

/** Champs fixes proposés dans le mapping (en plus des champs personnalisés
 *  de l'utilisateur, ajoutés dynamiquement côté appelant). */
export const FIXED_TARGET_FIELDS = [
  { key: "email", label: "Email", required: true },
  { key: "name", label: "Nom complet" },
  { key: "first_name", label: "Prénom" },
  { key: "last_name", label: "Nom de famille" },
  { key: "phone", label: "Téléphone" },
  { key: "status", label: "Statut" },
  { key: "source", label: "Source" },
  { key: "ignore", label: "— Ignorer cette colonne —" },
] as const;

export type TargetField = (typeof FIXED_TARGET_FIELDS)[number]["key"] | (string & {});

/** Alias reconnus par en-tête normalisé (minuscule, sans accents) pour la
 *  suggestion automatique de mapping. */
const HEADER_ALIASES: Record<string, TargetField> = {
  email: "email",
  "e-mail": "email",
  mail: "email",
  courriel: "email",
  nom: "name",
  "nom complet": "name",
  fullname: "name",
  "full name": "name",
  prenom: "first_name",
  "prénom": "first_name",
  firstname: "first_name",
  "first name": "first_name",
  "nom de famille": "last_name",
  lastname: "last_name",
  "last name": "last_name",
  telephone: "phone",
  "téléphone": "phone",
  tel: "phone",
  phone: "phone",
  whatsapp: "phone",
  mobile: "phone",
  statut: "status",
  status: "status",
  source: "source",
};

function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(new RegExp("[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]", "g"), "")
    .toLowerCase()
    .trim();
}

/** Devine le mapping colonne→champ à partir des en-têtes détectés. Renvoie un
 *  tableau de même longueur que `headers` (un mapping par colonne, "ignore"
 *  si rien ne correspond). */
export function suggestMapping(headers: string[]): TargetField[] {
  const used = new Set<TargetField>();
  return headers.map((h) => {
    const norm = normalizeHeader(h);
    const guess = HEADER_ALIASES[norm];
    if (guess && !used.has(guess)) {
      used.add(guess);
      return guess;
    }
    return "ignore";
  });
}

export type BuiltLeadRow = {
  sourceRowIndex: number; // 0-based dans `rows` (pour rapport d'erreurs)
  email: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: LeadStatus | null;
  source: string | null;
  custom_fields: Record<string, string>;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_STATUSES: LeadStatus[] = ["nouveau", "contacte", "qualifie", "client", "perdu"];

/** Construit les lignes de leads prêtes à insérer à partir du tableau brut +
 *  du mapping choisi. `customFieldKeys` = clés déjà connues (field_key) parmi
 *  lesquelles le mapping peut pointer (en plus des champs fixes). */
export function buildLeadRows(
  table: ParsedTable,
  mapping: TargetField[],
  customFieldKeys: string[],
): { rows: BuiltLeadRow[]; errors: { row: number; message: string }[] } {
  const rows: BuiltLeadRow[] = [];
  const errors: { row: number; message: string }[] = [];
  const customKeySet = new Set(customFieldKeys);

  const emailColIdx = mapping.findIndex((m) => m === "email");
  if (emailColIdx === -1) {
    errors.push({ row: 0, message: "Aucune colonne n'est mappée sur « Email » (obligatoire)." });
    return { rows, errors };
  }

  table.rows.forEach((raw, idx) => {
    const rowNum = idx + 2; // +1 en-tête, +1 pour un affichage humain 1-based
    const email = (raw[emailColIdx] ?? "").trim().toLowerCase();
    if (!email) {
      errors.push({ row: rowNum, message: "Email vide — ligne ignorée." });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      errors.push({ row: rowNum, message: `Email invalide ("${email}") — ligne ignorée.` });
      return;
    }

    const built: BuiltLeadRow = {
      sourceRowIndex: idx,
      email,
      name: null,
      first_name: null,
      last_name: null,
      phone: null,
      status: null,
      source: null,
      custom_fields: {},
    };

    mapping.forEach((target, colIdx) => {
      if (target === "ignore" || target === "email") return;
      const value = (raw[colIdx] ?? "").trim();
      if (!value) return;

      switch (target) {
        case "name":
          built.name = value;
          break;
        case "first_name":
          built.first_name = value;
          break;
        case "last_name":
          built.last_name = value;
          break;
        case "phone":
          built.phone = value;
          break;
        case "status": {
          const norm = normalizeHeader(value);
          const match = VALID_STATUSES.find((s) => s === norm);
          built.status = match ?? null;
          break;
        }
        case "source":
          built.source = value;
          break;
        default:
          // Champ personnalisé — seulement si reconnu (créé au préalable).
          if (customKeySet.has(target)) built.custom_fields[target] = value;
          break;
      }
    });

    rows.push(built);
  });

  return { rows, errors };
}
