// Comptes internes autorisés à tester toutes les fonctionnalités, même lorsque
// BILLING_ENFORCED est actif. Cette allowlist reste exclusivement côté serveur :
// l'identité provient de Supabase Auth, jamais d'une valeur envoyée par le client.

import { getSupabaseAdmin } from "@/lib/supabase/admin";

const BUILTIN_INTERNAL_TEST_EMAILS = [
  "takiyulai0dramane@gmail.com",
  "jwdemanou@gmail.com",
] as const;

function normalizeEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

/** Les adresses intégrées restent actives ; la variable permet d'en ajouter. */
export function internalTestAccountEmails(
  configuredEmails = process.env.INTERNAL_TEST_EMAILS ?? "",
): string[] {
  const configured = configuredEmails.split(",").map(normalizeEmail).filter(Boolean);
  return [...new Set([...BUILTIN_INTERNAL_TEST_EMAILS, ...configured])];
}

export function isInternalTestAccountEmail(
  email: string | null | undefined,
  configuredEmails?: string,
): boolean {
  const normalized = normalizeEmail(email);
  return !!normalized && internalTestAccountEmails(configuredEmails).includes(normalized);
}

/**
 * Vérification serveur d'un userId. Quand l'email authentifié est déjà connu,
 * il est passé par l'appelant pour éviter une seconde lecture Auth. Sinon, le
 * client admin récupère l'identité canonique : échec de lecture = aucun bypass.
 */
export async function isInternalTestAccount(
  userId: string,
  authenticatedEmail?: string | null,
): Promise<boolean> {
  if (authenticatedEmail !== undefined) {
    return isInternalTestAccountEmail(authenticatedEmail);
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) {
      console.error("[billing] lecture du compte test impossible", error);
      return false;
    }
    return isInternalTestAccountEmail(data.user?.email);
  } catch (error) {
    console.error("[billing] vérification du compte test impossible", error);
    return false;
  }
}
