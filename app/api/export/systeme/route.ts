// app/api/export/systeme/route.ts
import { NextResponse } from "next/server";
import {
  createHtmlZipBase64,
  renderFunnelHtml,
  createSystemeBlocks,
  createSystemeFormBlock,
} from "@/lib/export/html";
import { demoFunnel } from "@/lib/funnels/demo";
import type { Funnel } from "@/lib/funnels/types";

// ─── GET : conservé pour la démo (utilise demoFunnel) ──────────────────────
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  const blockId = url.searchParams.get("blockId");

  if (mode === "full") {
    const html = renderFunnelHtml(demoFunnel);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": 'inline; filename="funnel-complet.html"',
      },
    });
  }

  if (mode === "block" && blockId) {
    const blocks = [...createSystemeBlocks(demoFunnel), createSystemeFormBlock(demoFunnel)];
    const block = blocks.find((b) => b.id === blockId);
    if (!block) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }
    return new NextResponse(block.html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const base64 = createHtmlZipBase64(demoFunnel);
  const bytes = Buffer.from(base64, "base64");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="funnelflow-export.zip"',
    },
  });
}

// ─── POST : appelé par SystemeIoExportMenu (côté client) ───────────────────
// Body attendu :
// {
//   funnel: Funnel,
//   mode: "full" | "block",
//   scope: "active" | "all",
//   targetPageId?: string,
// }
// Réponse : { html: string }
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      funnel: Funnel;
      mode: "full" | "block";
      scope: "active" | "all";
      targetPageId?: string;
    };

    const { funnel, mode, scope, targetPageId } = body;

    if (!funnel) {
      return NextResponse.json({ error: "Missing funnel" }, { status: 400 });
    }

    // ── Mode "full" + scope "all" : toutes les pages concaténées
    if (mode === "full" && scope === "all" && (funnel.pages?.length ?? 0) > 1) {
      const pages = funnel.pages ?? [];
      const html = pages
        .map((page, idx) => {
          const pageHtml = renderFunnelHtml(funnel, { targetPageId: page.id });
          const label = pageLabel(page);
          return `<!-- ═══════════════════════════════════════════════
  PAGE ${idx + 1}/${pages.length} : ${label}
  Slug : /${page.isHome ? "" : page.slug}
  ═══════════════════════════════════════════════ -->\n${pageHtml}`;
        })
        .join("\n\n");
      return NextResponse.json({ html });
    }

    // ── Mode "full" + scope "active" : page active uniquement
    if (mode === "full") {
      const html = renderFunnelHtml(funnel, { targetPageId });
      return NextResponse.json({ html });
    }

    // ── Mode "block" : sections de la page active + form
    const blocks = createSystemeBlocks(funnel, { targetPageId });
    const formBlock = createSystemeFormBlock(funnel);
    const all = [...blocks, formBlock];
    const html = all
      .map(
        (b, i) =>
          `<!-- ═══ Bloc ${i + 1}/${all.length} : ${b.label} (${b.type}) ═══ -->\n${b.html}`
      )
      .join("\n\n");
    return NextResponse.json({ html });
  } catch (err) {
    console.error("[/api/export/systeme] POST failed", err);
    return NextResponse.json(
      { error: "Export failed", details: String(err) },
      { status: 500 }
    );
  }
}

// ─── Helper local (dupliqué depuis le composant) ───────────────────────────
const PAGE_ROLE_LABELS: Record<string, string> = {
  optin: "Page de capture",
  sales: "Page de vente",
  thankyou: "Page de remerciement",
  delivery: "Page de livraison",
  confirmation: "Page de confirmation",
  upsell: "Page d'upsell",
  downsell: "Page de downsell",
  webinar: "Page webinaire",
  replay: "Page de replay",
  booking: "Page de réservation",
  reservation: "Page de réservation",
};

function pageLabel(page: { role?: string; isHome?: boolean; slug?: string }): string {
  if (page.role && PAGE_ROLE_LABELS[page.role]) return PAGE_ROLE_LABELS[page.role];
  if (page.isHome) return "Page d'accueil";
  return page.slug || "Page";
}
