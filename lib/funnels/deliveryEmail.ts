// lib/funnels/deliveryEmail.ts
// 🆕 Email de livraison/bienvenue conditionnel.
//
// Lit la config dans `funnel.meta.deliveryEmail` (telle que figée dans
// `published_content` à la publication) et produit l'email personnalisé.
// Règle stricte : on ne renvoie une config QUE si elle est ACTIVÉE et possède
// un contenu réel (objet ou corps). Jamais d'email générique par défaut.

export type DeliveryEmailConfig = {
  enabled: boolean;
  subject: string;
  body: string;
  attachmentUrl?: string;
};

type LeadContext = { email: string; name?: string | null };

/**
 * 🆕 Chariow Niveau 2 : true si le tunnel vend via un LIEN PRODUIT Chariow
 * (au moins un CTA marqué `chariow: true`). Dans ce cas, Chariow gère le
 * paiement ET la livraison du produit → AutoFunnel n'envoie pas d'email de
 * livraison en double.
 */
export function funnelSellsViaChariow(publishedContent: unknown): boolean {
  if (!publishedContent || typeof publishedContent !== "object") return false;
  const content = publishedContent as {
    sections?: Array<{ cta?: { chariow?: boolean }; items?: Array<{ kind?: string; data?: { cta?: { chariow?: boolean } } }> }>;
    pages?: Array<{ sections?: Array<{ cta?: { chariow?: boolean }; items?: Array<{ kind?: string; data?: { cta?: { chariow?: boolean } } }> }> }>;
  };
  const sectionHasChariow = (s: {
    cta?: { chariow?: boolean };
    items?: Array<{ kind?: string; data?: { cta?: { chariow?: boolean } } }>;
  }): boolean => {
    if (s.cta?.chariow === true) return true;
    if (Array.isArray(s.items)) {
      return s.items.some(
        (it) => it?.kind === "pricing" && it.data?.cta?.chariow === true,
      );
    }
    return false;
  };
  if (Array.isArray(content.sections) && content.sections.some(sectionHasChariow)) {
    return true;
  }
  if (Array.isArray(content.pages)) {
    return content.pages.some(
      (p) => Array.isArray(p.sections) && p.sections.some(sectionHasChariow),
    );
  }
  return false;
}

/**
 * Extrait la config d'email de livraison depuis un contenu de funnel publié
 * (jsonb brut). Retourne null si absente, désactivée, ou vide.
 * 🆕 Retourne aussi null si le tunnel vend via Chariow (Chariow livre le
 * produit lui-même — pas de doublon).
 */
export function readDeliveryEmailConfig(
  publishedContent: unknown,
): DeliveryEmailConfig | null {
  if (!publishedContent || typeof publishedContent !== "object") return null;
  if (funnelSellsViaChariow(publishedContent)) return null;
  const meta = (publishedContent as { meta?: unknown }).meta;
  if (!meta || typeof meta !== "object") return null;
  const de = (meta as { deliveryEmail?: unknown }).deliveryEmail;
  if (!de || typeof de !== "object") return null;

  const cfg = de as Record<string, unknown>;
  if (cfg.enabled !== true) return null;

  const subject = typeof cfg.subject === "string" ? cfg.subject.trim() : "";
  const body = typeof cfg.body === "string" ? cfg.body : "";
  // Jamais d'email vide : il faut au moins un objet OU un corps.
  if (!subject && !body.trim()) return null;

  const attachmentUrl =
    typeof cfg.attachmentUrl === "string" && cfg.attachmentUrl.trim()
      ? cfg.attachmentUrl.trim()
      : undefined;

  return {
    enabled: true,
    subject: subject || "Votre accès",
    body,
    attachmentUrl,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isHttpUrl(u: string): boolean {
  return /^https?:\/\//i.test(u);
}

/**
 * Produit { subject, html } personnalisés. Le corps accepte {{name}} / {{email}}.
 * Si le corps contient déjà du HTML, on le conserve ; sinon on convertit les
 * sauts de ligne. Un lien de pièce jointe (URL http) est ajouté en bas.
 */
export function renderDeliveryEmail(
  cfg: DeliveryEmailConfig,
  lead: LeadContext,
): { subject: string; html: string } {
  const name = lead.name?.trim() || "";
  const fill = (s: string) =>
    s.replace(/\{\{\s*name\s*\}\}/gi, name).replace(/\{\{\s*email\s*\}\}/gi, lead.email);

  const subject = fill(cfg.subject);
  const filledBody = fill(cfg.body);

  const bodyHtml = /<[a-z][\s\S]*>/i.test(filledBody)
    ? filledBody
    : filledBody
        .split(/\n{2,}/)
        .filter((p) => p.trim().length > 0)
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
        .join("");

  const attachmentHtml =
    cfg.attachmentUrl && isHttpUrl(cfg.attachmentUrl)
      ? `<p style="margin-top:16px"><a href="${escapeHtml(cfg.attachmentUrl)}" style="display:inline-block;padding:10px 18px;background:#08498D;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Accéder à votre contenu</a></p>`
      : "";

  return { subject, html: `${bodyHtml}${attachmentHtml}` };
}
