// lib/funnels/cta.ts
// Helpers partagés pour transformer une CtaConfig en attributs <a> sûrs
// Utilisé par : FunnelPreview, app/tunnel/[slug], lib/export/html
import type { CtaConfig } from "@/lib/funnels/types";

// URL safe-list. Refuse javascript:, data:, file:, etc.
export function isSafeUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (trimmed.startsWith("#") || trimmed.startsWith("/")) return true;
  try {
    const u = new URL(trimmed);
    return ["http:", "https:", "mailto:", "tel:"].includes(u.protocol);
  } catch {
    return false;
  }
}

// Détermine si une URL est absolue (http/https) → mérite par défaut _blank
function isAbsoluteHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

// Calcule l'attribut href en fonction du mode du CTA
export function ctaHref(cta?: CtaConfig | null): string {
  if (!cta) return "#lead-form";
  if (cta.mode === "anchor") {
    const id = (cta.anchorId ?? "lead-form").replace(/^#/, "");
    return `#${id}`;
  }
  if (cta.mode === "popup") {
    const id = (cta.popupId ?? "popup").replace(/^#/, "");
    return `#${id}`;
  }
  if (cta.mode === "redirect" && cta.url && isSafeUrl(cta.url)) {
    return cta.url;
  }
  // Fallback sûr : ancre vers le formulaire si l'URL est manquante ou douteuse
  return "#lead-form";
}

// Calcule l'attribut target en fonction du mode et de la préférence utilisateur
// CORRECTION : par défaut _blank pour les URLs absolues en mode redirect
// (avant, _self par défaut → clic restait sur la même page)
export function ctaTarget(cta?: CtaConfig | null): "_self" | "_blank" {
  if (!cta) return "_self";
  if (cta.mode !== "redirect") return "_self";
  if (cta.target === "_self") return "_self";
  if (cta.target === "_blank") return "_blank";
  // target non défini : on choisit en fonction du type d'URL
  if (cta.url && isAbsoluteHttpUrl(cta.url)) return "_blank";
  return "_self";
}

// Calcule l'attribut rel pour la sécurité des liens externes
export function ctaRel(cta?: CtaConfig | null): string | undefined {
  return ctaTarget(cta) === "_blank" ? "noopener noreferrer" : undefined;
}

// Détecte si le CTA pointe vers une URL externe (utile pour styliser un picto)
export function ctaIsExternal(cta?: CtaConfig | null): boolean {
  return Boolean(cta?.mode === "redirect" && cta?.url && isSafeUrl(cta.url));
}
