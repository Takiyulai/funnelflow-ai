// lib/crm/emailRender.ts
// 🆕 Rendu HTML d'un email (personnalisation + gabarit). Partagé par les
// séquences (et réutilisable ailleurs). Les newsletters gardent leur propre
// rendu interne pour ne rien casser.

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

/** Convertit en corps HTML (laisse tel quel si déjà du HTML, sinon <p>/<br>). */
function toHtmlBody(text: string): string {
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Email complet (gabarit + personnalisation), prêt à envoyer via Resend. */
export function renderSequenceEmailHtml(content: string, r: EmailRecipient): string {
  const body = toHtmlBody(personalize(content, r));
  return (
    `<!doctype html><html><head><meta charset="utf-8" /></head>` +
    `<body style="margin:0;background:#f4f4f5;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#18181b;line-height:1.6;">` +
    `<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;">${body}</div>` +
    `</body></html>`
  );
}
