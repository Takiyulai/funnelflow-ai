// lib/export/html.ts
import { strToU8, zipSync } from "fflate";
import type {
  Funnel,
  FunnelSection,
  CtaConfig,
  SectionImage,
} from "@/lib/funnels/types";
import { createReadme } from "./readme";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function escapeHtml(value = "") {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return value.replace(/[&<>"']/g, (char) => entities[char] ?? char);
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}

function isSafeUrl(url: string): boolean {
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

function safeId(value: string, fallback: string): string {
  const cleaned = (value || "").toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return cleaned || fallback;
}

function ctaHref(cta: CtaConfig, popupDomId?: string): string {
  if (cta.mode === "anchor") {
    const id = safeId(cta.anchorId ?? "lead-form", "lead-form");
    return `#${id}`;
  }
  if (cta.mode === "popup") {
    return `#${popupDomId ?? safeId(cta.popupId ?? "popup", "popup")}`;
  }
  if (cta.mode === "redirect" && cta.url && isSafeUrl(cta.url)) {
    return cta.url;
  }
  return "#lead-form";
}

/**
 * Construit les attributs <a> pour un CTA selon son mode.
 * @param cta            La configuration du CTA
 * @param popupDomId     L'ID DOM réel du popup (préfixé) si mode popup
 */
function ctaAttrs(cta: CtaConfig, popupDomId?: string): string {
  const href = ctaHref(cta, popupDomId);
  const isExternal =
    cta.mode === "redirect" && cta.target === "_blank" && isSafeUrl(cta.url ?? "");
  const target = isExternal ? "_blank" : "_self";
  const rel = isExternal ? ' rel="noopener noreferrer"' : "";
  const dataPopup =
    cta.mode === "popup" && popupDomId
      ? ` data-ff-popup-target="${escapeAttr(popupDomId)}"`
      : "";
  return ` href="${escapeAttr(href)}" target="${target}"${rel}${dataPopup}`;
}

function renderImage(image?: SectionImage): string {
  if (!image || image.mode === "none" || !image.url) return "";
  const alt = escapeAttr(image.alt ?? "");
  const credit = image.credit
    ? `<span class="ff-image-credit">${escapeHtml(image.credit)}</span>`
    : "";
  return `<figure class="ff-image ff-img"><img src="${escapeAttr(image.url)}" alt="${alt}" loading="lazy" />${credit}</figure>`;
}

function sectionStyleAttrs(section: FunnelSection): string {
  const styles: string[] = [];
  if (section.style?.textColor) styles.push(`color:${section.style.textColor}`);
  if (section.style?.accentColor) styles.push(`--ff-accent:${section.style.accentColor}`);
  if (section.style?.align === "center") styles.push("text-align:center");
  else if (section.style?.align === "right") styles.push("text-align:right");
  return styles.length ? ` style="${escapeAttr(styles.join(";"))}"` : "";
}

function sectionSpacingClass(section: FunnelSection): string {
  return section.style?.spacing ? ` ff-spacing-${section.style.spacing}` : "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Popup embarqué (HTML + CSS + JS scopés)
// ─────────────────────────────────────────────────────────────────────────────
function renderPopupFallbackForm(language: Funnel["language"]): string {
  const labels = {
    fr: { name: "Votre nom", email: "Votre email", submit: "Recevoir l'accès" },
    en: { name: "Your name", email: "Your email", submit: "Get access" },
    es: { name: "Tu nombre", email: "Tu email", submit: "Recibir acceso" },
  } as const;
  const l = labels[language] ?? labels.fr;
  return `<form class="ff-popup-form" onsubmit="event.preventDefault(); alert('Démonstration : remplacez ce formulaire par votre code d\\'embed systeme.io.');">
  <input type="text" name="name" placeholder="${escapeAttr(l.name)}" required />
  <input type="email" name="email" placeholder="${escapeAttr(l.email)}" required />
  <button type="submit">${escapeHtml(l.submit)}</button>
</form>`;
}

/**
 * Rend un popup autonome (overlay + contenu + script de gestion).
 * @param domId      ID DOM unique (préfixé par le scope du bloc)
 * @param cta        La config CTA contenant titre, texte, embed
 * @param language   Langue pour le formulaire de fallback
 * @param scopeCls   Classe CSS racine du bloc (pour scoper le CSS du popup)
 */
function renderPopupMarkup(
  domId: string,
  cta: CtaConfig,
  language: Funnel["language"],
  scopeCls: string
): { css: string; html: string } {
  const title = escapeHtml(cta.popupTitle ?? "Recevez votre accès");
  const body = cta.popupBody
    ? `<p class="ff-popup-body">${escapeHtml(cta.popupBody)}</p>`
    : "";
  // L'embed est inséré tel quel (l'utilisateur colle son propre HTML systeme.io).
  // S'il est vide, on met un formulaire de démonstration.
  const embed = (cta.popupEmbed ?? "").trim();
  const formMarkup = embed
    ? `<div class="ff-popup-embed">${embed}</div>`
    : renderPopupFallbackForm(language);

  const css = `.${scopeCls} .ff-popup-overlay { position: fixed; inset: 0; background: rgba(8, 18, 36, 0.72); display: none; align-items: center; justify-content: center; z-index: 99999; padding: 16px; opacity: 0; transition: opacity 0.18s ease; }
.${scopeCls} .ff-popup-overlay[data-ff-open="true"] { display: flex; opacity: 1; }
.${scopeCls} .ff-popup-card { position: relative; width: 100%; max-width: 460px; background: #fff; color: #101828; border-radius: 14px; padding: 28px 24px 24px; box-shadow: 0 30px 80px rgba(8, 18, 36, 0.35); transform: translateY(8px); transition: transform 0.22s ease; max-height: 90vh; overflow-y: auto; }
.${scopeCls} .ff-popup-overlay[data-ff-open="true"] .ff-popup-card { transform: translateY(0); }
.${scopeCls} .ff-popup-close { position: absolute; top: 10px; right: 10px; width: 32px; height: 32px; border: none; background: transparent; color: #98A2B3; font-size: 22px; line-height: 1; cursor: pointer; border-radius: 8px; transition: background 0.15s ease, color 0.15s ease; }
.${scopeCls} .ff-popup-close:hover { background: #F3F4F6; color: #101828; }
.${scopeCls} .ff-popup-title { margin: 0 0 8px; font-size: 22px; font-weight: 700; line-height: 1.25; padding-right: 28px; }
.${scopeCls} .ff-popup-body { margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #475467; }
.${scopeCls} .ff-popup-embed { display: block; }
.${scopeCls} .ff-popup-embed form, .${scopeCls} .ff-popup-form { display: grid; gap: 10px; }
.${scopeCls} .ff-popup-embed input, .${scopeCls} .ff-popup-form input { min-height: 44px; border: 1px solid #E5E7EB; border-radius: 8px; padding: 0 12px; font: inherit; width: 100%; box-sizing: border-box; }
.${scopeCls} .ff-popup-embed button, .${scopeCls} .ff-popup-form button { min-height: 46px; border: none; border-radius: 8px; background: var(--ff-gold, #D4A537); color: #082B4C; font-weight: 700; font-size: 15px; cursor: pointer; transition: opacity 0.15s ease, transform 0.15s ease; }
.${scopeCls} .ff-popup-embed button:hover, .${scopeCls} .ff-popup-form button:hover { opacity: 0.92; transform: translateY(-1px); }
@media (prefers-reduced-motion: reduce) {
  .${scopeCls} .ff-popup-overlay, .${scopeCls} .ff-popup-card, .${scopeCls} .ff-popup-embed button, .${scopeCls} .ff-popup-form button { transition: none !important; }
}`;

  // Le script est délibérément autonome et défensif (pas de framework, pas de globals).
  // Il s'attache aux liens portant data-ff-popup-target="${domId}" dans le DOM
  // (peut être plusieurs CTA ouvrant le même popup).
  const html = `<div class="ff-popup-overlay" id="${escapeAttr(domId)}" role="dialog" aria-modal="true" aria-labelledby="${escapeAttr(domId)}-title" data-ff-open="false">
  <div class="ff-popup-card">
    <button type="button" class="ff-popup-close" aria-label="Fermer" data-ff-popup-close>&times;</button>
    <h3 class="ff-popup-title" id="${escapeAttr(domId)}-title">${title}</h3>
    ${body}
    ${formMarkup}
  </div>
</div>
<script>
(function(){
  var id = ${JSON.stringify(domId)};
  var overlay = document.getElementById(id);
  if (!overlay || overlay.dataset.ffBound === "1") return;
  overlay.dataset.ffBound = "1";
  var lastFocus = null;
  function open(e){
    if (e && e.preventDefault) e.preventDefault();
    lastFocus = document.activeElement;
    overlay.setAttribute("data-ff-open", "true");
    document.body.style.overflow = "hidden";
    var firstInput = overlay.querySelector("input, button:not([data-ff-popup-close]), select, textarea");
    if (firstInput) { try { firstInput.focus(); } catch(_) {} }
  }
  function close(){
    overlay.setAttribute("data-ff-open", "false");
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch(_) {} }
  }
  // Triggers : tout élément avec data-ff-popup-target = id
  document.querySelectorAll('[data-ff-popup-target="' + id + '"]').forEach(function(el){
    el.addEventListener("click", open);
  });
  // Fermeture : bouton croix
  overlay.querySelectorAll("[data-ff-popup-close]").forEach(function(el){
    el.addEventListener("click", close);
  });
  // Fermeture : clic sur le backdrop (overlay lui-même, pas la carte)
  overlay.addEventListener("click", function(ev){
    if (ev.target === overlay) close();
  });
  // Fermeture : touche Échap
  document.addEventListener("keydown", function(ev){
    if (ev.key === "Escape" && overlay.getAttribute("data-ff-open") === "true") close();
  });
})();
</script>`;

  return { css, html };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendu d'une section
// ─────────────────────────────────────────────────────────────────────────────
function renderSectionInner(section: FunnelSection, popupDomId?: string): string {
  const eyebrow = section.eyebrow
    ? `<span class="ff-eyebrow">${escapeHtml(section.eyebrow)}</span>`
    : "";
  const headline = `<h2 class="ff-headline ff-fade-in">${escapeHtml(section.headline)}</h2>`;
  const subheadline = section.subheadline
    ? `<div class="ff-subheadline">${escapeHtml(section.subheadline)}</div>`
    : "";
  const body = section.body
    ? `<p class="ff-body">${escapeHtml(section.body)}</p>`
    : "";
  const bullets = section.bullets?.length
    ? `<ul class="ff-bullets">${section.bullets
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("")}</ul>`
    : "";
  const cta = section.cta
    ? `<a class="ff-button ff-cta"${ctaAttrs(section.cta, popupDomId)}>${escapeHtml(section.cta.label)}</a>`
    : "";
  const image = renderImage(section.image);

  return `${eyebrow}${headline}${subheadline}${body}${bullets}${image}${cta}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formulaire intégré (toujours autonome)
// ─────────────────────────────────────────────────────────────────────────────
function renderLeadForm(funnel: Funnel): string {
  const labels = {
    fr: { title: "Recevoir les détails", name: "Votre nom", email: "Email", submit: "Continuer" },
    en: { title: "Get the details", name: "Your name", email: "Email", submit: "Continue" },
    es: { title: "Recibir los detalles", name: "Tu nombre", email: "Email", submit: "Continuar" },
  } as const;
  const l = labels[funnel.language] ?? labels.fr;

  return `<section id="lead-form" class="ff-section ff-form">
  <h2 class="ff-headline">${escapeHtml(l.title)}</h2>
  <form onsubmit="return false;">
    <input type="text" name="name" placeholder="${escapeAttr(l.name)}" required />
    <input type="email" name="email" placeholder="${escapeAttr(l.email)}" required />
    <button class="ff-button ff-cta" type="submit">${escapeHtml(l.submit)}</button>
  </form>
</section>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE 1 — One-shot complet (aperçu)
// ─────────────────────────────────────────────────────────────────────────────
export function renderFunnelHtml(funnel: Funnel): string {
  const css = renderFunnelCss(funnel);

  // Collecte des popups uniques utilisés dans le funnel
  const popupSections = funnel.sections.filter(
    (s) => s.visible !== false && s.cta?.mode === "popup"
  );
  const popups = popupSections
    .map((s) => {
      const domId = `ff-popup-${s.id}`;
      return { section: s, domId, markup: renderPopupMarkup(domId, s.cta!, funnel.language, "ff-page") };
    });

  const popupCss = popups.map((p) => p.markup.css).join("\n");
  const popupHtml = popups.map((p) => p.markup.html).join("\n");
  const popupIdBySection: Record<string, string> = {};
  popups.forEach((p) => {
    popupIdBySection[p.section.id] = p.domId;
  });

  const sections = funnel.sections
    .filter((s) => s.visible !== false)
    .map((section) => {
      const popupDomId = section.cta?.mode === "popup" ? popupIdBySection[section.id] : undefined;
      return `  <section class="ff-section ff-${section.type}${sectionSpacingClass(section)}"${sectionStyleAttrs(section)}>
    ${renderSectionInner(section, popupDomId)}
  </section>`;
    })
    .join("\n");

  return `<style>
${css}
${popupCss}
</style>

<div class="ff-page" data-ff-lang="${escapeAttr(funnel.language)}">
${sections}
${renderLeadForm(funnel)}
${popupHtml}
</div>`;
}

// CSS strictement scopé sous .ff-page
export function renderFunnelCss(funnel: Funnel): string {
  const primary = funnel.design.primaryColor;
  const gold = funnel.design.secondaryColor;
  const green = funnel.design.accentColor;

  return `.ff-page { --ff-primary:${primary}; --ff-gold:${gold}; --ff-green:${green}; --ff-ink:#101828; --ff-muted:#667085; --ff-bg:#F8FAFC; --ff-accent:${gold}; }
.ff-page, .ff-page * { box-sizing: border-box; }
.ff-page { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: var(--ff-ink); background: var(--ff-bg); overflow: hidden; }
.ff-page .ff-section { padding: 64px 20px; max-width: 1040px; margin: 0 auto; }
.ff-page .ff-spacing-compact { padding-top: 40px; padding-bottom: 40px; }
.ff-page .ff-spacing-large { padding-top: 96px; padding-bottom: 96px; }
.ff-page .ff-hero { min-height: 60vh; display: grid; align-content: center; }
.ff-page .ff-eyebrow { display: inline-block; color: var(--ff-green); font-weight: 700; text-transform: uppercase; font-size: 12px; letter-spacing: 0.1em; margin-bottom: 12px; }
.ff-page .ff-headline { margin: 0 0 16px; font-size: clamp(28px, 5vw, 56px); line-height: 1.1; letter-spacing: 0; color: var(--ff-ink); }
.ff-page .ff-subheadline { font-size: 18px; line-height: 1.65; color: var(--ff-muted); max-width: 720px; margin-bottom: 16px; }
.ff-page .ff-body { font-size: 16px; line-height: 1.7; color: var(--ff-muted); max-width: 720px; margin: 0 0 16px; }
.ff-page .ff-bullets { display: grid; gap: 10px; padding-left: 20px; margin: 0 0 20px; color: var(--ff-ink); }
.ff-page .ff-bullets li::marker { color: var(--ff-green); }
.ff-page .ff-button { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 22px; margin-top: 18px; border-radius: 8px; color: #082B4C; background: var(--ff-gold); text-decoration: none; font-weight: 700; font-size: 15px; transition: transform 0.18s ease, opacity 0.18s ease, box-shadow 0.18s ease; cursor: pointer; }
.ff-page .ff-button:hover { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(8, 43, 76, 0.12); }
.ff-page .ff-image { margin: 24px 0 0; }
.ff-page .ff-image img { width: 100%; height: auto; border-radius: 12px; display: block; transition: transform 0.3s ease; }
.ff-page .ff-img img:hover { transform: scale(1.01); }
.ff-page .ff-image-credit { display: block; font-size: 11px; color: var(--ff-muted); margin-top: 6px; }
.ff-page .ff-form { background: #fff; border: 1px solid #E5E7EB; border-radius: 12px; box-shadow: 0 18px 55px rgba(8, 43, 76, 0.08); }
.ff-page .ff-form form { display: grid; gap: 12px; max-width: 520px; }
.ff-page .ff-form input { min-height: 48px; border: 1px solid #E5E7EB; border-radius: 8px; padding: 0 14px; font: inherit; }
.ff-page .ff-form button { border: none; cursor: pointer; }
.ff-page .ff-fade-in { animation: ffFadeIn 0.6s ease-out both; }
.ff-page .ff-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; }
.ff-page .ff-lift:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(8, 43, 76, 0.10); }
@keyframes ffFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) {
  .ff-page .ff-fade-in, .ff-page .ff-lift, .ff-page .ff-button, .ff-page .ff-image img { animation: none !important; transition: none !important; }
}
@media (min-width: 760px) { .ff-page .ff-section { padding: 88px 32px; } }`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE 2 — Blocs individuels autonomes
// ─────────────────────────────────────────────────────────────────────────────
export type SystemeBlock = {
  id: string;
  label: string;
  type: string;
  html: string;
};

export function createSystemeBlocks(funnel: Funnel): SystemeBlock[] {
  return funnel.sections
    .filter((s) => s.visible !== false)
    .map((section) => {
      const cls = `ff-${section.type}-${section.id}`
        .replace(/[^a-z0-9-]/gi, "-")
        .toLowerCase();
      const accent = section.style?.accentColor ?? funnel.design.accentColor;
      const gold = funnel.design.secondaryColor;
      const ink = section.style?.textColor ?? "#101828";

      // Popup éventuel embarqué dans CE bloc (si la section utilise le mode popup)
      let popupCss = "";
      let popupHtml = "";
      let popupDomId: string | undefined;
      if (section.cta?.mode === "popup") {
        popupDomId = `${cls}-popup`;
        const p = renderPopupMarkup(popupDomId, section.cta, funnel.language, cls);
        popupCss = "\n" + p.css;
        popupHtml = "\n" + p.html;
      }

      const css = `.${cls} { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: ${ink}; padding: 56px 20px; max-width: 1040px; margin: 0 auto; box-sizing: border-box; --ff-gold: ${gold}; }
.${cls} *, .${cls} *::before, .${cls} *::after { box-sizing: border-box; }
.${cls} .ff-eyebrow { display: inline-block; color: ${accent}; font-weight: 700; text-transform: uppercase; font-size: 12px; letter-spacing: 0.1em; margin-bottom: 10px; }
.${cls} .ff-headline { margin: 0 0 14px; font-size: clamp(26px, 4.5vw, 44px); line-height: 1.15; }
.${cls} .ff-subheadline { font-size: 17px; line-height: 1.65; color: #667085; margin-bottom: 14px; max-width: 720px; }
.${cls} .ff-body { font-size: 16px; line-height: 1.7; color: #667085; max-width: 720px; margin: 0 0 14px; }
.${cls} .ff-bullets { display: grid; gap: 8px; padding-left: 20px; margin: 0 0 18px; }
.${cls} .ff-bullets li::marker { color: ${accent}; }
.${cls} .ff-button { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 22px; margin-top: 14px; border-radius: 8px; color: #082B4C; background: ${gold}; text-decoration: none; font-weight: 700; font-size: 15px; transition: transform 0.18s ease, opacity 0.18s ease, box-shadow 0.18s ease; cursor: pointer; }
.${cls} .ff-button:hover { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(8, 43, 76, 0.12); }
.${cls} .ff-image { margin: 20px 0 0; }
.${cls} .ff-image img { width: 100%; height: auto; border-radius: 12px; display: block; transition: transform 0.3s ease; }
.${cls} .ff-img img:hover { transform: scale(1.01); }
.${cls} .ff-image-credit { display: block; font-size: 11px; color: #98A2B3; margin-top: 6px; }
.${cls} .ff-fade-in { animation: ${cls}-fade 0.6s ease-out both; }
@keyframes ${cls}-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) {
  .${cls} .ff-fade-in, .${cls} .ff-button, .${cls} .ff-image img { animation: none !important; transition: none !important; }
}`;

      const html = `<style>
${css}${popupCss}
</style>

<section class="${cls}"${sectionStyleAttrs(section)}>
${renderSectionInner(section, popupDomId)}
</section>${popupHtml}`;

      return {
        id: section.id,
        label: section.headline,
        type: section.type,
        html,
      };
    });
}

export function createSystemeFormBlock(funnel: Funnel): SystemeBlock {
  const cls = "ff-form-block";
  const gold = funnel.design.secondaryColor;
  const labels = {
    fr: { title: "Recevoir les détails", name: "Votre nom", email: "Email", submit: "Continuer" },
    en: { title: "Get the details", name: "Your name", email: "Email", submit: "Continue" },
    es: { title: "Recibir los detalles", name: "Tu nombre", email: "Email", submit: "Continuar" },
  } as const;
  const l = labels[funnel.language] ?? labels.fr;

  const css = `.${cls} { font-family: Inter, system-ui, sans-serif; color: #101828; padding: 56px 20px; max-width: 560px; margin: 0 auto; box-sizing: border-box; background: #fff; border: 1px solid #E5E7EB; border-radius: 12px; }
.${cls} h2 { margin: 0 0 16px; font-size: clamp(22px, 3.5vw, 32px); line-height: 1.2; }
.${cls} form { display: grid; gap: 12px; }
.${cls} input { min-height: 48px; border: 1px solid #E5E7EB; border-radius: 8px; padding: 0 14px; font: inherit; }
.${cls} button { min-height: 48px; border: none; border-radius: 8px; background: ${gold}; color: #082B4C; font-weight: 700; font-size: 15px; cursor: pointer; transition: opacity 0.18s ease, transform 0.18s ease; }
.${cls} button:hover { opacity: 0.92; transform: translateY(-1px); }
@media (prefers-reduced-motion: reduce) { .${cls} button { transition: none !important; } }`;

  const html = `<style>
${css}
</style>

<section id="lead-form" class="${cls}">
<h2>${escapeHtml(l.title)}</h2>
<form onsubmit="return false;">
<input type="text" name="name" placeholder="${escapeAttr(l.name)}" required />
<input type="email" name="email" placeholder="${escapeAttr(l.email)}" required />
<button type="submit">${escapeHtml(l.submit)}</button>
</form>
</section>`;

  return { id: "lead-form", label: l.title, type: "form", html };
}

// ─────────────────────────────────────────────────────────────────────────────
// Guide d'import (legacy, conservé pour rétro-compat)
// ─────────────────────────────────────────────────────────────────────────────
export function createImportGuide(language: Funnel["language"] = "fr"): string {
  const guides = {
    fr: [
      "Guide d'import dans systeme.io",
      "",
      "1. Ouvrez systeme.io et créez un nouveau tunnel",
      "2. Ajoutez la page de capture ou de vente correspondant à votre objectif",
      "3. Glissez un bloc HTML personnalisé dans la section voulue",
      "4. Collez le contenu de funnel-complet.html (mode complet) OU collez chaque bloc de blocs/ un par un dans l'ordre indiqué",
      "5. Vérifiez que vos liens CTA pointent vers vos pages de paiement, formulaires ou rendez-vous",
      "6. Prévisualisez la page sur mobile avant publication",
    ],
    en: [
      "systeme.io import guide",
      "",
      "1. Open systeme.io and create a new funnel",
      "2. Add the capture or sales page that matches your goal",
      "3. Drag a Custom HTML block into the target section",
      "4. Paste the content of funnel-complete.html (full mode) OR paste each file from blocks/ one by one in order",
      "5. Make sure your CTA links point to your payment pages, forms or booking links",
      "6. Preview the page on mobile before publishing",
    ],
    es: [
      "Guía de importación en systeme.io",
      "",
      "1. Abre systeme.io y crea un nuevo embudo",
      "2. Añade la página de captura o de venta que corresponda a tu objetivo",
      "3. Arrastra un bloque HTML personalizado en la sección deseada",
      "4. Pega el contenido de embudo-completo.html (modo completo) O pega cada archivo de bloques/ uno a uno en orden",
      "5. Comprueba que tus enlaces CTA apuntan a tus páginas de pago, formularios o citas",
      "6. Previsualiza la página en móvil antes de publicar",
    ],
  } as const;

  return (guides[language] ?? guides.fr).join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Export ZIP
// ─────────────────────────────────────────────────────────────────────────────
export function createHtmlZipBase64(funnel: Funnel): string {
  const fullHtml = renderFunnelHtml(funnel);
  const blocks = createSystemeBlocks(funnel);
  const formBlock = createSystemeFormBlock(funnel);
  const guide = createImportGuide(funnel.language);

  const fileNames = {
    fr: "funnel-complet.html",
    en: "funnel-complete.html",
    es: "embudo-completo.html",
  } as const;

  const files: Record<string, Uint8Array> = {
    [fileNames[funnel.language] ?? "funnel-complete.html"]: strToU8(fullHtml),
    "guide-import-systeme.txt": strToU8(guide),
  };

  blocks.forEach((b, i) => {
    const safe = `${String(i + 1).padStart(2, "0")}-${b.type}-${b.id}`
      .replace(/[^a-z0-9-]/gi, "-")
      .toLowerCase();
    files[`blocs/${safe}.html`] = strToU8(b.html);
  });
  files[`blocs/99-form-${formBlock.id}.html`] = strToU8(formBlock.html);

  const zipped = zipSync(files);
  return Buffer.from(zipped).toString("base64");
}
// ─────────────────────────────────────────────────────────────────────────────
// Export ZIP v2 — structure améliorée pour systeme.io
// ─────────────────────────────────────────────────────────────────────────────

export function createSystemeIoZipBase64(funnel: Funnel): string {
  const fullHtml = renderFunnelHtml(funnel);
  const blocks = createSystemeBlocks(funnel);
  const formBlock = createSystemeFormBlock(funnel);

  const previewName = {
    fr: "apercu-complet.html",
    en: "funnel-complete.html",
    es: "embudo-completo.html",
  } as const;

  // Construit la liste des entrées de blocs pour le README
  const blockEntries = blocks.map((b, i) => {
    const safe = `${String(i + 1).padStart(2, "0")}-${b.type}-${b.id}`
      .replace(/[^a-z0-9-]/gi, "-")
      .toLowerCase();
    const fileName = `${safe}.html`;
    const section = funnel.sections.find((s) => s.id === b.id);
    const hasPopup = section?.cta?.mode === "popup";
    return {
      fileName: `blocs-systeme-io/${fileName}`,
      type: b.type,
      label: b.label,
      hasPopup,
      _zipPath: `blocs-systeme-io/${fileName}`,
      _html: b.html,
    };
  });

  // Bloc formulaire final
  const formFileName = `99-form-${formBlock.id}.html`
    .replace(/[^a-z0-9-]/gi, "-")
    .toLowerCase();
  blockEntries.push({
    fileName: `blocs-systeme-io/${formFileName}`,
    type: "form",
    label: formBlock.label,
    hasPopup: false,
    _zipPath: `blocs-systeme-io/${formFileName}`,
    _html: formBlock.html,
  });

  const readme = createReadme(
    funnel,
    blockEntries.map((b) => ({
      fileName: b.fileName.replace("blocs-systeme-io/", ""),
      type: b.type,
      label: b.label,
      hasPopup: b.hasPopup,
    }))
  );

  const files: Record<string, Uint8Array> = {
    "README.md": strToU8(readme),
    [previewName[funnel.language] ?? "apercu-complet.html"]: strToU8(fullHtml),
  };

  blockEntries.forEach((b) => {
    files[b._zipPath] = strToU8(b._html);
  });

  const zipped = zipSync(files);
  return Buffer.from(zipped).toString("base64");
}
