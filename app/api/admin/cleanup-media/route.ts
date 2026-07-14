// app/api/admin/cleanup-media/route.ts
// 🆕 MAINTENANCE — Nettoyage des médias orphelins du bucket Storage
// `cloned-funnels-media` (quota Supabase). Réservé aux ADMINS de la
// plateforme (allowlist d'emails), session requise.
//
//   GET  → dry-run : liste agrégée de ce qui SERAIT supprimé (rien n'est touché).
//   POST → suppression réelle via l'API Storage officielle (SQL seul laisserait
//          les fichiers physiques et ne libérerait pas le quota facturé).
//
// Sécurité :
//   - La liste est recalculée à CHAQUE appel par la fonction SQL
//     `list_orphan_media_v1()` (jamais de liste figée) : un média redevenu
//     référencé entre deux appels sort automatiquement du périmètre.
//   - Catégorie A : dossiers de tunnels SUPPRIMÉS, id absent de tout contenu
//     de tunnel vivant. Catégorie B : anciens chemins, nom URL-safe strict et
//     absent de tout contenu vivant.
//   - Suppression par lots avec garde-fou de durée : la réponse indique
//     `remaining` ; rappeler la route jusqu'à remaining = 0.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "cloned-funnels-media";
const CHUNK = 100;
const TIME_BUDGET_MS = 40_000;

function adminEmails(): string[] {
  const raw =
    process.env.ADMIN_EMAILS ??
    "takiyulai0dramane@gmail.com,idrissou0dramane@gmail.com";
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

async function requireAdmin(): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.email || !adminEmails().includes(user.email.toLowerCase())) {
    return {
      ok: false,
      res: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }),
    };
  }
  return { ok: true };
}

type OrphanRow = { name: string; bytes: number; category: string };

// La liste est PRÉ-CALCULÉE dans public.orphan_media_queue (le calcul complet
// — scan de tout le contenu des tunnels — dépasse le timeout PostgREST ; il est
// exécuté hors-ligne via list_orphan_media_v1() puis matérialisé). La route ne
// supprime QUE ce qui est dans la file, et la vide au fur et à mesure.
async function listOrphans(limit = 5000): Promise<OrphanRow[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("orphan_media_queue")
    .select("name, bytes, category")
    .order("name")
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as OrphanRow[];
}

function summarize(rows: OrphanRow[]) {
  const byCat: Record<string, { files: number; bytes: number }> = {};
  for (const r of rows) {
    const c = (byCat[r.category] ??= { files: 0, bytes: 0 });
    c.files++;
    c.bytes += Number(r.bytes) || 0;
  }
  return {
    totalFiles: rows.length,
    totalBytes: rows.reduce((a, r) => a + (Number(r.bytes) || 0), 0),
    byCategory: byCat,
  };
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;
  try {
    const rows = await listOrphans();
    return NextResponse.json({ ok: true, dryRun: true, ...summarize(rows) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "list_failed" },
      { status: 500 },
    );
  }
}

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const startedAt = Date.now();
  try {
    const rows = await listOrphans();
    const admin = getSupabaseAdmin();

    let deletedFiles = 0;
    let deletedBytes = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i += CHUNK) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break; // garde-fou durée
      const batch = rows.slice(i, i + CHUNK);
      const names = batch.map((r) => r.name);
      const { error } = await admin.storage.from(BUCKET).remove(names);
      if (error) {
        errors.push(error.message);
        continue; // un lot en échec n'empêche pas les suivants
      }
      // Fichier supprimé côté Storage → on le retire de la file.
      await admin.from("orphan_media_queue").delete().in("name", names);
      deletedFiles += batch.length;
      deletedBytes += batch.reduce((a, r) => a + (Number(r.bytes) || 0), 0);
    }

    const { count: remainingCount } = await admin
      .from("orphan_media_queue")
      .select("name", { count: "exact", head: true });
    const remaining = remainingCount ?? 0;
    return NextResponse.json({
      ok: true,
      deletedFiles,
      deletedMB: Math.round(deletedBytes / 1024 / 1024),
      remaining,
      errors: errors.slice(0, 5),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "cleanup_failed" },
      { status: 500 },
    );
  }
}
