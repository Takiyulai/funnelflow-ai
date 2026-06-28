 /*============================================================================
* lib/export/theme-css.ts
 *
 * Source UNIQUE de verite pour le CSS du tunnel.
 * Utilise a la fois par :
 *   - l'export Systeme.io (via getScopedFunnelThemeCss ou getFunnelThemeCss)
 *   - le preview public et l'editeur (via getFunnelThemeCss injecte dans layout)
 *
 * STRATEGIE RESPONSIVE :
 *   - Layout par defaut MOBILE (centre, empile)
 *   - Passage en desktop via @container ffpage (min-width: 600px)
 *   - Fallback @media (min-width: 640px) pour SIO et navigateurs anciens
 *   - Les .ff-section ont leur PROPRE container (ff-section) pour que les
 *     bullets/grid/strip detectent la largeur du bloc lui-meme, ce qui corrige
 *     le rendu dans l'editeur SIO mobile (qui ne propage pas correctement
 *     les @media viewport aux blocs HTML personnalises).
 *
 * STRATEGIE D'ESPACEMENT (inspire de l'ancien export qui respirait bien) :
 *   - Les .ff-headline / .ff-subheadline / .ff-body ont une PETITE margin-bottom
 *     (14px) — assez pour separer visuellement mais pas trop pour eviter les gaps.
 *   - Le gap parent reste a 0 sur les sections classiques (sinon double espacement).
 *   - Sur les split-grids, le gap parent est utilise (les enfants ont margin: 0).
 *
 * HEADER / FOOTER :
 *   - Couleur adaptative liee aux variables de thème (var(--ff-surface) etc.)
 *   - Footer compact (padding et typo reduits)
 *   - Brand-bar mobile centre UNIQUEMENT si pas de CTA et pas de logo image
 *     (via data-ff-brand-type="text" et data-ff-brand-has-cta="false")
 * ========================================================================= */

import type { Funnel } from "@/lib/funnels/types";

// ─────────────────────────────────────────────────────────────────────────────
// 1. BASE CSS
// ─────────────────────────────────────────────────────────────────────────────

const BASE_CSS = `
/* ─── Reset leger scope .ff-page ─── */
.ff-page,
.ff-page *,
.ff-page *::before,
.ff-page *::after {
  box-sizing: border-box;
  min-width: 0;
}

/* ─── Wrapper racine ─── */
.ff-page {
  --ff-bg: #ffffff;
  --ff-surface: #f8fafc;
  --ff-ink: #0f172a;
  --ff-ink-soft: #475569;
  --ff-muted: #94a3b8;
  --ff-border: rgba(15, 23, 42, 0.08);
  --ff-accent: #c7a436;
  --ff-accent-ink: #0f172a;
  --ff-accent-soft: rgba(199, 164, 54, 0.15);
  --ff-accent-card: rgba(199, 164, 54, 0.10);
  --ff-accent-glow: rgba(199, 164, 54, 0.40);
  --ff-btn-glow-color: rgba(10, 16, 32, 0.5);

  /* 🆕 Système de surface de CARD dérivé de la palette RÉELLE du template
     (--ff-bg / --ff-ink / --ff-accent sont toujours définis via previewColors).
     But : cards teintées de l'accent du template (« accent maîtrisé »), avec un
     texte TOUJOURS contrasté — fini le doré parasite et l'illisibilité, sans
     éditer chaque bloc [data-ff-theme]. Repli rgba(...) si color-mix non supporté. */
  --ff-card-bg: color-mix(in srgb, var(--ff-accent) 8%, color-mix(in srgb, var(--ff-ink) 7%, var(--ff-bg)));
  --ff-card-ink: var(--ff-ink);
  --ff-card-ink-soft: color-mix(in srgb, var(--ff-ink) 68%, var(--ff-card-bg));
  --ff-card-border: color-mix(in srgb, var(--ff-accent) 30%, transparent);

  /* Header / Footer adaptatifs : par defaut on suit le thème
     mais chaque thème peut surcharger ces variables */
  --ff-brand-bar-bg: var(--ff-surface);
  --ff-brand-bar-ink: var(--ff-ink);
  --ff-brand-bar-border: var(--ff-border);
  --ff-footer-bg: var(--ff-surface);
  --ff-footer-ink: var(--ff-ink-soft);
  --ff-footer-business-ink: var(--ff-ink);
  --ff-footer-border: var(--ff-border);

  --ff-font-heading: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --ff-font-body: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --ff-font-eyebrow: "Inter", system-ui, -apple-system, sans-serif;

  --ff-heading-weight: 800;
  --ff-heading-tracking: -0.02em;
  --ff-heading-leading: 1.12;
  --ff-body-leading: 1.6;

  --ff-text-scale: 1;
  --ff-btn-scale: 1;
  --ff-headline-scale: calc(2.1875rem * var(--ff-text-scale)); /* 35px */

  --ff-btn-radius: 8px;
  --ff-btn-bg: var(--ff-accent);
  --ff-btn-ink: var(--ff-accent-ink);
  --ff-btn-shadow: 0 4px 12px rgba(8, 43, 76, 0.08);

  /* Padding sections — inspire de l'ancien qui respirait bien */
  --ff-section-py: 3.5rem;       /* 56px mobile */
  --ff-section-py-md: 5.5rem;    /* 88px desktop */
  --ff-section-alt-1: transparent;
  --ff-section-alt-2: transparent;
  --ff-section-alt-border: transparent;

  --ff-anim-duration: 700ms;
  --ff-anim-easing: cubic-bezier(0.22, 1, 0.36, 1);

  --ff-shadow-color: rgba(0, 0, 0, 1);

  container-type: inline-size;
  container-name: ffpage;

  position: relative;
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 0;
  display: block;
  background-color: var(--ff-bg);
  color: var(--ff-ink);
  font-family: var(--ff-font-body);
  line-height: var(--ff-body-leading);

  overflow-x: clip;
  border-radius: 0;
  border: 0;
}

/* ─── Bulles de lumiere decoratives ─── */
.ff-page::before,
.ff-page::after {
  content: "";
  position: absolute;
  pointer-events: none;
  z-index: 0;
  border-radius: 50%;
  filter: blur(120px);
  will-change: transform;
  opacity: 0;
  max-width: 100%;
  max-height: 100%;
}
.ff-page > * {
  position: relative;
  z-index: 1;
}

/* ─── Headline scale responsive (35 → 45 → 55px comme l'ancien) ─── */
@container ffpage (min-width: 640px) {
  .ff-page { --ff-headline-scale: calc(2.8125rem * var(--ff-text-scale)); } /* 45px */
}
@container ffpage (min-width: 1024px) {
  .ff-page { --ff-headline-scale: calc(3.4375rem * var(--ff-text-scale)); } /* 55px */
}
/* 🆕 Export SIO : ces media-queries viewport s'appliquent TOUJOURS (et plus
   seulement en l'absence de container queries), pour activer le layout desktop
   même quand le bloc est collé dans une colonne SIO étroite. Condition
   toujours vraie = « que les container queries soient supportées ou non ». */
@supports (container-type: inline-size) or (not (container-type: inline-size)) {
  @media (min-width: 640px) {
    .ff-page { --ff-headline-scale: calc(2.8125rem * var(--ff-text-scale)); }
  }
  @media (min-width: 1024px) {
    .ff-page { --ff-headline-scale: calc(3.4375rem * var(--ff-text-scale)); }
  }
}

/* ─── Sections : padding genereux comme l'ancien export ─── */
/* IMPORTANT : chaque section est ELLE-MEME un container nomme ff-section.
   Cela permet aux bullets (grid / inline-strip) de detecter la largeur
   REELLE du conteneur, meme si SIO encapsule le bloc dans un parent etroit
   en mode preview mobile. */
.ff-section {
  position: relative;
  padding-top: var(--ff-section-py);
  padding-bottom: var(--ff-section-py);
  padding-left: 20px;
  padding-right: 20px;
  width: 100%;
  max-width: 100%;
  margin: 0;
  container-type: inline-size;
  container-name: ff-section;
}
@container ffpage (min-width: 760px) {
  .ff-section {
    padding-top: var(--ff-section-py-md);
    padding-bottom: var(--ff-section-py-md);
    padding-left: 32px;
    padding-right: 32px;
  }
}
/* 🆕 Export SIO : ces media-queries viewport s'appliquent TOUJOURS (et plus
   seulement en l'absence de container queries), pour activer le layout desktop
   même quand le bloc est collé dans une colonne SIO étroite. Condition
   toujours vraie = « que les container queries soient supportées ou non ». */
@supports (container-type: inline-size) or (not (container-type: inline-size)) {
  @media (min-width: 760px) {
    .ff-section {
      padding-top: var(--ff-section-py-md);
      padding-bottom: var(--ff-section-py-md);
      padding-left: 32px;
      padding-right: 32px;
    }
  }
}

.ff-page > .ff-section:first-of-type,
.ff-page > .ff-brand-bar + .ff-section {
  padding-top: 2rem;
}
@container ffpage (min-width: 760px) {
  .ff-page > .ff-section:first-of-type,
  .ff-page > .ff-brand-bar + .ff-section {
    padding-top: 3.5rem;
  }
}
/* 🆕 Export SIO : ces media-queries viewport s'appliquent TOUJOURS (et plus
   seulement en l'absence de container queries), pour activer le layout desktop
   même quand le bloc est collé dans une colonne SIO étroite. Condition
   toujours vraie = « que les container queries soient supportées ou non ». */
@supports (container-type: inline-size) or (not (container-type: inline-size)) {
  @media (min-width: 760px) {
    .ff-page > .ff-section:first-of-type,
    .ff-page > .ff-brand-bar + .ff-section {
      padding-top: 3.5rem;
    }
  }
}

.ff-section-inner {
  width: 100%;
  max-width: 1040px;
  margin-left: auto;
  margin-right: auto;
  position: relative;
  z-index: 1;
}
.ff-layout-wide-banner .ff-section-inner {
  max-width: 1180px;
}

/* ─── Layout par DEFAUT : tout centre et empile (mobile-first) ─── */
.ff-section .ff-section-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  /* PAS de gap ici : on s'appuie sur les margin-bottom des enfants
     (philosophie de l'ancien export qui marchait bien) */
}

/* ──────────────────────────────────────────────────────────────────────────
   Layout SPLIT (texte + image) - deux familles de selecteurs
   ────────────────────────────────────────────────────────────────────── */

/* === Famille A - Structure .ff-split-grid === */
.ff-split-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin: 0;
}
.ff-split-text,
.ff-split-media {
  flex: 1 1 min(100%, 360px);
  min-width: 0;
  max-width: 100%;
}

.ff-split-text {
  display: contents;
}
.ff-split-text > * {
  width: 100%;
  text-align: center;
  display: block;
  order: 1;
}
.ff-split-media {
  order: 2;
  display: flex;
  justify-content: center;
  align-items: center;
}
.ff-split-text > .ff-cta-wrap {
  order: 3;
}

@container ffpage (min-width: 760px) {
  .ff-split-grid {
    gap: 3rem;
    align-items: center; /* PAS stretch : evite l'etirement vertical de l'image */
    flex-wrap: nowrap;
  }
  .ff-split-text {
    display: flex !important;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    text-align: left;
  }
  .ff-split-text > * {
    width: auto;
    text-align: left;
    display: block;
    order: 0;
  }
  .ff-split-text > .ff-cta-wrap {
    order: 0;
    display: flex;
    justify-content: flex-start;
    width: 100%;
  }
  .ff-split-media {
    order: 0;
    justify-content: flex-start;
    align-items: center;
    max-height: 540px;
  }
  .ff-split-media img,
  .ff-split-media .ff-image,
  .ff-split-media .ff-image-wrap {
    max-height: 540px;
    width: auto;
    max-width: 100%;
    object-fit: contain;
  }
  .ff-layout-split-image-text .ff-split-grid {
    flex-direction: row-reverse;
  }
  .ff-split-text .ff-eyebrow {
    align-self: flex-start;
  }
}
/* 🆕 Export SIO : ces media-queries viewport s'appliquent TOUJOURS (et plus
   seulement en l'absence de container queries), pour activer le layout desktop
   même quand le bloc est collé dans une colonne SIO étroite. Condition
   toujours vraie = « que les container queries soient supportées ou non ». */
@supports (container-type: inline-size) or (not (container-type: inline-size)) {
  @media (min-width: 760px) {
    .ff-split-grid { gap: 3rem; flex-wrap: nowrap; align-items: center; }
    .ff-split-text {
      display: flex !important;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      text-align: left;
    }
    .ff-split-text > * {
      width: auto;
      text-align: left;
      display: block;
      order: 0;
    }
    .ff-split-text > .ff-cta-wrap {
      order: 0;
      display: flex;
      justify-content: flex-start;
      width: 100%;
    }
    .ff-split-media { order: 0; justify-content: flex-start; align-items: center; max-height: 540px; }
    .ff-split-media img,
    .ff-split-media .ff-image,
    .ff-split-media .ff-image-wrap {
      max-height: 540px;
      width: auto;
      max-width: 100%;
      object-fit: contain;
    }
    .ff-layout-split-image-text .ff-split-grid { flex-direction: row-reverse; }
    .ff-split-text .ff-eyebrow { align-self: flex-start; }
  }
}

/* === Famille B - Structure SIO export === */
@container ffpage (min-width: 760px) {
  .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative,
  .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 3rem;
    row-gap: 0;
    align-items: center; /* PAS stretch */
    max-width: 1180px;
    margin-left: auto;
    margin-right: auto;
    text-align: left;
  }

  .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-eyebrow,
  .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-headline,
  .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-subheadline,
  .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-body,
  .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-bullets,
  .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-cta-wrap {
    grid-column: 1;
    min-width: 0;
    text-align: left;
  }
  .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-image-wrap,
  .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > figure.ff-image-wrap,
  .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-image,
  .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-split-media {
    grid-column: 2;
    grid-row: 1 / span 99;
    align-self: center;
    justify-self: center;
    margin: 0 !important;
    max-width: 100%;
    max-height: 540px;
  }
  .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-image-wrap img,
  .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-image img {
    max-height: 540px;
    width: auto;
    max-width: 100%;
    object-fit: contain;
  }

  .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-eyebrow,
  .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-headline,
  .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-subheadline,
  .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-body,
  .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-bullets,
  .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-cta-wrap {
    grid-column: 2;
    min-width: 0;
    text-align: left;
  }
  .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-image-wrap,
  .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > figure.ff-image-wrap,
  .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-image,
  .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-split-media {
    grid-column: 1;
    grid-row: 1 / span 99;
    align-self: center;
    justify-self: center;
    margin: 0 !important;
    max-width: 100%;
    max-height: 540px;
  }
  .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-image-wrap img,
  .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-image img {
    max-height: 540px;
    width: auto;
    max-width: 100%;
    object-fit: contain;
  }

  .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-eyebrow,
  .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-eyebrow {
    justify-self: start;
  }
}
/* 🆕 Export SIO : ces media-queries viewport s'appliquent TOUJOURS (et plus
   seulement en l'absence de container queries), pour activer le layout desktop
   même quand le bloc est collé dans une colonne SIO étroite. Condition
   toujours vraie = « que les container queries soient supportées ou non ». */
@supports (container-type: inline-size) or (not (container-type: inline-size)) {
  @media (min-width: 760px) {
    .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative,
    .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 3rem;
      row-gap: 0;
      align-items: center;
      max-width: 1180px;
      margin-left: auto;
      margin-right: auto;
      text-align: left;
    }
    .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-eyebrow,
    .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-headline,
    .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-subheadline,
    .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-body,
    .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-bullets,
    .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-cta-wrap {
      grid-column: 1;
      text-align: left;
    }
    .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-image-wrap,
    .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > figure.ff-image-wrap,
    .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-image {
      grid-column: 2;
      grid-row: 1 / span 99;
      margin: 0 !important;
      max-height: 540px;
      align-self: center;
    }
    .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-image-wrap img,
    .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-image img {
      max-height: 540px;
      width: auto;
      max-width: 100%;
      object-fit: contain;
    }
    .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-eyebrow,
    .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-headline,
    .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-subheadline,
    .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-body,
    .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-bullets,
    .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-cta-wrap {
      grid-column: 2;
      text-align: left;
    }
    .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-image-wrap,
    .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > figure.ff-image-wrap,
    .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-image {
      grid-column: 1;
      grid-row: 1 / span 99;
      margin: 0 !important;
      max-height: 540px;
      align-self: center;
    }
    .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-image-wrap img,
    .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-image img {
      max-height: 540px;
      width: auto;
      max-width: 100%;
      object-fit: contain;
    }
  }
}

/* ─── Layout video : toujours empile ─── */
.ff-section[data-ff-has-video="true"] .ff-section-inner {
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.ff-section[data-ff-has-video="true"] .ff-split-grid {
  flex-direction: column;
  flex-wrap: nowrap;
}
.ff-section[data-ff-has-video="true"] .ff-split-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.ff-section[data-ff-has-video="true"] .ff-split-text > * {
  width: 100%;
  text-align: center;
  display: block;
  order: 0;
}
.ff-section[data-ff-has-video="true"] .ff-split-text,
.ff-section[data-ff-has-video="true"] .ff-split-media {
  flex: 0 0 auto;
  width: 100%;
}

/* ─── Typographie (avec petites margin-bottom comme l'ancien) ─── */
.ff-eyebrow {
  display: inline-block;
  color: var(--ff-accent);
  font-family: var(--ff-font-eyebrow);
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.875rem; /* 14px */
  letter-spacing: 0.12em;
  margin: 0 0 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--ff-accent-soft);
  border: 1px solid transparent;
  align-self: center;
  line-height: 1.2;
}
.ff-layout-centered .ff-eyebrow {
  margin-left: auto;
  margin-right: auto;
}

/* ─── Hero icon (success / thankyou / delivery / confirmation pages) ─── */
.ff-section-hero-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  margin: 0 auto 14px;
  border-radius: 50%;
  background: var(--ff-accent-soft, rgba(22, 163, 74, 0.12));
  color: var(--ff-accent, #16a34a);
}
.ff-section-hero-icon svg {
  width: 60%;
  height: 60%;
  display: block;
}

.ff-page[data-ff-page-role="thankyou"] .ff-section-inner,
.ff-page[data-ff-page-role="delivery"] .ff-section-inner,
.ff-page[data-ff-page-role="confirmation"] .ff-section-inner,
.ff-section[data-ff-page-role="thankyou"] .ff-section-inner {
  text-align: center;
}

@media (max-width: 600px) {
  .ff-section-hero-icon { width: 80px; height: 80px; }
}

.ff-headline {
  color: var(--ff-ink);
  font-family: var(--ff-font-heading);
  font-weight: var(--ff-heading-weight);
  letter-spacing: var(--ff-heading-tracking);
  line-height: var(--ff-heading-leading);
  font-size: var(--ff-headline-scale);
  margin: 0 0 14px;
  word-break: break-word;
  overflow-wrap: anywhere;
  max-width: 100%;
}

.ff-subheadline {
  color: var(--ff-ink-soft);
  font-family: var(--ff-font-body);
  line-height: 1.65;
  font-size: calc(1.3125rem * var(--ff-text-scale)); /* 21px comme l'ancien */
  opacity: 0.85;
  margin: 0 0 14px;
  max-width: 720px;
  overflow-wrap: anywhere;
  width: 100%;
}
.ff-layout-centered .ff-subheadline {
  margin-left: auto;
  margin-right: auto;
}

.ff-body {
  color: var(--ff-ink-soft);
  font-family: var(--ff-font-body);
  line-height: 1.7;
  font-size: calc(1.25rem * var(--ff-text-scale)); /* 20px comme l'ancien */
  opacity: 0.9;
  margin: 0 0 14px;
  max-width: 720px;
  white-space: pre-line;
  overflow-wrap: anywhere;
  width: 100%;
}
.ff-layout-centered .ff-body {
  margin-left: auto;
  margin-right: auto;
}

/* Ajustement mobile : un peu plus petit pour rester lisible */
@media (max-width: 640px) {
  .ff-subheadline { font-size: calc(1.125rem * var(--ff-text-scale)); } /* 18px */
  .ff-body        { font-size: calc(1.0625rem * var(--ff-text-scale)); } /* 17px */
}

/* ─── Bullets : mode LIST par defaut (vertical avec icone) ─── */
.ff-bullets {
  list-style: none;
  padding: 0;
  margin: 0 0 18px;
  display: grid;
  gap: 10px;
  width: 100%;
}
.ff-layout-centered .ff-bullets {
  display: inline-grid;
  text-align: left;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}
.ff-bullets li {
  color: var(--ff-ink-soft);
  font-family: var(--ff-font-body);
  line-height: var(--ff-body-leading);
  font-size: calc(1.1875rem * var(--ff-text-scale)); /* 19px comme l'ancien */
  display: flex;
  align-items: flex-start;
  gap: 10px;
  text-align: left;
  width: 100%;
}
.ff-bullets li::before { display: none; content: none; }
.ff-bullet-ic {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-top: 2px;
  color: var(--ff-accent);
}
.ff-bullet-ic svg {
  width: 100%;
  height: 100%;
  stroke: currentColor;
  stroke-width: 2;
}
.ff-bullets li span:last-child {
  text-align: left;
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
@media (max-width: 640px) {
  .ff-bullets li { font-size: calc(1rem * var(--ff-text-scale)); }
}

/* ─── CTA — style inspire de l'ancien (min-height 58px, glow permanent, hover lift) ─── */
/* 🆕 Lien discret « Non merci, continuer » (refus d'une offre OTO). */
.ff-decline-wrap {
  text-align: center;
  margin-top: 0.9rem;
}
.ff-decline-link {
  display: inline-block;
  font-size: 0.85rem;
  color: color-mix(in srgb, var(--ff-ink) 60%, transparent);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  transition: color 0.2s ease;
}
.ff-decline-link:hover {
  color: var(--ff-ink);
}

/* 🆕 Bullets « Titre | Description » : titre en gras, description en dessous. */
.ff-bullet-title { font-weight: 700; }
.ff-bullets--grid .ff-bullet-title { display: block; margin-bottom: 0.3rem; }
.ff-bullets--grid .ff-bullet-desc { display: block; opacity: 0.85; font-size: 0.95em; }
.ff-bullet-desc { opacity: 0.9; }

.ff-btn,
.ff-cta {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 58px;
  border-radius: var(--ff-btn-radius);
  background: var(--ff-btn-bg);
  color: var(--ff-btn-ink) !important;
  font-family: var(--ff-font-body);
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  border: none;
  transition: opacity 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
  box-shadow: var(--ff-btn-shadow);
  padding: 0 calc(1.75rem * var(--ff-btn-scale));
  font-size: calc(1.1875rem * var(--ff-btn-scale)); /* 19px comme l'ancien */
  text-align: center;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.2;
  letter-spacing: 0.01em;
  margin-top: 14px;
  /* Glow permanent par defaut (comme l'ancien export) */
  animation: ff-btn-glow 2.2s ease-in-out infinite;
}
@media (max-width: 640px) {
  .ff-btn,
  .ff-cta {
    min-height: 52px;
    font-size: calc(1.0625rem * var(--ff-btn-scale));
    padding: 0 calc(1.5rem * var(--ff-btn-scale));
  }
}

.ff-btn:hover,
.ff-cta:hover {
  opacity: 0.92;
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.15);
}

@keyframes ff-btn-glow {
  0%, 100% { box-shadow: 0 0 0 0 var(--ff-btn-glow-color); }
  50%      { box-shadow: 0 0 0 10px transparent; }
}

/* Desactivation du glow si data-ff-btn-anim="lift" */
.ff-page[data-ff-btn-anim="lift"] .ff-btn,
.ff-page[data-ff-btn-anim="lift"] .ff-cta {
  animation: none;
}

.ff-cta-wrap {
  margin-top: 18px;
  width: 100%;
  display: flex;
  justify-content: center;
}
@container ffpage (min-width: 760px) {
  .ff-split-text .ff-cta-wrap { justify-content: flex-start; }
  .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-cta-wrap,
  .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-cta-wrap {
    justify-content: flex-start;
  }
}
/* 🆕 Export SIO : ces media-queries viewport s'appliquent TOUJOURS (et plus
   seulement en l'absence de container queries), pour activer le layout desktop
   même quand le bloc est collé dans une colonne SIO étroite. Condition
   toujours vraie = « que les container queries soient supportées ou non ». */
@supports (container-type: inline-size) or (not (container-type: inline-size)) {
  @media (min-width: 760px) {
    .ff-split-text .ff-cta-wrap { justify-content: flex-start; }
    .ff-page .ff-section[data-ff-layout="split-text-image"] > div.relative > .ff-cta-wrap,
    .ff-page .ff-section[data-ff-layout="split-image-text"] > div.relative > .ff-cta-wrap {
      justify-content: flex-start;
    }
  }
}
.ff-layout-left-aligned .ff-cta-wrap { justify-content: flex-start; }

/* ─── Images ─── */
.ff-image {
  margin: 22px 0 8px;
  width: 100%;
  max-width: 100%;
}
.ff-image img,
.ff-image-wrap img {
  width: 100%;
  height: auto;
  max-width: 100%;
  border-radius: 12px;
  display: block;
  margin: 0 auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
}
.ff-image--transparent img,
.ff-image-wrap[data-ff-img-transparent="true"] img {
  box-shadow: none;
  border-radius: 0;
  background: transparent;
}
.ff-image-credit {
  display: block;
  font-size: 11px;
  opacity: 0.6;
  margin-top: 6px;
  text-align: center;
}

/* ─── Videos ─── */
.ff-video {
  margin: 22px auto;
  max-width: 720px;
  width: 100%;
}
.ff-video-inner {
  position: relative;
  padding-bottom: 56.25%;
  height: 0;
  overflow: hidden;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  background: #000;
}
.ff-video-inner iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}

/* ─── GRILLES ─── */
.ff-grid-1, .ff-grid-2, .ff-grid-3 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
  width: 100%;
  margin-top: 24px;
}
@container ffpage (min-width: 760px) {
  .ff-grid-2 { grid-template-columns: repeat(2, 1fr); }
  .ff-grid-3 { grid-template-columns: repeat(2, 1fr); }
}
@container ffpage (min-width: 960px) {
  .ff-grid-3 { grid-template-columns: repeat(3, 1fr); }
}
/* 🆕 Export SIO : ces media-queries viewport s'appliquent TOUJOURS (et plus
   seulement en l'absence de container queries), pour activer le layout desktop
   même quand le bloc est collé dans une colonne SIO étroite. Condition
   toujours vraie = « que les container queries soient supportées ou non ». */
@supports (container-type: inline-size) or (not (container-type: inline-size)) {
  @media (min-width: 760px) {
    .ff-grid-2 { grid-template-columns: repeat(2, 1fr); }
    .ff-grid-3 { grid-template-columns: repeat(2, 1fr); }
  }
  @media (min-width: 960px) {
    .ff-grid-3 { grid-template-columns: repeat(3, 1fr); }
  }
}

.ff-feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  gap: 1rem;
  width: 100%;
  margin: 24px 0 0;
}
.ff-feature-card {
  /* 🆕 Fond dérivé de la palette du template + texte contrasté + ombre + halo accent. */
  background: rgba(255, 255, 255, 0.05);
  background: var(--ff-card-bg, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--ff-card-border, var(--ff-border));
  border-radius: 0.875rem;
  padding: 1.25rem;
  text-align: left;
  font-size: 0.9375rem;
  color: var(--ff-card-ink-soft, var(--ff-ink-soft));
  line-height: 1.55;
  min-width: 0;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
}
.ff-feature-card :is(h1,h2,h3,h4,strong,b) { color: var(--ff-card-ink, var(--ff-ink)); }

/* 🆕 B2 : puces numérotées (process/programme) — parité avec l'aperçu. */
.ff-bullet-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 2rem; height: 2rem; border-radius: 999px;
  background: var(--ff-accent, #31845C); color: var(--ff-accent-ink, #fff);
  font-weight: 800; font-size: 0.95rem; line-height: 1;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
}
.ff-bullet-num--sm { width: 1.5rem; height: 1.5rem; font-size: 0.8rem; }

.ff-testimonials {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 1.25rem;
  width: 100%;
  margin: 24px 0 0;
}
.ff-testimonial-card {
  text-align: center;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 1.25rem;
  background: var(--ff-card-bg, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--ff-card-border, var(--ff-border));
  border-radius: 14px;
  min-width: 0;
  color: var(--ff-card-ink-soft, var(--ff-ink-soft));
}
.ff-testimonial-rating {
  color: #f59e0b;
  margin-bottom: 10px;
  font-size: 1rem;
  letter-spacing: 1px;
}
.ff-testimonial-quote {
  font-style: italic;
  font-size: 0.9375rem;
  line-height: 1.6;
  margin: 0 0 14px 0;
  color: var(--ff-ink-soft);
  flex: 1;
  overflow-wrap: anywhere;
}
.ff-testimonial-author {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 1rem;
}
.ff-testimonial-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.ff-testimonial-avatar--initials {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ff-accent);
  color: var(--ff-accent-ink);
  font-weight: 700;
  font-size: 1rem;
}
.ff-testimonial-meta { text-align: left; min-width: 0; }
.ff-testimonial-name { font-weight: 700; color: var(--ff-ink); overflow-wrap: anywhere; }
.ff-testimonial-role { font-size: 0.75rem; color: var(--ff-muted); overflow-wrap: anywhere; }

.ff-faq-list {
  width: 100%;
  max-width: 720px;
  margin: 24px auto 0;
  text-align: left;
}
.ff-faq-item { border-bottom: 1px solid var(--ff-border); }
.ff-faq-item:first-child { border-top: 1px solid var(--ff-border); }
.ff-faq-q {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  font-weight: 600;
  color: var(--ff-ink);
  padding: 16px 0;
  list-style: none;
  gap: 14px;
}
.ff-faq-q::-webkit-details-marker { display: none; }
.ff-faq-q-text {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 0.9375rem;
}
.ff-faq-chevron {
  transition: transform 0.25s ease;
  flex-shrink: 0;
  color: var(--ff-accent);
}
details[open] .ff-faq-chevron { transform: rotate(180deg); }
.ff-faq-a {
  padding: 0 28px 16px 0;
  color: var(--ff-ink-soft);
  font-size: 0.875rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.ff-faq-a p { margin: 0; white-space: pre-line; }

.ff-pricing {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 1.25rem;
  width: 100%;
  margin: 24px 0 0;
}
.ff-pricing-card {
  text-align: center;
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--ff-card-bg, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--ff-card-border, var(--ff-border));
  border-radius: 14px;
  padding: 1.25rem;
  min-width: 0;
  color: var(--ff-card-ink-soft, var(--ff-ink-soft));
}
.ff-pricing-card--highlighted {
  background: rgba(10, 16, 32, 0.08);
  border: 2px solid var(--ff-accent);
  transform: scale(1.02);
}
.ff-pricing-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--ff-accent);
  color: var(--ff-accent-ink);
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  white-space: nowrap;
}
.ff-pricing-name { font-size: 1.125rem; font-weight: 700; margin: 0 0 6px 0; overflow-wrap: anywhere; }
.ff-pricing-desc { margin: 0 0 14px 0; font-size: 0.8125rem; opacity: 0.65; }
.ff-pricing-price {
  display: flex;
  align-items: baseline;
  gap: 6px;
  justify-content: center;
  margin-bottom: 20px;
}
.ff-pricing-amount { font-size: 2.25rem; font-weight: 900; color: var(--ff-accent); }
.ff-pricing-period { font-size: 0.875rem; opacity: 0.6; }
.ff-pricing-features {
  list-style: none;
  padding: 0;
  margin: 0 0 18px 0;
  display: grid;
  gap: 8px;
  flex: 1;
  text-align: left;
}
.ff-pricing-features li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 0.875rem;
  overflow-wrap: anywhere;
}
.ff-feat-check { color: var(--ff-accent); flex-shrink: 0; display: inline-flex; line-height: 0; }
.ff-pricing-cta { margin-top: auto; width: 100%; }

.ff-bonus {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 1rem;
  width: 100%;
  margin: 24px 0 0;
}
.ff-bonus-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 1.125rem;
  border-radius: 12px;
  background: var(--ff-card-bg, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--ff-card-border, var(--ff-border));
  min-width: 0;
  color: var(--ff-card-ink-soft, var(--ff-ink-soft));
}
.ff-bonus-icon {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: var(--ff-accent);
  color: var(--ff-accent-ink);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ff-bonus-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.ff-bonus-title { font-weight: 700; margin: 0; font-size: 0.9375rem; overflow-wrap: anywhere; }
.ff-bonus-value {
  background: var(--ff-accent);
  color: var(--ff-accent-ink);
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}
.ff-bonus-desc {
  margin: 0;
  font-size: 0.875rem;
  opacity: 0.8;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.ff-guarantee {
  max-width: 720px;
  margin: 24px auto 0;
  padding: 24px;
  border-radius: 16px;
  background: var(--ff-card-bg, var(--ff-accent-card));
  border: 2px solid var(--ff-accent);
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  justify-content: center;
  text-align: center;
}
@container ffpage (min-width: 640px) {
  .ff-guarantee { flex-direction: row; text-align: left; }
}
/* 🆕 Export SIO : ces media-queries viewport s'appliquent TOUJOURS (et plus
   seulement en l'absence de container queries), pour activer le layout desktop
   même quand le bloc est collé dans une colonne SIO étroite. Condition
   toujours vraie = « que les container queries soient supportées ou non ». */
@supports (container-type: inline-size) or (not (container-type: inline-size)) {
  @media (min-width: 640px) {
    .ff-guarantee { flex-direction: row; text-align: left; }
  }
}
.ff-guarantee-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--ff-accent);
  color: var(--ff-accent-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ff-guarantee-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
  justify-content: center;
}
@container ffpage (min-width: 640px) {
  .ff-guarantee-head { justify-content: flex-start; }
}
/* 🆕 Export SIO : ces media-queries viewport s'appliquent TOUJOURS (et plus
   seulement en l'absence de container queries), pour activer le layout desktop
   même quand le bloc est collé dans une colonne SIO étroite. Condition
   toujours vraie = « que les container queries soient supportées ou non ». */
@supports (container-type: inline-size) or (not (container-type: inline-size)) {
  @media (min-width: 640px) {
    .ff-guarantee-head { justify-content: flex-start; }
  }
}
.ff-guarantee-title { margin: 0; font-size: 1.25rem; font-weight: 900; overflow-wrap: anywhere; }
.ff-guarantee-duration {
  background: var(--ff-accent);
  color: var(--ff-accent-ink);
  font-size: 0.8125rem;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 999px;
}
.ff-guarantee-desc {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.6;
  opacity: 0.85;
  overflow-wrap: anywhere;
}

.ff-card {
  background: rgba(15, 23, 42, 0.03);
  border: 1px solid var(--ff-border);
  border-radius: 14px;
  padding: 1.375rem;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  min-width: 0;
}
.ff-card-elevated {
  background: var(--ff-card-bg, var(--ff-accent-card));
  border: 2px solid var(--ff-accent);
  border-radius: 1rem;
  padding: 1.75rem;
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.10);
}

/* ─── Layout helpers ─── */
.ff-layout-centered .ff-section-inner {
  text-align: center;
  align-items: center;
}
.ff-layout-left-aligned .ff-section-inner {
  text-align: left;
  align-items: flex-start;
}
.ff-layout-left-aligned .ff-eyebrow { align-self: flex-start; margin-left: 0; }

.ff-layout-stacked-card .ff-section-inner {
  display: flex;
  justify-content: center;
}
.ff-stacked-card {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  text-align: center;
  align-items: center;
  background: var(--ff-card-bg, var(--ff-accent-card));
  border: 1px solid var(--ff-card-border, var(--ff-border));
  border-radius: 1.25rem;
  padding: 1.75rem;
}

.ff-dense-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  margin: 0;
  list-style: none;
  border-top: 1px solid var(--ff-border);
  width: 100%;
}
.ff-dense-list li {
  padding: 0.875rem 0;
  border-bottom: 1px solid var(--ff-border);
  color: var(--ff-ink-soft);
  font-size: 0.9375rem;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.ff-section:not(:last-child)::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(to right, transparent, var(--ff-border), transparent);
  opacity: 0.4;
}

/* ═══════════════════════════════════════════════════════════════════════════
   BRAND BAR (header) — couleur ADAPTATIVE au thème
   ═══════════════════════════════════════════════════════════════════════════ */
.ff-brand-bar {
  background: var(--ff-brand-bar-bg);
  color: var(--ff-brand-bar-ink);
  border-bottom: 1px solid var(--ff-brand-bar-border);
  padding: 14px 20px;
  font-family: var(--ff-font-body);
  font-weight: 600;
  font-size: 0.875rem;
  width: 100%;
  max-width: 100%;
  border-radius: 0;
}

.ff-brand-bar--sticky {
  position: -webkit-sticky;
  position: sticky;
  top: 0;
  z-index: 50;
  will-change: transform;
}

/* Mode transparent : leger overlay translucide qui s'adapte au fond */
.ff-brand-bar--transparent {
  background: rgba(255, 255, 255, 0.88);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}
.ff-page[data-ff-theme="clean-dark"] .ff-brand-bar--transparent,
.ff-page[data-ff-theme="coaching-premium"] .ff-brand-bar--transparent,
.ff-page[data-ff-theme="bold-energy"] .ff-brand-bar--transparent,
.ff-page[data-ff-theme="sharp-launch"] .ff-brand-bar--transparent,
.ff-page[data-ff-theme="trust-pro"] .ff-brand-bar--transparent,
.ff-page[data-ff-theme="lead-snap"] .ff-brand-bar--transparent,
.ff-page[data-ff-theme="story-sell"] .ff-brand-bar--transparent {
  background: rgba(10, 10, 10, 0.85);
}
/* Fallback navigateurs sans color-mix */
@supports not (background: color-mix(in srgb, red 50%, blue)) {
  .ff-brand-bar--transparent {
    background: rgba(255, 255, 255, 0.92);
  }
  .ff-page[data-ff-theme="clean-dark"] .ff-brand-bar--transparent,
  .ff-page[data-ff-theme="coaching-premium"] .ff-brand-bar--transparent,
  .ff-page[data-ff-theme="bold-energy"] .ff-brand-bar--transparent,
  .ff-page[data-ff-theme="sharp-launch"] .ff-brand-bar--transparent,
  .ff-page[data-ff-theme="trust-pro"] .ff-brand-bar--transparent,
  .ff-page[data-ff-theme="lead-snap"] .ff-brand-bar--transparent,
  .ff-page[data-ff-theme="story-sell"] .ff-brand-bar--transparent {
    background: rgba(10, 10, 10, 0.85);
  }
}

.ff-brand-bar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  max-width: 1180px;
  margin: 0 auto;
  width: 100%;
}
.ff-brand-id {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  overflow: hidden;
  flex: 1 1 auto;
}
.ff-brand-id span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
  font-size: 14px;
  color: inherit;
}
.ff-brand-bar img {
  height: 28px;
  width: auto;
  max-width: 120px;
  border-radius: 6px;
  object-fit: contain;
  background: transparent;
  flex-shrink: 0;
}
@container ffpage (min-width: 640px) {
  .ff-brand-bar img { height: 32px; max-width: 160px; }
}
/* 🆕 Export SIO : ces media-queries viewport s'appliquent TOUJOURS (et plus
   seulement en l'absence de container queries), pour activer le layout desktop
   même quand le bloc est collé dans une colonne SIO étroite. Condition
   toujours vraie = « que les container queries soient supportées ou non ». */
@supports (container-type: inline-size) or (not (container-type: inline-size)) {
  @media (min-width: 640px) {
    .ff-brand-bar img { height: 32px; max-width: 160px; }
  }
}

/* ─── CENTRAGE MOBILE CONDITIONNEL DU BRAND-NAME ───
   Centre UNIQUEMENT si :
   - c'est du texte (data-ff-brand-type="text")
   - ET il n'y a PAS de CTA dans le header (data-ff-brand-has-cta="false")
   Sinon : alignement a gauche pour eviter le chevauchement avec le CTA
   ou pour preserver l'identite visuelle du logo. */
@media (max-width: 640px) {
  /* Cas 1 : texte SANS cta → on centre */
  .ff-brand-bar[data-ff-brand-type="text"][data-ff-brand-has-cta="false"] .ff-brand-bar-inner {
    justify-content: center;
  }
  .ff-brand-bar[data-ff-brand-type="text"][data-ff-brand-has-cta="false"] .ff-brand-id {
    justify-content: center;
    text-align: center;
    flex: 0 1 auto;
    width: auto;
    max-width: 100%;
  }
  .ff-brand-bar[data-ff-brand-type="text"][data-ff-brand-has-cta="false"] .ff-brand-id span {
    text-align: center;
  }

  /* Cas 2 et 3 (texte+cta, ou logo image) : on laisse l'alignement par defaut
     (space-between) pour eviter chevauchement / preserver l'identite. */

  /* Petit ajustement de taille du CTA mobile pour eviter qu'il prenne tout */
  .ff-brand-bar[data-ff-brand-has-cta="true"] .ff-brand-cta {
    font-size: 0.75rem !important;
    padding: 0.4rem 0.9rem !important;
    min-height: 32px !important;
  }
  .ff-brand-bar[data-ff-brand-has-cta="true"] .ff-brand-id span {
    font-size: 13px;
  }
}

.ff-brand-cta,
a.ff-brand-cta,
.ff-page a.ff-brand-cta {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.375rem !important;
  padding: 0 16px !important;
  margin: 0 !important;
  border-radius: var(--ff-btn-radius) !important;
  background: var(--ff-accent) !important;
  background-color: var(--ff-accent) !important;
  color: var(--ff-accent-ink) !important;
  font-weight: 700 !important;
  font-size: 13px !important;
  text-decoration: none !important;
  white-space: nowrap !important;
  flex-shrink: 0 !important;
  transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease !important;
  min-height: 38px !important;
  line-height: 1.2 !important;
  border: none !important;
  cursor: pointer !important;
  animation: none !important; /* Pas de glow sur le brand-cta */
}
.ff-brand-cta:hover,
a.ff-brand-cta:hover {
  opacity: 0.94;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
}

/* ═══════════════════════════════════════════════════════════════════════════
   FOOTER — compact et adaptatif au thème
   ═══════════════════════════════════════════════════════════════════════════ */
.ff-footer {
  background: var(--ff-footer-bg);
  color: var(--ff-footer-ink);
  padding: 20px 20px;       /* compact (etait 32px) */
  font-family: var(--ff-font-body);
  font-size: 0.8125rem;     /* 13px (etait 14px) */
  width: 100%;
  max-width: 100%;
  margin-top: 0;
  text-align: center;
  border-top: 1px solid var(--ff-footer-border);
  border-radius: 0;
}
@container ffpage (min-width: 760px) {
  .ff-footer { padding: 24px 32px; }
}
/* 🆕 Export SIO : ces media-queries viewport s'appliquent TOUJOURS (et plus
   seulement en l'absence de container queries), pour activer le layout desktop
   même quand le bloc est collé dans une colonne SIO étroite. Condition
   toujours vraie = « que les container queries soient supportées ou non ». */
@supports (container-type: inline-size) or (not (container-type: inline-size)) {
  @media (min-width: 760px) {
    .ff-footer { padding: 24px 32px; }
  }
}
.ff-footer-inner {
  max-width: 920px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: center;
}
.ff-footer-brand {
  color: var(--ff-footer-business-ink);
  font-weight: 700;
  font-size: 0.875rem;       /* 14px (etait 15px) */
}
.ff-footer-legal { font-size: 0.75rem; opacity: 0.7; line-height: 1.5; }
.ff-footer-link {
  color: var(--ff-accent);
  text-decoration: none;
  font-weight: 500;
}
.ff-footer-copy {
  opacity: 0.55;
  font-size: 0.6875rem;      /* 11px (etait 12px) */
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--ff-footer-border);
}

/* ─── Animations CSS (declenchees au chargement, comme l'ancien) ─── */
.ff-page [class*="ff-anim-"] {
  opacity: 0;
  animation-duration: var(--ff-anim-duration);
  animation-timing-function: var(--ff-anim-easing);
  animation-fill-mode: forwards;
  animation-delay: 0.1s;
}
.ff-page .ff-anim-fade-in { animation-name: ff-fade-in; }
.ff-page .ff-anim-fade-up { animation-name: ff-fade-up; }
.ff-page .ff-anim-fade-down { animation-name: ff-fade-down; }
.ff-page .ff-anim-slide-left { animation-name: ff-slide-left; }
.ff-page .ff-anim-slide-right { animation-name: ff-slide-right; }
.ff-page .ff-anim-zoom-in { animation-name: ff-zoom-in; }
.ff-page .ff-anim-zoom-out { animation-name: ff-zoom-out; }
.ff-page .ff-anim-pulse { animation: ff-pulse 0.8s ease-out 0.1s both; }

/* ─── Mode SCROLL (progressive enhancement, active par JS) ───
   Sans JS : les animations jouent au chargement (comportement historique).
   Avec JS : on met chaque element en pause (fige au 1er keyframe = opacity:0)
   jusqu'a ce qu'il entre dans le viewport (.ff-in) → reveal au scroll. */
.ff-page.ff-anim-scroll [class*="ff-anim-"] { animation-play-state: paused; }
.ff-page.ff-anim-scroll [class*="ff-anim-"].ff-in { animation-play-state: running; }

@keyframes ff-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes ff-fade-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ff-fade-down { from { opacity: 0; transform: translateY(-24px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ff-slide-left { from { opacity: 0; transform: translateX(-32px); } to { opacity: 1; transform: translateX(0); } }
@keyframes ff-slide-right { from { opacity: 0; transform: translateX(32px); } to { opacity: 1; transform: translateX(0); } }
@keyframes ff-zoom-in { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
@keyframes ff-zoom-out { from { opacity: 0; transform: scale(1.06); } to { opacity: 1; transform: scale(1); } }
@keyframes ff-pulse { 0% { opacity: 0; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } }
@keyframes ff-decor-drift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%      { transform: translate(5%, -3%) scale(1.05); }
  66%      { transform: translate(-3%, 4%) scale(0.97); }
}

@media (prefers-reduced-motion: reduce) {
  .ff-page [class*="ff-anim-"] {
    opacity: 1 !important;
    animation: none !important;
    transform: none !important;
  }
  .ff-page .ff-btn,
  .ff-page .ff-cta { animation: none !important; }
}

/* ─── Alternance de fonds entre sections ─── */
.ff-page .ff-section:nth-of-type(even):not([data-ff-custom-bg="true"]):not([data-ff-has-bg-image="true"]) {
  background-color: var(--ff-section-alt-1);
}
.ff-page .ff-section[data-ff-section="testimonials"]:not([data-ff-custom-bg="true"]):not([data-ff-has-bg-image="true"]),
.ff-page .ff-section[data-ff-section="proof"]:not([data-ff-custom-bg="true"]):not([data-ff-has-bg-image="true"]),
.ff-page .ff-section[data-ff-section="faq"]:not([data-ff-custom-bg="true"]):not([data-ff-has-bg-image="true"]),
.ff-page .ff-section[data-ff-section="pricing"]:not([data-ff-custom-bg="true"]):not([data-ff-has-bg-image="true"]),
.ff-page .ff-section[data-ff-section="offer"]:not([data-ff-custom-bg="true"]):not([data-ff-has-bg-image="true"]),
.ff-page .ff-section[data-ff-section="bonus"]:not([data-ff-custom-bg="true"]):not([data-ff-has-bg-image="true"]),
.ff-page .ff-section[data-ff-section="guarantee"]:not([data-ff-custom-bg="true"]):not([data-ff-has-bg-image="true"]) {
  background-color: var(--ff-section-alt-2);
  border-top: 1px solid var(--ff-section-alt-border);
  border-bottom: 1px solid var(--ff-section-alt-border);
}
.ff-page .ff-section[data-ff-section="hero"]:not([data-ff-custom-bg="true"]):not([data-ff-has-bg-image="true"]) {
  background-color: transparent;
  border-top: none;
  border-bottom: none;
}

.ff-page .ff-section[data-ff-custom-bg="true"]:not([data-ff-has-bg-image="true"]) {
  background-image: none !important;
}
.ff-page .ff-section[data-ff-has-bg-image="true"] {
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
}

.ff-page[data-ff-custom-bg="true"] {
  background: var(--ff-custom-bg) !important;
}
.ff-page[data-ff-custom-bg="true"] .ff-section:nth-of-type(even) {
  background-color: transparent;
}

/* ─── Forms ─── */
.ff-form-fields {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  max-width: 520px;
  margin: 18px auto 0;
  width: 100%;
}
@container ffpage (min-width: 640px) {
  .ff-form-fields { grid-template-columns: 1fr 1fr; }
}
/* 🆕 Export SIO : ces media-queries viewport s'appliquent TOUJOURS (et plus
   seulement en l'absence de container queries), pour activer le layout desktop
   même quand le bloc est collé dans une colonne SIO étroite. Condition
   toujours vraie = « que les container queries soient supportées ou non ». */
@supports (container-type: inline-size) or (not (container-type: inline-size)) {
  @media (min-width: 640px) {
    .ff-form-fields { grid-template-columns: 1fr 1fr; }
  }
}
.ff-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  grid-column: 1 / -1;
  text-align: left;
  width: 100%;
}
.ff-field--half { grid-column: span 1; }
.ff-field-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  text-align: left;
}
.ff-input {
  min-height: 46px;
  border: 1px solid var(--ff-border);
  border-radius: 8px;
  padding: 0 14px;
  font-family: var(--ff-font-body);
  font-size: 0.9375rem;
  background: #fff;
  color: var(--ff-ink);
  width: 100%;
  max-width: 100%;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
textarea.ff-input {
  padding: 12px 14px;
  min-height: 100px;
  resize: vertical;
}
.ff-input:focus {
  outline: none;
  border-color: var(--ff-accent);
  box-shadow: 0 0 0 3px var(--ff-accent-soft);
}
.ff-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.875rem;
}
.ff-form-submit {
  grid-column: 1 / -1;
  margin-top: 0;
  width: 100%;
}

/* ─── Active section highlight (editeur) ─── */
@keyframes ff-section-pulse {
  0%   { box-shadow: 0 0 0 0 var(--ff-accent-soft); }
  60%  { box-shadow: 0 0 0 8px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
.ff-page .ff-section[data-ff-active="true"] {
  outline: 2px solid var(--ff-accent-glow);
  outline-offset: -2px;
  border-radius: 4px;
  animation: ff-section-pulse 1.5s ease-out 1;
}

.ff-page[data-ff-animations="off"] [class*="ff-anim-"] {
  animation: none !important;
  opacity: 1 !important;
  transform: none !important;
}
.ff-page[data-ff-animations="off"] .ff-btn,
.ff-page[data-ff-animations="off"] .ff-cta {
  animation: none !important;
}

.ff-spacing-compact {
  --ff-section-py: 2.5rem;
  --ff-section-py-md: 4rem;
}
.ff-spacing-large {
  --ff-section-py: 5rem;
  --ff-section-py-md: 7rem;
}

/* ─── Renforcement de specificite pour resister au CSS de SIO ─── */
.ff-page .ff-btn:hover,
.ff-page .ff-cta:hover,
.ff-page a.ff-btn:hover,
.ff-page a.ff-cta:hover {
  opacity: 0.92 !important;
  transform: translateY(-1px) !important;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.15) !important;
}

.ff-page .ff-card,
.ff-page .ff-testimonial-card,
.ff-page .ff-pricing-card,
.ff-page .ff-bonus-card,
.ff-page .ff-feature-card {
  transition: transform 0.3s ease, box-shadow 0.3s ease !important;
}
.ff-page .ff-card:hover,
.ff-page .ff-testimonial-card:hover,
.ff-page .ff-pricing-card:hover,
.ff-page .ff-bonus-card:hover,
.ff-page .ff-feature-card:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.18) !important;
}

.ff-page [class*="ff-anim-"] {
  will-change: opacity, transform;
}

/* Force l'animation glow malgre SIO qui peut redefinir animation: none */
.ff-page[data-ff-btn-anim="glow"] .ff-btn,
.ff-page[data-ff-btn-anim="glow"] .ff-cta {
  animation: ff-btn-glow 2.2s ease-in-out infinite !important;
}

/* === Section shadows (image, video, cards) ============================ */
.ff-section.ff-has-shadow .ff-media,
.ff-section.ff-has-shadow .ff-media img,
.ff-section.ff-has-shadow .ff-media video,
.ff-section.ff-has-shadow .ff-video,
.ff-section.ff-has-shadow .ff-image,
.ff-section.ff-has-shadow .ff-card,
.ff-section.ff-has-shadow .ff-feature-card,
.ff-section.ff-has-shadow .ff-bullet-card,
.ff-section.ff-has-shadow .ff-faq-item,
.ff-section.ff-has-shadow .ff-proof-card,
.ff-section.ff-has-shadow .ff-stacked-card {
  box-shadow: var(--ff-shadow) !important;
  border-radius: var(--ff-radius, 14px);
  transition: box-shadow .25s ease, transform .25s ease;
}

/* Renforce un leger lift au hover quand l'ombre est active */
.ff-section.ff-has-shadow .ff-card:hover,
.ff-section.ff-has-shadow .ff-feature-card:hover,
.ff-section.ff-has-shadow .ff-proof-card:hover,
.ff-section.ff-has-shadow .ff-bullet-card:hover {
  transform: translateY(-2px);
}

/* ═══════════════════════════════════════════════════════════════════════════
   BULLETS : modes "grid" et "inline-strip"
   ═══════════════════════════════════════════════════════════════════════════
   Le mode est porte par les classes supplementaires sur la <ul> :
     .ff-bullets               → mode "list" (defaut, plus haut dans ce fichier)
     .ff-bullets--grid         → mode "grid" (cards en grille 2 col desktop)
     .ff-bullets--inline-strip → mode "strip" (horizontal avec separateurs)

   IMPORTANT : on utilise des @container queries sur ff-section pour que
   le rendu s'adapte a la LARGEUR REELLE du bloc, meme dans l'editeur SIO
   qui ne propage pas correctement les @media viewport en preview mobile.
   ═══════════════════════════════════════════════════════════════════════════ */

/* --- Mode "grid" : bullets en cards 2 colonnes (desktop) ------------- */
.ff-bullets--grid {
  list-style: none;
  margin: 24px auto 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  max-width: 920px;
  width: 100%;
}
.ff-bullets--grid > li {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 20px 22px;
  background: var(--ff-surface, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--ff-border, rgba(255, 255, 255, 0.08));
  border-radius: 14px;
  text-align: left;
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
}
.ff-bullets--grid > li:hover {
  transform: translateY(-2px);
  border-color: var(--ff-accent, #f59e0b);
  box-shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.35);
}
.ff-bullets--grid > li .ff-bullet-ic {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin-top: 0;
  border-radius: 8px;
  background: var(--ff-accent-soft, rgba(245, 158, 11, 0.15));
  color: var(--ff-accent, #f59e0b);
}
.ff-bullets--grid > li .ff-bullet-text {
  flex: 1;
  font-size: 0.95rem;
  line-height: 1.5;
  color: inherit;
}

/* 🆕 Variation subtile des cartes (anti-monotonie) — parité aperçu. */
.ff-bullets--grid > li:nth-child(2n) {
  background: color-mix(in srgb, var(--ff-accent) 5%, var(--ff-surface, rgba(255, 255, 255, 0.04)));
}
.ff-bullets--grid > li:nth-child(3n) {
  background: color-mix(in srgb, var(--ff-accent) 9%, var(--ff-surface, rgba(255, 255, 255, 0.04)));
  border-color: color-mix(in srgb, var(--ff-accent) 35%, var(--ff-border, rgba(255, 255, 255, 0.08)));
}

/* 🆕 Eyebrow CENTRÉ au-dessus d'un split (sorti du bloc texte). */
.ff-split-eyebrow-top { text-align: center; margin: 0 auto 1.25rem; }

/* 🆕 Colonne de CARTES d'un split sans image : pile verticale pleine largeur
   dans sa colonne (au lieu d'une grille 2-col écrasée). */
.ff-split-media.ff-split-cards {
  display: block;
  width: 100%;
  align-items: stretch;
  justify-content: stretch;
}
.ff-split-cards .ff-bullets--grid {
  grid-template-columns: 1fr;
  margin: 0;
  max-width: 100%;
}

/* Container query : si la section est etroite (mobile/editeur SIO etroit),
   on passe en 1 colonne */
@container ff-section (max-width: 560px) {
  .ff-bullets--grid {
    grid-template-columns: 1fr !important;
    gap: 12px !important;
  }
  .ff-bullets--grid > li {
    padding: 16px 18px !important;
  }
}
/* Fallback media query (anciens navigateurs / contextes sans container) */
/* 🆕 Export SIO : ces media-queries viewport s'appliquent TOUJOURS (et plus
   seulement en l'absence de container queries), pour activer le layout desktop
   même quand le bloc est collé dans une colonne SIO étroite. Condition
   toujours vraie = « que les container queries soient supportées ou non ». */
@supports (container-type: inline-size) or (not (container-type: inline-size)) {
  @media (max-width: 640px) {
    .ff-bullets--grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }
    .ff-bullets--grid > li {
      padding: 16px 18px;
    }
  }
}

/* --- Mode "inline-strip" : bullets en ligne avec separateurs --------- */
.ff-bullets--inline-strip {
  list-style: none;
  margin: 28px auto 0;
  padding: 20px 0;
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 0;
  max-width: 880px;
  width: 100%;
  flex-wrap: nowrap;
}
.ff-bullets--inline-strip > li {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 24px;
  text-align: center;
  border-right: 1px solid var(--ff-border, rgba(255, 255, 255, 0.15));
}
.ff-bullets--inline-strip > li:last-child {
  border-right: none;
}
/* En mode strip on cache l'icone (la value sert d'accroche visuelle) */
.ff-bullets--inline-strip .ff-bullet-ic {
  display: none;
}
.ff-bullets--inline-strip .ff-strip-value {
  font-size: 2.25rem;
  font-weight: 800;
  line-height: 1.1;
  color: var(--ff-accent, #f59e0b);
  letter-spacing: -0.02em;
  word-break: keep-all;
  overflow-wrap: anywhere;
}
.ff-bullets--inline-strip .ff-strip-label {
  font-size: 0.875rem;
  line-height: 1.4;
  color: var(--ff-muted, rgba(255, 255, 255, 0.65));
  font-weight: 500;
  overflow-wrap: anywhere;
}
/* Sans label (un seul span dans le <li>) : la "value" devient un mot-cle
   plus discret, pas un grand chiffre */
.ff-bullets--inline-strip > li:not(:has(.ff-strip-label)) .ff-strip-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: inherit;
  letter-spacing: 0;
}

/* Container query : si la section est etroite, on passe en colonne avec
   des separateurs HORIZONTAUX a la place des verticaux */
@container ff-section (max-width: 560px) {
  .ff-bullets--inline-strip {
    flex-direction: column !important;
    padding: 12px 0 !important;
    max-width: 100% !important;
  }
  .ff-bullets--inline-strip > li {
    width: 100% !important;
    padding: 16px 12px !important;
    border-right: none !important;
    border-bottom: 1px solid var(--ff-border, rgba(255, 255, 255, 0.15)) !important;
  }
  .ff-bullets--inline-strip > li:last-child {
    border-bottom: none !important;
  }
  .ff-bullets--inline-strip .ff-strip-value {
    font-size: 1.875rem !important;
  }
}
/* Fallback media query */
/* 🆕 Export SIO : ces media-queries viewport s'appliquent TOUJOURS (et plus
   seulement en l'absence de container queries), pour activer le layout desktop
   même quand le bloc est collé dans une colonne SIO étroite. Condition
   toujours vraie = « que les container queries soient supportées ou non ». */
@supports (container-type: inline-size) or (not (container-type: inline-size)) {
  @media (max-width: 640px) {
    .ff-bullets--inline-strip {
      flex-direction: column;
      padding: 12px 0;
      max-width: 100%;
    }
    .ff-bullets--inline-strip > li {
      width: 100%;
      padding: 16px 12px;
      border-right: none;
      border-bottom: 1px solid var(--ff-border, rgba(255, 255, 255, 0.15));
    }
    .ff-bullets--inline-strip > li:last-child {
      border-bottom: none;
    }
    .ff-bullets--inline-strip .ff-strip-value {
      font-size: 1.875rem;
    }
  }
}

/* --- Body : largeur max pour rester lisible (centre par defaut) ----- */
.ff-section .ff-body {
  max-width: 640px;
  margin-left: auto;
  margin-right: auto;
}
.ff-layout-left-aligned .ff-body,
.ff-layout-split .ff-split-text .ff-body {
  margin-left: 0;
  margin-right: 0;
}
/* ═══════════════════════════════════════════════════════════════════════════
   Mots/groupes de mots mis en valeur via la syntaxe [[texte]] ou
   [[texte|#hexcolor]] dans les champs texte. Voir applyInlineHighlights()
   dans lib/export/html.ts.
   ═══════════════════════════════════════════════════════════════════════════ */
.ff-hl {
  color: var(--ff-accent);
  font-weight: inherit;
}
/* Quand le texte est dans une headline, on ajoute un leger effet "surligneur"
   pour donner plus de presence visuelle (style Linear / Framer). */
.ff-headline .ff-hl {
  background-image: none;
  text-decoration: underline;
  text-decoration-color: var(--ff-accent);
  text-decoration-thickness: 0.18em;
  text-underline-offset: 0.05em;
  padding: 0 4px;
  border-radius: 2px;
}
/* Si l'utilisateur a force une couleur custom via [[texte|#xxx]], on respecte
   sa couleur mais on retire l'effet surligneur (qui ne correspondrait plus). */
.ff-headline .ff-hl[style*="color"] {
  background-image: none;
  padding: 0;
}
/* Fallback pour navigateurs sans color-mix() */
@supports not (color: color-mix(in srgb, red, blue)) {
  .ff-headline .ff-hl {
    background-image: none;
    text-decoration: underline;
    text-decoration-color: var(--ff-accent);
    text-decoration-thickness: 0.18em;
    text-underline-offset: 0.05em;
  }
}
/* ═══════════════════════════════════════════════════════════════════════════
   29. TIMERS — Countdown / Seats counter
   ═══════════════════════════════════════════════════════════════════════════
   Le composant React TimerRenderer applique les styles inline (couleurs,
   tailles, dimensions). Ces règles ne font que :
   - centrer / contraindre le timer
   - lisser les transitions
   - définir l'animation de pulse sur les secondes (mode "digital")
   - ajuster les espacements mobiles
   ═══════════════════════════════════════════════════════════════════════════ */

.ff-page .ff-timer {
  display: block;
  margin-left: auto;
  margin-right: auto;
  max-width: 720px;
  text-align: center;
}

.ff-page .ff-timer--cards > div:last-child > div,
.ff-page .ff-timer--digital > div:last-child > div {
  transition: transform 0.2s ease;
}

.ff-page .ff-timer--cards > div:last-child > div:hover {
  transform: translateY(-2px);
}

@keyframes ff-timer-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.7; }
}

.ff-page .ff-timer--digital span[style*="opacity: 0.5"] {
  animation: ff-timer-pulse 1s ease-in-out infinite;
}

/* Compactage mobile : on resserre la grille pour éviter les débordements
   et on réduit le padding des cards xl/lg sur petit écran. */
@container ffpage (max-width: 640px) {
  .ff-page .ff-timer--cards > div:last-child,
  .ff-page .ff-timer--digital > div:last-child {
    gap: 0.375rem !important;
  }
  .ff-page .ff-timer--cards [data-ff-timer-size="xl"] > div:last-child > div,
  .ff-page .ff-timer--cards [data-ff-timer-size="lg"] > div:last-child > div {
    padding: 0.5rem 0.625rem !important;
  }
}
/* 🆕 Export SIO : ces media-queries viewport s'appliquent TOUJOURS (et plus
   seulement en l'absence de container queries), pour activer le layout desktop
   même quand le bloc est collé dans une colonne SIO étroite. Condition
   toujours vraie = « que les container queries soient supportées ou non ». */
@supports (container-type: inline-size) or (not (container-type: inline-size)) {
  @media (max-width: 640px) {
    .ff-page .ff-timer--cards > div:last-child,
    .ff-page .ff-timer--digital > div:last-child {
      gap: 0.375rem;
    }
    .ff-page .ff-timer--cards [data-ff-timer-size="xl"] > div:last-child > div,
    .ff-page .ff-timer--cards [data-ff-timer-size="lg"] > div:last-child > div {
      padding: 0.5rem 0.625rem;
    }
  }
}

/* 30. TESTIMONIAL MEDIAS (Sprint B2) */
.ff-page .ff-testimonial-media img,
.ff-page .ff-testimonial-media video {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(0, 0, 0, 0.04);
}
.ff-page .ff-testimonial-media--video {
  border-radius: 12px;
  overflow: hidden;
  background: #000;
}
.ff-page .ff-testimonial-media-gallery {
  margin-bottom: 1.25rem;
}
@media (max-width: 640px) {
  .ff-page .ff-testimonial-media-gallery {
    grid-template-columns: 1fr !important;
  }
}
/* SIO-FIX : SIO applique text-decoration:underline par défaut sur span colorés et enfants de headings */
.ff-page span,
.ff-page .ff-h1 span,
.ff-page .ff-headline span,
.ff-page h1 span,
.ff-page h2 span,
.ff-page h3 span,
.ff-page a.ff-btn,
.ff-page a.ff-brand-cta {
  text-decoration: none !important;
}
.ff-page .ff-body span[style*="color"],
.ff-page .ff-headline span[style*="color"],
.ff-page .ff-h1 span[style*="color"] {
  text-decoration: none !important;
  border-bottom: none !important;
}
/* SIO-FIX v1 : SIO applique text-decoration:underline aux spans colorés dans les headings */
.ff-page span,
.ff-page .ff-h1 span,
.ff-page .ff-h2 span,
.ff-page .ff-headline span,
.ff-page h1 span,
.ff-page h2 span,
.ff-page h3 span,
.ff-page .ff-body span,
.ff-page .ff-eyebrow span {
  text-decoration: none !important;
  border-bottom: none !important;
}
.ff-page a.ff-btn,
.ff-page a.ff-brand-cta,
.ff-page a.ff-brand-cta.ff-btn {
  text-decoration: none !important;
}
/* ═══════════════════════════════════════════════════════════════════════════
   RAW-HTML CLONED SECTIONS — Pleine largeur sur Systeme.io
   ═══════════════════════════════════════════════════════════════════════════
   Quand une section est entièrement clonée depuis un site externe
   (data-ff-raw-html="true"), elle apporte SA PROPRE structure de centrage
   (ex: .dKrHLy max-width 960px chez SIO). On doit donc :
     1. Annuler le padding latéral du wrapper .ff-section
     2. Annuler la max-width du .ff-section-inner (s'il existe)
     3. Forcer .ff-page à occuper toute la largeur quand TOUTES les sections
        sont des raw-html (cas "fully cloned")
   ═══════════════════════════════════════════════════════════════════════════ */

/* Cas 1 : funnel entièrement cloné → .ff-page pleine largeur sans padding */
.ff-page[data-ff-fully-cloned="true"] {
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* Cas 2 : section raw-html individuelle → on retire le padding latéral
   et toute contrainte de largeur du wrapper FunnelFlow.
   Le HTML cloné gère LUI-MÊME son centrage interne. */
.ff-page .ff-section.ff-raw-html,
.ff-page .ff-section[data-ff-raw-html="true"] {
  padding-left: 0 !important;
  padding-right: 0 !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
}

/* Le .ff-section-inner éventuel à l'intérieur d'une raw-html doit aussi
   être neutralisé (au cas où il aurait été généré par erreur). */
.ff-page .ff-section.ff-raw-html > .ff-section-inner,
.ff-page .ff-section[data-ff-raw-html="true"] > .ff-section-inner {
  max-width: 100% !important;
  width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  display: block !important;
  text-align: initial !important;
  align-items: initial !important;
}

/* Le contenu cloné direct (premier enfant de la raw-html) doit pouvoir
   prendre toute la largeur — c'est lui qui décide de sa propre contrainte
   (ex: max-width: 960px sur le .dKrHLy de SIO). */
.ff-page .ff-section.ff-raw-html > *,
.ff-page .ff-section[data-ff-raw-html="true"] > * {
  max-width: 100%;
  width: 100%;
}

/* Petit garde-fou : si le funnel cloné contient des éléments avec une
   largeur explicite > viewport (ex: width="1000" sur une image), on
   force le respect du viewport pour éviter le scroll horizontal. */
.ff-page[data-ff-fully-cloned="true"] img,
.ff-page[data-ff-fully-cloned="true"] picture {
  max-width: 100% !important;
  height: auto;
}

/* Annule la bordure-séparateur entre sections quand elles sont clonées
   (le séparateur est conçu pour les sections FunnelFlow natives) */
.ff-page .ff-section.ff-raw-html::after,
.ff-page .ff-section[data-ff-raw-html="true"]::after {
  display: none !important;
}

/* Pas d'alternance de fond sur les sections clonées (elles ont leur
   propre background-image / background-color via le site source) */
.ff-page .ff-section.ff-raw-html,
.ff-page .ff-section[data-ff-raw-html="true"] {
  background-color: transparent !important;
  border-top: none !important;
  border-bottom: none !important;
}

`;


// ─────────────────────────────────────────────────────────────────────────────
// 2. THEMES — 9 themes (header/footer adaptatifs par thème)
// ─────────────────────────────────────────────────────────────────────────────

const THEMES_CSS = `
/* ═══ CLEAN LIGHT ═══ */
.ff-page[data-ff-theme="clean-light"] {
  --ff-bg: #ffffff;
  --ff-surface: #fafafa;
  --ff-ink: #09090b;
  --ff-ink-soft: #52525b;
  --ff-muted: #a1a1aa;
  --ff-border: rgba(24, 24, 27, 0.08);
  --ff-accent: #000000;
  --ff-accent-ink: #ffffff;
  --ff-accent-soft: rgba(0, 0, 0, 0.10);
  --ff-accent-card: rgba(0, 0, 0, 0.04);
  --ff-accent-glow: rgba(0, 0, 0, 0.25);
  --ff-btn-glow-color: rgba(0, 0, 0, 0.4);
  --ff-font-heading: "Inter", system-ui, -apple-system, sans-serif;
  --ff-heading-weight: 800;
  --ff-heading-tracking: -0.03em;
  --ff-heading-leading: 1.12;
  --ff-btn-radius: 999px;
  --ff-btn-bg: #09090b;
  --ff-btn-ink: #ffffff;
  --ff-btn-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  --ff-section-alt-1: #fafafa;
  --ff-section-alt-2: #f4f4f5;
  --ff-section-alt-border: rgba(0, 0, 0, 0.04);
  /* Header / Footer */
  --ff-brand-bar-bg: #ffffff;
  --ff-brand-bar-ink: #09090b;
  --ff-brand-bar-border: rgba(0, 0, 0, 0.06);
  --ff-footer-bg: #fafafa;
  --ff-footer-ink: #52525b;
  --ff-footer-business-ink: #09090b;
  --ff-footer-border: rgba(0, 0, 0, 0.06);
  background-image:
    radial-gradient(at 0% 0%, rgba(0, 0, 0, 0.03) 0px, transparent 50%),
    radial-gradient(at 100% 0%, rgba(0, 0, 0, 0.02) 0px, transparent 50%);
}
.ff-page[data-ff-theme="clean-light"] .ff-card {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02), 0 12px 24px -12px rgba(0, 0, 0, 0.05);
}

/* ═══ CLEAN DARK ═══ */
.ff-page[data-ff-theme="clean-dark"] {
  --ff-bg: #09090b;
  --ff-surface: #18181b;
  --ff-ink: #fafafa;
  --ff-ink-soft: #a1a1aa;
  --ff-muted: #3f3f46;
  --ff-border: rgba(255, 255, 255, 0.08);
  --ff-accent: #ffffff;
  --ff-accent-ink: #000000;
  --ff-accent-soft: rgba(255, 255, 255, 0.12);
  --ff-accent-card: rgba(255, 255, 255, 0.05);
  --ff-accent-glow: rgba(255, 255, 255, 0.30);
  --ff-btn-glow-color: rgba(255, 255, 255, 0.35);
  --ff-font-heading: "Inter", system-ui, -apple-system, sans-serif;
  --ff-heading-weight: 800;
  --ff-heading-tracking: -0.03em;
  --ff-heading-leading: 1.12;
  --ff-btn-radius: 999px;
  --ff-btn-bg: #fafafa;
  --ff-btn-ink: #09090b;
  --ff-section-alt-1: rgba(255, 255, 255, 0.02);
  --ff-section-alt-2: rgba(255, 255, 255, 0.04);
  --ff-section-alt-border: rgba(255, 255, 255, 0.06);
  --ff-brand-bar-bg: #09090b;
  --ff-brand-bar-ink: #fafafa;
  --ff-brand-bar-border: rgba(255, 255, 255, 0.10);
  --ff-footer-bg: #050507;
  --ff-footer-ink: rgba(250, 250, 250, 0.65);
  --ff-footer-business-ink: #fafafa;
  --ff-footer-border: rgba(255, 255, 255, 0.08);
  background-image:
    radial-gradient(at 50% -20%, rgba(255, 255, 255, 0.05) 0px, transparent 50%),
    linear-gradient(to bottom, #09090b, #000000);
}
.ff-page[data-ff-theme="clean-dark"] .ff-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* ═══ COACHING PREMIUM ═══ */
.ff-page[data-ff-theme="coaching-premium"] {
  --ff-bg: #1a1d24;
  --ff-surface: #21252e;
  --ff-ink: #f0eee9;
  --ff-ink-soft: #c4c2bc;
  --ff-muted: #8a8780;
  --ff-border: rgba(255, 255, 255, 0.08);
  --ff-accent: #d4a574;
  --ff-accent-ink: #1a1d24;
  --ff-accent-soft: rgba(212, 165, 116, 0.20);
  --ff-accent-card: rgba(212, 165, 116, 0.10);
  --ff-accent-glow: rgba(212, 165, 116, 0.40);
  --ff-btn-glow-color: rgba(212, 165, 116, 0.45);
  --ff-font-heading: "Playfair Display", "Cormorant Garamond", Georgia, serif;
  --ff-font-body: "Inter", system-ui, sans-serif;
  --ff-heading-weight: 600;
  --ff-heading-tracking: -0.02em;
  --ff-heading-leading: 1.18;
  --ff-btn-radius: 999px;
  --ff-btn-bg: #d4a574;
  --ff-btn-ink: #1a1d24;
  --ff-btn-shadow: 0 8px 24px rgba(212, 165, 116, 0.30);
  --ff-section-alt-1: rgba(255, 255, 255, 0.02);
  --ff-section-alt-2: rgba(212, 165, 116, 0.06);
  --ff-section-alt-border: rgba(212, 165, 116, 0.18);
  --ff-brand-bar-bg: #1a1d24;
  --ff-brand-bar-ink: #f0eee9;
  --ff-brand-bar-border: rgba(212, 165, 116, 0.15);
  --ff-footer-bg: #14171c;
  --ff-footer-ink: rgba(240, 238, 233, 0.65);
  --ff-footer-business-ink: #f0eee9;
  --ff-footer-border: rgba(212, 165, 116, 0.15);
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: 60px 60px;
}
.ff-page[data-ff-theme="coaching-premium"] .ff-headline { font-style: italic; }
.ff-page[data-ff-theme="coaching-premium"]::before {
  width: 60%; height: 60%; top: -15%; right: -20%;
  background: radial-gradient(circle, rgba(212, 165, 116, 0.30), transparent 65%);
  opacity: 0.6;
  animation: ff-decor-drift 28s ease-in-out infinite;
}

/* ═══ BOLD ENERGY ═══ */
.ff-page[data-ff-theme="bold-energy"] {
  --ff-bg: #1a0808;
  --ff-surface: #220c0c;
  --ff-ink: #fff5ee;
  --ff-ink-soft: #fde9d4;
  --ff-muted: #b89579;
  --ff-border: rgba(255, 107, 53, 0.25);
  --ff-accent: #ff6b35;
  --ff-accent-ink: #1a0808;
  --ff-accent-soft: rgba(255, 107, 53, 0.22);
  --ff-accent-card: rgba(255, 107, 53, 0.12);
  --ff-accent-glow: rgba(255, 107, 53, 0.50);
  --ff-btn-glow-color: rgba(255, 107, 53, 0.55);
  --ff-font-heading: "Bricolage Grotesque", "Space Grotesk", "Inter", system-ui, sans-serif;
  --ff-heading-weight: 800;
  --ff-heading-tracking: -0.03em;
  --ff-heading-leading: 1.1;
  --ff-btn-radius: 999px;
  --ff-btn-bg: linear-gradient(135deg, #ff6b35 0%, #e07a3e 100%);
  --ff-btn-ink: #fff5ee;
  --ff-btn-shadow: 0 16px 40px rgba(255, 107, 53, 0.50);
  --ff-section-alt-1: rgba(255, 255, 255, 0.035);
  --ff-section-alt-2: rgba(255, 107, 53, 0.13);
  --ff-section-alt-border: rgba(255, 107, 53, 0.30);
  --ff-brand-bar-bg: #1a0808;
  --ff-brand-bar-ink: #fff5ee;
  --ff-brand-bar-border: rgba(255, 107, 53, 0.25);
  --ff-footer-bg: #120505;
  --ff-footer-ink: rgba(255, 245, 238, 0.65);
  --ff-footer-business-ink: #fff5ee;
  --ff-footer-border: rgba(255, 107, 53, 0.20);
  background-image:
    radial-gradient(ellipse at 20% 0%, rgba(255, 107, 53, 0.18), transparent 50%),
    radial-gradient(ellipse at 80% 100%, rgba(255, 107, 53, 0.12), transparent 50%),
    linear-gradient(180deg, #1a0808 0%, #220c0c 100%);
}
.ff-page[data-ff-theme="bold-energy"] .ff-headline { text-transform: none; }
.ff-page[data-ff-theme="bold-energy"] .ff-eyebrow {
  background: rgba(255, 107, 53, 0.22);
  color: #ff8a5b;
  border-color: rgba(255, 107, 53, 0.35);
}
.ff-page[data-ff-theme="bold-energy"]::before {
  width: 60%; height: 60%; top: -20%; left: -15%;
  background: radial-gradient(circle, rgba(255, 107, 53, 0.55), transparent 65%);
  opacity: 0.7;
  animation: ff-decor-drift 20s ease-in-out infinite;
}
.ff-page[data-ff-theme="bold-energy"]::after {
  width: 55%; height: 55%; top: -10%; right: -15%;
  background: radial-gradient(circle, rgba(255, 87, 51, 0.45), transparent 65%);
  opacity: 0.55;
  animation: ff-decor-drift 26s ease-in-out infinite reverse;
}

/* ═══ PREMIUM MINIMAL ═══ */
.ff-page[data-ff-theme="premium-minimal"] {
  --ff-bg: #ffffff;
  --ff-surface: #fafafa;
  --ff-ink: #000000;
  --ff-ink-soft: #4b5563;
  --ff-muted: #9ca3af;
  --ff-border: rgba(0, 0, 0, 0.06);
  --ff-accent: #000000;
  --ff-accent-ink: #ffffff;
  --ff-accent-soft: rgba(0, 0, 0, 0.08);
  --ff-accent-card: rgba(0, 0, 0, 0.03);
  --ff-accent-glow: rgba(0, 0, 0, 0.25);
  --ff-btn-glow-color: rgba(0, 0, 0, 0.35);
  --ff-font-heading: "Playfair Display", Georgia, serif;
  --ff-heading-weight: 600;
  --ff-heading-tracking: -0.02em;
  --ff-heading-leading: 1.15;
  --ff-btn-radius: 999px;
  --ff-btn-bg: #000000;
  --ff-btn-ink: #ffffff;
  --ff-btn-shadow: 0 4px 12px rgba(0, 0, 0, 0.10);
  --ff-section-alt-1: #fafafa;
  --ff-section-alt-2: #f4f4f5;
  --ff-section-alt-border: rgba(0, 0, 0, 0.04);
  --ff-brand-bar-bg: #ffffff;
  --ff-brand-bar-ink: #000000;
  --ff-brand-bar-border: rgba(0, 0, 0, 0.06);
  --ff-footer-bg: #fafafa;
  --ff-footer-ink: #4b5563;
  --ff-footer-business-ink: #000000;
  --ff-footer-border: rgba(0, 0, 0, 0.06);
  background-image:
    radial-gradient(at 0% 0%, rgba(0, 0, 0, 0.02) 0px, transparent 50%),
    radial-gradient(at 100% 100%, rgba(0, 0, 0, 0.01) 0px, transparent 50%);
}
.ff-page[data-ff-theme="premium-minimal"] .ff-card {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02), 0 8px 16px -4px rgba(0, 0, 0, 0.04);
}

/* ═══ SHARP LAUNCH ═══ */
.ff-page[data-ff-theme="sharp-launch"] {
  --ff-bg: #05080a;
  --ff-surface: #0a0f14;
  --ff-ink: #f1f5f9;
  --ff-ink-soft: #cbd5e1;
  --ff-muted: #64748b;
  --ff-border: rgba(34, 211, 238, 0.20);
  --ff-accent: #22d3ee;
  --ff-accent-ink: #05080a;
  --ff-accent-soft: rgba(34, 211, 238, 0.20);
  --ff-accent-card: rgba(34, 211, 238, 0.10);
  --ff-accent-glow: rgba(34, 211, 238, 0.45);
  --ff-btn-glow-color: rgba(34, 211, 238, 0.50);
  --ff-font-heading: "Space Grotesk", "Inter", sans-serif;
  --ff-heading-weight: 700;
  --ff-heading-tracking: -0.025em;
  --ff-heading-leading: 1.12;
  --ff-btn-radius: 999px;
  --ff-btn-bg: linear-gradient(180deg, #67e8f9 0%, #22d3ee 100%);
  --ff-btn-ink: #05080a;
  --ff-btn-shadow: 0 8px 24px rgba(34, 211, 238, 0.40);
  --ff-anim-duration: 400ms;
  --ff-section-alt-1: rgba(255, 255, 255, 0.03);
  --ff-section-alt-2: rgba(34, 211, 238, 0.10);
  --ff-section-alt-border: rgba(34, 211, 238, 0.25);
  --ff-brand-bar-bg: #05080a;
  --ff-brand-bar-ink: #f1f5f9;
  --ff-brand-bar-border: rgba(34, 211, 238, 0.20);
  --ff-footer-bg: #030507;
  --ff-footer-ink: rgba(241, 245, 249, 0.65);
  --ff-footer-business-ink: #f1f5f9;
  --ff-footer-border: rgba(34, 211, 238, 0.15);
  background-image:
    radial-gradient(ellipse at 50% 0%, rgba(34, 211, 238, 0.15), transparent 60%),
    linear-gradient(180deg, #05080a 0%, #0a0f14 100%);
}
.ff-page[data-ff-theme="sharp-launch"]::before {
  width: 80%; height: 50%; top: -20%; left: 10%;
  background: radial-gradient(circle, rgba(34, 211, 238, 0.45), transparent 70%);
  opacity: 0.55;
}

/* ═══ WEBINAR LIVE (🆕 thème créé — indigo sur navy) ═══ */
.ff-page[data-ff-theme="webinar-live"] {
  --ff-bg: #0b1228;
  --ff-surface: #141a35;
  --ff-ink: #eef2ff;
  --ff-ink-soft: #c7d0f5;
  --ff-muted: #8a93c2;
  --ff-border: rgba(99, 102, 241, 0.22);
  --ff-accent: #6366f1;
  --ff-accent-ink: #ffffff;
  --ff-accent-soft: rgba(99, 102, 241, 0.20);
  --ff-accent-card: rgba(99, 102, 241, 0.12);
  --ff-accent-glow: rgba(99, 102, 241, 0.45);
  --ff-btn-glow-color: rgba(99, 102, 241, 0.50);
  --ff-heading-weight: 800;
  --ff-heading-tracking: -0.02em;
  --ff-heading-leading: 1.12;
  --ff-btn-radius: 10px;
  --ff-btn-bg: linear-gradient(180deg, #818cf8 0%, #6366f1 100%);
  --ff-btn-ink: #ffffff;
  --ff-btn-shadow: 0 8px 24px rgba(99, 102, 241, 0.40);
  --ff-section-alt-1: rgba(255, 255, 255, 0.03);
  --ff-section-alt-2: rgba(99, 102, 241, 0.10);
  --ff-section-alt-border: rgba(99, 102, 241, 0.25);
  --ff-brand-bar-bg: #0b1228;
  --ff-brand-bar-ink: #eef2ff;
  --ff-brand-bar-border: rgba(99, 102, 241, 0.22);
  --ff-footer-bg: #070c1c;
  --ff-footer-ink: rgba(238, 242, 255, 0.65);
  --ff-footer-business-ink: #eef2ff;
  --ff-footer-border: rgba(99, 102, 241, 0.15);
  background-image:
    radial-gradient(ellipse at 50% 0%, rgba(99, 102, 241, 0.16), transparent 60%),
    linear-gradient(180deg, #0b1228 0%, #141a35 100%);
}
.ff-page[data-ff-theme="webinar-live"]::before {
  width: 80%; height: 50%; top: -20%; left: 10%;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.45), transparent 70%);
  opacity: 0.5;
}

/* ═══ SHOWCASE (🆕 thème créé — émeraude sur charbon) ═══ */
.ff-page[data-ff-theme="showcase"] {
  --ff-bg: #0e1116;
  --ff-surface: #161b22;
  --ff-ink: #ecfdf5;
  --ff-ink-soft: #b9e7d4;
  --ff-muted: #6b8c7f;
  --ff-border: rgba(52, 211, 153, 0.22);
  --ff-accent: #34d399;
  --ff-accent-ink: #04231a;
  --ff-accent-soft: rgba(52, 211, 153, 0.20);
  --ff-accent-card: rgba(52, 211, 153, 0.12);
  --ff-accent-glow: rgba(52, 211, 153, 0.45);
  --ff-btn-glow-color: rgba(52, 211, 153, 0.50);
  --ff-heading-weight: 800;
  --ff-heading-tracking: -0.02em;
  --ff-heading-leading: 1.12;
  --ff-btn-radius: 12px;
  --ff-btn-bg: linear-gradient(180deg, #6ee7b7 0%, #34d399 100%);
  --ff-btn-ink: #04231a;
  --ff-btn-shadow: 0 8px 24px rgba(52, 211, 153, 0.38);
  --ff-section-alt-1: rgba(255, 255, 255, 0.03);
  --ff-section-alt-2: rgba(52, 211, 153, 0.10);
  --ff-section-alt-border: rgba(52, 211, 153, 0.25);
  --ff-brand-bar-bg: #0e1116;
  --ff-brand-bar-ink: #ecfdf5;
  --ff-brand-bar-border: rgba(52, 211, 153, 0.22);
  --ff-footer-bg: #090c10;
  --ff-footer-ink: rgba(236, 253, 245, 0.65);
  --ff-footer-business-ink: #ecfdf5;
  --ff-footer-border: rgba(52, 211, 153, 0.15);
  background-image:
    radial-gradient(ellipse at 50% 0%, rgba(52, 211, 153, 0.15), transparent 60%),
    linear-gradient(180deg, #0e1116 0%, #161b22 100%);
}
.ff-page[data-ff-theme="showcase"]::before {
  width: 80%; height: 50%; top: -20%; left: 10%;
  background: radial-gradient(circle, rgba(52, 211, 153, 0.42), transparent 70%);
  opacity: 0.5;
}

/* ═══ VSL FOCUS (🆕 thème créé — bleu ciel sur nuit) ═══ */
.ff-page[data-ff-theme="vsl-focus"] {
  --ff-bg: #070a12;
  --ff-surface: #0e1422;
  --ff-ink: #eef2f8;
  --ff-ink-soft: #c2cde0;
  --ff-muted: #6b7894;
  --ff-border: rgba(56, 189, 248, 0.22);
  --ff-accent: #38bdf8;
  --ff-accent-ink: #04141f;
  --ff-accent-soft: rgba(56, 189, 248, 0.20);
  --ff-accent-card: rgba(56, 189, 248, 0.12);
  --ff-accent-glow: rgba(56, 189, 248, 0.45);
  --ff-btn-glow-color: rgba(56, 189, 248, 0.50);
  --ff-heading-weight: 800;
  --ff-heading-tracking: -0.02em;
  --ff-heading-leading: 1.12;
  --ff-btn-radius: 10px;
  --ff-btn-bg: linear-gradient(180deg, #7dd3fc 0%, #38bdf8 100%);
  --ff-btn-ink: #04141f;
  --ff-btn-shadow: 0 8px 24px rgba(56, 189, 248, 0.38);
  --ff-section-alt-1: rgba(255, 255, 255, 0.03);
  --ff-section-alt-2: rgba(56, 189, 248, 0.10);
  --ff-section-alt-border: rgba(56, 189, 248, 0.25);
  --ff-brand-bar-bg: #070a12;
  --ff-brand-bar-ink: #eef2f8;
  --ff-brand-bar-border: rgba(56, 189, 248, 0.22);
  --ff-footer-bg: #04060c;
  --ff-footer-ink: rgba(238, 242, 248, 0.65);
  --ff-footer-business-ink: #eef2f8;
  --ff-footer-border: rgba(56, 189, 248, 0.15);
  background-image:
    radial-gradient(ellipse at 50% 0%, rgba(56, 189, 248, 0.15), transparent 60%),
    linear-gradient(180deg, #070a12 0%, #0e1422 100%);
}
.ff-page[data-ff-theme="vsl-focus"]::before {
  width: 80%; height: 50%; top: -20%; left: 10%;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.42), transparent 70%);
  opacity: 0.5;
}

/* ═══ TRUST PRO ═══ */
.ff-page[data-ff-theme="trust-pro"] {
  --ff-bg: #0b1e3d;
  --ff-surface: #0f2847;
  --ff-ink: #e2e8f0;
  --ff-ink-soft: #94a3b8;
  --ff-muted: #6b8aaf;
  --ff-border: rgba(6, 182, 212, 0.20);
  --ff-accent: #06b6d4;
  --ff-accent-ink: #ffffff;
  --ff-accent-soft: rgba(6, 182, 212, 0.20);
  --ff-accent-card: rgba(6, 182, 212, 0.10);
  --ff-accent-glow: rgba(6, 182, 212, 0.40);
  --ff-btn-glow-color: rgba(6, 182, 212, 0.45);
  --ff-font-heading: "Inter", system-ui, sans-serif;
  --ff-font-body: "Inter", system-ui, sans-serif;
  --ff-heading-weight: 700;
  --ff-heading-tracking: -0.02em;
  --ff-heading-leading: 1.15;
  --ff-btn-radius: 999px;
  --ff-btn-bg: #06b6d4;
  --ff-btn-ink: #ffffff;
  --ff-btn-shadow: 0 6px 16px rgba(6, 182, 212, 0.30);
  --ff-section-alt-1: rgba(255, 255, 255, 0.03);
  --ff-section-alt-2: rgba(6, 182, 212, 0.10);
  --ff-section-alt-border: rgba(6, 182, 212, 0.25);
  --ff-brand-bar-bg: #0b1e3d;
  --ff-brand-bar-ink: #e2e8f0;
  --ff-brand-bar-border: rgba(6, 182, 212, 0.18);
  --ff-footer-bg: #07152b;
  --ff-footer-ink: rgba(226, 232, 240, 0.65);
  --ff-footer-business-ink: #e2e8f0;
  --ff-footer-border: rgba(6, 182, 212, 0.18);
  background-image:
    radial-gradient(ellipse at 0% 0%, rgba(6, 182, 212, 0.18), transparent 50%),
    radial-gradient(ellipse at 100% 100%, rgba(6, 182, 212, 0.12), transparent 50%),
    linear-gradient(135deg, #0b1e3d 0%, #0f2847 100%);
}
.ff-page[data-ff-theme="trust-pro"] .ff-eyebrow {
  background: rgba(6, 182, 212, 0.15);
  color: #67e8f9;
}
.ff-page[data-ff-theme="trust-pro"]::before {
  width: 55%; height: 55%; top: -15%; left: -15%;
  background: radial-gradient(circle, rgba(6, 182, 212, 0.45), transparent 65%);
  opacity: 0.6;
  animation: ff-decor-drift 30s ease-in-out infinite;
}
.ff-page[data-ff-theme="trust-pro"]::after {
  width: 50%; height: 50%; bottom: -15%; right: -15%;
  background: radial-gradient(circle, rgba(6, 182, 212, 0.30), transparent 65%);
  opacity: 0.5;
  animation: ff-decor-drift 36s ease-in-out infinite reverse;
}

/* ═══ LEAD SNAP ═══ */
.ff-page[data-ff-theme="lead-snap"] {
  --ff-bg: #1a0f2e;
  --ff-surface: #271847;
  --ff-ink: #f3e8ff;
  --ff-ink-soft: #c4b5dc;
  --ff-muted: #8c7aab;
  --ff-border: rgba(192, 132, 252, 0.20);
  --ff-accent: #c084fc;
  --ff-accent-ink: #1a0f2e;
  --ff-accent-soft: rgba(192, 132, 252, 0.22);
  --ff-accent-card: rgba(192, 132, 252, 0.12);
  --ff-accent-glow: rgba(192, 132, 252, 0.50);
  --ff-btn-glow-color: rgba(192, 132, 252, 0.50);
  --ff-font-heading: "Space Grotesk", "Inter", sans-serif;
  --ff-font-body: "Inter", system-ui, sans-serif;
  --ff-heading-weight: 700;
  --ff-heading-tracking: -0.02em;
  --ff-heading-leading: 1.12;
  --ff-btn-radius: 999px;
  --ff-btn-bg: linear-gradient(135deg, #c084fc 0%, #a855f7 100%);
  --ff-btn-ink: #1a0f2e;
  --ff-btn-shadow: 0 8px 24px rgba(192, 132, 252, 0.45);
  --ff-anim-duration: 350ms;
  --ff-section-alt-1: rgba(255, 255, 255, 0.035);
  --ff-section-alt-2: rgba(192, 132, 252, 0.12);
  --ff-section-alt-border: rgba(192, 132, 252, 0.28);
  --ff-brand-bar-bg: #1a0f2e;
  --ff-brand-bar-ink: #f3e8ff;
  --ff-brand-bar-border: rgba(192, 132, 252, 0.18);
  --ff-footer-bg: #120921;
  --ff-footer-ink: rgba(243, 232, 255, 0.65);
  --ff-footer-business-ink: #f3e8ff;
  --ff-footer-border: rgba(192, 132, 252, 0.18);
  background-color: #1a0f2e;
  background-image:
    linear-gradient(rgba(192, 132, 252, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(192, 132, 252, 0.06) 1px, transparent 1px),
    radial-gradient(ellipse at 100% 0%, rgba(192, 132, 252, 0.18), transparent 55%);
  background-size: 32px 32px, 32px 32px, 100% 100%;
}
.ff-page[data-ff-theme="lead-snap"]::before {
  width: 50%; height: 50%; top: -15%; right: -15%;
  background: radial-gradient(circle, rgba(192, 132, 252, 0.40), transparent 65%);
  opacity: 0.6;
}
.ff-page[data-ff-theme="lead-snap"]::after {
  width: 35%; height: 35%; bottom: -10%; left: -10%;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.30), transparent 65%);
  opacity: 0.5;
}

/* ═══ STORY SELL ═══ */
.ff-page[data-ff-theme="story-sell"] {
  --ff-bg: #0f0805;
  --ff-surface: #14100a;
  --ff-ink: #f5efe6;
  --ff-ink-soft: #cbd5e1;
  --ff-muted: #94a3b8;
  --ff-border: rgba(212, 175, 55, 0.18);
  --ff-accent: #d4af37;
  --ff-accent-ink: #0f0805;
  --ff-accent-soft: rgba(212, 175, 55, 0.22);
  --ff-accent-card: rgba(212, 175, 55, 0.12);
  --ff-accent-glow: rgba(212, 175, 55, 0.50);
  --ff-btn-glow-color: rgba(212, 175, 55, 0.50);
  --ff-font-heading: "Playfair Display", "Cormorant Garamond", Georgia, serif;
  --ff-font-body: "Inter", system-ui, sans-serif;
  --ff-heading-weight: 600;
  --ff-heading-tracking: -0.01em;
  --ff-heading-leading: 1.18;
  --ff-btn-radius: 999px;
  --ff-btn-bg: linear-gradient(180deg, #d4b04a 0%, #c7a436 100%);
  --ff-btn-ink: #0f0805;
  --ff-btn-shadow: 0 12px 32px rgba(212, 175, 55, 0.35);
  --ff-section-alt-1: rgba(255, 255, 255, 0.025);
  --ff-section-alt-2: rgba(212, 175, 55, 0.10);
  --ff-section-alt-border: rgba(212, 175, 55, 0.18);
  --ff-brand-bar-bg: #0f0805;
  --ff-brand-bar-ink: #f5efe6;
  --ff-brand-bar-border: rgba(212, 175, 55, 0.18);
  --ff-footer-bg: #0a0503;
  --ff-footer-ink: rgba(245, 239, 230, 0.65);
  --ff-footer-business-ink: #f5efe6;
  --ff-footer-border: rgba(212, 175, 55, 0.18);
  background-image:
    radial-gradient(ellipse at 80% 20%, rgba(212, 175, 55, 0.10), transparent 50%),
    linear-gradient(180deg, #0f0805 0%, #14100a 100%);
}
.ff-page[data-ff-theme="story-sell"] .ff-headline { font-style: italic; }
.ff-page[data-ff-theme="story-sell"] .ff-eyebrow {
  font-style: italic;
  letter-spacing: 0.15em;
}
.ff-page[data-ff-theme="story-sell"]::before {
  width: 60%; height: 60%; top: -15%; right: -20%;
  background: radial-gradient(circle, rgba(212, 175, 55, 0.55), transparent 65%);
  opacity: 0.7;
  animation: ff-decor-drift 24s ease-in-out infinite;
}
.ff-page[data-ff-theme="story-sell"]::after {
  width: 50%; height: 50%; bottom: -15%; left: -15%;
  background: radial-gradient(circle, rgba(212, 175, 55, 0.40), transparent 65%);
  opacity: 0.55;
  animation: ff-decor-drift 28s ease-in-out infinite reverse;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PARITÉ APERÇU ↔ PUBLIC — overrides Clean Red & Luxe Ivoire + 6 nouveaux thèmes.
   Déclarés APRÈS les blocs d'origine : l'ordre source fait gagner les overrides.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ═══ CLEAN RED (ex clean-dark, refonte) ═══ */
.ff-page[data-ff-theme="clean-dark"] {
  --ff-bg: #0B0305; --ff-surface: #1C0A0E; --ff-ink: #FFF3F4; --ff-ink-soft: #E4A9AE; --ff-muted: #7A4A50;
  --ff-border: rgba(255,46,67,0.16); --ff-accent: #FF2E43; --ff-accent-ink: #FFFFFF;
  --ff-accent-soft: rgba(255,46,67,0.18); --ff-accent-card: rgba(255,46,67,0.08);
  --ff-accent-glow: rgba(255,46,67,0.45); --ff-btn-glow-color: rgba(255,46,67,0.55);
  --ff-font-heading: "Inter", system-ui, -apple-system, sans-serif;
  --ff-heading-weight: 800; --ff-heading-tracking: -0.04em; --ff-heading-leading: 1.12;
  --ff-btn-radius: 999px; --ff-btn-bg: linear-gradient(135deg, #FF2E43 0%, #C81E33 100%);
  --ff-btn-ink: #FFFFFF; --ff-btn-shadow: 0 12px 30px -10px rgba(255,46,67,0.55);
  --ff-section-alt-1: rgba(255,46,67,0.06); --ff-section-alt-2: rgba(255,46,67,0.12); --ff-section-alt-border: rgba(255,46,67,0.28);
  --ff-brand-bar-bg: #120406; --ff-brand-bar-ink: #FFF3F4; --ff-brand-bar-border: rgba(255,46,67,0.18);
  --ff-footer-bg: #120406; --ff-footer-ink: rgba(255,243,244,0.55); --ff-footer-business-ink: #FFF3F4; --ff-footer-border: rgba(255,46,67,0.18);
  background-image:
    radial-gradient(circle at 0% 0%, rgba(255,46,67,0.28), transparent 32%),
    radial-gradient(circle at 100% 0%, rgba(255,46,67,0.22), transparent 30%),
    radial-gradient(circle at 0% 100%, rgba(255,46,67,0.20), transparent 30%),
    radial-gradient(circle at 100% 100%, rgba(255,46,67,0.26), transparent 32%),
    linear-gradient(to bottom, #0B0305, #0B0305);
}
.ff-page[data-ff-theme="clean-dark"] .ff-card { background: #1C0A0E; border: 1px solid rgba(255,46,67,0.34); }
.ff-page[data-ff-theme="clean-dark"] .ff-eyebrow { color: #FF6B78; }

/* ═══ LUXE IVOIRE (ex coaching-premium, refonte) ═══ */
.ff-page[data-ff-theme="coaching-premium"] {
  --ff-bg: #F6F1E7; --ff-surface: #FFFFFF; --ff-ink: #1C1A17; --ff-ink-soft: #5A5249; --ff-muted: #9A9183;
  --ff-border: rgba(28,26,23,0.12); --ff-accent: #9A7B3F; --ff-accent-ink: #FFFFFF;
  --ff-accent-soft: rgba(154,123,63,0.18); --ff-accent-card: rgba(154,123,63,0.08);
  --ff-accent-glow: rgba(154,123,63,0.35); --ff-btn-glow-color: rgba(154,123,63,0.35);
  --ff-font-heading: "Cormorant Garamond", "Playfair Display", Georgia, serif;
  --ff-font-body: "DM Sans", "Inter", system-ui, sans-serif;
  --ff-heading-weight: 500; --ff-heading-tracking: -0.01em; --ff-heading-leading: 1.08;
  --ff-btn-radius: 0px; --ff-btn-bg: #1C1A17; --ff-btn-ink: #F6F1E7; --ff-btn-shadow: none;
  --ff-section-alt-1: rgba(154,123,63,0.05); --ff-section-alt-2: rgba(28,26,23,0.035); --ff-section-alt-border: rgba(28,26,23,0.12);
  --ff-brand-bar-bg: #1C1A17; --ff-brand-bar-ink: #F6F1E7; --ff-brand-bar-border: rgba(154,123,63,0.25);
  --ff-footer-bg: #1C1A17; --ff-footer-ink: rgba(246,241,231,0.6); --ff-footer-business-ink: #F6F1E7; --ff-footer-border: rgba(154,123,63,0.2);
  background-image: none; background-color: #F6F1E7;
}
.ff-page[data-ff-theme="coaching-premium"] .ff-card { background: #FFFFFF; border: 1px solid rgba(28,26,23,0.10); }
.ff-page[data-ff-theme="coaching-premium"] .ff-headline { font-style: normal; }
.ff-page[data-ff-theme="coaching-premium"]::before { display: none; }
.ff-page[data-ff-theme="coaching-premium"]::after { display: none; }
.ff-page[data-ff-theme="coaching-premium"] .ff-eyebrow { color: #9A7B3F; text-transform: uppercase; letter-spacing: 0.28em; font-style: normal; }
.ff-page[data-ff-theme="coaching-premium"] .ff-btn { text-transform: uppercase; letter-spacing: 0.18em; border-radius: 0; }

/* ═══ EDITORIAL WARM ═══ */
.ff-page[data-ff-theme="editorial-warm"] {
  --ff-bg: #FBF7F1; --ff-surface: #FFFFFF; --ff-ink: #2B1D16; --ff-ink-soft: #6B5648; --ff-muted: #A99A8C;
  --ff-border: rgba(43,29,22,0.12); --ff-accent: #C2410C; --ff-accent-ink: #FFFFFF;
  --ff-accent-soft: rgba(194,65,12,0.16); --ff-accent-card: rgba(194,65,12,0.06);
  --ff-accent-glow: rgba(194,65,12,0.35); --ff-btn-glow-color: rgba(194,65,12,0.4);
  --ff-font-heading: "Fraunces", "Playfair Display", Georgia, serif;
  --ff-font-body: "DM Sans", "Inter", system-ui, sans-serif;
  --ff-heading-weight: 500; --ff-heading-tracking: -0.01em; --ff-heading-leading: 1.1;
  --ff-btn-radius: 12px; --ff-btn-bg: #C2410C; --ff-btn-ink: #FFFFFF; --ff-btn-shadow: 0 12px 28px -10px rgba(194,65,12,0.45);
  --ff-section-alt-1: rgba(194,65,12,0.07); --ff-section-alt-2: rgba(15,110,86,0.10); --ff-section-alt-border: rgba(43,29,22,0.14);
  --ff-brand-bar-bg: #2B1D16; --ff-brand-bar-ink: #FBF7F1; --ff-brand-bar-border: rgba(194,65,12,0.25);
  --ff-footer-bg: #2B1D16; --ff-footer-ink: rgba(251,247,241,0.6); --ff-footer-business-ink: #FBF7F1; --ff-footer-border: rgba(194,65,12,0.2);
  background-color: #FBF7F1; background-image: none;
}
.ff-page[data-ff-theme="editorial-warm"] .ff-card { background: #FFFFFF; border: 1px solid rgba(43,29,22,0.10); }
.ff-page[data-ff-theme="editorial-warm"] .ff-eyebrow { color: #0F6E56; text-transform: uppercase; letter-spacing: 0.18em; }

/* ═══ AURORA GLOW ═══ */
.ff-page[data-ff-theme="aurora-glow"] {
  --ff-bg: #E7EAF7; --ff-surface: #FFFFFF; --ff-ink: #0F1031; --ff-ink-soft: #4B4E72; --ff-muted: #9094B8;
  --ff-border: rgba(15,16,49,0.10); --ff-accent: #6D5DF6; --ff-accent-ink: #FFFFFF;
  --ff-accent-soft: rgba(109,93,246,0.16); --ff-accent-card: rgba(109,93,246,0.06);
  --ff-accent-glow: rgba(109,93,246,0.4); --ff-btn-glow-color: rgba(109,93,246,0.5);
  --ff-font-heading: "Space Grotesk", "Sora", "Inter", sans-serif;
  --ff-font-body: "Inter", system-ui, sans-serif;
  --ff-heading-weight: 600; --ff-heading-tracking: -0.03em; --ff-heading-leading: 1.12;
  --ff-btn-radius: 12px; --ff-btn-bg: linear-gradient(135deg, #6D5DF6 0%, #0EA5E9 100%); --ff-btn-ink: #FFFFFF; --ff-btn-shadow: 0 12px 30px -10px rgba(109,93,246,0.5);
  --ff-section-alt-1: rgba(109,93,246,0.08); --ff-section-alt-2: rgba(14,165,233,0.10); --ff-section-alt-border: rgba(15,16,49,0.10);
  --ff-brand-bar-bg: #0F1031; --ff-brand-bar-ink: #E7EAF7; --ff-brand-bar-border: rgba(109,93,246,0.25);
  --ff-footer-bg: #0F1031; --ff-footer-ink: rgba(231,234,247,0.6); --ff-footer-business-ink: #E7EAF7; --ff-footer-border: rgba(109,93,246,0.2);
  background-image:
    radial-gradient(ellipse at 12% -10%, rgba(109,93,246,0.22), transparent 45%),
    radial-gradient(ellipse at 95% 8%, rgba(14,165,233,0.18), transparent 45%),
    radial-gradient(ellipse at 50% 118%, rgba(236,72,153,0.14), transparent 50%),
    linear-gradient(to bottom, #E7EAF7, #E7EAF7);
}
.ff-page[data-ff-theme="aurora-glow"] .ff-card { background: #FFFFFF; border: 1px solid rgba(15,16,49,0.08); }
.ff-page[data-ff-theme="aurora-glow"] .ff-eyebrow { color: #6D5DF6; text-transform: uppercase; letter-spacing: 0.14em; }

/* ═══ ÉMERAUDE (mint-fresh) ═══ */
.ff-page[data-ff-theme="mint-fresh"] {
  --ff-bg: #EAF8F1; --ff-surface: #FFFFFF; --ff-ink: #08231A; --ff-ink-soft: #3C6B58; --ff-muted: #8FB6A6;
  --ff-border: rgba(8,35,26,0.10); --ff-accent: #10B981; --ff-accent-ink: #FFFFFF;
  --ff-accent-soft: rgba(16,185,129,0.16); --ff-accent-card: rgba(16,185,129,0.06);
  --ff-accent-glow: rgba(16,185,129,0.4); --ff-btn-glow-color: rgba(16,185,129,0.5);
  --ff-font-heading: "Sora", "Inter", sans-serif; --ff-font-body: "DM Sans", "Inter", system-ui, sans-serif;
  --ff-heading-weight: 600; --ff-heading-tracking: -0.02em; --ff-heading-leading: 1.12;
  --ff-btn-radius: 14px; --ff-btn-bg: linear-gradient(135deg, #10B981 0%, #0EA5A4 100%); --ff-btn-ink: #FFFFFF; --ff-btn-shadow: 0 12px 28px -10px rgba(16,185,129,0.5);
  --ff-section-alt-1: rgba(16,185,129,0.07); --ff-section-alt-2: rgba(13,148,136,0.11); --ff-section-alt-border: rgba(8,35,26,0.10);
  --ff-brand-bar-bg: #08231A; --ff-brand-bar-ink: #EAF8F1; --ff-brand-bar-border: rgba(16,185,129,0.25);
  --ff-footer-bg: #08231A; --ff-footer-ink: rgba(234,248,241,0.6); --ff-footer-business-ink: #EAF8F1; --ff-footer-border: rgba(16,185,129,0.2);
  background-image:
    radial-gradient(ellipse at 10% -10%, rgba(16,185,129,0.16), transparent 45%),
    radial-gradient(ellipse at 95% 110%, rgba(13,148,136,0.14), transparent 45%),
    linear-gradient(to bottom, #EAF8F1, #EAF8F1);
}
.ff-page[data-ff-theme="mint-fresh"] .ff-card { background: #FFFFFF; border: 1px solid rgba(8,35,26,0.08); }
.ff-page[data-ff-theme="mint-fresh"] .ff-eyebrow { color: #0E9F6E; text-transform: uppercase; letter-spacing: 0.14em; }

/* ═══ COSMOS (cosmos-night) ═══ */
.ff-page[data-ff-theme="cosmos-night"] {
  --ff-bg: #0A0E27; --ff-surface: #141A3A; --ff-ink: #EDEBFF; --ff-ink-soft: #A7A6D6; --ff-muted: #5C5B8F;
  --ff-border: rgba(139,92,246,0.18); --ff-accent: #8B5CF6; --ff-accent-ink: #FFFFFF;
  --ff-accent-soft: rgba(139,92,246,0.20); --ff-accent-card: rgba(139,92,246,0.10);
  --ff-accent-glow: rgba(139,92,246,0.5); --ff-btn-glow-color: rgba(139,92,246,0.6);
  --ff-font-heading: "Space Grotesk", "Sora", "Inter", sans-serif; --ff-font-body: "Inter", system-ui, sans-serif;
  --ff-heading-weight: 600; --ff-heading-tracking: -0.03em; --ff-heading-leading: 1.12;
  --ff-btn-radius: 12px; --ff-btn-bg: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%); --ff-btn-ink: #FFFFFF; --ff-btn-shadow: 0 14px 32px -10px rgba(139,92,246,0.6);
  --ff-section-alt-1: rgba(139,92,246,0.08); --ff-section-alt-2: rgba(236,72,153,0.10); --ff-section-alt-border: rgba(139,92,246,0.22);
  --ff-brand-bar-bg: #070A1C; --ff-brand-bar-ink: #EDEBFF; --ff-brand-bar-border: rgba(139,92,246,0.25);
  --ff-footer-bg: #070A1C; --ff-footer-ink: rgba(237,235,255,0.55); --ff-footer-business-ink: #EDEBFF; --ff-footer-border: rgba(139,92,246,0.2);
  background-image:
    radial-gradient(ellipse at 8% -8%, rgba(139,92,246,0.30), transparent 42%),
    radial-gradient(ellipse at 100% 6%, rgba(236,72,153,0.20), transparent 40%),
    radial-gradient(ellipse at 50% 120%, rgba(56,189,248,0.16), transparent 48%),
    linear-gradient(to bottom, #0A0E27, #0A0E27);
}
.ff-page[data-ff-theme="cosmos-night"] .ff-card { background: #141A3A; border: 1px solid rgba(139,92,246,0.22); }
.ff-page[data-ff-theme="cosmos-night"] .ff-eyebrow { color: #B794F6; text-transform: uppercase; letter-spacing: 0.16em; }

/* ═══ SUNSET (sunset-coral) ═══ */
.ff-page[data-ff-theme="sunset-coral"] {
  --ff-bg: #FFF1E8; --ff-surface: #FFFFFF; --ff-ink: #3A1408; --ff-ink-soft: #8A5240; --ff-muted: #C99884;
  --ff-border: rgba(58,20,8,0.10); --ff-accent: #FB6F4C; --ff-accent-ink: #FFFFFF;
  --ff-accent-soft: rgba(251,111,76,0.16); --ff-accent-card: rgba(251,111,76,0.06);
  --ff-accent-glow: rgba(251,111,76,0.45); --ff-btn-glow-color: rgba(251,111,76,0.55);
  --ff-font-heading: "Sora", "Inter", sans-serif; --ff-font-body: "DM Sans", "Inter", system-ui, sans-serif;
  --ff-heading-weight: 700; --ff-heading-tracking: -0.02em; --ff-heading-leading: 1.1;
  --ff-btn-radius: 16px; --ff-btn-bg: linear-gradient(135deg, #FB6F4C 0%, #F4467E 100%); --ff-btn-ink: #FFFFFF; --ff-btn-shadow: 0 14px 30px -10px rgba(251,111,76,0.55);
  --ff-section-alt-1: rgba(251,111,76,0.08); --ff-section-alt-2: rgba(244,70,126,0.10); --ff-section-alt-border: rgba(58,20,8,0.10);
  --ff-brand-bar-bg: #3A1408; --ff-brand-bar-ink: #FFF1E8; --ff-brand-bar-border: rgba(251,111,76,0.25);
  --ff-footer-bg: #3A1408; --ff-footer-ink: rgba(255,241,232,0.6); --ff-footer-business-ink: #FFF1E8; --ff-footer-border: rgba(251,111,76,0.2);
  background-image:
    radial-gradient(ellipse at 0% -10%, rgba(251,111,76,0.22), transparent 45%),
    radial-gradient(ellipse at 100% 110%, rgba(244,70,126,0.16), transparent 45%),
    linear-gradient(to bottom, #FFF1E8, #FFF1E8);
}
.ff-page[data-ff-theme="sunset-coral"] .ff-card { background: #FFFFFF; border: 1px solid rgba(58,20,8,0.08); }
.ff-page[data-ff-theme="sunset-coral"] .ff-eyebrow { color: #E2542F; text-transform: uppercase; letter-spacing: 0.14em; }

/* ═══ BRUTALIST (neo-brutalist) ═══ */
.ff-page[data-ff-theme="neo-brutalist"] {
  --ff-bg: #FBF7EC; --ff-surface: #FFFFFF; --ff-ink: #14110A; --ff-ink-soft: #3F3A2C; --ff-muted: #8A8472;
  --ff-border: #14110A; --ff-accent: #3B49F6; --ff-accent-ink: #FFFFFF;
  --ff-accent-soft: rgba(59,73,246,0.16); --ff-accent-card: rgba(59,73,246,0.06);
  --ff-accent-glow: rgba(59,73,246,0.4); --ff-btn-glow-color: rgba(20,17,10,0.9);
  --ff-font-heading: "Archivo Black", "Inter", sans-serif; --ff-font-body: "Inter", system-ui, sans-serif;
  --ff-heading-weight: 800; --ff-heading-tracking: -0.02em; --ff-heading-leading: 1.05;
  --ff-btn-radius: 0px; --ff-btn-bg: #3B49F6; --ff-btn-ink: #FFFFFF; --ff-btn-shadow: 4px 4px 0 #14110A;
  --ff-section-alt-1: #FBF59B; --ff-section-alt-2: #C7F5E9; --ff-section-alt-border: #14110A;
  --ff-brand-bar-bg: #FACC15; --ff-brand-bar-ink: #14110A; --ff-brand-bar-border: #14110A;
  --ff-footer-bg: #14110A; --ff-footer-ink: rgba(251,247,236,0.7); --ff-footer-business-ink: #FBF7EC; --ff-footer-border: #14110A;
  background-color: #FBF7EC; background-image: none;
}
.ff-page[data-ff-theme="neo-brutalist"] .ff-card { background: #FFFFFF; border: 2px solid #14110A; border-radius: 0; box-shadow: 5px 5px 0 #14110A; }
.ff-page[data-ff-theme="neo-brutalist"] .ff-btn { border: 2px solid #14110A; border-radius: 0; box-shadow: 4px 4px 0 #14110A; }
.ff-page[data-ff-theme="neo-brutalist"] .ff-eyebrow { color: #3B49F6; text-transform: uppercase; letter-spacing: 0.10em; }

/* ─── Reassurance message (sous forms / popup) ─── */
.ff-reassurance {
  margin-top: 0.75rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--ff-ink-soft);
  opacity: 0.65;
  line-height: 1.5;
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// 3. FULL DOC RESET
// ─────────────────────────────────────────────────────────────────────────────

const FULL_DOC_RESET = `
html, body { margin: 0; padding: 0; }
body {
  font-family: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
* { box-sizing: border-box; }
img { max-width: 100%; height: auto; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// 4. API publique
// ─────────────────────────────────────────────────────────────────────────────

let _cachedFullCss: string | null = null;

export function getFunnelThemeCss(): string {
  if (_cachedFullCss === null) {
    _cachedFullCss = `${BASE_CSS}\n${THEMES_CSS}\n${FULL_DOC_RESET}`;
  }
  return _cachedFullCss;
}

let _cachedNoResetCss: string | null = null;

/**
 * CSS du thème SANS le reset global (`body`, `html`, `*`, `img`).
 * À utiliser quand le CSS doit rester scopé sous `.ff-page` et ne PAS fuiter
 * vers la page hôte (ex : injection dans un éditeur/preview, export par blocs
 * systeme.io). Tout est déjà préfixé `.ff-page` dans BASE_CSS/THEMES_CSS.
 */
export function getFunnelThemeCssNoGlobalReset(): string {
  if (_cachedNoResetCss === null) {
    _cachedNoResetCss = `${BASE_CSS}\n${THEMES_CSS}`;
  }
  return _cachedNoResetCss;
}

export function getScopedFunnelThemeCss(scopeClass: string): string {
  const safe = scopeClass.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) return getFunnelThemeCss();

  // Liste des noms de keyframes à renommer pour éviter les collisions
  // entre blocs HTML d'une même page SIO.
  const keyframeNames = [
    "ff-btn-glow",
    "ff-fade-in",
    "ff-fade-up",
    "ff-fade-down",
    "ff-slide-left",
    "ff-slide-right",
    "ff-zoom-in",
    "ff-zoom-out",
    "ff-pulse",
    "ff-decor-drift",
    "ff-section-pulse",
    "ff-timer-pulse", // 🆕 timer
  ];

  const base = `${BASE_CSS}\n${THEMES_CSS}`;

  // 1. Scope toutes les règles .ff-page sous .<safe>.ff-page
  let scoped = base.replace(/\.ff-page/g, `.${safe}.ff-page`);

  // 2. Renomme chaque keyframe en lui ajoutant un suffixe unique par bloc.
  //    Remplace à la fois la déclaration @keyframes XXX et les usages
  //    animation-name: XXX / animation: XXX … .
  for (const name of keyframeNames) {
    const suffixed = `${name}-${safe}`;
    // Échapper le tiret pour la regex
    const escName = name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    // @keyframes XXX
    scoped = scoped.replace(
      new RegExp(`@keyframes\\s+${escName}\\b`, "g"),
      `@keyframes ${suffixed}`,
    );
    // animation-name: XXX
    scoped = scoped.replace(
      new RegExp(`animation-name:\\s*${escName}\\b`, "g"),
      `animation-name: ${suffixed}`,
    );
    // animation: XXX … (shorthand : XXX peut être à n'importe quelle position
    // mais le nom est généralement en premier ou en dernier — on cible le mot)
    scoped = scoped.replace(
      new RegExp(`\\b${escName}\\b(?=[^;{}]*?[;}])`, "g"),
      suffixed,
    );
  }

  return scoped;
}


// ─────────────────────────────────────────────────────────────────────────────
// 5. buildThemeRootAttrs
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_THEMES = [
  "clean-light",
  "clean-dark",
  "coaching-premium",
  "bold-energy",
  "premium-minimal",
  "sharp-launch",
  "trust-pro",
  "lead-snap",
  "story-sell",
  // Nouveaux / refondus — parité avec funnel-theme.css (aperçu).
  "editorial-warm",
  "aurora-glow",
  "mint-fresh",
  "cosmos-night",
  "sunset-coral",
  "neo-brutalist",
  // 🆕 Thèmes ajoutés (avaient un template mais PAS de bloc CSS → repli story-sell).
  "webinar-live",
  "showcase",
  "vsl-focus",
] as const;

type ThemeId = typeof ALLOWED_THEMES[number];

export type ThemeRootAttrs = {
  dataAttrs: Record<string, string>;
  inlineStyle: string;
};

function isAllowedTheme(v: unknown): v is ThemeId {
  return typeof v === "string" && (ALLOWED_THEMES as readonly string[]).includes(v);
}

export function buildThemeRootAttrs(funnel: Funnel): ThemeRootAttrs {
  const design = (funnel.design ?? {}) as Record<string, unknown>;
  const meta = funnel.meta as { templateId?: string } | undefined;

  const templateId = meta?.templateId ?? design.templateId ?? "story-sell";
  const template = isAllowedTheme(templateId) ? templateId : "story-sell";

  const btnAnim =
    design.buttonAnim === "lift" || design.buttonAnim === "glow"
      ? (design.buttonAnim as string)
      : "glow";

  const animations = design.animations === false ? "off" : "on";

  const dataAttrs: Record<string, string> = {
    "data-ff-theme": template,
    "data-ff-btn-anim": btnAnim,
    "data-ff-animations": animations,
  };

  const styleParts: string[] = [];

  if (typeof design.textScale === "number" && design.textScale > 0) {
    styleParts.push(`--ff-text-scale:${design.textScale}`);
  }
  if (typeof design.buttonScale === "number" && design.buttonScale > 0) {
    styleParts.push(`--ff-btn-scale:${design.buttonScale}`);
  }
  if (
    design.userAccentOverride === true &&
    typeof design.accentColor === "string" &&
    /^#[0-9a-fA-F]{3,8}$/.test(design.accentColor)
  ) {
    styleParts.push(`--ff-accent:${design.accentColor}`);
  }
  if (typeof design.customBackground === "string" && design.customBackground.trim()) {
    dataAttrs["data-ff-custom-bg"] = "true";
    styleParts.push(`--ff-custom-bg:${design.customBackground}`);
  }

  return {
    dataAttrs,
    inlineStyle: styleParts.join(";"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. 🆕 Résolution des couleurs RÉELLES du thème (bg/ink/accent) — pour générer
// du CSS hors .ff-page (ex. restylage d'un popup systeme.io aux vraies couleurs
// du template, pas aux couleurs génériques de funnel.design).
// ─────────────────────────────────────────────────────────────────────────────

export type ThemeColors = { bg: string; ink: string; accent: string };

const THEME_COLOR_DEFAULTS: ThemeColors = {
  bg: "#ffffff",
  ink: "#0f172a",
  accent: "#c7a436",
};

const _themeColorCache = new Map<string, ThemeColors>();

/** Extrait --ff-bg/--ff-ink/--ff-accent du bloc racine d'un thème dans THEMES_CSS. */
function extractThemeColors(theme: string): ThemeColors {
  const cached = _themeColorCache.get(theme);
  if (cached) return cached;

  const css = THEMES_CSS;
  const blockRe = new RegExp(
    `\\.ff-page\\[data-ff-theme="${theme}"\\][^{]*\\{([^}]*)\\}`,
    "g",
  );
  let m: RegExpExecArray | null;
  let result = { ...THEME_COLOR_DEFAULTS };
  while ((m = blockRe.exec(css)) !== null) {
    const body = m[1];
    if (body.includes("--ff-bg")) {
      const grab = (v: string): string | undefined =>
        body.match(new RegExp(`--ff-${v}\\s*:\\s*([^;]+)`))?.[1]?.trim();
      result = {
        bg: grab("bg") || THEME_COLOR_DEFAULTS.bg,
        ink: grab("ink") || THEME_COLOR_DEFAULTS.ink,
        accent: grab("accent") || THEME_COLOR_DEFAULTS.accent,
      };
      break;
    }
  }
  _themeColorCache.set(theme, result);
  return result;
}

/** Couleurs résolues (bg/ink/accent) telles qu'affichées pour ce funnel. */
export function getThemeColors(funnel: Funnel): ThemeColors {
  const design = (funnel.design ?? {}) as Record<string, unknown>;
  const meta = funnel.meta as { templateId?: string } | undefined;
  const templateId = meta?.templateId ?? design.templateId ?? "story-sell";
  const theme = isAllowedTheme(templateId) ? templateId : "story-sell";

  const colors = extractThemeColors(theme);

  // Override d'accent explicite (même règle que buildThemeRootAttrs).
  if (
    design.userAccentOverride === true &&
    typeof design.accentColor === "string" &&
    /^#[0-9a-fA-F]{3,8}$/.test(design.accentColor)
  ) {
    return { ...colors, accent: design.accentColor };
  }
  return colors;
}
