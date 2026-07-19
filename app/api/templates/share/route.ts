// app/api/templates/share/route.ts
// 🆕 Partager un tunnel dans la GALERIE COMMUNAUTAIRE (réservé aux abonnés).
import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApiAccess } from "@/lib/billing/apiGuard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sanitizeFunnelForSharing } from "@/lib/templates/shareable";

export const dynamic = "force-dynamic";

const schema = z.object({
  funnelId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(400).optional(),
  ownerName: z.string().min(1).max(80),
});

export async function POST(req: Request) {
  // Réservé aux abonnés (guardApiAccess → 402 si pas d'accès).
  const guard = await guardApiAccess();
  if (!guard.ok) return guard.response;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { funnelId, name, description, ownerName } = parsed.data;

  const admin = getSupabaseAdmin();
  const { data: funnel } = await admin
    .from("funnels")
    .select("user_id, json_content, language, funnel_type")
    .eq("id", funnelId)
    .maybeSingle();

  if (!funnel || funnel.user_id !== guard.userId) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const content = sanitizeFunnelForSharing(funnel.json_content);
  const kind =
    (content?.meta?.funnelKind as string | undefined) ??
    (funnel.funnel_type as string | null) ??
    null;

  const { data, error } = await admin
    .from("shared_templates")
    .insert({
      owner_id: guard.userId,
      owner_name: ownerName.trim().slice(0, 80),
      name: name.trim().slice(0, 120),
      description: description?.trim().slice(0, 400) || null,
      funnel_kind: kind,
      language: (funnel.language as string) ?? (content?.language as string) ?? "fr",
      content,
      status: "approved", // auto-approuvé + bouton « Signaler » côté galerie
    })
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "share_failed", message: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, id: data?.id });
}
