// Temps actif par page pour les prospects DÉJÀ identifiés uniquement.
// Endpoint silencieux et best-effort : il ne doit jamais gêner la navigation.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_SESSION_PAGE_MS = 30 * 24 * 60 * 60 * 1000;

const bodySchema = z.object({
  funnelSlug: z.string().min(1).max(100),
  pageSlug: z.string().max(100).nullable().optional(),
  contactId: z.string().uuid(),
  sessionId: z.string().uuid(),
  // Total cumulatif déclaré pour cette session/page. La fonction SQL limite
  // chaque progression par rapport à la valeur déjà stockée à 60 secondes.
  activeMs: z.number().int().min(1).max(MAX_SESSION_PAGE_MS),
});

type PublishedPage = {
  slug?: unknown;
  isHome?: unknown;
};

function normalizeSlug(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/^\/+|\/+$/g, "") : "";
}

/** Retourne le slug canonique publié, ou null si la page demandée n'existe pas. */
function resolvePublishedPageSlug(
  publishedContent: unknown,
  requestedSlug: string | null | undefined,
): string | null {
  const content =
    publishedContent && typeof publishedContent === "object"
      ? (publishedContent as { pages?: unknown })
      : null;
  const pages = Array.isArray(content?.pages)
    ? (content.pages as PublishedPage[])
    : [];
  const requested = normalizeSlug(requestedSlug);

  // Ancien funnel mono-page : seule la page racine est valide.
  if (pages.length === 0) return requested ? null : "";

  const page = requested
    ? pages.find((candidate) => normalizeSlug(candidate.slug) === requested)
    : pages.find((candidate) => candidate.isHome === true) ?? pages[0];
  return page ? normalizeSlug(page.slug) : null;
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Plusieurs événements naturels peuvent arriver ensemble (visibilitychange +
  // pagehide). La limite reste assez haute pour quelques onglets légitimes, mais
  // borne les rafales visant à gonfler artificiellement la durée d'un contact.
  const limited = await rateLimit(`page-time:${parsed.data.contactId}`, 30, 60);
  if (!limited.ok) return NextResponse.json({ ok: true });

  try {
    const admin = getSupabaseAdmin();
    let { data: funnel, error: funnelError } = await admin
      .from("funnels")
      .select("id, user_id, published_content")
      .eq("published_slug", parsed.data.funnelSlug)
      .eq("status", "published")
      .maybeSingle();

    if (!funnel && !funnelError) {
      const fallback = await admin
        .from("funnels")
        .select("id, user_id, published_content")
        .eq("slug", parsed.data.funnelSlug)
        .eq("status", "published")
        .maybeSingle();
      funnel = fallback.data;
      funnelError = fallback.error;
    }

    if (funnelError) throw funnelError;
    if (!funnel) return NextResponse.json({ ok: true });

    const pageSlug = resolvePublishedPageSlug(
      funnel.published_content,
      parsed.data.pageSlug,
    );
    if (pageSlug === null) return NextResponse.json({ ok: true });

    // Le contact doit appartenir au propriétaire du funnel. Un UUID présent
    // dans localStorage n'est jamais considéré comme une preuve suffisante.
    const { data: contact, error: contactError } = await admin
      .from("leads")
      .select("id")
      .eq("id", parsed.data.contactId)
      .eq("user_id", funnel.user_id)
      .maybeSingle();
    if (contactError) throw contactError;
    if (!contact) return NextResponse.json({ ok: true });

    // La fonction SQL effectue l'addition atomique et répète les contrôles de
    // propriété. Le client ne peut ni écrire directement la table, ni fournir
    // funnel_id/user_id.
    const { error: incrementError } = await admin.rpc(
      "increment_funnel_page_session",
      {
        p_funnel_id: funnel.id,
        p_user_id: funnel.user_id,
        p_page_slug: pageSlug,
        p_contact_id: contact.id,
        p_session_id: parsed.data.sessionId,
        p_active_ms: parsed.data.activeMs,
      },
    );
    if (incrementError) throw incrementError;
  } catch (error) {
    // Aucun détail technique n'est renvoyé au navigateur. Avant application de
    // la migration, cette route échoue ici sans casser la page publiée.
    console.warn("[track/page-time] enregistrement échoué (non bloquant):", error);
  }

  return NextResponse.json({ ok: true });
}
