// app/api/leads/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// ─── Schéma de validation ─────────────────────────────────────────────
const leadSchema = z.object({
  funnelSlug: z.string().min(1).max(100),
  pageSlug: z.string().max(100).optional().nullable(),
  sectionId: z.string().max(100).optional().nullable(),
  // Champs lead
  email: z.string().email().max(255),
  name: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  consent: z.boolean().optional().default(false),
  // Métadonnées arbitraires (autres champs du formulaire)
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

// ─── Anti-spam léger : rate-limit en mémoire ──────────────────────────
// (à upgrader vers Upstash/Redis en prod multi-instance)
const RATE_WINDOW_MS = 60_000; // 1 min
const RATE_MAX = 5; // 5 leads max / min / IP
const rateMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ipHash: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ipHash);
  if (!entry || entry.resetAt < now) {
    rateMap.set(ipHash, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_MAX) return false;
  entry.count++;
  return true;
}

// Nettoyage périodique léger pour éviter la fuite mémoire
function pruneRateMap() {
  const now = Date.now();
  for (const [k, v] of rateMap.entries()) {
    if (v.resetAt < now) rateMap.delete(k);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────
function hashIp(ip: string): string {
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 16) ?? "ff-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

// ─── POST /api/leads ──────────────────────────────────────────────────
export async function POST(request: Request) {
  // 1. Parse + validation
  let payload: z.infer<typeof leadSchema>;
  try {
    const body = await request.json();
    payload = leadSchema.parse(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "validation", details: err.flatten() },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // 2. Rate-limit
  pruneRateMap();
  const ip = getClientIp(request);
  const ipHash = hashIp(ip);
  if (!checkRateLimit(ipHash)) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 }
    );
  }

  // 3. Résolution du funnel par slug
  const admin = getSupabaseAdmin();
  const { data: funnel, error: funnelErr } = await admin
    .from("funnels")
    .select("id, user_id, status, language")
    .eq("slug", payload.funnelSlug)
    .maybeSingle();

  if (funnelErr) {
    console.error("[api/leads] funnel lookup error", funnelErr);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }

  if (!funnel) {
    return NextResponse.json(
      { ok: false, error: "funnel_not_found" },
      { status: 404 }
    );
  }

  if (funnel.status !== "published") {
    return NextResponse.json(
      { ok: false, error: "funnel_not_published" },
      { status: 403 }
    );
  }

  // 4. Insertion du lead
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

  const { data: lead, error: insertErr } = await admin
    .from("leads")
    .insert({
      funnel_id: funnel.id,
      user_id: funnel.user_id,
      email: payload.email.toLowerCase().trim(),
      name: payload.name?.trim() || null,
      phone: payload.phone?.trim() || null,
      status: "nouveau",
      source: "funnel_form",
      page_slug: payload.pageSlug || null,
      section_id: payload.sectionId || null,
      consent: payload.consent ?? false,
      ip_hash: ipHash,
      user_agent: userAgent,
      language: funnel.language ?? null,
      metadata: payload.metadata ?? {},
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("[api/leads] insert error", insertErr);
    return NextResponse.json({ ok: false, error: "db_insert_error" }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      leadId: lead.id,
    },
    { status: 201 }
  );
}

// ─── Méthodes non autorisées ──────────────────────────────────────────
export async function GET() {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
