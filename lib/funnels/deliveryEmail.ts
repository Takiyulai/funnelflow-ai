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
 * Extrait la config d'email de livraison depuis un contenu de funnel publié
 * (jsonb brut). Retourne null si absente, désactivée, ou vide.
 */
export function readDeliveryEmailConfig(
  publishedContent: unknown,
): DeliveryEmailConfig | null {
  if (!publishedContent || typeof publishedContent !== "object") return null;
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
