// lib/crm/emailRender.ts
// 🆕 Rendu HTML d'un email (personnalisation + gabarit). Partagé par les
// séquences (et réutilisable ailleurs). Les newsletters gardent leur propre
// rendu interne pour ne rien casser.

import type { SupabaseClient } from "@supabase/supabase-js";

// 🆕 MODULE 3 — `firstName`/`lastName`/`phone`/`customFields` sont tous
// optionnels et rétrocompatibles : un appelant qui ne passe que
// `{name, email}` (comme avant) obtient exactement le même résultat qu'avant.
export type EmailRecipient = {
  name?: string | null;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  /** Champs libres (voir CustomFieldDef) — clé = field_key. */
  customFields?: Record<string, unknown> | null;
};

// ⚠️ Compatibilité : {{prenom}}/{{nom}}/{{name}} restent TOUS des alias du nom
// complet historique (`name`) quand `firstName`/`lastName` ne sont pas fournis
// — sinon des campagnes déjà écrites (ex. « {{nom}}, » pour dire bonjour)
// changeraient de sens du jour au lendemain. `{{prenom}}` préfère `firstName`
// s'il est renseigné ; `{{nom}}`/`{{name}}` restent le nom complet. `last_name`
// est un tout NOUVEAU jeton (personne ne l'utilisait avant), sans risque de
// régression.
const FIXED_FIELD_RESOLVERS: Record<string, (r: EmailRecipient) => string> = {
  prenom: (r) => r.firstName || r.name || "",
  firstname: (r) => r.firstName || r.name || "",
  first_name: (r) => r.firstName || r.name || "",
  nom: (r) => r.name || r.firstName || "",
  name: (r) => r.name || r.firstName || "",
  lastname: (r) => r.lastName || "",
  last_name: (r) => r.lastName || "",
  email: (r) => r.email || "",
  telephone: (r) => r.phone || "",
  phone: (r) => r.phone || "",
};

/**
 * Remplace toutes les variables {{...}} d'un contenu : d'abord les colonnes
 * fixes (prenom/nom/name/email/telephone), sinon une recherche insensible à
 * la casse dans `customFields`. Toute variable inconnue est remplacée par une
 * chaîne vide — jamais laissée telle quelle (ex. plus jamais "{{prenom}}"
 * affiché brut dans un email envoyé).
 */
export function personalize(content: string, r: EmailRecipient): string {
  if (!content) return content;
  return content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, rawKey: string) => {
    const key = rawKey.toLowerCase();
    const fixed = FIXED_FIELD_RESOLVERS[key];
    if (fixed) return fixed(r);

    const custom = r.customFields;
    if (custom) {
      const foundKey = Object.keys(custom).find((k) => k.toLowerCase() === key);
      if (foundKey !== undefined) {
        const v = custom[foundKey];
        return v === null || v === undefined ? "" : String(v);
      }
    }
    return "";
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 REFONTE DESIGN EMAIL — gabarit « newsletter » aéré (bannière de marque,
// boutons CTA, typographie plus généreuse), 100 % styles inline (compatibilité
// clients email). Le contenu de l'utilisateur reste la source ; on l'habille.
// ─────────────────────────────────────────────────────────────────────────────

export type EmailRenderOptions = {
  /** Nom de marque affiché dans la bannière (businessName du tunnel). */
  brandName?: string | null;
  /** Couleur d'accent (CTA / liens). Défaut : or AutoFunnel #C7A436. */
  accentColor?: string | null;
};

const DEFAULT_ACCENT = "#C7A436"; // or signature (identique au CTA de l'app)
const INK = "#080E1A"; // fond profond (identique à la landing)

const BTN_STYLE = (accent: string) =>
  `display:inline-block;background:${accent};color:${INK};font-weight:bold;` +
  `font-size:15px;line-height:1;padding:14px 30px;border-radius:10px;` +
  `text-decoration:none;`;

const LINK_STYLE = (accent: string) =>
  `color:${accent};font-weight:bold;text-decoration:underline;`;

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Markdown allégé pour le contenu SAISI EN TEXTE BRUT :
 *   `# Titre` (ligne seule)      → titre de section
 *   `[Label](https://...)` seul  → bouton CTA centré
 *   `[Label](https://...)`       → lien accentué (inline)
 *   `**gras**`                   → <strong>
 */
function inlineMarkdown(text: string, accent: string): string {
  return escapeHtmlText(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (_m, label: string, url: string) =>
        `<a href="${url}" style="${LINK_STYLE(accent)}" target="_blank" rel="noopener noreferrer">${label}</a>`,
    );
}

function toHtmlBody(text: string, accent: string): string {
  // Contenu déjà HTML (éditeur riche) : on l'embellit sans le réécrire.
  if (/<[a-z][\s\S]*>/i.test(text)) return decorateHtml(text, accent);

  return text
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      // Titre de section : ligne unique commençant par "# " ou "## ".
      const h = trimmed.match(/^#{1,2}\s+(.+)$/);
      if (h && !trimmed.includes("\n")) {
        return (
          `<h2 style="margin:28px 0 12px;font-size:21px;line-height:1.35;` +
          `color:${INK};font-weight:bold;">${inlineMarkdown(h[1], accent)}</h2>`
        );
      }
      // Bouton CTA : ligne unique de la forme [Label](url).
      const btn = trimmed.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (btn) {
        return (
          `<p style="margin:28px 0;text-align:center;">` +
          `<a href="${btn[2]}" style="${BTN_STYLE(accent)}" target="_blank" rel="noopener noreferrer">${escapeHtmlText(btn[1])}</a>` +
          `</p>`
        );
      }
      return `<p style="margin:0 0 18px;">${inlineMarkdown(block, accent).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

/**
 * Habille un contenu DÉJÀ HTML : aère les paragraphes, accentue les liens, et
 * transforme en bouton CTA tout paragraphe ne contenant QU'UN lien.
 */
function decorateHtml(html: string, accent: string): string {
  let out = html;
  // Paragraphe ne contenant qu'un seul lien → bouton CTA centré.
  out = out.replace(
    /<p(?:\s[^>]*)?>\s*(?:<(?:b|strong)>\s*)?<a\s([^>]*)>([\s\S]*?)<\/a>\s*(?:<\/(?:b|strong)>\s*)?<\/p>/gi,
    (_m, attrs: string, label: string) => {
      const cleanAttrs = attrs.replace(/style="[^"]*"/i, "").trim();
      return (
        `<p style="margin:28px 0;text-align:center;">` +
        `<a ${cleanAttrs} style="${BTN_STYLE(accent)}">${label}</a></p>`
      );
    },
  );
  // Liens restants sans style → lien accentué.
  out = out.replace(/<a\s(?![^>]*style=)([^>]*)>/gi, `<a style="${LINK_STYLE(accent)}" $1>`);
  // Paragraphes sans style → marge aérée.
  out = out.replace(/<p>/g, `<p style="margin:0 0 18px;">`);
  return out;
}

/**
 * Email complet (gabarit + personnalisation), prêt à envoyer via Resend.
 * `opts` est optionnel et rétrocompatible : sans lui, bannière générique.
 */
export function renderSequenceEmailHtml(
  content: string,
  r: EmailRecipient,
  opts: EmailRenderOptions = {},
): string {
  const accent = (opts.accentColor ?? "").trim() || DEFAULT_ACCENT;
  const brand = (opts.brandName ?? "").trim();
  const body = toHtmlBody(personalize(content, r), accent);

  const header = brand
    ? `<div class="ff-head" style="background:${INK};border-radius:16px 16px 0 0;padding:26px 36px;text-align:center;">` +
      `<span style="display:inline-block;color:#ffffff;font-size:19px;font-weight:bold;letter-spacing:0.4px;">${escapeHtmlText(brand)}</span>` +
      `<div style="margin:12px auto 0;width:44px;height:3px;background:${accent};border-radius:2px;"></div>` +
      `</div>`
    : `<div style="height:6px;background:${accent};border-radius:16px 16px 0 0;"></div>`;

  const footer = brand
    ? `<p style="margin:20px 0 0;text-align:center;font-size:12px;line-height:1.6;color:#9ca3af;">` +
      `Vous recevez cet email de la part de ${escapeHtmlText(brand)}.</p>`
    : "";

  // 🆕 LARGEUR UTILE — même correctif que les emails de rendez-vous
  // (lib/booking/emails.ts), pour la même raison.
  //
  // Le calcul qui posait problème, sur un écran de 360 px :
  //   360 − 32 (marges du <body>) − 72 (padding du bloc blanc) = 256 px
  // Il restait donc 256 px pour le texte, sur un écran qui en offre 360. Le
  // gabarit se serrait tout seul là où la place existait, et aucune media
  // query ne venait relâcher ces marges en petite largeur.
  //
  // Le padding intérieur tombe à 18 px sous 600 px de large, ce qui rend
  // ~292 px au texte — un tiers de largeur gagné sans rien changer au
  // rendu sur ordinateur. La carte passe de 600 à 640 px : au-delà, les
  // lignes deviennent trop longues pour rester confortables à lire.
  //
  // La media query est un bonus : un client qui supprime le <style> affiche
  // les valeurs par défaut, qui restent correctes.
  return (
    `<!doctype html><html><head><meta charset="utf-8" />` +
    `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
    `<style>@media only screen and (max-width:600px){` +
    `.ff-wrap{padding:14px 10px !important}` +
    `.ff-head{padding:22px 18px !important}` +
    `.ff-body{padding:24px 18px 22px !important}` +
    `}</style></head>` +
    `<body class="ff-wrap" style="margin:0;background:#eef0f3;padding:28px 16px;` +
    `font-family:Arial,Helvetica,sans-serif;color:#26303f;">` +
    `<div style="max-width:640px;margin:0 auto;">` +
    header +
    `<div class="ff-body" style="background:#ffffff;border-radius:0 0 16px 16px;` +
    `padding:32px 32px 28px;font-size:15px;line-height:1.75;">${body}</div>` +
    footer +
    `</div>` +
    `</body></html>`
  );
}

/**
 * 🆕 Nom de marque d'un tunnel (published_content.meta.businessName), pour la
 * bannière du gabarit. Best-effort : null si absent/introuvable, jamais bloquant.
 */
export async function getFunnelBrandName(
  sb: SupabaseClient,
  funnelId?: string | null,
): Promise<string | null> {
  if (!funnelId) return null;
  try {
    const { data } = await sb
      .from("funnels")
      .select("published_content")
      .eq("id", funnelId)
      .maybeSingle();
    const meta = (data?.published_content as { meta?: { businessName?: string } } | null)?.meta;
    return meta?.businessName?.trim() || null;
  } catch {
    return null;
  }
}
