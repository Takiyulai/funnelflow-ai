// app/api/leads/import/commit/route.ts
// 🆕 MODULE 3 — Étape 2 de l'import : reçoit les en-têtes/lignes brutes + le
// mapping choisi par l'utilisateur, RECONSTRUIT et REVALIDE tout côté serveur
// (on ne fait jamais confiance à un objet "lead" déjà construit côté client),
// déduplique (fichier + base existante), puis insère via le client de SESSION
// (RLS) — jamais le client admin, pour rester dans le périmètre du propriétaire.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listCustomFieldDefs } from "@/lib/crm/customFields";
import { getOrCreateContactList, addContactsToLists } from "@/lib/crm/lists";
import { buildLeadRows, type TargetField } from "@/lib/import/leadsImport";
import type { ParsedTable } from "@/lib/import/csv";
import type { LeadStatus } from "@/lib/crm/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const INSERT_CHUNK = 500;
const MAX_ROWS = 20_000;

const VALID_STATUSES: LeadStatus[] = ["nouveau", "contacte", "qualifie", "client", "perdu"];

type Body = {
  headers?: unknown;
  rows?: unknown;
  mapping?: unknown;
  funnelId?: unknown;
  dedupeOn?: unknown;
  /** 🆕 Classement du lot importé (voir lib/crm/lists.ts). */
  listId?: unknown;
  listName?: unknown;
  sourceLabel?: unknown;
  defaultStatus?: unknown;
};

export async function POST(request: Request) {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Body | null;
  if (
    !body ||
    !Array.isArray(body.headers) ||
    !Array.isArray(body.rows) ||
    !Array.isArray(body.mapping)
  ) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const headers = body.headers.filter((h): h is string => typeof h === "string");
  const mapping = body.mapping.filter((m): m is TargetField => typeof m === "string");
  const rows = (body.rows as unknown[])
    .filter((r): r is unknown[] => Array.isArray(r))
    .slice(0, MAX_ROWS)
    .map((r) => r.map((v) => (v === null || v === undefined ? "" : String(v))));
  const funnelId = typeof body.funnelId === "string" && body.funnelId ? body.funnelId : null;
  const dedupeOn = body.dedupeOn === "phone" ? "phone" : "email";

  // 🆕 Classement du lot. `listId` cible une liste existante, `listName` en
  // crée/réutilise une par son nom. Les deux sont facultatifs : un import sans
  // classement reste possible et se comporte exactement comme avant.
  const listId = typeof body.listId === "string" && body.listId ? body.listId : null;
  const listName = typeof body.listName === "string" ? body.listName.trim() : "";
  const sourceLabel =
    typeof body.sourceLabel === "string" && body.sourceLabel.trim()
      ? body.sourceLabel.trim().slice(0, 80)
      : null;
  // On ne fait JAMAIS confiance au statut envoyé par le client : une valeur
  // hors énumération passerait la contrainte applicative et polluerait les
  // filtres du CRM.
  const defaultStatus: LeadStatus = VALID_STATUSES.includes(body.defaultStatus as LeadStatus)
    ? (body.defaultStatus as LeadStatus)
    : "nouveau";

  if (headers.length === 0 || mapping.length !== headers.length) {
    return NextResponse.json({ ok: false, error: "headers_mapping_mismatch" }, { status: 400 });
  }

  try {
    // 🆕 Si le tunnel est fourni, on vérifie qu'il appartient bien à l'utilisateur
    // (évite de rattacher des leads importés à un tunnel d'un autre compte).
    if (funnelId) {
      const { data: funnel } = await sb
        .from("funnels")
        .select("id")
        .eq("id", funnelId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!funnel) {
        return NextResponse.json({ ok: false, error: "funnel_not_found" }, { status: 404 });
      }
    }

    const customFieldDefs = await listCustomFieldDefs(sb, user.id);
    const customFieldKeys = customFieldDefs.map((f) => f.field_key);

    const table: ParsedTable = { headers, rows };
    const { rows: built, errors: buildErrors } = buildLeadRows(table, mapping, customFieldKeys);

    // ── Déduplication INTRA-fichier ──────────────────────────────────────
    const seenInFile = new Set<string>();
    const afterFileDedup: typeof built = [];
    let fileDuplicates = 0;
    for (const row of built) {
      const key = dedupeOn === "phone" && row.phone ? row.phone : row.email;
      if (!key) {
        afterFileDedup.push(row);
        continue;
      }
      if (seenInFile.has(key)) {
        fileDuplicates++;
        continue;
      }
      seenInFile.add(key);
      afterFileDedup.push(row);
    }

    // ── Déduplication CONTRE la base existante ───────────────────────────
    const emails = afterFileDedup.map((r) => r.email);
    const existingEmails = new Set<string>();
    const existingPhones = new Set<string>();
    for (let i = 0; i < emails.length; i += INSERT_CHUNK) {
      const chunk = emails.slice(i, i + INSERT_CHUNK);
      const { data } = await sb
        .from("leads")
        .select("email, phone")
        .eq("user_id", user.id)
        .in("email", chunk);
      for (const r of (data ?? []) as { email: string; phone: string | null }[]) {
        existingEmails.add(r.email.toLowerCase());
        if (r.phone) existingPhones.add(r.phone);
      }
    }

    const toInsert: typeof afterFileDedup = [];
    let dbDuplicates = 0;
    for (const row of afterFileDedup) {
      const isDup =
        existingEmails.has(row.email) || (dedupeOn === "phone" && !!row.phone && existingPhones.has(row.phone));
      if (isDup) {
        dbDuplicates++;
        continue;
      }
      toInsert.push(row);
    }

    // ── Résolution de la liste de destination ─────────────────────────────
    // Faite AVANT l'insertion : si le nom de liste est invalide, autant le
    // savoir avant d'avoir écrit 3 000 contacts qu'on ne saurait plus
    // regrouper.
    const insertErrors: string[] = [];
    let targetListId: string | null = null;
    let targetListName: string | null = null;
    if (listId || listName) {
      try {
        if (listId) {
          // La RLS filtre déjà sur le propriétaire : une liste d'un autre
          // compte ressort simplement introuvable.
          const { data: owned } = await sb
            .from("crm_lists")
            .select("id, name")
            .eq("id", listId)
            .eq("user_id", user.id)
            .maybeSingle();
          if (owned) {
            targetListId = (owned as { id: string }).id;
            targetListName = (owned as { name: string }).name;
            await sb
              .from("crm_lists")
              .update({ imported_at: new Date().toISOString() })
              .eq("user_id", user.id)
              .eq("id", targetListId);
          }
        } else {
          const list = await getOrCreateContactList(sb, user.id, listName, {
            origin: "import",
            sourceLabel,
          });
          targetListId = list.id;
          targetListName = list.name;
        }
      } catch (e) {
        // Un échec de classement ne doit pas annuler l'import : les contacts
        // sont la valeur, le rangement se rattrape à la main.
        insertErrors.push(
          `Classement dans la liste impossible : ${e instanceof Error ? e.message : "erreur inconnue"}`,
        );
      }
    }

    // ── Insertion par lots ────────────────────────────────────────────────
    let imported = 0;
    const insertedIds: string[] = [];
    for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
      const chunk = toInsert.slice(i, i + INSERT_CHUNK).map((r) => ({
        user_id: user.id,
        funnel_id: funnelId,
        email: r.email,
        name: r.name,
        first_name: r.first_name,
        last_name: r.last_name,
        phone: r.phone,
        // Le statut du fichier prime ; à défaut, celui choisi dans l'écran
        // d'import ; à défaut « nouveau ».
        status: r.status || defaultStatus,
        // Idem pour la source : la colonne du fichier prime, sinon le libellé
        // de provenance saisi, sinon « import ».
        source: r.source || sourceLabel || "import",
        custom_fields: r.custom_fields,
        consent: false,
      }));
      // `select("id")` : on a besoin des identifiants pour rattacher les
      // contacts à la liste juste après.
      const { data, error } = await sb.from("leads").insert(chunk).select("id");
      if (error) {
        insertErrors.push(error.message);
        continue;
      }
      const ids = (data ?? []).map((r: { id: string }) => r.id);
      insertedIds.push(...ids);
      imported += ids.length || chunk.length;
    }

    // ── Rattachement à la liste ───────────────────────────────────────────
    if (targetListId && insertedIds.length > 0) {
      try {
        for (let i = 0; i < insertedIds.length; i += INSERT_CHUNK) {
          await addContactsToLists(
            sb,
            user.id,
            insertedIds.slice(i, i + INSERT_CHUNK),
            [targetListId],
          );
        }
      } catch (e) {
        insertErrors.push(
          `Contacts importés mais non rattachés à la liste : ${e instanceof Error ? e.message : "erreur inconnue"}`,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      imported,
      duplicates: fileDuplicates + dbDuplicates,
      errors: [...buildErrors.map((e) => `Ligne ${e.row} : ${e.message}`), ...insertErrors].slice(0, 50),
      totalErrors: buildErrors.length + insertErrors.length,
      totalRows: rows.length,
      listId: targetListId,
      listName: targetListName,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "commit_failed" },
      { status: 500 },
    );
  }
}
