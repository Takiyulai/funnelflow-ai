// lib/email/sendingDomain.ts
//
// 🆕 MODULE PREMIUM — Domaine d'envoi personnalisé.
//
// Permet à un utilisateur Pro/Agency d'envoyer ses emails marketing depuis SON
// domaine (contact@sa-marque.com) au lieu du domaine partagé d'AutoFunnel.
//
// CE QUE CE FICHIER FAIT — ET NE FAIT PAS. Il pilote le cycle de vie du
// domaine chez Resend (création, vérification, suppression) et reflète l'état
// dans `profiles`. Il ne touche PAS à l'envoi : `lib/email/userSender.ts` lit
// déjà `custom_email_status === 'verified'` et bascule tout seul. C'est
// justement pourquoi la fonctionnalité peut arriver sans refonte.
//
// POURQUOI LA DÉLIVRABILITÉ COMPTE ICI. Envoyer depuis un domaine non
// authentifié, c'est atterrir en spam. Resend impose SPF + DKIM ; DMARC est
// fortement recommandé. Tant que ces enregistrements ne sont pas publiés chez
// le registrar du client, le domaine reste 'pending' et on continue d'envoyer
// depuis le domaine partagé — jamais depuis une adresse non authentifiée.

import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type SendingDomainStatus = "none" | "pending" | "verified" | "failed";

/** Enregistrement DNS à publier chez le registrar du client. */
export type DnsRecord = {
  record: string;
  name: string;
  type: string;
  value: string;
  ttl?: string;
  priority?: number;
  status?: string;
};

export type SendingDomainState = {
  domain: string | null;
  /** Adresse complète d'expédition, ex. contact@sa-marque.com */
  fromEmail: string | null;
  status: SendingDomainStatus;
  records: DnsRecord[];
  checkedAt: string | null;
};

export const EMPTY_STATE: SendingDomainState = {
  domain: null,
  fromEmail: null,
  status: "none",
  records: [],
  checkedAt: null,
};

const PROFILE_COLS =
  "custom_email_domain, custom_email_from, custom_email_status, custom_email_domain_id, custom_email_records, custom_email_checked_at";

// Fournisseurs grand public : on ne peut pas publier d'enregistrement DNS sur
// un domaine qu'on ne possède pas. Resend refuserait de toute façon, mais un
// message clair ici évite à l'utilisateur d'attendre une vérification qui
// n'aboutira jamais.
const PUBLIC_PROVIDERS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.fr", "hotmail.com",
  "hotmail.fr", "outlook.com", "outlook.fr", "live.com", "live.fr",
  "icloud.com", "me.com", "aol.com", "gmx.com", "gmx.fr", "protonmail.com",
  "proton.me", "orange.fr", "free.fr", "sfr.fr", "laposte.net", "wanadoo.fr",
  "yandex.com", "mail.com", "zoho.com",
]);

/** Domaine valide : lettres/chiffres/tirets, au moins un point, pas de schéma. */
const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

/** Partie locale d'une adresse (avant le @), volontairement conservatrice. */
const LOCAL_PART_RE = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;

export class SendingDomainError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Nettoie une saisie utilisateur en nom de domaine. Tolère « https://www.x.com/ ». */
export function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "")
    .replace(/\.+$/, "");
}

export function assertValidDomain(domain: string): void {
  if (!domain) throw new SendingDomainError("domain_required", "Indiquez un domaine.");
  if (!DOMAIN_RE.test(domain)) {
    throw new SendingDomainError(
      "invalid_domain",
      "Domaine invalide. Attendu : quelque chose comme « ma-marque.com ».",
    );
  }
  if (PUBLIC_PROVIDERS.has(domain)) {
    throw new SendingDomainError(
      "public_provider",
      "Impossible d'utiliser une adresse Gmail, Outlook ou équivalente : il faut un domaine dont vous êtes propriétaire, pour pouvoir y publier les enregistrements DNS.",
    );
  }
}

export function assertValidLocalPart(localPart: string): void {
  if (!LOCAL_PART_RE.test(localPart)) {
    throw new SendingDomainError(
      "invalid_local_part",
      "La partie avant le @ ne peut contenir que lettres, chiffres, points, tirets et soulignés.",
    );
  }
}

function resendClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new SendingDomainError(
      "resend_not_configured",
      "L'envoi d'emails n'est pas configuré côté serveur (RESEND_API_KEY manquante).",
    );
  }
  return new Resend(key);
}

/** Traduit le statut Resend vers le nôtre. */
function mapResendStatus(raw: unknown): SendingDomainStatus {
  switch (raw) {
    case "verified":
      return "verified";
    case "failed":
      return "failed";
    // 'not_started', 'pending', 'temporary_failure' → tous « en attente » de
    // notre point de vue : l'utilisateur n'a rien de différent à faire, il doit
    // publier ses enregistrements et patienter.
    default:
      return "pending";
  }
}

function toRecords(raw: unknown): DnsRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      record: String(r.record ?? ""),
      name: String(r.name ?? ""),
      type: String(r.type ?? ""),
      value: String(r.value ?? ""),
      ttl: r.ttl !== undefined ? String(r.ttl) : undefined,
      priority: typeof r.priority === "number" ? r.priority : undefined,
      status: r.status !== undefined ? String(r.status) : undefined,
    }));
}

/** État courant du domaine d'envoi d'un utilisateur. */
export async function getSendingDomain(userId: string): Promise<SendingDomainState> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data || !data.custom_email_domain) return EMPTY_STATE;

  return {
    domain: (data.custom_email_domain as string) ?? null,
    fromEmail: (data.custom_email_from as string | null) ?? null,
    status: (data.custom_email_status as SendingDomainStatus) ?? "pending",
    records: toRecords(data.custom_email_records),
    checkedAt: (data.custom_email_checked_at as string | null) ?? null,
  };
}

/**
 * Déclare un nouveau domaine d'envoi et renvoie les enregistrements DNS à
 * publier. Le statut démarre à 'pending' : tant que la vérification n'a pas
 * abouti, l'envoi continue de passer par le domaine partagé.
 */
export async function createSendingDomain(
  userId: string,
  rawDomain: string,
  rawLocalPart: string,
): Promise<SendingDomainState> {
  const domain = normalizeDomain(rawDomain);
  assertValidDomain(domain);

  const localPart = (rawLocalPart || "contact").trim().toLowerCase();
  assertValidLocalPart(localPart);

  const admin = getSupabaseAdmin();

  // 🔒 Un domaine ne peut appartenir qu'à un seul compte : chez Resend, le nom
  // est unique pour toute l'organisation. Sans ce contrôle, le deuxième
  // utilisateur à tenter « client.com » recevrait une erreur d'API opaque.
  const { data: taken } = await admin
    .from("profiles")
    .select("user_id")
    .eq("custom_email_domain", domain)
    .neq("user_id", userId)
    .maybeSingle();
  if (taken) {
    throw new SendingDomainError(
      "domain_taken",
      "Ce domaine est déjà rattaché à un autre compte AutoFunnel.",
    );
  }

  // Un domaine déjà déclaré par CE compte est d'abord retiré, sinon Resend
  // refuse le doublon et on se retrouverait avec un identifiant orphelin.
  const current = await getSendingDomain(userId);
  if (current.domain && current.domain !== domain) {
    await removeSendingDomain(userId);
  }

  const resend = resendClient();
  const { data, error } = await resend.domains.create({ name: domain });

  if (error || !data) {
    throw new SendingDomainError(
      "resend_create_failed",
      error?.message || "Resend a refusé la création de ce domaine.",
    );
  }

  const records = toRecords((data as unknown as { records?: unknown }).records);
  const status = mapResendStatus((data as unknown as { status?: unknown }).status);

  await admin
    .from("profiles")
    .update({
      custom_email_domain: domain,
      custom_email_from: `${localPart}@${domain}`,
      custom_email_domain_id: data.id,
      custom_email_records: records,
      custom_email_status: status,
      custom_email_checked_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return {
    domain,
    fromEmail: `${localPart}@${domain}`,
    status,
    records,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Relance la vérification chez Resend et rafraîchit l'état local.
 *
 * On demande la vérification PUIS on relit : `verify` est asynchrone côté
 * Resend, la réponse ne porte pas le statut final. La lecture qui suit donne
 * l'état réel, y compris le détail par enregistrement (SPF ok, DKIM en
 * attente…), ce qui permet de dire à l'utilisateur CE QUI manque plutôt qu'un
 * « échec » sans explication.
 */
export async function refreshSendingDomain(userId: string): Promise<SendingDomainState> {
  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("user_id", userId)
    .maybeSingle();

  const domainId = profile?.custom_email_domain_id as string | null | undefined;
  if (!profile?.custom_email_domain || !domainId) return EMPTY_STATE;

  const resend = resendClient();

  // Un domaine déjà vérifié n'a pas besoin qu'on redemande une vérification :
  // on se contente de relire (Resend limite les appels à `verify`).
  if (profile.custom_email_status !== "verified") {
    await resend.domains.verify(domainId).catch(() => null);
  }

  const { data, error } = await resend.domains.get(domainId);
  if (error || !data) {
    throw new SendingDomainError(
      "resend_get_failed",
      error?.message || "Impossible de lire l'état du domaine chez Resend.",
    );
  }

  const records = toRecords((data as unknown as { records?: unknown }).records);
  const status = mapResendStatus((data as unknown as { status?: unknown }).status);
  const checkedAt = new Date().toISOString();

  await admin
    .from("profiles")
    .update({
      custom_email_status: status,
      custom_email_records: records,
      custom_email_checked_at: checkedAt,
    })
    .eq("user_id", userId);

  return {
    domain: profile.custom_email_domain as string,
    fromEmail: (profile.custom_email_from as string | null) ?? null,
    status,
    records,
    checkedAt,
  };
}

/**
 * Détache le domaine. L'envoi retombe immédiatement sur le domaine partagé
 * d'AutoFunnel — aucun email ne se retrouve sans expéditeur valide.
 */
export async function removeSendingDomain(userId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("custom_email_domain_id")
    .eq("user_id", userId)
    .maybeSingle();

  const domainId = profile?.custom_email_domain_id as string | null | undefined;
  if (domainId) {
    // Un échec de suppression côté Resend (domaine déjà retiré à la main) ne
    // doit pas empêcher de nettoyer notre base : sinon l'utilisateur reste
    // bloqué avec un domaine fantôme qu'il ne peut plus ni vérifier ni changer.
    try {
      const resend = resendClient();
      await resend.domains.remove(domainId);
    } catch (e) {
      console.error("[sendingDomain] suppression Resend échouée :", e);
    }
  }

  await admin
    .from("profiles")
    .update({
      custom_email_domain: null,
      custom_email_from: null,
      custom_email_domain_id: null,
      custom_email_records: null,
      custom_email_status: "none",
      custom_email_checked_at: null,
    })
    .eq("user_id", userId);
}

/** Met à jour la seule adresse d'expédition (sans retoucher au domaine). */
export async function updateSendingLocalPart(
  userId: string,
  rawLocalPart: string,
): Promise<SendingDomainState> {
  const localPart = rawLocalPart.trim().toLowerCase();
  assertValidLocalPart(localPart);

  const current = await getSendingDomain(userId);
  if (!current.domain) {
    throw new SendingDomainError("no_domain", "Aucun domaine d'envoi déclaré.");
  }

  const admin = getSupabaseAdmin();
  const fromEmail = `${localPart}@${current.domain}`;
  await admin
    .from("profiles")
    .update({ custom_email_from: fromEmail })
    .eq("user_id", userId);

  return { ...current, fromEmail };
}
