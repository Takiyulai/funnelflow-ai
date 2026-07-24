// app/api/leads/import/parse/route.ts
// 🆕 MODULE 3 — Étape 1 de l'import : parse le fichier (CSV/XLSX) et renvoie
// un APERÇU (en-têtes, lignes, mapping suggéré, champs personnalisés
// disponibles). N'écrit RIEN en base — la validation/insertion se fait dans
// /api/leads/import/commit après confirmation de l'utilisateur.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listCustomFieldDefs } from "@/lib/crm/customFields";
import { parseCsv } from "@/lib/import/csv";
import { parseXlsx } from "@/lib/import/xlsx";
import { suggestMapping, FIXED_TARGET_FIELDS } from "@/lib/import/leadsImport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_ROWS = 20_000;
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

export async function POST(request: Request) {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "file_required" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ ok: false, error: "empty_file" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { ok: false, error: `Fichier trop volumineux (max ${MAX_FILE_SIZE / 1024 / 1024} Mo).` },
      { status: 413 },
    );
  }

  const name = (file.name || "").toLowerCase();
  const isXlsx = name.endsWith(".xlsx") || file.type.includes("spreadsheetml");
  const isKnownExt = isXlsx || name.endsWith(".csv") || file.type.includes("csv");
  if (!isKnownExt) {
    return NextResponse.json(
      { ok: false, error: "Format non reconnu — utilisez un fichier .csv ou .xlsx." },
      { status: 415 },
    );
  }

  try {
    // Tout ce qui n'est pas .xlsx est tenté en CSV (couvre aussi .txt délimité,
    // fréquent en export "brut" de certains outils).
    const table = isXlsx
      ? parseXlsx(new Uint8Array(await file.arrayBuffer()))
      : parseCsv(await file.text());

    if (table.headers.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Impossible de détecter des colonnes dans ce fichier." },
        { status: 422 },
      );
    }

    const totalRows = table.rows.length;
    const truncated = totalRows > MAX_ROWS;
    const rows = truncated ? table.rows.slice(0, MAX_ROWS) : table.rows;

    const customFields = await listCustomFieldDefs(sb, user.id);
    const suggestedMapping = suggestMapping(table.headers);

    return NextResponse.json({
      ok: true,
      headers: table.headers,
      rows,
      totalRows,
      truncated,
      suggestedMapping,
      fixedTargetFields: FIXED_TARGET_FIELDS,
      customFields,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "parse_failed" },
      { status: 500 },
    );
  }
}
