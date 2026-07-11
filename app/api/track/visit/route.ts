// app/api/track/visit/route.ts
// 🆕 VAGUE 1 / LOT 2 — Comptage ANONYME des visites de pages sur les tunnels
// PUBLIÉS (analytics v1). Zéro donnée personnelle : ni IP ni user-agent
// stockés ; `visitorId` est un UUID aléatoire localStorage sans lien avec une
// identité. Silencieux et best-effort : ne doit JAMAIS impacter la page
// publiée (toute erreur renvoie { ok: true }).
import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  funnelSlug: z.string().min(1).max(100),
  pageSlug: z.string().max(100).nullable().optional(),
  visitorId: z.string().min(8).max(64),
  referrerHost: z.string().max(255).nullable().optional(),
  utmSource: z.string().max(120).nullable().optional(),
  utmMedium: z.string().max(120).nullable().optional(),
  utmCampaign: z.string().max(120).nullable().optional(),
});

// Bots/crawlers connus : ignorés (le user-agent sert au filtre, PAS stocké).
const BOT_UA =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|headless|lighthouse|pingdom|uptimerobot|vercel-screenshot/i;

const silentOk = () => NextResponse.json({ ok: true });

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const ua = request.headers.get("user-agent") ?? "";
  if (BOT_UA.test(ua)) return silentOk();

  // Rate-limit généreux par IP. L'IP n'est jamais stockée : seulement hachée
  // (salée) pour la clé de fenêtre de limitation, comme /api/leads.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 16) ?? "ff-salt";
  const ipHash = createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
  try {
    const limited = await rateLimit(`visit:${ipHash}`, 120, 60);
    if (!limited.ok) return silentOk();
  } catch {
    /* rate-limit indisponible → on laisse passer (best-effort) */
  }

  try {
    const admin = getSupabaseAdmin();
    let { data: funnel } = await admin
      .from("funnels")
      .select("id, user_id, status")
      .eq("published_slug", parsed.data.funnelSlug)
      .maybeSingle();
    if (!funnel) {
      const byDraft = await admin
        .from("funnels")
        .select("id, user_id, status")
        .eq("slug", parsed.data.funnelSlug)
        .maybeSingle();
      funnel = byDraft.data;
    }
    // On ne compte que les tunnels réellement publiés.
    if (!funnel || funnel.status !== "published") return silentOk();

    await admin.from("funnel_visits").insert({
      funnel_id: funnel.id,
      user_id: funnel.user_id,
      page_slug: parsed.data.pageSlug || null,
      visitor_id: parsed.data.visitorId,
      referrer_host: parsed.data.referrerHost || null,
      utm_source: parsed.data.utmSource || null,
      utm_medium: parsed.data.utmMedium || null,
      utm_campaign: parsed.data.utmCampaign || null,
    });
  } catch {
    // Best-effort : table absente (migration non exécutée) ou erreur DB →
    // aucune erreur exposée à la page publique.
  }
  return silentOk();
}
