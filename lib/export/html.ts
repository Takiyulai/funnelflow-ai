// lib/export/html.ts
import { strToU8, zipSync } from "fflate";
import type {
  Funnel,
  FunnelSection,
  CtaConfig,
  SectionImage,
} from "@/lib/funnels/types";

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

function ctaHref(cta: CtaConfig): string {
  if (cta.mode === "anchor") {
    const id = (cta.anchorId ?? "lead-form").replace(/^#/, "");
    return `#${id}`;
  }
  if (cta.mode === "popup") {
    return `#${cta.popupId ?? "popup"}`;
  }
  if (cta.mode === "redirect" && cta.url && isSafeUrl(cta.url)) {
    return cta.url;
  }
  return "#lead-form";
}

function ctaAttrs(cta: CtaConfig): string {
  const href = ctaHref(cta);
  const target = cta.mode === "redirect" && cta.target === "_blank" ? "_blank" : "_self";
  const rel = target === "_blank" ? ' rel="noopener"' : "";
  return ` href="${escapeAttr(href)}" target="${target}"${rel}`;
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
// Rendu d'une section
// ─────────────────────────────────────────────────────────────────────────────
function renderSectionInner(section: FunnelSection): string {
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
    ? `<a class="ff-button ff-cta"${ctaAttrs(section.cta)}>${escapeHtml(section.cta.label)}</a>`
    : "";
  const image = renderImage(section.image);

  return `${eyebrow}${headline}${subheadline}${body}${bullets}${image}${cta}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formulaire intégré (toujours autonome, pas de rechargement)
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
// MODE 1 — One-shot complet
// ─────────────────────────────────────────────────────────────────────────────
export function renderFunnelHtml(funnel: Funnel): string {
  const css = renderFunnelCss(funnel);

  const sections = funnel.sections
    .filter((s) => s.visible !== false)
    .map((section) => {
      return `  <section class="ff-section ff-${section.type}${sectionSpacingClass(section)}"${sectionStyleAttrs(section)}>
    ${renderSectionInner(section)}
  </section>`;
    })
    .join("\n");

  return `<style>
${css}
</style>

<div class="ff-page" data-ff-lang="${escapeAttr(funnel.language)}">
${sections}
${renderLeadForm(funnel)}
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
.ff-page .ff-button { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 22px; margin-top: 18px; border-radius: 8px; color: #082B4C; background: var(--ff-gold); text-decoration: none; font-weight: 700; font-size: 15px; transition: transform 0.18s ease, opacity 0.18s ease, box-shadow 0.18s ease; }
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
      const cls = `ff-${section.type}-${section.id}`.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
      const accent = section.style?.accentColor ?? funnel.design.accentColor;
      const gold = funnel.design.secondaryColor;
      const ink = section.style?.textColor ?? "#101828";

      const css = `.${cls} { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: ${ink}; padding: 56px 20px; max-width: 1040px; margin: 0 auto; box-sizing: border-box; }
.${cls} *, .${cls} *::before, .${cls} *::after { box-sizing: border-box; }
.${cls} .ff-eyebrow { display: inline-block; color: ${accent}; font-weight: 700; text-transform: uppercase; font-size: 12px; letter-spacing: 0.1em; margin-bottom: 10px; }
.${cls} .ff-headline { margin: 0 0 14px; font-size: clamp(26px, 4.5vw, 44px); line-height: 1.15; }
.${cls} .ff-subheadline { font-size: 17px; line-height: 1.65; color: #667085; margin-bottom: 14px; max-width: 720px; }
.${cls} .ff-body { font-size: 16px; line-height: 1.7; color: #667085; max-width: 720px; margin: 0 0 14px; }
.${cls} .ff-bullets { display: grid; gap: 8px; padding-left: 20px; margin: 0 0 18px; }
.${cls} .ff-bullets li::marker { color: ${accent}; }
.${cls} .ff-button { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 22px; margin-top: 14px; border-radius: 8px; color: #082B4C; background: ${gold}; text-decoration: none; font-weight: 700; font-size: 15px; transition: transform 0.18s ease, opacity 0.18s ease, box-shadow 0.18s ease; }
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
${css}
</style>

<section class="${cls}"${sectionStyleAttrs(section)}>
${renderSectionInner(section)}
</section>`;

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
// Guide d'import
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
