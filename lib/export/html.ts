// lib/export/html.ts
import { strToU8, zipSync } from "fflate";
import type {
  Funnel,
  FunnelSection,
  CtaConfig,
  SectionImage,
  SectionItem,
  FormFieldItem,
  IconName,
  SectionColors,
} from "@/lib/funnels/types";
import { createReadme } from "./readme";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers HTML
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

// ─────────────────────────────────────────────────────────────────────────────
// CTA
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Image
// ─────────────────────────────────────────────────────────────────────────────
function renderImage(image?: SectionImage): string {
  if (!image || image.mode === "none" || !image.url) return "";
  const alt = escapeAttr(image.alt ?? "");
  const credit = image.credit
    ? `<span class="ff-image-credit">${escapeHtml(image.credit)}</span>`
    : "";
  return `<figure class="ff-image ff-img"><img src="${escapeAttr(image.url)}" alt="${alt}" loading="lazy" />${credit}</figure>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Couleurs & style de section (Lot K)
// ─────────────────────────────────────────────────────────────────────────────
function getSectionColors(section: FunnelSection): SectionColors {
  const style = (section.style ?? {}) as {
    colors?: SectionColors;
    userColorsOverride?: boolean;
  };
  const colors: SectionColors = style.colors ?? {};
  if (style.userColorsOverride) return colors;
  const hasExplicitBg =
    typeof colors.bg === "string" && colors.bg.trim().length > 0;
  if (hasExplicitBg) return colors;
  const { bg: _ignored, ...rest } = colors;
  return rest;
}

function sectionStyleAttrs(section: FunnelSection): string {
  const styles: string[] = [];
  const colors = getSectionColors(section);

  if (colors.bg) styles.push(`background:${colors.bg}`);
  if (colors.ink) styles.push(`color:${colors.ink}`);
  if (colors.ink) styles.push(`--ff-ink:${colors.ink}`);
  if (colors.accent) styles.push(`--ff-accent:${colors.accent}`);

  // Legacy
  if (!colors.ink && section.style?.textColor)
    styles.push(`color:${section.style.textColor}`);
  if (!colors.accent && section.style?.accentColor)
    styles.push(`--ff-accent:${section.style.accentColor}`);

  if (section.style?.align === "center") styles.push("text-align:center");
  else if (section.style?.align === "right") styles.push("text-align:right");

  return styles.length ? ` style="${escapeAttr(styles.join(";"))}"` : "";
}

function sectionSpacingClass(section: FunnelSection): string {
  return section.style?.spacing ? ` ff-spacing-${section.style.spacing}` : "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Icônes → emojis (compatibles systeme.io sans police externe)
// ─────────────────────────────────────────────────────────────────────────────
const ICON_TO_EMOJI: Record<string, string> = {
  check: "✓", star: "★", shield: "🛡️", zap: "⚡", target: "🎯",
  rocket: "🚀", "trending-up": "📈", "trending-down": "📉",
  clock: "🕐", calendar: "📅", mail: "✉️", user: "👤", users: "👥",
  briefcase: "💼", award: "🏆", gift: "🎁", lock: "🔒", settings: "⚙️",
  sparkles: "✨", lightbulb: "💡", flag: "🚩", "bar-chart": "📊",
  play: "▶", download: "⬇", "file-text": "📄", "thumbs-up": "👍",
  heart: "❤", globe: "🌐",
};
function iconChar(name?: IconName | string): string {
  if (!name) return ICON_TO_EMOJI.check;
  return ICON_TO_EMOJI[name] || ICON_TO_EMOJI.check;
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderers spécialisés (HTML statique équivalent aux composants React)
// ─────────────────────────────────────────────────────────────────────────────

function renderPricing(section: FunnelSection): string {
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "pricing" } => it.kind === "pricing"
  );
  if (items.length === 0) return "";

  const cardsCount = items.length;
  const gridCls =
    cardsCount === 1 ? "ff-grid-1" : cardsCount === 2 ? "ff-grid-2" : "ff-grid-3";

  return `<div class="ff-pricing ${gridCls}">
${items
  .map((item, idx) => {
    const d = item.data;
    const highlighted = !!d.highlighted;
    const cls = `ff-pricing-card${highlighted ? " ff-pricing-card--highlighted" : ""}`;

    let ctaHtml = "";
    if (d.cta?.label) {
      ctaHtml = `<a class="ff-btn ff-pricing-cta"${ctaAttrs(d.cta)}>${escapeHtml(d.cta.label)}</a>`;
    }

    const badge = highlighted
      ? `<div class="ff-pricing-badge">★ Populaire</div>`
      : "";

    const desc = d.description
      ? `<p class="ff-pricing-desc">${escapeHtml(d.description)}</p>`
      : "";

    const period = d.period
      ? `<span class="ff-pricing-period">${escapeHtml(d.period)}</span>`
      : "";

    const features =
      d.features && d.features.length > 0
        ? `<ul class="ff-pricing-features">
${d.features.map((f) => `  <li><span class="ff-feat-check">✓</span><span>${escapeHtml(f)}</span></li>`).join("\n")}
</ul>`
        : "";

    return `  <div class="${cls}">
    ${badge}
    <div class="ff-pricing-head">
      <h3 class="ff-pricing-name">${escapeHtml(d.name || `Plan ${idx + 1}`)}</h3>
      ${desc}
    </div>
    <div class="ff-pricing-price">
      <span class="ff-pricing-amount">${escapeHtml(d.price || "—")}</span>
      ${period}
    </div>
    ${features}
    ${ctaHtml}
  </div>`;
  })
  .join("\n")}
</div>`;
}

function renderBonus(section: FunnelSection): string {
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "bonus" } => it.kind === "bonus"
  );
  if (items.length === 0) return "";

  const gridCls =
    items.length === 1 ? "ff-grid-1" : items.length === 2 ? "ff-grid-2" : "ff-grid-3";

  return `<div class="ff-bonus ${gridCls}">
${items
  .map((item, idx) => {
    const d = item.data;
    const value = d.value
      ? `<span class="ff-bonus-value">${escapeHtml(d.value)}</span>`
      : "";
    const desc = d.description
      ? `<p class="ff-bonus-desc">${escapeHtml(d.description)}</p>`
      : "";
    return `  <div class="ff-bonus-card">
    <div class="ff-bonus-icon">${iconChar(d.iconName || "gift")}</div>
    <div class="ff-bonus-body">
      <div class="ff-bonus-head">
        <h3 class="ff-bonus-title">${escapeHtml(d.title || `Bonus ${idx + 1}`)}</h3>
        ${value}
      </div>
      ${desc}
    </div>
  </div>`;
  })
  .join("\n")}
</div>`;
}

function renderTestimonials(section: FunnelSection): string {
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "testimonial" } => it.kind === "testimonial"
  );
  if (items.length === 0) return "";

  const gridCls =
    items.length === 1 ? "ff-grid-1" : items.length === 2 ? "ff-grid-2" : "ff-grid-3";

  return `<div class="ff-testimonials ${gridCls}">
${items
  .map((item) => {
    const d = item.data;
    const initials = (d.authorName || "?")
      .split(" ")
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();

    const rating =
      d.rating && d.rating > 0
        ? `<div class="ff-testimonial-rating">${"★".repeat(Math.max(0, Math.min(5, d.rating)))}${"☆".repeat(5 - Math.max(0, Math.min(5, d.rating)))}</div>`
        : "";

    const quote = d.quote
      ? `<blockquote class="ff-testimonial-quote">« ${escapeHtml(d.quote)} »</blockquote>`
      : "";

    const avatar = d.avatarUrl
      ? `<img class="ff-testimonial-avatar" src="${escapeAttr(d.avatarUrl)}" alt="${escapeAttr(d.authorName || "")}" loading="lazy" />`
      : `<div class="ff-testimonial-avatar ff-testimonial-avatar--initials">${escapeHtml(initials)}</div>`;

    const role = d.authorRole
      ? `<div class="ff-testimonial-role">${escapeHtml(d.authorRole)}</div>`
      : "";

    return `  <div class="ff-testimonial-card">
    ${rating}
    ${quote}
    <div class="ff-testimonial-author">
      ${avatar}
      <div class="ff-testimonial-meta">
        <div class="ff-testimonial-name">${escapeHtml(d.authorName || "")}</div>
        ${role}
      </div>
    </div>
  </div>`;
  })
  .join("\n")}
</div>`;
}

function renderFaq(section: FunnelSection, scopeCls: string): string {
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "faq" } => it.kind === "faq"
  );
  if (items.length === 0) return "";

  const list = items
    .map((item, idx) => {
      const d = item.data;
      const id = `${scopeCls}-faq-${idx}`;
      return `  <div class="ff-faq-item">
    <button type="button" class="ff-faq-q" aria-expanded="false" data-ff-faq-toggle="${id}">
      <span>${escapeHtml(d.question || `Question ${idx + 1}`)}</span>
      <span class="ff-faq-chevron">▾</span>
    </button>
    <div class="ff-faq-a" id="${id}" data-ff-faq-panel hidden>
      <p>${escapeHtml(d.answer || "")}</p>
    </div>
  </div>`;
    })
    .join("\n");

  return `<div class="ff-faq-list">
${list}
</div>`;
}

function renderGuarantee(section: FunnelSection): string {
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "guarantee" } => it.kind === "guarantee"
  );
  const item = items[0];
  if (!item) return "";
  const d = item.data;

  const duration = d.duration
    ? `<span class="ff-guarantee-duration">${escapeHtml(d.duration)}</span>`
    : "";
  const desc = d.description
    ? `<p class="ff-guarantee-desc">${escapeHtml(d.description)}</p>`
    : "";

  return `<div class="ff-guarantee">
  <div class="ff-guarantee-icon">${iconChar(d.iconName || "shield")}</div>
  <div class="ff-guarantee-body">
    <div class="ff-guarantee-head">
      <h3 class="ff-guarantee-title">${escapeHtml(d.title || "Notre garantie")}</h3>
      ${duration}
    </div>
    ${desc}
  </div>
</div>`;
}

function renderFormFields(section: FunnelSection, language: Funnel["language"]): string {
  const fields = (section.items || []).filter(
    (it): it is SectionItem & { kind: "formField" } => it.kind === "formField"
  );

  const labels = {
    fr: { submit: "Envoyer", placeholderText: "Votre réponse" },
    en: { submit: "Submit", placeholderText: "Your answer" },
    es: { submit: "Enviar", placeholderText: "Tu respuesta" },
  } as const;
  const l = labels[language] ?? labels.fr;

  const ctaLabel = section.cta?.label || l.submit;

  // Si pas de champs, on met un fallback minimal email
  const list: FormFieldItem[] = fields.length
    ? fields.map((f) => f.data)
    : [
        { name: "email", label: "Email", type: "email", required: true, width: "full" },
      ];

  const fieldsHtml = list
    .map((f, idx) => {
      const widthCls = f.width === "half" ? "ff-field ff-field--half" : "ff-field";
      const name = escapeAttr(f.name || `field_${idx}`);
      const label = f.label
        ? `<label class="ff-field-label" for="${name}">${escapeHtml(f.label)}${f.required ? " *" : ""}</label>`
        : "";
      const ph = escapeAttr(f.placeholder || "");
      const req = f.required ? " required" : "";

      let input = "";
      if (f.type === "textarea") {
        input = `<textarea class="ff-input" id="${name}" name="${name}" placeholder="${ph}" rows="4"${req}></textarea>`;
      } else if (f.type === "select") {
        const opts = (f.options || [])
          .map((o) => `<option value="${escapeAttr(o)}">${escapeHtml(o)}</option>`)
          .join("");
        input = `<select class="ff-input" id="${name}" name="${name}"${req}><option value="">${escapeHtml(f.placeholder || "—")}</option>${opts}</select>`;
      } else if (f.type === "checkbox") {
        input = `<label class="ff-checkbox"><input type="checkbox" id="${name}" name="${name}"${req} /><span>${escapeHtml(f.placeholder || f.label || "")}</span></label>`;
        return `<div class="${widthCls}">${input}</div>`;
      } else {
        input = `<input class="ff-input" type="${f.type}" id="${name}" name="${name}" placeholder="${ph}"${req} />`;
      }

      return `<div class="${widthCls}">${label}${input}</div>`;
    })
    .join("\n");

  return `<form class="ff-form-fields" onsubmit="event.preventDefault(); alert('Démonstration : remplacez ce formulaire par votre embed systeme.io.');">
${fieldsHtml}
<button type="submit" class="ff-btn ff-form-submit">${escapeHtml(ctaLabel)}</button>
</form>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Video embed
// ─────────────────────────────────────────────────────────────────────────────
function getVideoEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === "vimeo.com") {
      const id = u.pathname.replace(/^\//, "");
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  } catch {
    return null;
  }
}

function renderVideo(url?: string): string {
  if (!url) return "";
  const embed = getVideoEmbedUrl(url);
  if (!embed) return "";
  return `<div class="ff-video">
  <iframe src="${escapeAttr(embed)}" title="Vidéo" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Popup
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
  const embed = (cta.popupEmbed ?? "").trim();
  const formMarkup = embed
    ? `<div class="ff-popup-embed">${embed}</div>`
    : renderPopupFallbackForm(language);

  const css = `.${scopeCls} .ff-popup-overlay { position: fixed; inset: 0; background: rgba(8, 18, 36, 0.72); display: none; align-items: center; justify-content: center; z-index: 99999; padding: 16px; opacity: 0; transition: opacity 0.18s ease; }
.${scopeCls} .ff-popup-overlay[data-ff-open="true"] { display: flex; opacity: 1; }
.${scopeCls} .ff-popup-card { position: relative; width: 100%; max-width: 460px; background: #fff; color: #101828; border-radius: 14px; padding: 28px 24px 24px; box-shadow: 0 30px 80px rgba(8, 18, 36, 0.35); max-height: 90vh; overflow-y: auto; }
.${scopeCls} .ff-popup-close { position: absolute; top: 10px; right: 10px; width: 32px; height: 32px; border: none; background: transparent; color: #98A2B3; font-size: 22px; line-height: 1; cursor: pointer; border-radius: 8px; }
.${scopeCls} .ff-popup-close:hover { background: #F3F4F6; color: #101828; }
.${scopeCls} .ff-popup-title { margin: 0 0 8px; font-size: 22px; font-weight: 700; line-height: 1.25; padding-right: 28px; color: #101828; }
.${scopeCls} .ff-popup-body { margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #475467; }
.${scopeCls} .ff-popup-embed form, .${scopeCls} .ff-popup-form { display: grid; gap: 10px; }
.${scopeCls} .ff-popup-embed input, .${scopeCls} .ff-popup-form input { min-height: 44px; border: 1px solid #E5E7EB; border-radius: 8px; padding: 0 12px; font: inherit; width: 100%; box-sizing: border-box; }
.${scopeCls} .ff-popup-embed button, .${scopeCls} .ff-popup-form button { min-height: 46px; border: none; border-radius: 8px; background: var(--ff-accent, #D4A537); color: #ffffff; font-weight: 700; font-size: 15px; cursor: pointer; }
.${scopeCls} .ff-popup-embed button:hover, .${scopeCls} .ff-popup-form button:hover { opacity: 0.92; }`;

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
  function open(e){ if (e && e.preventDefault) e.preventDefault(); lastFocus = document.activeElement; overlay.setAttribute("data-ff-open", "true"); document.body.style.overflow = "hidden"; }
  function close(){ overlay.setAttribute("data-ff-open", "false"); document.body.style.overflow = ""; if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch(_) {} } }
  document.querySelectorAll('[data-ff-popup-target="' + id + '"]').forEach(function(el){ el.addEventListener("click", open); });
  overlay.querySelectorAll("[data-ff-popup-close]").forEach(function(el){ el.addEventListener("click", close); });
  overlay.addEventListener("click", function(ev){ if (ev.target === overlay) close(); });
  document.addEventListener("keydown", function(ev){ if (ev.key === "Escape" && overlay.getAttribute("data-ff-open") === "true") close(); });
})();
</script>`;
  return { css, html };
}

// ─────────────────────────────────────────────────────────────────────────────
// Script FAQ accordéon
// ─────────────────────────────────────────────────────────────────────────────
function faqScript(scopeCls: string): string {
  return `<script>
(function(){
  var root = document.querySelector(".${scopeCls}");
  if (!root || root.dataset.ffFaqBound === "1") return;
  root.dataset.ffFaqBound = "1";
  root.querySelectorAll("[data-ff-faq-toggle]").forEach(function(btn){
    btn.addEventListener("click", function(){
      var id = btn.getAttribute("data-ff-faq-toggle");
      var panel = root.querySelector('[data-ff-faq-panel]#' + id);
      if (!panel) return;
      var open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", open ? "false" : "true");
      if (open) panel.setAttribute("hidden", ""); else panel.removeAttribute("hidden");
    });
  });
})();
</script>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendu d'une section
// ─────────────────────────────────────────────────────────────────────────────
function isSpecializedType(type: string): boolean {
  return ["pricing", "offer", "bonus", "testimonials", "proof", "faq", "guarantee", "form"].includes(type);
}

function renderSectionInner(
  section: FunnelSection,
  language: Funnel["language"],
  scopeCls: string,
  popupDomId?: string
): string {
  const eyebrow = section.eyebrow
    ? `<span class="ff-eyebrow">${escapeHtml(section.eyebrow)}</span>`
    : "";
  const headline = section.headline
    ? `<h2 class="ff-headline">${escapeHtml(section.headline)}</h2>`
    : "";
  const subheadline = section.subheadline
    ? `<p class="ff-subheadline">${escapeHtml(section.subheadline)}</p>`
    : "";
  const body = section.body
    ? `<p class="ff-body">${escapeHtml(section.body)}</p>`
    : "";

  const type = section.type as string;
  const hasItems = Array.isArray(section.items) && section.items.length > 0;

  // Renderer spécialisé
  let specialized = "";
  if (hasItems) {
    if (type === "pricing" || type === "offer") specialized = renderPricing(section);
    else if (type === "bonus") specialized = renderBonus(section);
    else if (type === "testimonials" || type === "proof") specialized = renderTestimonials(section);
    else if (type === "faq") specialized = renderFaq(section, scopeCls);
    else if (type === "guarantee") specialized = renderGuarantee(section);
  }

  // Formulaire (utilise items de type formField)
  let formHtml = "";
  if (type === "form") {
    formHtml = renderFormFields(section, language);
  }

  // Bullets (uniquement si pas de renderer spécialisé)
  const bullets =
    !specialized && section.bullets?.length
      ? `<ul class="ff-bullets">${section.bullets
          .map((b) => `<li><span class="ff-bullet-ic">✓</span><span>${escapeHtml(b)}</span></li>`)
          .join("")}</ul>`
      : "";

  const image = renderImage(section.image);
  const video = renderVideo(section.video?.url);

  const cta =
    section.cta?.label && type !== "form"
      ? `<div class="ff-cta-wrap"><a class="ff-btn ff-cta"${ctaAttrs(section.cta, popupDomId)}>${escapeHtml(section.cta.label)}</a></div>`
      : "";

  return `${eyebrow}${headline}${subheadline}${body}${bullets}${specialized}${video}${image}${formHtml}${cta}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Header (brand bar) + Footer
// ─────────────────────────────────────────────────────────────────────────────
function extractBrandName(fullName: string): string {
  if (!fullName) return "";
  const separators = [" - ", " – ", " — ", " | ", " : "];
  for (const sep of separators) {
    const idx = fullName.indexOf(sep);
    if (idx > 0) return fullName.slice(0, idx).trim();
  }
  return fullName.trim();
}

function renderBrandBar(funnel: Funnel): string {
  const logo = funnel.meta?.logoUrl;
  const brand = extractBrandName(funnel.funnelName || "");
  if (!logo && !brand) return "";
  return `<div class="ff-brand-bar">
${logo ? `<img src="${escapeAttr(logo)}" alt="" />` : ""}
${brand ? `<span>${escapeHtml(brand)}</span>` : ""}
</div>`;
}

function renderFooter(funnel: Funnel): string {
  const meta = funnel.meta;
  const businessName = meta?.businessName?.trim();
  const legalNotice = meta?.legalNotice?.trim();
  const contactEmail = meta?.contactEmail?.trim();
  const year = new Date().getFullYear();
  const displayName = businessName || extractBrandName(funnel.funnelName) || "FunnelFlow";

  return `<footer class="ff-footer">
  <div class="ff-footer-inner">
    <div class="ff-footer-brand">${escapeHtml(displayName)}</div>
    ${legalNotice ? `<div class="ff-footer-legal">${escapeHtml(legalNotice)}</div>` : ""}
    ${contactEmail ? `<div><a class="ff-footer-link" href="mailto:${escapeAttr(contactEmail)}">${escapeHtml(contactEmail)}</a></div>` : ""}
    <div class="ff-footer-copy">© ${year} ${escapeHtml(displayName)} — Tous droits réservés</div>
  </div>
</footer>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE 1 — Page complète scopée sous .ff-page
// ─────────────────────────────────────────────────────────────────────────────
export function renderFunnelHtml(funnel: Funnel): string {
  const css = renderFunnelCss(funnel);

  const popupSections = funnel.sections.filter(
    (s) => s.visible !== false && s.cta?.mode === "popup"
  );
  const popups = popupSections.map((s) => {
    const domId = `ff-popup-${s.id}`;
    return {
      section: s,
      domId,
      markup: renderPopupMarkup(domId, s.cta!, funnel.language, "ff-page"),
    };
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
      const popupDomId =
        section.cta?.mode === "popup" ? popupIdBySection[section.id] : undefined;
      return `  <section class="ff-section ff-${section.type}${sectionSpacingClass(section)}"${sectionStyleAttrs(section)}>
    <div class="ff-section-inner">
      ${renderSectionInner(section, funnel.language, "ff-page", popupDomId)}
    </div>
  </section>`;
    })
    .join("\n");

  // FAQ script si au moins une section FAQ
  const hasFaq = funnel.sections.some(
    (s) => s.visible !== false && s.type === "faq" && (s.items?.length ?? 0) > 0
  );

  return `<style>
${css}
${popupCss}
</style>

<div class="ff-page" data-ff-lang="${escapeAttr(funnel.language)}">
${renderBrandBar(funnel)}
${sections}
${renderFooter(funnel)}
${popupHtml}
</div>
${hasFaq ? faqScript("ff-page") : ""}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS scopé sous .ff-page
// ─────────────────────────────────────────────────────────────────────────────
export function renderFunnelCss(funnel: Funnel): string {
  const primary = funnel.design.primaryColor || "#0f172a";
  const gold = funnel.design.secondaryColor || "#D4A537";
  const accent = funnel.design.accentColor || gold;

  return `.ff-page { --ff-primary:${primary}; --ff-gold:${gold}; --ff-accent:${accent}; --ff-ink:#0f172a; --ff-muted:#667085; --ff-bg:#ffffff; --ff-border: rgba(0,0,0,0.08); --ff-brand-surface:#0f172a; --ff-brand-on-surface: rgba(255,255,255,0.85); }
.ff-page, .ff-page * { box-sizing: border-box; }
.ff-page { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--ff-ink); background: var(--ff-bg); }

/* Brand bar */
.ff-page .ff-brand-bar { display: flex; align-items: center; gap: 10px; padding: 14px 20px; background: var(--ff-brand-surface); color: #fff; }
.ff-page .ff-brand-bar img { height: 28px; width: auto; }
.ff-page .ff-brand-bar span { font-weight: 700; font-size: 14px; }

/* Sections */
.ff-page .ff-section { padding: 64px 20px; }
.ff-page .ff-section-inner { max-width: 1040px; margin: 0 auto; }
.ff-page .ff-spacing-compact { padding-top: 40px; padding-bottom: 40px; }
.ff-page .ff-spacing-large { padding-top: 96px; padding-bottom: 96px; }

/* Typo */
.ff-page .ff-eyebrow { display: inline-block; color: var(--ff-accent); font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.12em; margin-bottom: 12px; padding: 4px 10px; border-radius: 999px; background: color-mix(in srgb, var(--ff-accent) 12%, transparent); }
.ff-page .ff-headline { margin: 0 0 14px; font-size: clamp(26px, 4.5vw, 44px); line-height: 1.15; font-weight: 800; color: inherit; }
.ff-page .ff-subheadline { font-size: 17px; line-height: 1.65; opacity: 0.85; max-width: 720px; margin: 0 0 14px; }
.ff-page .ff-body { font-size: 16px; line-height: 1.7; opacity: 0.9; max-width: 720px; margin: 0 0 14px; white-space: pre-line; }

/* Bullets */
.ff-page .ff-bullets { list-style: none; padding: 0; margin: 0 0 18px; display: grid; gap: 10px; }
.ff-page .ff-bullets li { display: flex; align-items: flex-start; gap: 10px; }
.ff-page .ff-bullet-ic { color: var(--ff-accent); font-weight: 700; flex-shrink: 0; }

/* Buttons */
.ff-page .ff-btn, .ff-page .ff-cta { display: inline-flex; align-items: center; justify-content: center; min-height: 46px; padding: 0 22px; margin-top: 14px; border-radius: 8px; color: #ffffff !important; background: var(--ff-accent); text-decoration: none; font-weight: 700; font-size: 15px; cursor: pointer; border: none; transition: opacity 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease; }
.ff-page .ff-btn:hover, .ff-page .ff-cta:hover { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0, 0, 0, 0.15); }
.ff-page .ff-cta-wrap { margin-top: 18px; }

/* Image */
.ff-page .ff-image { margin: 22px 0 8px; }
.ff-page .ff-image img { width: 100%; max-width: 720px; height: auto; border-radius: 12px; display: block; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
.ff-page .ff-image-credit { display: block; font-size: 11px; opacity: 0.6; margin-top: 6px; text-align: center; }

/* Video */
.ff-page .ff-video { margin: 22px auto; max-width: 720px; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.15); aspect-ratio: 16/9; background: #000; }
.ff-page .ff-video iframe { width: 100%; height: 100%; border: 0; display: block; }

/* Grids */
.ff-page .ff-grid-1 { display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 24px; }
.ff-page .ff-grid-2 { display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 24px; }
.ff-page .ff-grid-3 { display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 24px; }
@media (min-width: 760px) {
  .ff-page .ff-grid-2 { grid-template-columns: 1fr 1fr; }
  .ff-page .ff-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
}

/* Pricing */
.ff-page .ff-pricing-card { position: relative; background: color-mix(in srgb, var(--ff-ink) 3%, transparent); border: 1px solid var(--ff-border); border-radius: 14px; padding: 24px; display: flex; flex-direction: column; }
.ff-page .ff-pricing-card--highlighted { background: color-mix(in srgb, var(--ff-accent) 8%, transparent); border: 2px solid var(--ff-accent); box-shadow: 0 10px 30px -10px color-mix(in srgb, var(--ff-accent) 40%, transparent); }
.ff-page .ff-pricing-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--ff-accent); color: #fff; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 12px; border-radius: 999px; }
.ff-page .ff-pricing-name { margin: 0 0 6px; font-size: 18px; font-weight: 700; color: inherit; }
.ff-page .ff-pricing-desc { margin: 0 0 14px; font-size: 13px; opacity: 0.65; }
.ff-page .ff-pricing-price { display: flex; align-items: baseline; gap: 6px; margin-bottom: 20px; }
.ff-page .ff-pricing-amount { font-size: 36px; font-weight: 900; color: inherit; }
.ff-page .ff-pricing-card--highlighted .ff-pricing-amount { color: var(--ff-accent); }
.ff-page .ff-pricing-period { font-size: 14px; opacity: 0.6; }
.ff-page .ff-pricing-features { list-style: none; padding: 0; margin: 0 0 20px; display: grid; gap: 8px; flex: 1; }
.ff-page .ff-pricing-features li { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; opacity: 0.85; }
.ff-page .ff-feat-check { color: var(--ff-accent); font-weight: 700; flex-shrink: 0; }
.ff-page .ff-pricing-cta { width: 100%; margin-top: auto; }

/* Bonus */
.ff-page .ff-bonus-card { display: flex; gap: 14px; align-items: flex-start; padding: 18px; border-radius: 12px; background: color-mix(in srgb, var(--ff-accent) 6%, transparent); border: 1px solid color-mix(in srgb, var(--ff-accent) 25%, transparent); }
.ff-page .ff-bonus-icon { width: 42px; height: 42px; border-radius: 10px; background: var(--ff-accent); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
.ff-page .ff-bonus-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
.ff-page .ff-bonus-title { margin: 0; font-size: 15px; font-weight: 700; color: inherit; }
.ff-page .ff-bonus-value { background: var(--ff-accent); color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
.ff-page .ff-bonus-desc { margin: 0; font-size: 14px; opacity: 0.8; line-height: 1.5; }

/* Testimonials */
.ff-page .ff-testimonial-card { padding: 18px; border-radius: 12px; background: color-mix(in srgb, var(--ff-ink) 4%, transparent); border: 1px solid var(--ff-border); }
.ff-page .ff-testimonial-rating { color: #f59e0b; margin-bottom: 10px; font-size: 16px; letter-spacing: 1px; }
.ff-page .ff-testimonial-quote { margin: 0 0 14px; font-size: 14px; line-height: 1.6; opacity: 0.9; font-style: italic; }
.ff-page .ff-testimonial-author { display: flex; align-items: center; gap: 10px; }
.ff-page .ff-testimonial-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
.ff-page .ff-testimonial-avatar--initials { background: var(--ff-accent); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; }
.ff-page .ff-testimonial-name { font-size: 13px; font-weight: 700; color: inherit; }
.ff-page .ff-testimonial-role { font-size: 12px; opacity: 0.6; }

/* FAQ */
.ff-page .ff-faq-list { max-width: 720px; margin: 24px auto 0; }
.ff-page .ff-faq-item { border-bottom: 1px solid var(--ff-border); }
.ff-page .ff-faq-item:first-child { border-top: 1px solid var(--ff-border); }
.ff-page .ff-faq-q { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 16px 0; background: transparent; border: none; cursor: pointer; font-size: 15px; font-weight: 600; color: inherit; text-align: left; font-family: inherit; }
.ff-page .ff-faq-chevron { color: var(--ff-accent); transition: transform 0.25s ease; flex-shrink: 0; }
.ff-page .ff-faq-q[aria-expanded="true"] .ff-faq-chevron { transform: rotate(180deg); }
.ff-page .ff-faq-a { padding: 0 28px 16px 0; font-size: 14px; line-height: 1.6; opacity: 0.85; }
.ff-page .ff-faq-a p { margin: 0; white-space: pre-line; }

/* Guarantee */
.ff-page .ff-guarantee { max-width: 720px; margin: 24px auto 0; padding: 24px; border-radius: 16px; background: color-mix(in srgb, var(--ff-accent) 8%, transparent); border: 2px solid color-mix(in srgb, var(--ff-accent) 30%, transparent); display: flex; flex-direction: column; gap: 16px; align-items: center; text-align: center; }
@media (min-width: 640px) { .ff-page .ff-guarantee { flex-direction: row; text-align: left; } }
.ff-page .ff-guarantee-icon { width: 64px; height: 64px; border-radius: 50%; background: var(--ff-accent); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 28px; flex-shrink: 0; }
.ff-page .ff-guarantee-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; justify-content: center; }
@media (min-width: 640px) { .ff-page .ff-guarantee-head { justify-content: flex-start; } }
.ff-page .ff-guarantee-title { margin: 0; font-size: 20px; font-weight: 900; color: inherit; }
.ff-page .ff-guarantee-duration { background: var(--ff-accent); color: #fff; font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 999px; }
.ff-page .ff-guarantee-desc { margin: 0; font-size: 14px; line-height: 1.6; opacity: 0.85; }

/* Form */
.ff-page .ff-form-fields { display: grid; grid-template-columns: 1fr; gap: 12px; max-width: 520px; margin: 18px auto 0; }
@media (min-width: 640px) { .ff-page .ff-form-fields { grid-template-columns: 1fr 1fr; } }
.ff-page .ff-field { display: flex; flex-direction: column; gap: 6px; grid-column: 1 / -1; }
.ff-page .ff-field--half { grid-column: span 1; }
.ff-page .ff-field-label { font-size: 13px; font-weight: 600; color: inherit; }
.ff-page .ff-input { min-height: 46px; border: 1px solid var(--ff-border); border-radius: 8px; padding: 0 14px; font: inherit; background: #fff; color: var(--ff-ink); width: 100%; box-sizing: border-box; }
.ff-page textarea.ff-input { padding: 12px 14px; min-height: 100px; resize: vertical; }
.ff-page .ff-checkbox { display: flex; align-items: center; gap: 8px; font-size: 14px; color: inherit; }
.ff-page .ff-form-submit { grid-column: 1 / -1; }

/* Footer */
.ff-page .ff-footer { background: var(--ff-brand-surface); color: var(--ff-brand-on-surface); padding: 32px 20px; text-align: center; border-top: 1px solid rgba(255,255,255,0.08); }
.ff-page .ff-footer-inner { max-width: 920px; margin: 0 auto; display: flex; flex-direction: column; gap: 8px; }
.ff-page .ff-footer-brand { font-weight: 700; font-size: 15px; color: #fff; }
.ff-page .ff-footer-legal { font-size: 13px; opacity: 0.7; line-height: 1.5; }
.ff-page .ff-footer-link { color: var(--ff-accent); text-decoration: none; font-weight: 500; }
.ff-page .ff-footer-copy { opacity: 0.5; font-size: 12px; margin-top: 8px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); }

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
      const rawCls = `ff-${section.type}-${section.id}`
        .replace(/[^a-z0-9-]/gi, "-")
        .toLowerCase();
      const cls = rawCls;

      const colors = getSectionColors(section);
      const accent = colors.accent || section.style?.accentColor || funnel.design.accentColor || "#D4A537";
      const ink = colors.ink || section.style?.textColor || "#0f172a";
      const bg = colors.bg || "transparent";

      let popupCss = "";
      let popupHtml = "";
      let popupDomId: string | undefined;
      if (section.cta?.mode === "popup") {
        popupDomId = `${cls}-popup`;
        const p = renderPopupMarkup(popupDomId, section.cta, funnel.language, cls);
        popupCss = "\n" + p.css;
        popupHtml = "\n" + p.html;
      }

      // CSS minimal du bloc (utilise les mêmes classes que la page complète, scopées sous .${cls})
      const css = `.${cls} { font-family: Inter, system-ui, sans-serif; color: ${ink}; background: ${bg}; padding: 56px 20px; box-sizing: border-box; --ff-accent: ${accent}; --ff-ink: ${ink}; --ff-border: rgba(0,0,0,0.08); }
.${cls} *, .${cls} *::before, .${cls} *::after { box-sizing: border-box; }
.${cls} .ff-section-inner { max-width: 1040px; margin: 0 auto; }
.${cls} .ff-eyebrow { display: inline-block; color: var(--ff-accent); font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.12em; margin-bottom: 12px; padding: 4px 10px; border-radius: 999px; background: color-mix(in srgb, var(--ff-accent) 12%, transparent); }
.${cls} .ff-headline { margin: 0 0 14px; font-size: clamp(26px, 4.5vw, 44px); line-height: 1.15; font-weight: 800; color: inherit; }
.${cls} .ff-subheadline { font-size: 17px; line-height: 1.65; opacity: 0.85; margin: 0 0 14px; }
.${cls} .ff-body { font-size: 16px; line-height: 1.7; opacity: 0.9; margin: 0 0 14px; white-space: pre-line; }
.${cls} .ff-bullets { list-style: none; padding: 0; margin: 0 0 18px; display: grid; gap: 10px; }
.${cls} .ff-bullets li { display: flex; align-items: flex-start; gap: 10px; }
.${cls} .ff-bullet-ic { color: var(--ff-accent); font-weight: 700; flex-shrink: 0; }
.${cls} .ff-btn, .${cls} .ff-cta { display: inline-flex; align-items: center; justify-content: center; min-height: 46px; padding: 0 22px; margin-top: 14px; border-radius: 8px; color: #fff !important; background: var(--ff-accent); text-decoration: none; font-weight: 700; font-size: 15px; cursor: pointer; border: none; transition: opacity 0.18s ease, transform 0.18s ease; }
.${cls} .ff-btn:hover, .${cls} .ff-cta:hover { opacity: 0.92; transform: translateY(-1px); }
.${cls} .ff-cta-wrap { margin-top: 18px; }
.${cls} .ff-image { margin: 22px 0 8px; }
.${cls} .ff-image img { width: 100%; max-width: 720px; height: auto; border-radius: 12px; display: block; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
.${cls} .ff-video { margin: 22px auto; max-width: 720px; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.15); aspect-ratio: 16/9; background: #000; }
.${cls} .ff-video iframe { width: 100%; height: 100%; border: 0; display: block; }
.${cls} .ff-grid-1 { display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 24px; }
.${cls} .ff-grid-2 { display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 24px; }
.${cls} .ff-grid-3 { display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 24px; }
@media (min-width: 760px) { .${cls} .ff-grid-2 { grid-template-columns: 1fr 1fr; } .${cls} .ff-grid-3 { grid-template-columns: 1fr 1fr 1fr; } }
.${cls} .ff-pricing-card { position: relative; background: color-mix(in srgb, var(--ff-ink) 3%, transparent); border: 1px solid var(--ff-border); border-radius: 14px; padding: 24px; display: flex; flex-direction: column; }
.${cls} .ff-pricing-card--highlighted { background: color-mix(in srgb, var(--ff-accent) 8%, transparent); border: 2px solid var(--ff-accent); box-shadow: 0 10px 30px -10px color-mix(in srgb, var(--ff-accent) 40%, transparent); }
.${cls} .ff-pricing-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--ff-accent); color: #fff; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 12px; border-radius: 999px; }
.${cls} .ff-pricing-name { margin: 0 0 6px; font-size: 18px; font-weight: 700; }
.${cls} .ff-pricing-desc { margin: 0 0 14px; font-size: 13px; opacity: 0.65; }
.${cls} .ff-pricing-price { display: flex; align-items: baseline; gap: 6px; margin-bottom: 20px; }
.${cls} .ff-pricing-amount { font-size: 36px; font-weight: 900; }
.${cls} .ff-pricing-card--highlighted .ff-pricing-amount { color: var(--ff-accent); }
.${cls} .ff-pricing-period { font-size: 14px; opacity: 0.6; }
.${cls} .ff-pricing-features { list-style: none; padding: 0; margin: 0 0 20px; display: grid; gap: 8px; flex: 1; }
.${cls} .ff-pricing-features li { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; opacity: 0.85; }
.${cls} .ff-feat-check { color: var(--ff-accent); font-weight: 700; flex-shrink: 0; }
.${cls} .ff-pricing-cta { width: 100%; margin-top: auto; }
.${cls} .ff-bonus-card { display: flex; gap: 14px; align-items: flex-start; padding: 18px; border-radius: 12px; background: color-mix(in srgb, var(--ff-accent) 6%, transparent); border: 1px solid color-mix(in srgb, var(--ff-accent) 25%, transparent); }
.${cls} .ff-bonus-icon { width: 42px; height: 42px; border-radius: 10px; background: var(--ff-accent); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
.${cls} .ff-bonus-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
.${cls} .ff-bonus-title { margin: 0; font-size: 15px; font-weight: 700; }
.${cls} .ff-bonus-value { background: var(--ff-accent); color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
.${cls} .ff-bonus-desc { margin: 0; font-size: 14px; opacity: 0.8; line-height: 1.5; }
.${cls} .ff-testimonial-card { padding: 18px; border-radius: 12px; background: color-mix(in srgb, var(--ff-ink) 4%, transparent); border: 1px solid var(--ff-border); }
.${cls} .ff-testimonial-rating { color: #f59e0b; margin-bottom: 10px; font-size: 16px; letter-spacing: 1px; }
.${cls} .ff-testimonial-quote { margin: 0 0 14px; font-size: 14px; line-height: 1.6; opacity: 0.9; font-style: italic; }
.${cls} .ff-testimonial-author { display: flex; align-items: center; gap: 10px; }
.${cls} .ff-testimonial-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
.${cls} .ff-testimonial-avatar--initials { background: var(--ff-accent); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; }
.${cls} .ff-testimonial-name { font-size: 13px; font-weight: 700; }
.${cls} .ff-testimonial-role { font-size: 12px; opacity: 0.6; }
.${cls} .ff-faq-list { max-width: 720px; margin: 24px auto 0; }
.${cls} .ff-faq-item { border-bottom: 1px solid var(--ff-border); }
.${cls} .ff-faq-item:first-child { border-top: 1px solid var(--ff-border); }
.${cls} .ff-faq-q { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 16px 0; background: transparent; border: none; cursor: pointer; font-size: 15px; font-weight: 600; color: inherit; text-align: left; font-family: inherit; }
.${cls} .ff-faq-chevron { color: var(--ff-accent); transition: transform 0.25s ease; flex-shrink: 0; }
.${cls} .ff-faq-q[aria-expanded="true"] .ff-faq-chevron { transform: rotate(180deg); }
.${cls} .ff-faq-a { padding: 0 28px 16px 0; font-size: 14px; line-height: 1.6; opacity: 0.85; }
.${cls} .ff-faq-a p { margin: 0; white-space: pre-line; }
.${cls} .ff-guarantee { max-width: 720px; margin: 24px auto 0; padding: 24px; border-radius: 16px; background: color-mix(in srgb, var(--ff-accent) 8%, transparent); border: 2px solid color-mix(in srgb, var(--ff-accent) 30%, transparent); display: flex; flex-direction: column; gap: 16px; align-items: center; text-align: center; }
@media (min-width: 640px) { .${cls} .ff-guarantee { flex-direction: row; text-align: left; } }
.${cls} .ff-guarantee-icon { width: 64px; height: 64px; border-radius: 50%; background: var(--ff-accent); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 28px; flex-shrink: 0; }
.${cls} .ff-guarantee-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.${cls} .ff-guarantee-title { margin: 0; font-size: 20px; font-weight: 900; }
.${cls} .ff-guarantee-duration { background: var(--ff-accent); color: #fff; font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 999px; }
.${cls} .ff-guarantee-desc { margin: 0; font-size: 14px; line-height: 1.6; opacity: 0.85; }
.${cls} .ff-form-fields { display: grid; grid-template-columns: 1fr; gap: 12px; max-width: 520px; margin: 18px auto 0; }
@media (min-width: 640px) { .${cls} .ff-form-fields { grid-template-columns: 1fr 1fr; } }
.${cls} .ff-field { display: flex; flex-direction: column; gap: 6px; grid-column: 1 / -1; }
.${cls} .ff-field--half { grid-column: span 1; }
.${cls} .ff-field-label { font-size: 13px; font-weight: 600; }
.${cls} .ff-input { min-height: 46px; border: 1px solid var(--ff-border); border-radius: 8px; padding: 0 14px; font: inherit; background: #fff; color: ${ink}; width: 100%; box-sizing: border-box; }
.${cls} textarea.ff-input { padding: 12px 14px; min-height: 100px; resize: vertical; }
.${cls} .ff-form-submit { grid-column: 1 / -1; }`;

      const inner = renderSectionInner(section, funnel.language, cls, popupDomId);
      const hasFaqInner =
        section.type === "faq" && Array.isArray(section.items) && section.items.some((it) => it.kind === "faq");

      const html = `<style>
${css}${popupCss}
</style>

<section class="${cls}">
<div class="ff-section-inner">
${inner}
</div>
</section>${popupHtml}
${hasFaqInner ? faqScript(cls) : ""}`;

      return {
        id: section.id,
        label: section.headline,
        type: section.type,
        html,
      };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloc formulaire final (lead capture autonome)
// ─────────────────────────────────────────────────────────────────────────────
export function createSystemeFormBlock(funnel: Funnel): SystemeBlock {
  const cls = "ff-form-block";
  const accent = funnel.design.accentColor || funnel.design.secondaryColor || "#D4A537";
  const labels = {
    fr: { title: "Recevoir les détails", name: "Votre nom", email: "Email", submit: "Continuer" },
    en: { title: "Get the details", name: "Your name", email: "Email", submit: "Continue" },
    es: { title: "Recibir los detalles", name: "Tu nombre", email: "Email", submit: "Continuar" },
  } as const;
  const l = labels[funnel.language] ?? labels.fr;

  const css = `.${cls} { font-family: Inter, system-ui, sans-serif; color: #0f172a; padding: 48px 20px; max-width: 560px; margin: 0 auto; box-sizing: border-box; background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 14px; --ff-accent: ${accent}; }
.${cls} h2 { margin: 0 0 16px; font-size: clamp(22px, 3.5vw, 30px); line-height: 1.2; font-weight: 800; }
.${cls} form { display: grid; gap: 12px; }
.${cls} input { min-height: 46px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; padding: 0 14px; font: inherit; }
.${cls} button { min-height: 46px; border: none; border-radius: 8px; background: var(--ff-accent); color: #fff; font-weight: 700; font-size: 15px; cursor: pointer; transition: opacity 0.18s ease, transform 0.18s ease; }
.${cls} button:hover { opacity: 0.92; transform: translateY(-1px); }`;

  const html = `<style>
${css}
</style>

<section id="lead-form" class="${cls}">
<h2>${escapeHtml(l.title)}</h2>
<form onsubmit="event.preventDefault(); alert('Démonstration : remplacez par votre embed systeme.io.');">
<input type="text" name="name" placeholder="${escapeAttr(l.name)}" required />
<input type="email" name="email" placeholder="${escapeAttr(l.email)}" required />
<button type="submit">${escapeHtml(l.submit)}</button>
</form>
</section>`;

  return { id: "lead-form", label: l.title, type: "form", html };
}

// ─────────────────────────────────────────────────────────────────────────────
// Guide d'import (rétrocompat)
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
// ZIP exports
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

export function createSystemeIoZipBase64(funnel: Funnel): string {
  const fullHtml = renderFunnelHtml(funnel);
  const blocks = createSystemeBlocks(funnel);
  const formBlock = createSystemeFormBlock(funnel);

  const previewName = {
    fr: "apercu-complet.html",
    en: "funnel-complete.html",
    es: "embudo-completo.html",
  } as const;

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
