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
  IconConfig,
  SectionColors,
  AnimationPreset,
  FunnelHeader,
} from "@/lib/funnels/types";
import { normalizeIconName, resolveIconSizePx } from "@/lib/funnels/types";
import { createReadme } from "./readme";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers HTML
// ─────────────────────────────────────────────────────────────────────────────
function escapeHtml(value = "") {
  const entities: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  };
  return value.replace(/[&<>"']/g, (c) => entities[c] ?? c);
}
const escapeAttr = escapeHtml;

function isSafeUrl(url: string): boolean {
  if (!url) return false;
  const t = url.trim();
  if (t.startsWith("#") || t.startsWith("/")) return true;
  try {
    const u = new URL(t);
    return ["http:", "https:", "mailto:", "tel:"].includes(u.protocol);
  } catch { return false; }
}

function safeId(value: string, fallback: string): string {
  const c = (value || "").toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return c || fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// ─────────────────────────────────────────────────────────────────────────────
// Couleurs : helpers (remplacent color-mix, non supporté par SIO)
// ─────────────────────────────────────────────────────────────────────────────
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return null;
  const num = parseInt(h, 16);
  if (Number.isNaN(num)) return null;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function colorWithAlpha(color: string, alpha: number): string {
  const a = clamp(alpha, 0, 1);
  if (!color) return `rgba(0,0,0,${a})`;
  const c = color.trim();
  if (c.startsWith("rgb")) {
    // rgb(r,g,b) ou rgba(r,g,b,a) → on remplace alpha
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const parts = m[1].split(",").map((s) => s.trim());
      const [r, g, b] = parts;
      return `rgba(${r},${g},${b},${a})`;
    }
  }
  const rgb = hexToRgb(c);
  if (rgb) return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
  return c;
}

// ─────────────────────────────────────────────────────────────────────────────
// CTA (pas de popup actif côté SIO : on retombe sur #lead-form)
// ─────────────────────────────────────────────────────────────────────────────
function ctaHref(cta: CtaConfig): string {
  if (cta.mode === "anchor") return `#${safeId(cta.anchorId ?? "lead-form", "lead-form")}`;
  if (cta.mode === "popup") return `#lead-form`;
  if (cta.mode === "redirect" && cta.url && isSafeUrl(cta.url)) return cta.url;
  return "#lead-form";
}

function ctaAttrs(cta: CtaConfig): string {
  const href = ctaHref(cta);
  const isExternal = cta.mode === "redirect" && cta.target === "_blank" && isSafeUrl(cta.url ?? "");
  const target = isExternal ? "_blank" : "_self";
  const rel = isExternal ? ' rel="noopener noreferrer"' : "";
  return ` href="${escapeAttr(href)}" target="${target}"${rel}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Icônes SVG inline (Lucide-like)
// ─────────────────────────────────────────────────────────────────────────────
const SVG_PATHS: Record<IconName, string> = {
  check: `<polyline points="20 6 9 17 4 12"/>`,
  checkCircle: `<circle cx="12" cy="12" r="10"/><polyline points="9 12 12 15 16 10"/>`,
  badgeCheck: `<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><polyline points="9 12 12 15 16 10"/>`,
  thumbsUp: `<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L15 2c1.66 0 2.5 1.39 2 3.88Z"/>`,
  star: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
  sparkles: `<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>`,
  award: `<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>`,
  trophy: `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>`,
  crown: `<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>`,
  flame: `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>`,
  zap: `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
  rocket: `<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>`,
  target: `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`,
  lightbulb: `<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>`,
  shield: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
  lock: `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
  clock: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
  calendar: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  heart: `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>`,
  gift: `<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>`,
  trendingUp: `<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>`,
  trendingDown: `<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>`,
  barChart: `<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>`,
  mail: `<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>`,
  user: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  users: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  briefcase: `<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
  flag: `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>`,
  globe: `<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
  play: `<polygon points="6 3 20 12 6 21 6 3"/>`,
  download: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`,
  fileText: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`,
};

function renderIconSvg(name: IconName, sizePx = 20, color?: string): string {
  const path = SVG_PATHS[name] ?? SVG_PATHS.check;
  const stroke = color ? escapeAttr(color) : "currentColor";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

function renderIcon(config?: IconConfig, fallback: IconName = "check"): string {
  const name = normalizeIconName(config?.name ?? fallback);
  const size = resolveIconSizePx(config);
  const color = config?.color;
  return `<span style="display:inline-flex;align-items:center;justify-content:center;line-height:0;">${renderIconSvg(name, size, color)}</span>`;
}

function renderIconByName(name?: IconName | string, sizePx = 20, color?: string): string {
  const n = normalizeIconName(typeof name === "string" ? name : name);
  return renderIconSvg(n, sizePx, color);
}

// ─────────────────────────────────────────────────────────────────────────────
// Image
// ─────────────────────────────────────────────────────────────────────────────
const IMG_SIZE_PX: Record<string, number> = { sm: 320, md: 480, lg: 720, full: 1040 };

function renderImage(image?: SectionImage, animClass = ""): string {
  if (!image || image.mode === "none" || !image.url) return "";
  const alt = escapeAttr(image.alt ?? "");
  const credit = image.credit
    ? `<span class="ff-image-credit">${escapeHtml(image.credit)}</span>` : "";

  const sizeKey = image.size ?? "lg";
  let widthStyle = "";
  if (sizeKey === "custom" && image.customWidth) {
    widthStyle = `max-width:${clamp(image.customWidth, 80, 1600)}px;`;
  } else if (sizeKey === "full") {
    widthStyle = `max-width:100%;`;
  } else if (IMG_SIZE_PX[sizeKey]) {
    widthStyle = `max-width:${IMG_SIZE_PX[sizeKey]}px;`;
  }
  const transparent = image.transparentBg ? " ff-image--transparent" : "";
  const ownAnim = image.animation && image.animation !== "none" ? ` ff-anim-${image.animation}` : "";
  const cls = `ff-image${transparent}${ownAnim || animClass}`;
  const imgStyle = widthStyle ? ` style="${widthStyle}"` : "";

  return `<figure class="${cls}"><img src="${escapeAttr(image.url)}" alt="${alt}" loading="lazy"${imgStyle} />${credit}</figure>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section helpers
// ─────────────────────────────────────────────────────────────────────────────
function getSectionColors(section: FunnelSection): SectionColors {
  const style = (section.style ?? {}) as { colors?: SectionColors; userColorsOverride?: boolean };
  const colors: SectionColors = style.colors ?? {};
  if (style.userColorsOverride) return colors;
  const hasExplicitBg = typeof colors.bg === "string" && colors.bg.trim().length > 0;
  if (hasExplicitBg) return colors;
  const { bg: _ignored, ...rest } = colors;
  return rest;
}

function buildSectionStyle(section: FunnelSection): string {
  const styles: string[] = [];
  const colors = getSectionColors(section);

  if (colors.bg) styles.push(`background:${colors.bg}`);
  if (colors.ink) styles.push(`color:${colors.ink}`);

  if (!colors.ink && section.style?.textColor) styles.push(`color:${section.style.textColor}`);

  if (section.style?.align === "center") styles.push("text-align:center");
  else if (section.style?.align === "right") styles.push("text-align:right");

  const bgImg = section.background?.imageUrl;
  if (bgImg) {
    const pos = section.background?.position ?? "center";
    const size = section.background?.size ?? "cover";
    styles.push(`background-image:url('${bgImg.replace(/'/g, "%27")}')`);
    styles.push(`background-size:${size}`);
    styles.push(`background-position:${pos}`);
    styles.push(`background-repeat:no-repeat`);
    styles.push(`position:relative`);
  }

  // shadow inline (compat SIO : pas de data-* + CSS attr selector)
  const sh = section.style?.shadow;
  if (sh && sh.size && sh.size !== "none") {
    const map: Record<string, string> = {
      sm: "0 2px 8px",
      md: "0 8px 24px",
      lg: "0 16px 40px",
      xl: "0 24px 60px",
    };
    const color = sh.color || "rgba(15,23,42,0.15)";
    styles.push(`box-shadow:${map[sh.size] ?? map.md} ${color}`);
  }

  return styles.join(";");
}

function sectionSpacingClass(section: FunnelSection): string {
  return section.style?.spacing ? ` ff-spacing-${section.style.spacing}` : "";
}

function sectionLayoutClass(section: FunnelSection): string {
  const v = section.layoutVariant;
  if (!v) return "";
  return ` ff-layout-${v}`;
}

function animClassFor(preset?: AnimationPreset): string {
  if (!preset || preset === "none") return "";
  return ` ff-anim-${preset}`;
}

function renderBackgroundOverlay(section: FunnelSection): string {
  const bg = section.background;
  if (!bg?.imageUrl) return "";
  const overlay = typeof bg.overlay === "number" ? clamp(bg.overlay, 0, 1) : 0.4;
  if (overlay <= 0) return "";
  return `<div class="ff-section-overlay" style="position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,${overlay});pointer-events:none;z-index:0;"></div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Specialized renderers
// ─────────────────────────────────────────────────────────────────────────────
function renderPricing(section: FunnelSection): string {
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "pricing" } => it.kind === "pricing");
  if (items.length === 0) return "";
  const gridCls = items.length === 1 ? "ff-grid-1" : items.length === 2 ? "ff-grid-2" : "ff-grid-3";

  return `<div class="ff-pricing ${gridCls}">
${items.map((item, idx) => {
  const d = item.data;
  const highlighted = !!d.highlighted;
  const cls = `ff-pricing-card ff-card${highlighted ? " ff-pricing-card--highlighted ff-card-elevated" : ""}`;
  const ctaHtml = d.cta?.label
    ? `<a class="ff-btn ff-pricing-cta"${ctaAttrs(d.cta)}>${escapeHtml(d.cta.label)}</a>` : "";
  const badge = highlighted ? `<div class="ff-pricing-badge">★ ${escapeHtml(d.badge ?? "Populaire")}</div>` : "";
  const desc = d.description ? `<p class="ff-pricing-desc">${escapeHtml(d.description)}</p>` : "";
  const period = d.period ? `<span class="ff-pricing-period">${escapeHtml(d.period)}</span>` : "";
  const featureIconSize = resolveIconSizePx(d.featureIcon);
  const featureIconHtml = d.featureIcon
    ? renderIconSvg(normalizeIconName(d.featureIcon.name), featureIconSize, d.featureIcon.color)
    : renderIconSvg("check", 16);
  const features = d.features?.length
    ? `<ul class="ff-pricing-features">
${d.features.map((f) => `  <li><span class="ff-feat-check">${featureIconHtml}</span><span>${escapeHtml(f)}</span></li>`).join("\n")}
</ul>` : "";
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
}).join("\n")}
</div>`;
}

function renderBonus(section: FunnelSection): string {
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "bonus" } => it.kind === "bonus");
  if (items.length === 0) return "";
  const gridCls = items.length === 1 ? "ff-grid-1" : items.length === 2 ? "ff-grid-2" : "ff-grid-3";

  return `<div class="ff-bonus ${gridCls}">
${items.map((item, idx) => {
  const d = item.data;
  const iconConfig: IconConfig = d.icon ?? { name: normalizeIconName(d.iconName ?? "gift") };
  const iconSize = resolveIconSizePx(iconConfig);
  const iconSvg = renderIconSvg(normalizeIconName(iconConfig.name), iconSize, iconConfig.color);
  const value = d.value ? `<span class="ff-bonus-value">${escapeHtml(d.value)}</span>` : "";
  const desc = d.description ? `<p class="ff-bonus-desc">${escapeHtml(d.description)}</p>` : "";
  return `  <div class="ff-bonus-card ff-card">
    <div class="ff-bonus-icon">${iconSvg}</div>
    <div class="ff-bonus-body">
      <div class="ff-bonus-head">
        <h3 class="ff-bonus-title">${escapeHtml(d.title || `Bonus ${idx + 1}`)}</h3>
        ${value}
      </div>
      ${desc}
    </div>
  </div>`;
}).join("\n")}
</div>`;
}

function renderTestimonials(section: FunnelSection): string {
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "testimonial" } => it.kind === "testimonial");
  if (items.length === 0) return "";
  const gridCls = items.length === 1 ? "ff-grid-1" : items.length === 2 ? "ff-grid-2" : "ff-grid-3";

  return `<div class="ff-testimonials ${gridCls}">
${items.map((item) => {
  const d = item.data;
  const initials = (d.authorName || "?").split(" ").map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const rating = d.rating && d.rating > 0
    ? `<div class="ff-testimonial-rating">${"★".repeat(clamp(d.rating, 0, 5))}${"☆".repeat(5 - clamp(d.rating, 0, 5))}</div>` : "";
  const quote = d.quote ? `<blockquote class="ff-testimonial-quote">« ${escapeHtml(d.quote)} »</blockquote>` : "";
  const avatar = d.avatarUrl
    ? `<img class="ff-testimonial-avatar" src="${escapeAttr(d.avatarUrl)}" alt="${escapeAttr(d.authorName || "")}" loading="lazy" />`
    : `<div class="ff-testimonial-avatar ff-testimonial-avatar--initials">${escapeHtml(initials)}</div>`;
  const role = d.authorRole ? `<div class="ff-testimonial-role">${escapeHtml(d.authorRole)}</div>` : "";
  return `  <div class="ff-testimonial-card ff-card">
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
}).join("\n")}
</div>`;
}

// FAQ : <details>/<summary> natif, pas de JS — compat SIO totale
function renderFaq(section: FunnelSection): string {
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "faq" } => it.kind === "faq");
  if (items.length === 0) return "";
  const list = items.map((item, idx) => {
    const d = item.data;
    const iconHtml = d.icon ? `<span class="ff-faq-icon">${renderIcon(d.icon, "lightbulb")}</span>` : "";
    return `  <details class="ff-faq-item">
    <summary class="ff-faq-q">
      ${iconHtml}<span class="ff-faq-q-text">${escapeHtml(d.question || `Question ${idx + 1}`)}</span>
      <span class="ff-faq-chevron">▾</span>
    </summary>
    <div class="ff-faq-a"><p>${escapeHtml(d.answer || "")}</p></div>
  </details>`;
  }).join("\n");
  return `<div class="ff-faq-list">\n${list}\n</div>`;
}

function renderGuarantee(section: FunnelSection): string {
  const items = (section.items || []).filter(
    (it): it is SectionItem & { kind: "guarantee" } => it.kind === "guarantee");
  const item = items[0];
  if (!item) return "";
  const d = item.data;
  const iconConfig: IconConfig = d.icon ?? { name: normalizeIconName(d.iconName ?? "shield") };
  const iconSize = Math.max(28, resolveIconSizePx(iconConfig));
  const iconSvg = renderIconSvg(normalizeIconName(iconConfig.name), iconSize, iconConfig.color);
  const duration = d.duration ? `<span class="ff-guarantee-duration">${escapeHtml(d.duration)}</span>` : "";
  const desc = d.description ? `<p class="ff-guarantee-desc">${escapeHtml(d.description)}</p>` : "";
  return `<div class="ff-guarantee ff-card-elevated">
  <div class="ff-guarantee-icon">${iconSvg}</div>
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
    (it): it is SectionItem & { kind: "formField" } => it.kind === "formField");
  const labels = {
    fr: { submit: "Envoyer" },
    en: { submit: "Submit" },
    es: { submit: "Enviar" },
  } as const;
  const l = labels[language] ?? labels.fr;
  const ctaLabel = section.cta?.label || l.submit;
  const list: FormFieldItem[] = fields.length
    ? fields.map((f) => f.data)
    : [{ name: "email", label: "Email", type: "email", required: true, width: "full" }];

  const fieldsHtml = list.map((f, idx) => {
    const widthCls = f.width === "half" ? "ff-field ff-field--half" : "ff-field";
    const name = escapeAttr(f.name || `field_${idx}`);
    const label = f.label
      ? `<label class="ff-field-label" for="${name}">${escapeHtml(f.label)}${f.required ? " *" : ""}</label>` : "";
    const ph = escapeAttr(f.placeholder || "");
    const req = f.required ? " required" : "";
    let input = "";
    if (f.type === "textarea") {
      input = `<textarea class="ff-input" id="${name}" name="${name}" placeholder="${ph}" rows="4"${req}></textarea>`;
    } else if (f.type === "select") {
      const opts = (f.options || []).map((o) => `<option value="${escapeAttr(o)}">${escapeHtml(o)}</option>`).join("");
      input = `<select class="ff-input" id="${name}" name="${name}"${req}><option value="">${escapeHtml(f.placeholder || "—")}</option>${opts}</select>`;
    } else if (f.type === "checkbox") {
      input = `<label class="ff-checkbox"><input type="checkbox" id="${name}" name="${name}"${req} /><span>${escapeHtml(f.placeholder || f.label || "")}</span></label>`;
      return `<div class="${widthCls}">${input}</div>`;
    } else {
      input = `<input class="ff-input" type="${f.type}" id="${name}" name="${name}" placeholder="${ph}"${req} />`;
    }
    return `<div class="${widthCls}">${label}${input}</div>`;
  }).join("\n");

  return `<form class="ff-form-fields" action="#" method="post">
${fieldsHtml}
<button type="submit" class="ff-btn ff-form-submit">${escapeHtml(ctaLabel)}</button>
</form>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Video (sans aspect-ratio — padding-bottom 56.25%)
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
  } catch { return null; }
}

function renderVideo(url?: string, animClass = ""): string {
  if (!url) return "";
  const embed = getVideoEmbedUrl(url);
  if (!embed) return "";
  const cls = `ff-video${animClass}`;
  return `<div class="${cls}"><div class="ff-video-inner">
  <iframe src="${escapeAttr(embed)}" title="Vidéo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div></div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bullets
// ─────────────────────────────────────────────────────────────────────────────
function renderBullets(section: FunnelSection): string {
  if (!section.bullets?.length) return "";
  return `<ul class="ff-bullets">${section.bullets.map((b, i) => {
    const iconName = section.bulletIcons?.[i] ?? section.iconName ?? "check";
    const svg = renderIconByName(iconName, 18);
    return `<li><span class="ff-bullet-ic">${svg}</span><span>${escapeHtml(b)}</span></li>`;
  }).join("")}</ul>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section inner
// ─────────────────────────────────────────────────────────────────────────────
function renderSectionInner(section: FunnelSection, language: Funnel["language"]): string {
  const anims = section.animations ?? {};
  const eyebrow = section.eyebrow
    ? `<span class="ff-eyebrow${animClassFor(anims.eyebrow)}">${escapeHtml(section.eyebrow)}</span>` : "";
  const headline = section.headline
    ? `<h2 class="ff-headline${animClassFor(anims.headline)}">${escapeHtml(section.headline)}</h2>` : "";
  const subheadline = section.subheadline
    ? `<p class="ff-subheadline${animClassFor(anims.subheadline)}">${escapeHtml(section.subheadline)}</p>` : "";
  const body = section.body
    ? `<p class="ff-body${animClassFor(anims.body)}">${escapeHtml(section.body)}</p>` : "";

  const type = section.type as string;
  const hasItems = Array.isArray(section.items) && section.items.length > 0;

  let specialized = "";
  if (hasItems) {
    if (type === "pricing" || type === "offer") specialized = renderPricing(section);
    else if (type === "bonus") specialized = renderBonus(section);
    else if (type === "testimonials" || type === "proof") specialized = renderTestimonials(section);
    else if (type === "faq") specialized = renderFaq(section);
    else if (type === "guarantee") specialized = renderGuarantee(section);
  }
  if (specialized) {
    const cls = animClassFor(anims.bullets);
    specialized = cls ? `<div class="${cls.trim()}">${specialized}</div>` : specialized;
  }

  let formHtml = "";
  if (type === "form") formHtml = renderFormFields(section, language);

  const bullets = !specialized && section.bullets?.length
    ? (() => {
        const cls = animClassFor(anims.bullets);
        return cls ? `<div class="${cls.trim()}">${renderBullets(section)}</div>` : renderBullets(section);
      })()
    : "";

  const image = renderImage(section.image, animClassFor(anims.image));
  const video = renderVideo(section.video?.url, animClassFor(anims.video));

  const cta = section.cta?.label && type !== "form"
    ? `<div class="ff-cta-wrap${animClassFor(anims.cta)}"><a class="ff-btn ff-cta"${ctaAttrs(section.cta)}>${escapeHtml(section.cta.label)}</a></div>` : "";

  const variant = section.layoutVariant;
  const isSplit = variant === "split-text-image" || variant === "split-image-text";

  if (isSplit) {
    const textCol = `<div class="ff-split-text">${eyebrow}${headline}${subheadline}${body}${bullets}${cta}</div>`;
    const mediaCol = `<div class="ff-split-media">${image}${video}${specialized}${formHtml}</div>`;
    const order = variant === "split-image-text" ? `${mediaCol}${textCol}` : `${textCol}${mediaCol}`;
    return `<div class="ff-split-grid">${order}</div>`;
  }

  return `${eyebrow}${headline}${subheadline}${body}${bullets}${specialized}${video}${image}${formHtml}${cta}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Header & Footer
// ─────────────────────────────────────────────────────────────────────────────
function extractBrandName(fullName: string): string {
  if (!fullName) return "";
  const seps = [" - ", " – ", " — ", " | ", " : "];
  for (const s of seps) { const i = fullName.indexOf(s); if (i > 0) return fullName.slice(0, i).trim(); }
  return fullName.trim();
}

function renderHeader(funnel: Funnel): string {
  const h: FunnelHeader = funnel.header ?? {};
  if (h.enabled === false) return "";
  const logo = h.logoUrl ?? funnel.meta?.logoUrl;
  const brand = h.brandName ?? extractBrandName(funnel.funnelName || "");
  const displayMode = h.displayMode ?? "both";
  const showLogo = (displayMode === "logo" || displayMode === "both") && !!logo;
  const showName = (displayMode === "name" || displayMode === "both") && !!brand;
  if (!showLogo && !showName && !h.cta?.label) return "";

  const classes = ["ff-brand-bar"];
  if (h.sticky) classes.push("ff-brand-bar--sticky");
  if (h.transparent) classes.push("ff-brand-bar--transparent");

  const ctaHtml = h.cta?.label
    ? `<a class="ff-brand-cta ff-btn"${ctaAttrs(h.cta)}>${escapeHtml(h.cta.label)}</a>` : "";

  return `<div class="${classes.join(" ")}">
  <div class="ff-brand-bar-inner">
    <div class="ff-brand-id">
      ${showLogo ? `<img src="${escapeAttr(logo!)}" alt="" />` : ""}
      ${showName ? `<span>${escapeHtml(brand)}</span>` : ""}
    </div>
    ${ctaHtml}
  </div>
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
// Template presets (sans @import — fallback système, polices Google chargées par SIO si dispo)
// ─────────────────────────────────────────────────────────────────────────────
type TemplatePreset = { font: string; headlineFont?: string };
const TEMPLATE_PRESETS: Record<string, TemplatePreset> = {
  "premium-elegant": {
    font: `Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
    headlineFont: `"Playfair Display", Georgia, "Times New Roman", serif`,
  },
  "tech-modern": {
    font: `Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
    headlineFont: `"Space Grotesk", Inter, system-ui, sans-serif`,
  },
  "warm-storytelling": {
    font: `Georgia, "Times New Roman", serif`,
    headlineFont: `"Lora", Georgia, "Times New Roman", serif`,
  },
  "bold-action": {
    font: `Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
    headlineFont: `"Archivo Black", Impact, "Arial Black", sans-serif`,
  },
  "clean-corporate": {
    font: `Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
  },
};

function getTemplatePreset(funnel: Funnel): TemplatePreset {
  const id = funnel.meta?.templateId;
  if (id && TEMPLATE_PRESETS[id]) return TEMPLATE_PRESETS[id];
  return { font: `Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` };
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS — scopé sous .ff-page, sans color-mix, sans aspect-ratio, sans @import
// ─────────────────────────────────────────────────────────────────────────────
export function renderFunnelCss(funnel: Funnel): string {
  const primary = funnel.design.primaryColor || "#0f172a";
  const gold = funnel.design.secondaryColor || "#D4A537";
  const accent = funnel.design.accentColor || gold;
  const textScale = clamp(funnel.design.textScale ?? 1, 0.85, 1.25);
  const buttonScale = clamp(funnel.design.buttonScale ?? 1, 0.85, 1.25);
  const customBg = funnel.design.customBgEnabled && funnel.design.customBg
    ? funnel.design.customBg : "#ffffff";
  const preset = getTemplatePreset(funnel);
  const buttonAnim = funnel.design.buttonAnim;

  // Pré-calcul couleurs dérivées (au lieu de color-mix)
  const accent12 = colorWithAlpha(accent, 0.12);
  const accent08 = colorWithAlpha(accent, 0.08);
  const accent06 = colorWithAlpha(accent, 0.06);
  const accent25 = colorWithAlpha(accent, 0.25);
  const accent30 = colorWithAlpha(accent, 0.30);
  const ink03 = colorWithAlpha("#0f172a", 0.03);

  const headlineFont = preset.headlineFont ?? preset.font;
  const baseFontSize = 16 * textScale;
  const btnMinH = Math.round(46 * buttonScale);
  const btnPad = Math.round(22 * buttonScale);
  const btnFont = Math.round(15 * buttonScale);

  // Animations boutons (CSS pur)
  let buttonAnimCss = "";
  if (buttonAnim === "pulse") {
    buttonAnimCss = `.ff-page .ff-btn, .ff-page .ff-cta { animation: ff-btn-pulse 2.4s ease-in-out infinite; }
@keyframes ff-btn-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }`;
  } else if (buttonAnim === "glow") {
    buttonAnimCss = `.ff-page .ff-btn, .ff-page .ff-cta { animation: ff-btn-glow 2.2s ease-in-out infinite; }
@keyframes ff-btn-glow { 0%,100% { box-shadow: 0 0 0 0 ${colorWithAlpha(accent, 0.5)}; } 50% { box-shadow: 0 0 0 10px ${colorWithAlpha(accent, 0)}; } }`;
  } else if (buttonAnim === "shine") {
    buttonAnimCss = `.ff-page .ff-btn, .ff-page .ff-cta { position: relative; overflow: hidden; }
.ff-page .ff-btn::after, .ff-page .ff-cta::after { content: ""; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%); transform: translateX(-100%); animation: ff-btn-shine 2.6s ease-in-out infinite; }
@keyframes ff-btn-shine { 0% { transform: translateX(-100%); } 60%,100% { transform: translateX(100%); } }`;
  } else if (buttonAnim === "lift") {
    buttonAnimCss = `.ff-page .ff-btn:hover, .ff-page .ff-cta:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(0,0,0,0.18); }`;
  }

  return `.ff-page { font-family: ${preset.font}; color: #0f172a; background: ${customBg}; }
.ff-page, .ff-page *, .ff-page *::before, .ff-page *::after { box-sizing: border-box; }

/* Brand bar */
.ff-page .ff-brand-bar { background: #0f172a; color: #fff; }
.ff-page .ff-brand-bar-inner { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; max-width: 1180px; margin: 0 auto; }
.ff-page .ff-brand-id { display: flex; align-items: center; gap: 10px; }
.ff-page .ff-brand-bar img { height: 28px; width: auto; }
.ff-page .ff-brand-bar span { font-weight: 700; font-size: 14px; color: #fff; }
.ff-page .ff-brand-bar--sticky { position: sticky; top: 0; z-index: 50; }
.ff-page .ff-brand-bar--transparent { background: rgba(255,255,255,0.92); color: #0f172a; border-bottom: 1px solid rgba(0,0,0,0.06); }
.ff-page .ff-brand-bar--transparent span { color: #0f172a; }
.ff-page .ff-brand-cta { margin: 0; min-height: 38px; padding: 0 16px; font-size: 13px; }

/* Sections */
.ff-page .ff-section { padding: 64px 20px; position: relative; }
.ff-page .ff-section-inner { max-width: 1040px; margin: 0 auto; position: relative; z-index: 1; }
.ff-page .ff-spacing-compact { padding-top: 40px; padding-bottom: 40px; }
.ff-page .ff-spacing-large { padding-top: 96px; padding-bottom: 96px; }

/* Layout variants */
.ff-page .ff-layout-centered .ff-section-inner { text-align: center; }
.ff-page .ff-layout-left-aligned .ff-section-inner { text-align: left; }
.ff-page .ff-layout-wide-banner .ff-section-inner { max-width: 1180px; }
.ff-page .ff-split-grid { display: grid; grid-template-columns: 1fr; gap: 32px; align-items: center; }
@media (min-width: 860px) { .ff-page .ff-split-grid { grid-template-columns: 1fr 1fr; gap: 48px; } }
.ff-page .ff-split-media .ff-image { margin: 0; }
.ff-page .ff-split-media .ff-image img { max-width: 100%; }

/* Typo */
.ff-page .ff-eyebrow { display: inline-block; color: ${accent}; font-weight: 700; text-transform: uppercase; font-size: ${Math.round(11 * textScale)}px; letter-spacing: 0.12em; margin-bottom: 12px; padding: 4px 10px; border-radius: 999px; background: ${accent12}; }
.ff-page .ff-layout-centered .ff-eyebrow { margin-left: auto; margin-right: auto; }
.ff-page .ff-headline { margin: 0 0 14px; font-family: ${headlineFont}; font-size: ${Math.round(28 * textScale)}px; line-height: 1.15; font-weight: 800; color: inherit; }
@media (min-width: 640px) { .ff-page .ff-headline { font-size: ${Math.round(36 * textScale)}px; } }
@media (min-width: 1024px) { .ff-page .ff-headline { font-size: ${Math.round(44 * textScale)}px; } }
.ff-page .ff-subheadline { font-size: ${Math.round(17 * textScale)}px; line-height: 1.65; opacity: 0.85; max-width: 720px; margin: 0 0 14px; }
.ff-page .ff-layout-centered .ff-subheadline, .ff-page .ff-layout-centered .ff-body { margin-left: auto; margin-right: auto; }
.ff-page .ff-body { font-size: ${Math.round(baseFontSize)}px; line-height: 1.7; opacity: 0.9; max-width: 720px; margin: 0 0 14px; white-space: pre-line; }

/* Bullets */
.ff-page .ff-bullets { list-style: none; padding: 0; margin: 0 0 18px; display: grid; gap: 10px; }
.ff-page .ff-layout-centered .ff-bullets { display: inline-grid; text-align: left; }
.ff-page .ff-bullets li { display: flex; align-items: flex-start; gap: 10px; font-size: ${Math.round(15 * textScale)}px; }
.ff-page .ff-bullet-ic { color: ${accent}; flex-shrink: 0; display: inline-flex; line-height: 0; margin-top: 2px; }

/* Buttons */
.ff-page .ff-btn, .ff-page .ff-cta { display: inline-flex; align-items: center; justify-content: center; min-height: ${btnMinH}px; padding: 0 ${btnPad}px; margin-top: 14px; border-radius: 8px; color: #ffffff !important; background: ${accent}; text-decoration: none; font-weight: 700; font-size: ${btnFont}px; cursor: pointer; border: none; transition: opacity 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease; }
.ff-page .ff-btn:hover, .ff-page .ff-cta:hover { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,0,0,0.15); }
.ff-page .ff-cta-wrap { margin-top: 18px; }
${buttonAnimCss}

/* Image */
.ff-page .ff-image { margin: 22px 0 8px; }
.ff-page .ff-image img { width: 100%; height: auto; border-radius: 12px; display: block; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
.ff-page .ff-image--transparent img { box-shadow: none; border-radius: 0; background: transparent; }
.ff-page .ff-image-credit { display: block; font-size: 11px; opacity: 0.6; margin-top: 6px; text-align: center; }

/* Video (sans aspect-ratio, compat SIO) */
.ff-page .ff-video { margin: 22px auto; max-width: 720px; }
.ff-page .ff-video-inner { position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); background: #000; }
.ff-page .ff-video-inner iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; display: block; }

/* Grids */
.ff-page .ff-grid-1, .ff-page .ff-grid-2, .ff-page .ff-grid-3 { display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 24px; }
@media (min-width: 760px) {
  .ff-page .ff-grid-2 { grid-template-columns: 1fr 1fr; }
  .ff-page .ff-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
}

/* Cards */
.ff-page .ff-card { background: ${ink03}; border: 1px solid rgba(0,0,0,0.08); border-radius: 14px; padding: 22px; }
.ff-page .ff-card-elevated { box-shadow: 0 14px 36px rgba(15,23,42,0.10); }

/* Pricing */
.ff-page .ff-pricing-card { position: relative; display: flex; flex-direction: column; }
.ff-page .ff-pricing-card--highlighted { background: ${accent08}; border: 2px solid ${accent}; }
.ff-page .ff-pricing-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: ${accent}; color: #fff; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 12px; border-radius: 999px; }
.ff-page .ff-pricing-name { margin: 0 0 6px; font-size: 18px; font-weight: 700; color: inherit; }
.ff-page .ff-pricing-desc { margin: 0 0 14px; font-size: 13px; opacity: 0.65; }
.ff-page .ff-pricing-price { display: flex; align-items: baseline; gap: 6px; margin-bottom: 20px; }
.ff-page .ff-pricing-amount { font-size: 36px; font-weight: 900; color: inherit; }
.ff-page .ff-pricing-card--highlighted .ff-pricing-amount { color: ${accent}; }
.ff-page .ff-pricing-period { font-size: 14px; opacity: 0.6; }
.ff-page .ff-pricing-features { list-style: none; padding: 0; margin: 0 0 20px; display: grid; gap: 8px; flex: 1; }
.ff-page .ff-pricing-features li { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; opacity: 0.85; }
.ff-page .ff-feat-check { color: ${accent}; flex-shrink: 0; display: inline-flex; line-height: 0; margin-top: 2px; }
.ff-page .ff-pricing-cta { width: 100%; margin-top: auto; }

/* Bonus */
.ff-page .ff-bonus-card { display: flex; gap: 14px; align-items: flex-start; padding: 18px; border-radius: 12px; background: ${accent06}; border: 1px solid ${accent25}; }
.ff-page .ff-bonus-icon { width: 42px; height: 42px; border-radius: 10px; background: ${accent}; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ff-page .ff-bonus-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
.ff-page .ff-bonus-title { margin: 0; font-size: 15px; font-weight: 700; color: inherit; }
.ff-page .ff-bonus-value { background: ${accent}; color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
.ff-page .ff-bonus-desc { margin: 0; font-size: 14px; opacity: 0.8; line-height: 1.5; }

/* Testimonials */
.ff-page .ff-testimonial-card { padding: 18px; }
.ff-page .ff-testimonial-rating { color: #f59e0b; margin-bottom: 10px; font-size: 16px; letter-spacing: 1px; }
.ff-page .ff-testimonial-quote { margin: 0 0 14px; font-size: 14px; line-height: 1.6; opacity: 0.9; font-style: italic; }
.ff-page .ff-testimonial-author { display: flex; align-items: center; gap: 10px; }
.ff-page .ff-testimonial-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
.ff-page .ff-testimonial-avatar--initials { background: ${accent}; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; }
.ff-page .ff-testimonial-name { font-size: 13px; font-weight: 700; color: inherit; }
.ff-page .ff-testimonial-role { font-size: 12px; opacity: 0.6; }

/* FAQ (natif <details>) */
.ff-page .ff-faq-list { max-width: 720px; margin: 24px auto 0; }
.ff-page .ff-faq-item { border-bottom: 1px solid rgba(0,0,0,0.08); }
.ff-page .ff-faq-item:first-child { border-top: 1px solid rgba(0,0,0,0.08); }
.ff-page .ff-faq-q { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 16px 0; cursor: pointer; font-size: 15px; font-weight: 600; color: inherit; list-style: none; }
.ff-page .ff-faq-q::-webkit-details-marker { display: none; }
.ff-page .ff-faq-q-text { flex: 1; }
.ff-page .ff-faq-icon { display: inline-flex; color: ${accent}; line-height: 0; }
.ff-page .ff-faq-chevron { color: ${accent}; transition: transform 0.25s ease; flex-shrink: 0; }
.ff-page .ff-faq-item[open] .ff-faq-chevron { transform: rotate(180deg); }
.ff-page .ff-faq-a { padding: 0 28px 16px 0; font-size: 14px; line-height: 1.6; opacity: 0.85; }
.ff-page .ff-faq-a p { margin: 0; white-space: pre-line; }

/* Guarantee */
.ff-page .ff-guarantee { max-width: 720px; margin: 24px auto 0; padding: 24px; border-radius: 16px; background: ${accent08}; border: 2px solid ${accent30}; display: flex; flex-direction: column; gap: 16px; align-items: center; text-align: center; }
@media (min-width: 640px) { .ff-page .ff-guarantee { flex-direction: row; text-align: left; } }
.ff-page .ff-guarantee-icon { width: 64px; height: 64px; border-radius: 50%; background: ${accent}; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ff-page .ff-guarantee-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; justify-content: center; }
@media (min-width: 640px) { .ff-page .ff-guarantee-head { justify-content: flex-start; } }
.ff-page .ff-guarantee-title { margin: 0; font-size: 20px; font-weight: 900; color: inherit; }
.ff-page .ff-guarantee-duration { background: ${accent}; color: #fff; font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 999px; }
.ff-page .ff-guarantee-desc { margin: 0; font-size: 14px; line-height: 1.6; opacity: 0.85; }

/* Form */
.ff-page .ff-form-fields { display: grid; grid-template-columns: 1fr; gap: 12px; max-width: 520px; margin: 18px auto 0; }
@media (min-width: 640px) { .ff-page .ff-form-fields { grid-template-columns: 1fr 1fr; } }
.ff-page .ff-field { display: flex; flex-direction: column; gap: 6px; grid-column: 1 / -1; text-align: left; }
.ff-page .ff-field--half { grid-column: span 1; }
.ff-page .ff-field-label { font-size: 13px; font-weight: 600; color: inherit; }
.ff-page .ff-input { min-height: 46px; border: 1px solid rgba(0,0,0,0.12); border-radius: 8px; padding: 0 14px; font: inherit; background: #fff; color: #0f172a; width: 100%; }
.ff-page textarea.ff-input { padding: 12px 14px; min-height: 100px; resize: vertical; }
.ff-page .ff-checkbox { display: flex; align-items: center; gap: 8px; font-size: 14px; color: inherit; }
.ff-page .ff-form-submit { grid-column: 1 / -1; }

/* Scroll-reveal en CSS pur (animation au chargement avec léger délai) */
.ff-page .ff-anim-fade-in,
.ff-page .ff-anim-fade-up,
.ff-page .ff-anim-fade-down,
.ff-page .ff-anim-slide-left,
.ff-page .ff-anim-slide-right,
.ff-page .ff-anim-zoom-in,
.ff-page .ff-anim-zoom-out,
.ff-page .ff-anim-pulse {
  opacity: 0;
  animation-duration: 0.7s;
  animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
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
.ff-page .ff-anim-pulse { animation-name: ff-fade-in; }
@keyframes ff-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes ff-fade-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ff-fade-down { from { opacity: 0; transform: translateY(-24px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ff-slide-left { from { opacity: 0; transform: translateX(-32px); } to { opacity: 1; transform: translateX(0); } }
@keyframes ff-slide-right { from { opacity: 0; transform: translateX(32px); } to { opacity: 1; transform: translateX(0); } }
@keyframes ff-zoom-in { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
@keyframes ff-zoom-out { from { opacity: 0; transform: scale(1.06); } to { opacity: 1; transform: scale(1); } }
@media (prefers-reduced-motion: reduce) {
  .ff-page [class*="ff-anim-"] { opacity: 1 !important; animation: none !important; transform: none !important; }
}

/* Footer */
.ff-page .ff-footer { background: #0f172a; color: rgba(255,255,255,0.85); padding: 32px 20px; text-align: center; border-top: 1px solid rgba(255,255,255,0.08); }
.ff-page .ff-footer-inner { max-width: 920px; margin: 0 auto; display: flex; flex-direction: column; gap: 8px; }
.ff-page .ff-footer-brand { font-weight: 700; font-size: 15px; color: #fff; }
.ff-page .ff-footer-legal { font-size: 13px; opacity: 0.7; line-height: 1.5; }
.ff-page .ff-footer-link { color: ${accent}; text-decoration: none; font-weight: 500; }
.ff-page .ff-footer-copy { opacity: 0.5; font-size: 12px; margin-top: 8px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); }

@media (min-width: 760px) { .ff-page .ff-section { padding: 88px 32px; } }`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE 1 — Page complète scopée sous .ff-page
// ─────────────────────────────────────────────────────────────────────────────
export function renderFunnelHtml(funnel: Funnel): string {
  const css = renderFunnelCss(funnel);

  const sections = funnel.sections
    .filter((s) => s.visible !== false)
    .map((section) => {
      const styleAttrs = buildSectionStyle(section);
      const styleProp = styleAttrs ? ` style="${escapeAttr(styleAttrs)}"` : "";
      return `  <section id="${escapeAttr(section.id)}" class="ff-section ff-${section.type}${sectionSpacingClass(section)}${sectionLayoutClass(section)}"${styleProp}>
    ${renderBackgroundOverlay(section)}
    <div class="ff-section-inner">
      ${renderSectionInner(section, funnel.language)}
    </div>
  </section>`;
    }).join("\n");

  return `<style>
${css}
</style>

<div class="ff-page">
${renderHeader(funnel)}
${sections}
${renderFooter(funnel)}
</div>`;
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
  const preset = getTemplatePreset(funnel);
  const textScale = clamp(funnel.design.textScale ?? 1, 0.85, 1.25);
  const buttonScale = clamp(funnel.design.buttonScale ?? 1, 0.85, 1.25);

  return funnel.sections
    .filter((s) => s.visible !== false)
    .map((section) => {
      const rawCls = `ff-${section.type}-${section.id}`.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
      const cls = rawCls;

      const colors = getSectionColors(section);
      const accent = colors.accent || section.style?.accentColor || funnel.design.accentColor || funnel.design.secondaryColor || "#D4A537";
      const ink = colors.ink || section.style?.textColor || "#0f172a";
      const bg = colors.bg || "transparent";

      const accent12 = colorWithAlpha(accent, 0.12);
      const accent08 = colorWithAlpha(accent, 0.08);
      const accent06 = colorWithAlpha(accent, 0.06);
      const accent25 = colorWithAlpha(accent, 0.25);
      const accent30 = colorWithAlpha(accent, 0.30);
      const ink03 = colorWithAlpha(ink, 0.03);

      const bgImg = section.background?.imageUrl;
      const bgImgCss = bgImg
        ? `background-image:url('${bgImg.replace(/'/g, "%27")}');background-size:${section.background?.size ?? "cover"};background-position:${section.background?.position ?? "center"};background-repeat:no-repeat;`
        : "";

      const shadowKey = section.style?.shadow?.size;
      const shadowColor = section.style?.shadow?.color ?? "rgba(15,23,42,0.15)";
      const shadowMap: Record<string, string> = { sm: "0 2px 8px", md: "0 8px 24px", lg: "0 16px 40px", xl: "0 24px 60px" };
      const shadowCss = shadowKey && shadowKey !== "none" ? `box-shadow:${shadowMap[shadowKey] ?? shadowMap.md} ${shadowColor};` : "";

      const headlineFont = preset.headlineFont ?? preset.font;
      const btnMinH = Math.round(46 * buttonScale);
      const btnPad = Math.round(22 * buttonScale);
      const btnFont = Math.round(15 * buttonScale);

      const css = `.${cls} { font-family: ${preset.font}; color: ${ink}; background: ${bg}; padding: 56px 20px; ${bgImgCss}${shadowCss} position: relative; }
.${cls}, .${cls} *, .${cls} *::before, .${cls} *::after { box-sizing: border-box; }
.${cls} .ff-section-inner { max-width: 1040px; margin: 0 auto; position: relative; z-index: 1; }
.${cls} .ff-section-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 0; }
.${cls} .ff-eyebrow { display: inline-block; color: ${accent}; font-weight: 700; text-transform: uppercase; font-size: ${Math.round(11 * textScale)}px; letter-spacing: 0.12em; margin-bottom: 12px; padding: 4px 10px; border-radius: 999px; background: ${accent12}; }
.${cls} .ff-headline { margin: 0 0 14px; font-family: ${headlineFont}; font-size: ${Math.round(28 * textScale)}px; line-height: 1.15; font-weight: 800; color: inherit; }
@media (min-width: 640px) { .${cls} .ff-headline { font-size: ${Math.round(36 * textScale)}px; } }
@media (min-width: 1024px) { .${cls} .ff-headline { font-size: ${Math.round(44 * textScale)}px; } }
.${cls} .ff-subheadline { font-size: ${Math.round(17 * textScale)}px; line-height: 1.65; opacity: 0.85; margin: 0 0 14px; }
.${cls} .ff-body { font-size: ${Math.round(16 * textScale)}px; line-height: 1.7; opacity: 0.9; margin: 0 0 14px; white-space: pre-line; }
.${cls} .ff-bullets { list-style: none; padding: 0; margin: 0 0 18px; display: grid; gap: 10px; }
.${cls} .ff-bullets li { display: flex; align-items: flex-start; gap: 10px; }
.${cls} .ff-bullet-ic { color: ${accent}; flex-shrink: 0; display: inline-flex; line-height: 0; margin-top: 2px; }
.${cls} .ff-btn, .${cls} .ff-cta { display: inline-flex; align-items: center; justify-content: center; min-height: ${btnMinH}px; padding: 0 ${btnPad}px; margin-top: 14px; border-radius: 8px; color: #fff !important; background: ${accent}; text-decoration: none; font-weight: 700; font-size: ${btnFont}px; cursor: pointer; border: none; transition: opacity 0.18s ease, transform 0.18s ease; }
.${cls} .ff-btn:hover, .${cls} .ff-cta:hover { opacity: 0.92; transform: translateY(-1px); }
.${cls} .ff-cta-wrap { margin-top: 18px; }
.${cls} .ff-split-grid { display: grid; grid-template-columns: 1fr; gap: 32px; align-items: center; }
@media (min-width: 860px) { .${cls} .ff-split-grid { grid-template-columns: 1fr 1fr; gap: 48px; } }
.${cls} .ff-image { margin: 22px 0 8px; }
.${cls} .ff-image img { width: 100%; height: auto; border-radius: 12px; display: block; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
.${cls} .ff-image--transparent img { box-shadow: none; border-radius: 0; background: transparent; }
.${cls} .ff-video { margin: 22px auto; max-width: 720px; }
.${cls} .ff-video-inner { position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); background: #000; }
.${cls} .ff-video-inner iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }
.${cls} .ff-grid-1, .${cls} .ff-grid-2, .${cls} .ff-grid-3 { display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 24px; }
@media (min-width: 760px) { .${cls} .ff-grid-2 { grid-template-columns: 1fr 1fr; } .${cls} .ff-grid-3 { grid-template-columns: 1fr 1fr 1fr; } }
.${cls} .ff-card { background: ${ink03}; border: 1px solid rgba(0,0,0,0.08); border-radius: 14px; padding: 22px; }
.${cls} .ff-card-elevated { box-shadow: 0 14px 36px rgba(15,23,42,0.10); }
.${cls} .ff-pricing-card { position: relative; display: flex; flex-direction: column; }
.${cls} .ff-pricing-card--highlighted { background: ${accent08}; border: 2px solid ${accent}; }
.${cls} .ff-pricing-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: ${accent}; color: #fff; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 12px; border-radius: 999px; }
.${cls} .ff-pricing-name { margin: 0 0 6px; font-size: 18px; font-weight: 700; }
.${cls} .ff-pricing-desc { margin: 0 0 14px; font-size: 13px; opacity: 0.65; }
.${cls} .ff-pricing-price { display: flex; align-items: baseline; gap: 6px; margin-bottom: 20px; }
.${cls} .ff-pricing-amount { font-size: 36px; font-weight: 900; }
.${cls} .ff-pricing-card--highlighted .ff-pricing-amount { color: ${accent}; }
.${cls} .ff-pricing-period { font-size: 14px; opacity: 0.6; }
.${cls} .ff-pricing-features { list-style: none; padding: 0; margin: 0 0 20px; display: grid; gap: 8px; flex: 1; }
.${cls} .ff-pricing-features li { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; opacity: 0.85; }
.${cls} .ff-feat-check { color: ${accent}; display: inline-flex; line-height: 0; margin-top: 2px; flex-shrink: 0; }
.${cls} .ff-pricing-cta { width: 100%; margin-top: auto; }
.${cls} .ff-bonus-card { display: flex; gap: 14px; align-items: flex-start; padding: 18px; border-radius: 12px; background: ${accent06}; border: 1px solid ${accent25}; }
.${cls} .ff-bonus-icon { width: 42px; height: 42px; border-radius: 10px; background: ${accent}; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.${cls} .ff-bonus-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
.${cls} .ff-bonus-title { margin: 0; font-size: 15px; font-weight: 700; }
.${cls} .ff-bonus-value { background: ${accent}; color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
.${cls} .ff-bonus-desc { margin: 0; font-size: 14px; opacity: 0.8; line-height: 1.5; }
.${cls} .ff-testimonial-card { padding: 18px; }
.${cls} .ff-testimonial-rating { color: #f59e0b; margin-bottom: 10px; font-size: 16px; letter-spacing: 1px; }
.${cls} .ff-testimonial-quote { margin: 0 0 14px; font-size: 14px; line-height: 1.6; opacity: 0.9; font-style: italic; }
.${cls} .ff-testimonial-author { display: flex; align-items: center; gap: 10px; }
.${cls} .ff-testimonial-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
.${cls} .ff-testimonial-avatar--initials { background: ${accent}; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; }
.${cls} .ff-testimonial-name { font-size: 13px; font-weight: 700; }
.${cls} .ff-testimonial-role { font-size: 12px; opacity: 0.6; }
.${cls} .ff-faq-list { max-width: 720px; margin: 24px auto 0; }
.${cls} .ff-faq-item { border-bottom: 1px solid rgba(0,0,0,0.08); }
.${cls} .ff-faq-item:first-child { border-top: 1px solid rgba(0,0,0,0.08); }
.${cls} .ff-faq-q { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 16px 0; cursor: pointer; font-size: 15px; font-weight: 600; color: inherit; list-style: none; }
.${cls} .ff-faq-q::-webkit-details-marker { display: none; }
.${cls} .ff-faq-q-text { flex: 1; }
.${cls} .ff-faq-chevron { color: ${accent}; transition: transform 0.25s ease; flex-shrink: 0; }
.${cls} .ff-faq-item[open] .ff-faq-chevron { transform: rotate(180deg); }
.${cls} .ff-faq-a { padding: 0 28px 16px 0; font-size: 14px; line-height: 1.6; opacity: 0.85; }
.${cls} .ff-faq-a p { margin: 0; white-space: pre-line; }
.${cls} .ff-guarantee { max-width: 720px; margin: 24px auto 0; padding: 24px; border-radius: 16px; background: ${accent08}; border: 2px solid ${accent30}; display: flex; flex-direction: column; gap: 16px; align-items: center; text-align: center; }
@media (min-width: 640px) { .${cls} .ff-guarantee { flex-direction: row; text-align: left; } }
.${cls} .ff-guarantee-icon { width: 64px; height: 64px; border-radius: 50%; background: ${accent}; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.${cls} .ff-guarantee-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.${cls} .ff-guarantee-title { margin: 0; font-size: 20px; font-weight: 900; }
.${cls} .ff-guarantee-duration { background: ${accent}; color: #fff; font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 999px; }
.${cls} .ff-guarantee-desc { margin: 0; font-size: 14px; line-height: 1.6; opacity: 0.85; }
.${cls} .ff-form-fields { display: grid; grid-template-columns: 1fr; gap: 12px; max-width: 520px; margin: 18px auto 0; }
@media (min-width: 640px) { .${cls} .ff-form-fields { grid-template-columns: 1fr 1fr; } }
.${cls} .ff-field { display: flex; flex-direction: column; gap: 6px; grid-column: 1 / -1; text-align: left; }
.${cls} .ff-field--half { grid-column: span 1; }
.${cls} .ff-field-label { font-size: 13px; font-weight: 600; }
.${cls} .ff-input { min-height: 46px; border: 1px solid rgba(0,0,0,0.12); border-radius: 8px; padding: 0 14px; font: inherit; background: #fff; color: ${ink}; width: 100%; }
.${cls} textarea.ff-input { padding: 12px 14px; min-height: 100px; resize: vertical; }
.${cls} .ff-form-submit { grid-column: 1 / -1; }
.${cls} .ff-anim-fade-in, .${cls} .ff-anim-fade-up, .${cls} .ff-anim-fade-down, .${cls} .ff-anim-slide-left, .${cls} .ff-anim-slide-right, .${cls} .ff-anim-zoom-in, .${cls} .ff-anim-zoom-out, .${cls} .ff-anim-pulse { opacity: 0; animation-duration: 0.7s; animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1); animation-fill-mode: forwards; animation-delay: 0.1s; }
.${cls} .ff-anim-fade-in { animation-name: ff-fade-in-${cls}; }
.${cls} .ff-anim-fade-up { animation-name: ff-fade-up-${cls}; }
.${cls} .ff-anim-fade-down { animation-name: ff-fade-down-${cls}; }
.${cls} .ff-anim-slide-left { animation-name: ff-slide-left-${cls}; }
.${cls} .ff-anim-slide-right { animation-name: ff-slide-right-${cls}; }
.${cls} .ff-anim-zoom-in { animation-name: ff-zoom-in-${cls}; }
.${cls} .ff-anim-zoom-out { animation-name: ff-zoom-out-${cls}; }
.${cls} .ff-anim-pulse { animation-name: ff-fade-in-${cls}; }
@keyframes ff-fade-in-${cls} { from { opacity: 0; } to { opacity: 1; } }
@keyframes ff-fade-up-${cls} { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ff-fade-down-${cls} { from { opacity: 0; transform: translateY(-24px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ff-slide-left-${cls} { from { opacity: 0; transform: translateX(-32px); } to { opacity: 1; transform: translateX(0); } }
@keyframes ff-slide-right-${cls} { from { opacity: 0; transform: translateX(32px); } to { opacity: 1; transform: translateX(0); } }
@keyframes ff-zoom-in-${cls} { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
@keyframes ff-zoom-out-${cls} { from { opacity: 0; transform: scale(1.06); } to { opacity: 1; transform: scale(1); } }`;

      const inner = renderSectionInner(section, funnel.language);
      const overlay = renderBackgroundOverlay(section);

      const html = `<style>
${css}
</style>

<section class="${cls}">
${overlay}
<div class="ff-section-inner">
${inner}
</div>
</section>`;

      return { id: section.id, label: section.headline, type: section.type, html };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloc formulaire final
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

  const css = `.${cls} { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #0f172a; padding: 48px 20px; max-width: 560px; margin: 0 auto; background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 14px; }
.${cls}, .${cls} *, .${cls} *::before, .${cls} *::after { box-sizing: border-box; }
.${cls} h2 { margin: 0 0 16px; font-size: 24px; line-height: 1.2; font-weight: 800; }
@media (min-width: 640px) { .${cls} h2 { font-size: 30px; } }
.${cls} form { display: grid; gap: 12px; }
.${cls} input { min-height: 46px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; padding: 0 14px; font: inherit; }
.${cls} button { min-height: 46px; border: none; border-radius: 8px; background: ${accent}; color: #fff; font-weight: 700; font-size: 15px; cursor: pointer; transition: opacity 0.18s ease, transform 0.18s ease; }
.${cls} button:hover { opacity: 0.92; transform: translateY(-1px); }`;

  const html = `<style>
${css}
</style>

<section id="lead-form" class="${cls}">
<h2>${escapeHtml(l.title)}</h2>
<form action="#" method="post">
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
      "Guide d'import dans systeme.io", "",
      "1. Ouvrez systeme.io et créez un nouveau tunnel",
      "2. Ajoutez la page de capture ou de vente correspondant à votre objectif",
      "3. Glissez un bloc HTML personnalisé dans la section voulue",
      "4. Collez le contenu de funnel-complet.html (mode complet) OU collez chaque bloc de blocs/ un par un dans l'ordre indiqué",
      "5. Vérifiez que vos liens CTA pointent vers vos pages de paiement, formulaires ou rendez-vous",
      "6. Prévisualisez la page sur mobile avant publication",
    ],
    en: [
      "systeme.io import guide", "",
      "1. Open systeme.io and create a new funnel",
      "2. Add the capture or sales page that matches your goal",
      "3. Drag a Custom HTML block into the target section",
      "4. Paste the content of funnel-complete.html (full mode) OR paste each file from blocks/ one by one in order",
      "5. Make sure your CTA links point to your payment pages, forms or booking links",
      "6. Preview the page on mobile before publishing",
    ],
    es: [
      "Guía de importación en systeme.io", "",
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

  const fileNames = { fr: "funnel-complet.html", en: "funnel-complete.html", es: "embudo-completo.html" } as const;

  const files: Record<string, Uint8Array> = {
    [fileNames[funnel.language] ?? "funnel-complete.html"]: strToU8(fullHtml),
    "guide-import-systeme.txt": strToU8(guide),
  };
  blocks.forEach((b, i) => {
    const safe = `${String(i + 1).padStart(2, "0")}-${b.type}-${b.id}`.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
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

  const previewName = { fr: "apercu-complet.html", en: "funnel-complete.html", es: "embudo-completo.html" } as const;

  const blockEntries = blocks.map((b, i) => {
    const safe = `${String(i + 1).padStart(2, "0")}-${b.type}-${b.id}`.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    const fileName = `${safe}.html`;
    const section = funnel.sections.find((s) => s.id === b.id);
    const hasPopup = section?.cta?.mode === "popup";
    return {
      fileName: `blocs-systeme-io/${fileName}`,
      type: b.type, label: b.label, hasPopup,
      _zipPath: `blocs-systeme-io/${fileName}`, _html: b.html,
    };
  });

  const formFileName = `99-form-${formBlock.id}.html`.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  blockEntries.push({
    fileName: `blocs-systeme-io/${formFileName}`,
    type: "form", label: formBlock.label, hasPopup: false,
    _zipPath: `blocs-systeme-io/${formFileName}`, _html: formBlock.html,
  });

  const readme = createReadme(funnel, blockEntries.map((b) => ({
    fileName: b.fileName.replace("blocs-systeme-io/", ""),
    type: b.type, label: b.label, hasPopup: b.hasPopup,
  })));

  const files: Record<string, Uint8Array> = {
    "README.md": strToU8(readme),
    [previewName[funnel.language] ?? "apercu-complet.html"]: strToU8(fullHtml),
  };
  blockEntries.forEach((b) => { files[b._zipPath] = strToU8(b._html); });

  const zipped = zipSync(files);
  return Buffer.from(zipped).toString("base64");
}
