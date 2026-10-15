function normalizePublicUrl(value: string | null | undefined): string | null {
  const raw = value?.trim().replace(/\/+$/, "");
  if (!raw) return null;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    const host = url.hostname.toLowerCase();
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1"
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Résout l'adresse publique sans dépendre exclusivement d'une variable
 * manuelle. Vercel expose automatiquement ses domaines ; l'origine de la
 * requête sert de dernier repli pour les domaines personnalisés.
 */
export function resolvePublicAppUrl(requestUrl?: string): string | null {
  const explicit =
    normalizePublicUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizePublicUrl(process.env.APP_URL) ??
    normalizePublicUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (explicit) return explicit;

  const vercel =
    normalizePublicUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizePublicUrl(process.env.VERCEL_URL);
  if (vercel) return vercel;

  return normalizePublicUrl(requestUrl);
}
