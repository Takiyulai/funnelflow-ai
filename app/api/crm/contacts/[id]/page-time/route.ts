// Synthèse du temps actif d'un contact. Accès protégé côté serveur par le plan
// et par la propriété du contact ; aucun simple masquage d'interface.

import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApiAccess, featureBlockedResponse } from "@/lib/billing/apiGuard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  buildPublishedPageRoleLookup,
  getPublishedPageRole,
  isPostConversionPageRole,
} from "@/lib/funnels/publishedPageRoles";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

type SessionRow = {
  funnel_id: string;
  page_slug: string | null;
  session_id: string;
  active_ms: number | string;
  last_seen_at: string;
};

type FunnelPublishedPagesRow = {
  id: string;
  pages: unknown;
};

function safeMilliseconds(value: number | string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardApiAccess();
  if (!guard.ok) return guard.response;
  if (!guard.access.limits.pageTimeTracking) {
    return featureBlockedResponse("pageTimeTracking");
  }

  const parsedId = idSchema.safeParse((await params).id);
  if (!parsedId.success) {
    return NextResponse.json({ ok: false, error: "invalid_contact" }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: contact, error: contactError } = await admin
      .from("leads")
      .select("id")
      .eq("id", parsedId.data)
      .eq("user_id", guard.userId)
      .maybeSingle();
    if (contactError) throw contactError;
    if (!contact) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const { data, error } = await admin
      .from("funnel_page_sessions")
      .select("funnel_id, page_slug, session_id, active_ms, last_seen_at")
      .eq("user_id", guard.userId)
      .eq("contact_id", contact.id)
      .order("last_seen_at", { ascending: false });
    if (error) throw error;

    const rows = (data ?? []) as SessionRow[];
    const funnelIds = [...new Set(rows.map((row) => row.funnel_id))];
    const { data: funnelPageRows, error: funnelPagesError } = funnelIds.length
      ? await admin
          .from("funnels")
          // Le rôle vient du snapshot publié. La projection JSON évite de relire
          // les sections et médias lourds dont cette agrégation n'a pas besoin.
          .select("id, pages:published_content->pages")
          .eq("user_id", guard.userId)
          .in("id", funnelIds)
      : { data: [], error: null };
    if (funnelPagesError) throw funnelPagesError;

    const pageRoles = buildPublishedPageRoleLookup(
      (funnelPageRows ?? []) as FunnelPublishedPagesRow[],
    );
    const allSessions = new Set<string>();
    const byPage = new Map<
      string,
      { activeMs: number; sessionIds: Set<string>; lastSeenAt: string | null }
    >();
    let engagementActiveMs = 0;
    let postConversionActiveMs = 0;
    let lastSeenAt: string | null = null;

    for (const row of rows) {
      const activeMs = safeMilliseconds(row.active_ms);
      const pageSlug = row.page_slug?.trim() || "";
      const page = byPage.get(pageSlug) ?? {
        activeMs: 0,
        sessionIds: new Set<string>(),
        lastSeenAt: null,
      };
      page.activeMs += activeMs;
      page.sessionIds.add(row.session_id);
      if (!page.lastSeenAt || row.last_seen_at > page.lastSeenAt) {
        page.lastSeenAt = row.last_seen_at;
      }
      byPage.set(pageSlug, page);
      allSessions.add(row.session_id);
      const role = getPublishedPageRole(pageRoles, row.funnel_id, pageSlug);
      if (isPostConversionPageRole(role)) {
        postConversionActiveMs += activeMs;
      } else {
        engagementActiveMs += activeMs;
      }
      if (!lastSeenAt || row.last_seen_at > lastSeenAt) lastSeenAt = row.last_seen_at;
    }

    const pages = [...byPage.entries()]
      .map(([pageSlug, page]) => ({
        pageSlug,
        activeMs: page.activeMs,
        sessionCount: page.sessionIds.size,
        lastSeenAt: page.lastSeenAt,
      }))
      .sort((left, right) =>
        (right.lastSeenAt ?? "").localeCompare(left.lastSeenAt ?? ""),
      );

    return NextResponse.json({
      ok: true,
      summary: {
        engagementActiveMs,
        postConversionActiveMs,
        sessionCount: allSessions.size,
        lastSeenAt,
        pages,
      },
    });
  } catch (error) {
    console.error("[crm/contact/page-time] lecture échouée", error);
    return NextResponse.json(
      { ok: false, error: "tracking_unavailable" },
      { status: 503 },
    );
  }
}
