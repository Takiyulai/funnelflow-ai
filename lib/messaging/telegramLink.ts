// lib/messaging/telegramLink.ts
//
// 🆕 LIENS D'INVITATION TELEGRAM — la pièce qui manquait.
//
// LE PROBLÈME
// Un bot Telegram ne peut pas écrire à quelqu'un qui ne lui a jamais parlé.
// Ce n'est pas une limite qu'on contourne : c'est la protection anti-spam de
// Telegram, et elle est absolue. L'API n'expose AUCUN moyen de transformer un
// @pseudo ou un numéro en `chat_id` pour un utilisateur qui n'a pas démarré le
// bot. Un pseudo Telegram stocké dans le CRM ne permet donc rien.
//
// LA VRAIE SOLUTION : LE LIEN PROFOND SIGNÉ
// Telegram accepte `https://t.me/MonBot?start=PAYLOAD`. Quand le prospect
// clique et appuie sur « Démarrer », le bot reçoit `/start PAYLOAD`. On y met
// un jeton signé qui identifie le contact CRM : à cet instant précis, on obtient
// son `chat_id` ET on sait exactement à qui il appartient. La conversation est
// rattachée automatiquement, sans que le prospect ait à se présenter.
//
// CE QUE ÇA CHANGE VRAIMENT
// Une fois ce premier pas franchi, la restriction tombe DÉFINITIVEMENT :
// Telegram n'a AUCUNE fenêtre de 24 h (contrairement à WhatsApp) et aucun coût.
// On peut donc écrire à ce contact quand on veut, autant qu'on veut, y compris
// en envoi groupé. Le canal n'est fermé qu'à la prospection à froid.
//
// Le jeton est un HMAC sans état — même motif que les liens de désinscription
// (lib/crm/unsubscribe.ts) : rien à stocker, et un tiers ne peut pas fabriquer
// le lien d'un contact dont il ignore l'identifiant et le secret serveur.

import { createHmac } from "node:crypto";

/** Le payload `start` de Telegram est limité à 64 caractères (A-Z a-z 0-9 _ -). */
const MAX_PAYLOAD = 64;
const SIG_LEN = 16;

function secret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "ff-tg-secret";
}

function sign(contactId: string): string {
  return createHmac("sha256", secret())
    .update(`tg:${contactId}`)
    .digest("hex")
    .slice(0, SIG_LEN);
}

/**
 * Construit le payload `start` : `<contactId sans tirets>.<signature>`.
 * Un UUID sans tirets fait 32 caractères, plus un point et 16 de signature :
 * 49 au total, sous la limite des 64.
 */
export function buildStartPayload(contactId: string): string | null {
  const compact = contactId.replace(/-/g, "");
  if (!compact) return null;
  const payload = `${compact}.${sign(contactId)}`;
  return payload.length <= MAX_PAYLOAD ? payload : null;
}

/** Restaure un UUID à partir de sa forme compacte (32 caractères hexadécimaux). */
function expandUuid(compact: string): string | null {
  if (!/^[0-9a-f]{32}$/i.test(compact)) return null;
  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20),
  ].join("-");
}

/**
 * Vérifie un payload reçu via `/start` et renvoie l'id du contact.
 * `null` si le format est invalide ou la signature ne correspond pas — dans ce
 * cas la conversation est créée sans rattachement, jamais rattachée au hasard.
 */
export function parseStartPayload(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const [compact, sig] = payload.trim().split(".");
  if (!compact || !sig) return null;
  const contactId = expandUuid(compact);
  if (!contactId) return null;
  return sign(contactId) === sig ? contactId : null;
}

/**
 * Lien d'invitation PERSONNALISÉ pour un contact connu.
 * À placer dans les emails de séquence, sur la page de remerciement, ou dans la
 * fiche contact du CRM. C'est LUI qui permet de récupérer les prospects déjà
 * en base : ils cliquent depuis un email, et deviennent joignables sur Telegram.
 */
export function telegramInviteUrl(
  botUsername: string | null | undefined,
  contactId: string | null | undefined,
): string | null {
  if (!botUsername) return null;
  if (!contactId) return `https://t.me/${botUsername}`;
  const payload = buildStartPayload(contactId);
  return payload
    ? `https://t.me/${botUsername}?start=${payload}`
    : `https://t.me/${botUsername}`;
}
