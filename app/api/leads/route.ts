// app/api/leads/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getOrCreateTagsByName, assignTagsToContacts } from "@/lib/crm/tags";
import { addContactsToLists } from "@/lib/crm/lists";
import { runLeadCreatedWorkflows, runWorkflowsForEvent, semanticEventForSubmission } from "@/lib/workflows/engine";
import { dispatchDueEmailsNow } from "@/lib/crm/deliverScheduled";
import { rateLimit } from "@/lib/rate-limit";
import { recordAbConversion } from "@/lib/ab/serve";

// ─── Schéma de validation ─────────────────────────────────────────────
const leadSchema = z.object({
  funnelSlug: z.string().min(1).max(100),
  pageSlug: z.string().max(100).optional().nullable(),
  sectionId: z.string().max(100).optional().nullable(),
  // Identifiant du CTA raw HTML servant uniquement à retrouver son patch dans
  // le snapshot publié. Ce n'est jamais un identifiant de liste.
  popupId: z.string().max(100).optional().nullable(),
  // Champs lead
  email: z.string().email().max(255),
  name: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  consent: z.boolean().optional().default(false),
  // Compatibilité avec les runtimes existants. Ces noms sont recoupés avec la
  // configuration publiée côté serveur et ne sont jamais une source de vérité.
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

type PublishedCaptureSection = {
  id?: unknown;
  formConfig?: {
    captureTags?: unknown;
    captureListIds?: unknown;
  } | null;
  cta?: {
    mode?: unknown;
    captureTags?: unknown;
    captureListIds?: unknown;
    ignoreGlobalCta?: unknown;
  } | null;
  rawHtmlPatches?: {
    links?: Record<
      string,
      {
        action?: unknown;
        popup?: {
          captureTags?: unknown;
          captureListIds?: unknown;
        } | null;
      } | undefined
    >;
  } | null;
};

type PublishedCapturePage = {
  slug?: unknown;
  isHome?: unknown;
  sections?: unknown;
};

type PublishedCaptureContent = {
  pages?: unknown;
  sections?: unknown;
  defaultCta?: {
    mode?: unknown;
    captureTags?: unknown;
    captureListIds?: unknown;
  } | null;
  meta?: {
    applyDefaultCtaToAll?: unknown;
  } | null;
};

type CaptureSettings = {
  tags: string[];
  listIds: string[];
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanStrings(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const clean = item.trim().slice(0, maxLength);
    if (!clean) continue;
    unique.set(clean.toLowerCase(), clean);
    if (unique.size >= maxItems) break;
  }
  return [...unique.values()];
}

function normalizePageSlug(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/^\/+|\/+$/g, "") : "";
}

/**
 * Résout les automatisations de capture depuis le contenu PUBLIÉ uniquement.
 * Les tags envoyés par les anciens runtimes servent au plus à sélectionner un
 * popup cloné parmi ceux autorisés dans la section ; aucun ID de liste visiteur
 * n'est lu ici.
 */
function resolveCaptureSettings(
  contentValue: unknown,
  pageSlug: string | null | undefined,
  sectionId: string | null | undefined,
  requestedTags: string[] | undefined,
  popupId: string | null | undefined,
): CaptureSettings {
  if (!contentValue || typeof contentValue !== "object" || !sectionId) {
    return { tags: [], listIds: [] };
  }

  const content = contentValue as PublishedCaptureContent;
  const pages = Array.isArray(content.pages)
    ? (content.pages as PublishedCapturePage[])
    : [];
  const normalizedSlug = normalizePageSlug(pageSlug);
  const page = normalizedSlug
    ? pages.find((candidate) => normalizePageSlug(candidate.slug) === normalizedSlug)
    : pages.find((candidate) => candidate.isHome === true) ?? pages[0];
  const sectionValues = page
    ? page.sections
    : pages.length === 0
      ? content.sections
      : undefined;
  const sections = Array.isArray(sectionValues)
    ? (sectionValues as PublishedCaptureSection[])
    : [];
  const section = sections.find((candidate) => candidate.id === sectionId);
  if (!section) return { tags: [], listIds: [] };

  const localCta = section.cta;
  // Même périmètre que CtaLink : l'action commune ne s'applique qu'au CTA
  // principal de la page d'accueil, si le funnel l'a activée et si ce CTA ne
  // porte pas son opt-out individuel. Pour les anciens funnels mono-page sans
  // pages[], la section racine est assimilée à l'accueil comme côté client.
  const isHomePage = page ? page.isHome === true : pages.length <= 1;
  const globalCta = content.defaultCta;
  const useGlobalCta =
    isHomePage &&
    content.meta?.applyDefaultCtaToAll === true &&
    localCta?.ignoreGlobalCta !== true &&
    Boolean(globalCta?.mode);

  // Une configuration de capture explicitement posée sur le CTA local reste
  // prioritaire, propriété par propriété. Sinon, le CTA global fournit le
  // fallback correspondant. Un tableau vide explicite permet donc aussi de
  // désactiver les tags ou listes pour ce CTA précis.
  const effectiveCta = useGlobalCta
    ? {
        mode: globalCta?.mode,
        captureTags: Array.isArray(localCta?.captureTags)
          ? localCta?.captureTags
          : globalCta?.captureTags,
        captureListIds: Array.isArray(localCta?.captureListIds)
          ? localCta?.captureListIds
          : globalCta?.captureListIds,
      }
    : localCta;
  const directCta = effectiveCta?.mode === "popup" ? effectiveCta : null;
  const directTags = cleanStrings(
    [
      ...cleanStrings(section.formConfig?.captureTags, 20, 60),
      ...cleanStrings(directCta?.captureTags, 20, 60),
    ],
    20,
    60,
  );

  const rawLinks = section.rawHtmlPatches?.links ?? {};
  const rawPatch = popupId ? rawLinks[popupId] : undefined;
  const exactRawPopup = rawPatch?.action === "popup" ? rawPatch.popup : null;

  // Les runtimes récents indiquent le spot raw HTML, puis le serveur lit son
  // patch publié. Pour les anciens runtimes sans popupId, on conserve seulement
  // le fallback historique des tags autorisés ; aucune liste n'est résolue à
  // partir d'un identifiant fourni par le visiteur.
  const rawTags = exactRawPopup
    ? cleanStrings(exactRawPopup.captureTags, 20, 60)
    : (() => {
        const allowedTags = Object.values(rawLinks).flatMap((patch) =>
          cleanStrings(patch?.popup?.captureTags, 20, 60),
        );
        const allowedByName = new Map(
          allowedTags.map((tag) => [tag.toLowerCase(), tag]),
        );
        return cleanStrings(requestedTags, 20, 60)
          .map((tag) => allowedByName.get(tag.toLowerCase()))
          .filter((tag): tag is string => Boolean(tag));
      })();
  const tags = cleanStrings([...directTags, ...rawTags], 20, 60);

  const listIds = cleanStrings(
    [
      ...cleanStrings(section.formConfig?.captureListIds, 30, 64),
      ...cleanStrings(directCta?.captureListIds, 30, 64),
      ...cleanStrings(exactRawPopup?.captureListIds, 30, 64),
    ],
    30,
    64,
  ).filter((id) => UUID_PATTERN.test(id));

  return { tags, listIds };
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
      console.warn("[api/leads] payload validation failed", err.issues);
      return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
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

  // Le visiteur ne décide ni des tags ni des listes. La section du contenu
  // publié est la seule source de vérité ; `payload.tags` n'est qu'un indice
  // rétrocompatible pour distinguer les popups clonés d'une même section.
  const captureSettings = resolveCaptureSettings(
    funnel.published_content,
    payload.pageSlug,
    payload.sectionId,
    payload.tags,
    payload.popupId,
  );

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

  // 5. Auto-tag : applique les tags de la section publiée (non bloquant).
  if (captureSettings.tags.length > 0) {
    try {
      const tags = await getOrCreateTagsByName(admin, funnel.user_id, captureSettings.tags);
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

  // 5bis. Assignation aux listes du formulaire publié. Le client admin contourne
  // la RLS : on vérifie donc explicitement que chaque clé étrangère appartient
  // bien au propriétaire du funnel AVANT l'upsert N-N. Best-effort : le lead est
  // déjà sauvegardé et ne doit jamais être perdu si cette étape échoue.
  if (captureSettings.listIds.length > 0) {
    try {
      const { data: ownedLists, error: ownedListsError } = await admin
        .from("crm_lists")
        .select("id")
        .eq("user_id", funnel.user_id)
        .in("id", captureSettings.listIds);
      if (ownedListsError) throw ownedListsError;

      const ownedListIds = (ownedLists ?? [])
        .map((list: { id?: unknown }) => list.id)
        .filter((id): id is string => typeof id === "string");
      if (ownedListIds.length !== captureSettings.listIds.length) {
        console.warn(
          `[api/leads] certaines listes configurées sont absentes ou n'appartiennent pas au funnel owner (${ownedListIds.length}/${captureSettings.listIds.length})`,
        );
      }
      if (ownedListIds.length > 0) {
        await addContactsToLists(admin, funnel.user_id, [lead.id], ownedListIds);
      }
    } catch (listErr) {
      console.warn("[api/leads] assignation aux listes échouée (non bloquant):", listErr);
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
