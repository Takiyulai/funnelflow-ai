import type { EmailBlock, EmailDocument, EmailTextAlign } from "./types";

const ALLOWED_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function color(value: string, fallback: string): string {
  return ALLOWED_COLOR.test(value.trim()) ? value.trim() : fallback;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(value: string, fallback = "#"): string {
  const clean = value.trim();
  if (!clean) return fallback;
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(clean)) return escapeHtml(clean);
  return fallback;
}

/** Assainissement volontairement conservateur du HTML produit par l'éditeur riche/IA. */
export function sanitizeEmailRichHtml(value: string): string {
  return value
    .replace(/<(script|style|iframe|object|embed|form|input|button|meta|link|svg|math)[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|input|button|meta|link|svg|math)\b[^>]*\/?\s*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*(javascript:|data:text\/html)[\s\S]*?\2/gi, '$1="#"')
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/url\s*\(\s*(["']?)\s*javascript:[^)]*\)/gi, "none");
}

function align(value: EmailTextAlign): EmailTextAlign {
  return value === "center" || value === "right" || value === "justify" ? value : "left";
}

export function isEmailRichTextEmpty(value: string): boolean {
  return value
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .trim().length === 0;
}

function renderBlock(block: EmailBlock): string {
  switch (block.type) {
    case "heading": {
      if (!block.content.text.trim()) return "";
      const size = clamp(block.style.fontSize, 14, 64);
      return `<tr><td style="padding:${clamp(block.style.padding, 0, 64)}px;text-align:${align(block.style.align)};color:${color(block.style.color, "#080e1a")};font-size:${size}px;line-height:${clamp(block.style.lineHeight, 1, 2)};font-weight:700;">${escapeHtml(block.content.text)}</td></tr>`;
    }
    case "richText":
      if (isEmailRichTextEmpty(block.content.html)) return "";
      return `<tr><td style="padding:${clamp(block.style.padding, 0, 64)}px;text-align:${align(block.style.align)};color:${color(block.style.color, "#26303f")};font-size:${clamp(block.style.fontSize, 10, 36)}px;line-height:${clamp(block.style.lineHeight, 1, 2.5)};">${sanitizeEmailRichHtml(block.content.html)}</td></tr>`;
    case "image": {
      if (!block.content.src.trim()) {
        return "";
      }
      const image = `<img src="${safeUrl(block.content.src, "")}" alt="${escapeHtml(block.content.alt)}" width="${clamp(block.style.width, 10, 100)}%" style="display:inline-block;width:${clamp(block.style.width, 10, 100)}%;max-width:100%;height:auto;border:0;border-radius:${clamp(block.style.borderRadius, 0, 80)}px;" />`;
      const linked = block.content.href?.trim()
        ? `<a href="${safeUrl(block.content.href)}" target="_blank" rel="noopener noreferrer">${image}</a>`
        : image;
      return `<tr><td style="padding:${clamp(block.style.padding, 0, 64)}px;text-align:${align(block.style.align)};">${linked}</td></tr>`;
    }
    case "button":
      if (!block.content.text.trim() || !block.content.url.trim()) return "";
      return `<tr><td style="padding:${clamp(block.style.padding, 0, 64)}px;text-align:${align(block.style.align)};"><a href="${safeUrl(block.content.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:${color(block.style.background, "#c7a436")};color:${color(block.style.color, "#080e1a")};font-size:${clamp(block.style.fontSize, 10, 30)}px;font-weight:700;line-height:1.2;padding:14px 26px;border-radius:${clamp(block.style.borderRadius, 0, 40)}px;text-decoration:none;">${escapeHtml(block.content.text)}</a></td></tr>`;
    case "divider":
      return `<tr><td style="padding:${clamp(block.style.padding, 0, 64)}px;"><div style="margin:0 auto;width:${clamp(block.style.width, 10, 100)}%;border-top:${clamp(block.style.thickness, 1, 8)}px solid ${color(block.style.color, "#d8dde6")};font-size:0;line-height:0;">&nbsp;</div></td></tr>`;
    case "spacer":
      return `<tr><td height="${clamp(block.style.height, 4, 160)}" style="height:${clamp(block.style.height, 4, 160)}px;font-size:0;line-height:0;">&nbsp;</td></tr>`;
  }
}

export type EmailCompileOptions = {
  preheader?: string;
  brandName?: string | null;
  accentColor?: string | null;
};

function wrapFragment(
  document: EmailDocument,
  blocksHtml: string,
  options: EmailCompileOptions,
): string {
  const width = clamp(document.settings.width, 320, 760);
  const bg = color(document.settings.background, "#eef0f3");
  const contentBg = color(document.settings.contentBackground, "#ffffff");
  const allowedFonts = new Set([
    "Arial, Helvetica, sans-serif",
    "Georgia, Times, serif",
    "Verdana, Geneva, sans-serif",
    "Tahoma, Geneva, sans-serif",
  ]);
  const family = allowedFonts.has(document.settings.fontFamily)
    ? document.settings.fontFamily
    : "Arial, Helvetica, sans-serif";
  const preheader = options.preheader ?? "";
  const hiddenPreheader = preheader.trim()
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader.trim())}</div>`
    : "";
  const brand = (options.brandName ?? "").trim();
  const accent = color((options.accentColor ?? "").trim(), "#c7a436");
  const brandRow = brand
    ? `<tr><td style="padding:24px;text-align:center;background:#080e1a;color:#ffffff;font-size:19px;font-weight:700;">${escapeHtml(brand)}<div style="margin:10px auto 0;width:42px;border-top:3px solid ${accent};"></div></td></tr>`
    : `<tr><td style="height:6px;background:${accent};font-size:0;line-height:0;">&nbsp;</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><style>@media only screen and (max-width:620px){.ff-email-wrap{padding:12px 8px!important}.ff-email-card{width:100%!important}}</style></head><body class="ff-email-wrap" style="margin:0;padding:28px 16px;background:${bg};font-family:${family};">${hiddenPreheader}<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center"><table class="ff-email-card" role="presentation" cellpadding="0" cellspacing="0" border="0" width="${width}" style="width:100%;max-width:${width}px;background:${contentBg};border-collapse:collapse;border-radius:14px;overflow:hidden;">${brandRow}${blocksHtml || '<tr><td style="padding:48px 24px;text-align:center;color:#7b8494;">Votre email est vide.</td></tr>'}</table></td></tr></table></body></html>`;
}

export function compileEmailDocument(
  document: EmailDocument,
  options: EmailCompileOptions = {},
): string {
  if (document.legacy?.pristine) return document.legacy.originalHtml;
  return wrapFragment(document, document.blocks.map(renderBlock).join(""), options);
}

export function isCompiledEmailHtml(content: string): boolean {
  return content.includes("ff-email-card");
}
