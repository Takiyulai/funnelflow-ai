// app/api/leads/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getOrCreateTagsByName, assignTagsToContacts } from "@/lib/crm/tags";
import { runLeadCreatedWorkflows, runWorkflowsForEvent, semanticEventForSubmission } from "@/lib/workflows/engine";
import { dispatchDueEmailsNow } from "@/lib/crm/deliverScheduled";
import { rateLimit } from "@/lib/rate-limit";
import { recordAbConversion } from "@/lib/ab/serve";

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
  // 🆕 Tags CRM à appliquer automatiquement (configurés sur le formulaire).
  tags: z.array(z.string().max(60)).max(20).optional(),
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

// 🆕 La résolution du rôle de page + événement sémantique vit désormais dans
// lib/workflows/engine.ts (semanticEventForSubmission), avec le fallback
// tunnel webinaire — voir le commentaire là-bas.

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

  // 2. Rate-limit (par IP) — 🆕 distribué via Upstash (prod multi-instance),
  //    avec repli local en mémoire si Upstash n'est pas configuré (dev).
  const ip = getClientIp(request);
  const ipHash = hashIp(ip);
  const distributed = await rateLimit(`leads:${ipHash}`, RATE_MAX, 60);
  pruneRateMap();
  if (!distributed.ok || !checkRateLimit(ipHash)) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 }
    );
  }

  // 3. Résolution du funnel : d'abord par slug public (published_slug, celui
  //    servi aux visiteurs), sinon par slug brouillon (fallback).
  const admin = getSupabaseAdmin();
  let { data: funnel, error: funnelErr } = await admin
    .from("funnels")
    .select("id, user_id, status, language, published_content")
    .eq("published_slug", payload.funnelSlug)
    .maybeSingle();

  if (!funnel && !funnelErr) {
    const byDraft = await admin
      .from("funnels")
      .select("id, user_id, status, language, published_content")
      .eq("slug", payload.funnelSlug)
      .maybeSingle();
    funnel = byDraft.data;
    funnelErr = byDraft.error;
  }

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

  // 4bis. 🆕 MODULE 3 — Conversion A/B, si un test tourne sur la page où le
  //       formulaire a été soumis. Le test est indexé par ID de page, pas par
  //       slug : on résout donc l'un vers l'autre à partir du contenu publié.
  //       Non bloquant, comme tout ce qui suit l'insertion du lead.
  try {
    const content = funnel.published_content as {
      pages?: Array<{ id?: string; slug?: string; isHome?: boolean }>;
    } | null;
    const pages = content?.pages ?? [];
    const submittedPage = payload.pageSlug
      ? pages.find(
          (p) => p.slug === payload.pageSlug || p.slug === `/${payload.pageSlug}`,
        )
      : pages.find((p) => p.isHome) ?? pages[0];

    if (submittedPage?.id) {
      await recordAbConversion(funnel.id, funnel.user_id, submittedPage.id);
    }
  } catch (abErr) {
    console.warn("[api/leads] mesure A/B échouée (non bloquant):", abErr);
  }

  // 5. 🆕 Auto-tag : applique les tags configurés sur le formulaire (non bloquant).
  if (payload.tags && payload.tags.length > 0) {
    try {
      const tags = await getOrCreateTagsByName(admin, funnel.user_id, payload.tags);
      if (tags.length > 0) {
        await assignTagsToContacts(
          admin,
          funnel.user_id,
          [lead.id],
          tags.map((t) => t.id),
        );
      }
    } catch (tagErr) {
      console.warn("[api/leads] auto-tag échoué (non bloquant):", tagErr);
    }
  }

  // 6. 🆕 Workflows : exécute les automatisations actives déclenchées par la
  //    capture d'un lead (tags, statut, emails différés, notif propriétaire).
  //    NON bloquant : toute erreur est avalée pour ne jamais perdre le lead.
  try {
    await runLeadCreatedWorkflows({
      admin,
      userId: funnel.user_id,
      funnelId: funnel.id,
      lead: {
        id: lead.id,
        email: payload.email.toLowerCase().trim(),
        name: payload.name?.trim() || null,
      },
    });
  } catch (wfErr) {
    console.warn("[api/leads] workflows échoués (non bloquant):", wfErr);
  }

  // 6bis. 🆕 LOT 4/7/8 — Événement SÉMANTIQUE en plus de lead.created, selon le
  //       rôle de la page (inscription webinaire, RDV, candidature coaching).
  //       Best-effort, jamais bloquant pour la capture du lead.
  try {
    // 🔒 CORRECTIF — semanticEventForSubmission inclut le FALLBACK webinaire :
    // une soumission depuis la landing (ou sans pageSlug) d'un tunnel webinaire
    // déclenche bien `webinar.registered` (avant : jamais déclenché, car le
    // formulaire est sur la page `landing`, pas sur une page `registration`).
    const semanticEvent = semanticEventForSubmission(
      funnel.published_content,
      payload.pageSlug,
    );
    if (semanticEvent) {
      await runWorkflowsForEvent(admin, funnel.user_id, {
        event: semanticEvent,
        lead: {
          id: lead.id,
          email: payload.email.toLowerCase().trim(),
          name: payload.name?.trim() || null,
        },
        funnelId: funnel.id,
      });
    }
  } catch (wfErr) {
    console.warn("[api/leads] événement sémantique échoué (non bloquant):", wfErr);
  }

  // 🆕 L'« email de livraison » du tunnel a été RETIRÉ : tout l'emailing est
  //    désormais centralisé dans l'onglet Emails (séquences / campagnes /
  //    workflows). Pour livrer un cadeau à l'inscription, on branche un workflow
  //    « Nouveau lead » → « Inscrire dans une séquence » sur le tunnel concerné.

  // 7. 🔒 CORRECTIF EMAILS — ENVOI IMMÉDIAT : les workflows ci-dessus viennent
  //    de déposer les emails « instantanés » (délai 0) dans la file
  //    `scheduled_emails`. On les envoie TOUT DE SUITE au lieu d'attendre le
  //    prochain passage du cron (1×/jour sur Vercel Hobby → les emails de
  //    bienvenue semblaient ne jamais partir). Non bloquant, anti double envoi
  //    (claim atomique partagé avec le cron).
  await dispatchDueEmailsNow(funnel.user_id);

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
