/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/templates/[id]/use/route.ts
// 🆕 « Utiliser ce modèle » : clone le contenu du modèle communautaire dans un
// NOUVEAU tunnel (brouillon) de l'utilisateur, puis renvoie son id pour ouvrir
// l'éditeur. Incrémente le compteur d'utilisations du modèle.
import { NextResponse } from "next/server";
import { guardApiAccess } from "@/lib/billing/apiGuard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function slugify(s: string): string {
  return (s || "modele")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "modele";
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardApiAccess();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const admin = getSupabaseAdmin();
  const { data: tpl } = await admin
    .from("shared_templates")
    .select("id, name, content, funnel_kind, language, usage_count, status")
    .eq("id", id)
    .maybeSingle();

  if (!tpl || tpl.status !== "approved") {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const content: any = tpl.content ?? {};
  content.funnelName = tpl.name;
  if (content.meta && typeof content.meta === "object") {
    content.meta.creationMode = "template";
  }

  const newId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `tpl_${Date.now()}`;
  const slug = `${slugify(tpl.name)}-${Math.random().toString(36).slice(2, 6)}`;

  const { error } = await admin.from("funnels").insert({
    id: newId,
    user_id: guard.userId,
    name: tpl.name,
    slug,
    language: (tpl.language as string) ?? "fr",
    funnel_type: (tpl.funnel_kind as string) ?? null,
    json_content: content,
    default_cta: content.defaultCta ?? null,
    status: "draft",
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "use_failed", message: error.message },
      { status: 500 },
    );
  }

  // Incrément best-effort du compteur d'utilisations.
  await admin
    .from("shared_templates")
    .update({ usage_count: (tpl.usage_count ?? 0) + 1 })
    .eq("id", id);

  return NextResponse.json({ ok: true, funnelId: newId });
}
