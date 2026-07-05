import type { Funnel, FunnelSection } from "@/lib/funnels/types";

// Injecte les données du tunnel (héros) dans le HTML de démo d'un template
// bespoke : titre (h1), sous-titre (premier <p> après le h1) et libellé du CTA
// principal. Fallback = contenu de démo si le champ est absent. Le reste du
// design conserve son contenu par défaut.

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function strip(s: string): string {
  return s.replace(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g, "$1").trim();
}

function heroOf(funnel?: Funnel): FunnelSection | undefined {
  if (!funnel) return undefined;
  let sections: FunnelSection[] = [];
  if (Array.isArray(funnel.pages) && funnel.pages.length > 0) {
    const home = funnel.pages.find((p) => p.isHome) ?? funnel.pages[0];
    sections = home?.sections ?? [];
  } else {
    sections = funnel.sections ?? [];
  }
  return sections.find((s) => s.type === "hero") ?? sections[0];
}

export function bindTemplateData(html: string, funnel?: Funnel): string {
  const hero = heroOf(funnel);
  if (!hero) return html;
  let out = html;

  const headline = hero.headline ? strip(hero.headline) : "";
  const sub = hero.subheadline ? strip(hero.subheadline) : "";
  const ctaLabel = hero.cta?.label ? strip(hero.cta.label) : "";

  if (headline) {
    out = out.replace(/(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/, (_m, a, b) => a + esc(headline) + b);
  }
  if (sub) {
    const h1end = out.indexOf("</h1>");
    if (h1end >= 0) {
      const head = out.slice(0, h1end);
      const rest = out.slice(h1end).replace(/(<p\b[^>]*>)[\s\S]*?(<\/p>)/, (_m, a, b) => a + esc(sub) + b);
      out = head + rest;
    }
  }
  if (ctaLabel) {
    out = out.replace(
      /(<a\b[^>]*class="[^"]*af-cta[^"]*"[^>]*>)[\s\S]*?(<\/a>)/,
      (_m, a, b) => a + esc(ctaLabel) + b,
    );
  }
  return out;
}
