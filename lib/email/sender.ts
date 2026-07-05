// lib/email/sender.ts
// 🆕 Résolution CENTRALISÉE de l'expéditeur Resend. AUCUNE adresse en dur :
// tout vient de l'environnement (RESEND_FROM_EMAIL / RESEND_FROM_NAME), avec
// compatibilité ascendante sur l'ancienne variable combinée RESEND_FROM
// (« Nom <email> »). Voir lib/email/userSender.ts pour la logique par utilisateur.

export type Sender = { from: string; replyTo?: string };

/** Parse "Nom <email>" → { name, email }. Tolérant (email seul, nom seul). */
export function parseFrom(raw?: string | null): { name?: string; email?: string } {
  if (!raw) return {};
  const m = raw.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  if (m) return { name: m[1]?.trim() || undefined, email: m[2].trim() };
  const t = raw.trim();
  return t.includes("@") ? { email: t } : { name: t || undefined };
}

/** Adresse expéditrice par défaut (domaine AutoFunnel), depuis l'env. */
export function defaultFromEmail(): string {
  const explicit = process.env.RESEND_FROM_EMAIL?.trim();
  if (explicit) return explicit;
  const legacy = parseFrom(process.env.RESEND_FROM).email;
  if (legacy) return legacy;
  // Dernier repli : domaine de TEST Resend (ne livre qu'à l'email du compte).
  // À remplacer en prod par un domaine vérifié via RESEND_FROM_EMAIL.
  return "onboarding@resend.dev";
}

/** Nom d'expéditeur par défaut (marque AutoFunnel), depuis l'env. */
export function defaultFromName(): string {
  return (
    process.env.RESEND_FROM_NAME?.trim() ||
    parseFrom(process.env.RESEND_FROM).name ||
    "AutoFunnel AI"
  );
}

/** Compose un "Nom <email>" propre (nettoie les caractères dangereux du nom). */
export function composeFrom(name: string | undefined, email: string): string {
  const safe = (name ?? "").replace(/[<>"\r\n]/g, "").trim();
  return safe ? `${safe} <${email}>` : email;
}

/**
 * Expéditeur des emails SYSTÈME AutoFunnel (confirmation, notifications…) :
 * TOUJOURS le domaine AutoFunnel. Aucune personnalisation utilisateur.
 */
export function getSystemSender(): Sender {
  return { from: composeFrom(defaultFromName(), defaultFromEmail()) };
}

/**
 * 🆕 Expéditeur « business » : nom du BUSINESS DU TUNNEL (meta.businessName)
 * sur le domaine AutoFunnel vérifié — SANS suffixe « via AutoFunnel ».
 * FROM = "<Nom du business> <noreply@autofunnelai.cloud>", reply-to = email du
 * créateur. Fallback : nom par défaut (AutoFunnel AI) si le nom est vide.
 */
export function businessSender(businessName?: string | null, replyTo?: string): Sender {
  const name = (businessName ?? "").trim() || defaultFromName();
  return {
    from: composeFrom(name, defaultFromEmail()),
    ...(replyTo ? { replyTo } : {}),
  };
}
