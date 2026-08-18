// lib/platform/emails.ts
//
// 🆕 Emails TRANSACTIONNELS DE LA PLATEFORME (compte utilisateur AutoFunnel) —
// distincts des emails de tunnel (lib/crm/email.ts) et de rendez-vous
// (lib/booking/emails.ts).
//
// ── POURQUOI UN MODULE SÉPARÉ ───────────────────────────────────────────────
// Ces trois familles n'ont ni le même expéditeur, ni les mêmes règles :
//   • tunnel   → expéditeur = nom du business du créateur (businessSender) ;
//   • RDV      → expéditeur système, contenu piloté par l'hôte ;
//   • plateforme → expéditeur système, contenu piloté par NOUS.
// Les mélanger conduirait tôt ou tard à envoyer un message AutoFunnel au nom
// d'un client, ou l'inverse.
//
// ── CE QU'IL RÉUTILISE ──────────────────────────────────────────────────────
// Le client Resend et la résolution d'expéditeur EXISTANTS
// (lib/email/resend.ts, lib/email/sender.ts). Aucune clé relue à la main,
// aucune adresse en dur : `getSystemSender()` lit RESEND_FROM_EMAIL et
// RESEND_FROM_NAME, avec repli sur l'ancienne variable combinée RESEND_FROM.
//
// ⚠️ Ce module NE TOUCHE PAS au flux booking. Il n'importe rien de
// lib/booking/* et n'est importé par aucun de ses fichiers.

import "server-only";
import { createResendClient } from "@/lib/email/resend";
import { getSystemSender } from "@/lib/email/sender";

export interface WelcomeEmailRecipient {
  email: string;
  name?: string | null;
}

export type SendResult =
  | { ok: true; id?: string }
  | { ok: false; reason: "not_configured" | "send_failed"; message: string };

/** Prénom exploitable, ou rien. Un « Bonjour undefined » est pire que rien. */
function firstName(name?: string | null): string | null {
  const clean = (name ?? "").trim();
  if (!clean) return null;
  return clean.split(/\s+/)[0] ?? null;
}

/**
 * Masque une adresse pour les journaux : `dramane@gmail.com` → `d••••e@gmail.com`.
 *
 * On garde la première et la dernière lettre de la partie locale, plus le
 * domaine entier. C'est assez pour reconnaître un compte pendant un diagnostic,
 * et insuffisant pour reconstituer l'adresse depuis un export de logs.
 */
function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return `${local[0]}•${domain}`;
  return `${local[0]}${"•".repeat(Math.min(local.length - 2, 6))}${local.at(-1)}${domain}`;
}

/** Échappe le HTML : un nom contenant « <script> » ne doit pas s'exécuter. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
    "https://autofunnelai.cloud"
  );
}

function buildWelcomeHtml(recipient: WelcomeEmailRecipient): string {
  const prenom = firstName(recipient.name);
  const hello = prenom ? `Bienvenue ${esc(prenom)},` : "Bienvenue,";
  const dashboard = `${appUrl()}/dashboard`;

  // HTML volontairement simple : tables et styles inline. Les clients mail
  // ignorent les feuilles de style externes et une bonne partie du CSS moderne.
  // 🆕 Largeur utile : même correctif que lib/booking/emails.ts et
  // lib/crm/emailRender.ts. Les marges cumulées (32 px du conteneur + 64 px de
  // padding intérieur) ne laissaient que 264 px de texte sur un écran de
  // 360 px. `ff-pad` ne touche QUE le padding horizontal en petite largeur :
  // écrire la propriété `padding` complète dans la media query écraserait
  // aussi les valeurs verticales, qui diffèrent d'une cellule à l'autre.
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
@media only screen and (max-width:600px){
  .ff-wrap{padding-left:10px !important;padding-right:10px !important}
  .ff-pad{padding-left:18px !important;padding-right:18px !important}
}
</style></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ff-wrap" style="background:#f4f5f7;padding:28px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(8,14,26,.08);">
        <tr>
          <td class="ff-pad" style="padding:28px 32px 8px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8A6F1F;">AutoFunnel AI</p>
            <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#080E1A;">${hello}</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569;">
              Ton compte est actif. Tu peux dès maintenant décrire ton offre et laisser l'IA construire ton tunnel complet : pages, textes, formulaire de capture et emails de relance.
            </p>
          </td>
        </tr>
        <tr>
          <td class="ff-pad" style="padding:0 32px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr><td style="background:#C7A436;border-radius:10px;">
                <a href="${dashboard}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#0B2B5E;text-decoration:none;">Créer mon premier tunnel</a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="ff-pad" style="padding:20px 32px 28px;">
            <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#080E1A;">Pour bien démarrer</p>
            <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#475569;">1. Décris ton offre en quelques phrases — plus c'est précis, meilleur est le copy.</p>
            <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#475569;">2. Publie ton tunnel en un clic, il est en ligne immédiatement.</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">3. Branche ton formulaire : les leads arrivent dans ton CRM intégré.</p>
          </td>
        </tr>
        <tr>
          <td class="ff-pad" style="padding:0 32px 28px;">
            <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
              Une question ? Réponds simplement à ce message.
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;">© ${new Date().getFullYear()} AutoFunnel AI</p>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildWelcomeText(recipient: WelcomeEmailRecipient): string {
  const prenom = firstName(recipient.name);
  return [
    prenom ? `Bienvenue ${prenom},` : "Bienvenue,",
    "",
    "Ton compte AutoFunnel AI est actif. Décris ton offre, et l'IA construit ton tunnel complet : pages, textes, formulaire de capture et emails de relance.",
    "",
    `Créer ton premier tunnel : ${appUrl()}/dashboard`,
    "",
    "Pour bien démarrer :",
    "1. Décris ton offre en quelques phrases — plus c'est précis, meilleur est le copy.",
    "2. Publie ton tunnel en un clic.",
    "3. Branche ton formulaire : les leads arrivent dans ton CRM intégré.",
    "",
    "Une question ? Réponds simplement à ce message.",
  ].join("\n");
}

/**
 * Envoie l'email de bienvenue.
 *
 * ⚠️ NE LÈVE JAMAIS. L'appelant est un chemin d'inscription : un incident
 * Resend ne doit sous aucun prétexte empêcher quelqu'un d'utiliser son compte.
 * Le résultat est renvoyé pour que l'appelant décide de poser ou non le
 * marqueur anti-doublon — poser le verrou après un échec priverait
 * définitivement l'utilisateur de son message.
 *
 * Email TRANSACTIONNEL : pas de lien de désinscription, il ne relève pas du
 * consentement marketing.
 */
export async function sendWelcomeEmail(
  recipient: WelcomeEmailRecipient,
): Promise<SendResult> {
  if (!recipient?.email?.includes("@")) {
    return { ok: false, reason: "send_failed", message: "Adresse invalide." };
  }

  // Absence de clé : cas NORMAL en développement. On le distingue d'un échec
  // d'envoi pour ne pas polluer les logs de production avec de fausses alertes.
  if (!process.env.RESEND_API_KEY) {
    console.warn("[welcome-email] ⚠️ RESEND_API_KEY absente — envoi ignoré.");
    return { ok: false, reason: "not_configured", message: "RESEND_API_KEY absente." };
  }

  try {
    const resend = createResendClient();
    const { from } = getSystemSender();

    const { data, error } = await resend.emails.send({
      from,
      to: recipient.email,
      subject: "Bienvenue sur AutoFunnel AI",
      html: buildWelcomeHtml(recipient),
      text: buildWelcomeText(recipient),
    });

    if (error) {
      console.error("[welcome-email] ❌ Resend a refusé l'envoi :", error);
      return { ok: false, reason: "send_failed", message: String(error.message ?? error) };
    }

    // 🔒 AUDIT 18/08/2026 — l'adresse complète n'est plus journalisée.
    //
    // Les logs Vercel sont conservés, consultables par toute l'équipe et
    // exportables : une adresse email y est une donnée personnelle qui n'a
    // aucune raison d'y séjourner. L'identifiant Resend suffit pour retrouver
    // un envoi précis dans leur tableau de bord, et le masque garde ce qu'un
    // diagnostic demande réellement — reconnaître de quel compte il s'agit.
    console.log(
      `[welcome-email] ✅ Envoyé à ${maskEmail(recipient.email)} (id: ${data?.id ?? "?"})`,
    );
    return { ok: true, id: data?.id };
  } catch (e) {
    console.error("[welcome-email] ❌ Exception pendant l'envoi :", e);
    return {
      ok: false,
      reason: "send_failed",
      message: e instanceof Error ? e.message : "unknown",
    };
  }
}
