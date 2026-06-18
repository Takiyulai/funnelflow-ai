// lib/clone/feature-modules.ts
//
// 🆕 Phase 1C — Système EXTENSIBLE de "modules de features" pour le clonage.
//
// Problème : stripNoise retire les <script> source, donc les comportements
// dynamiques (FAQ, bouton flottant, timers, header sticky…) meurent. On
// reconstruit un système où :
//   - DÉTECTEUR : `detect(html)` repère la présence d'une feature dans le HTML.
//   - INJECTEUR : `css(ctx)` / `script(ctx)` réinjectés au rendu (iframe éditeur,
//     aperçu, publication) pour restaurer le rendu/comportement.
//
// Ajouter une feature = ajouter un objet `FeatureModule` au tableau
// `FEATURE_MODULES`. Rien d'autre à modifier.

export interface FeatureRuntimeCtx {
  /** true = iframe d'édition (clics neutralisés, FAQ révélées), false = public. */
  editMode: boolean;
}

export interface FeatureModule {
  id: string;
  label: string;
  /** Détecte la présence de la feature dans le HTML source de la section. */
  detect: (html: string) => boolean;
  /** CSS à injecter dans le <head> de l'iframe (optionnel). */
  css?: (ctx: FeatureRuntimeCtx) => string;
  /** <script> à injecter en fin de <body> de l'iframe (optionnel). */
  script?: (ctx: FeatureRuntimeCtx) => string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Modules
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FAQ / Accordéon. Le runtime de toggle est actuellement géré par le script
 * FAQ inline de RawHtmlRenderer (chevrons Font Awesome). Ce module sert à
 * DÉTECTER et documenter la feature ; sa généralisation (détection non liée à
 * Font Awesome) sera branchée ici sans toucher au reste.
 */
const faqModule: FeatureModule = {
  id: "faq",
  label: "FAQ / Accordéon",
  detect: (html) =>
    /fa-chevron|accord(e|é)on|\bfaq\b|data-ff-faq|<details\b|aria-expanded|collapse/i.test(
      html,
    ),
};

/**
 * Bouton flottant WhatsApp (liens wa.me / api.whatsapp.com, souvent en
 * position:fixed). On garantit qu'il reste cliquable et ouvre un nouvel onglet
 * en mode public.
 */
const whatsappFloatModule: FeatureModule = {
  id: "whatsapp-float",
  label: "Bouton flottant WhatsApp",
  detect: (html) => /wa\.me|api\.whatsapp\.com|whatsapp/i.test(html),
  css: () => `
<style id="ff-feat-whatsapp">
  a[href*="wa.me"], a[href*="api.whatsapp.com"], a[href*="whatsapp"] {
    pointer-events: auto !important;
  }
</style>`,
  script: ({ editMode }) =>
    editMode
      ? ""
      : `
<script>
(function(){
  try {
    var links = document.querySelectorAll('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    for (var i = 0; i < links.length; i++) {
      links[i].setAttribute('target', '_blank');
      links[i].setAttribute('rel', 'noopener noreferrer');
    }
  } catch (e) {}
})();
</script>`,
};

/**
 * Header sticky/fixed. On PRÉSERVE uniquement les en-têtes qui étaient déjà
 * sticky/fixed dans la source (on n'ajoute pas de sticky là où il n'y en avait
 * pas) afin d'éviter tout décalage de mise en page.
 */
const stickyHeaderModule: FeatureModule = {
  id: "sticky-header",
  label: "Header sticky",
  detect: (html) =>
    /<header\b/i.test(html) &&
    /position\s*:\s*(sticky|fixed)|\bsticky\b|\bfixed\b/i.test(html),
  css: () => `
<style id="ff-feat-sticky">
  header[style*="position: sticky"], header[style*="position:sticky"],
  header[style*="position: fixed"], header[style*="position:fixed"],
  [class*="header"][style*="position: sticky"],
  [class*="navbar"][style*="position: sticky"] {
    position: sticky !important;
    top: 0 !important;
    z-index: 50 !important;
  }
</style>`,
};

/**
 * Compte à rebours / timer. Détection (preservation du markup via single-iframe).
 * La réanimation du décompte d'origine n'est pas reconstruite génériquement
 * (script source spécifique) — à compléter par module dédié si besoin.
 */
const countdownModule: FeatureModule = {
  id: "countdown",
  label: "Compte à rebours / Timer",
  detect: (html) =>
    /countdown|data-countdown|data-deadline|data-(?:end|target)-?(?:date|time)|compte[\s-]?(?:à|a)[\s-]?rebours/i.test(
      html,
    ),
};

// ─────────────────────────────────────────────────────────────────────────────
// Registre + API
// ─────────────────────────────────────────────────────────────────────────────

export const FEATURE_MODULES: FeatureModule[] = [
  faqModule,
  whatsappFloatModule,
  stickyHeaderModule,
  countdownModule,
];

/** Retourne les ids des features détectées dans le HTML. */
export function detectFeatures(html: string): string[] {
  if (!html) return [];
  const out: string[] = [];
  for (const m of FEATURE_MODULES) {
    try {
      if (m.detect(html)) out.push(m.id);
    } catch {
      // best-effort
    }
  }
  return out;
}

/** Construit le CSS + script à injecter pour les features actives. */
export function buildFeatureRuntime(
  featureIds: string[] | undefined,
  ctx: FeatureRuntimeCtx,
): { css: string; script: string } {
  const ids = new Set(featureIds ?? []);
  let css = "";
  let script = "";
  for (const m of FEATURE_MODULES) {
    if (!ids.has(m.id)) continue;
    if (m.css) css += "\n" + m.css(ctx);
    if (m.script) script += "\n" + m.script(ctx);
  }
  return { css, script };
}

/** Liste documentée des features supportées (pour l'UI / la doc). */
export function listSupportedFeatures(): Array<{ id: string; label: string }> {
  return FEATURE_MODULES.map((m) => ({ id: m.id, label: m.label }));
}
