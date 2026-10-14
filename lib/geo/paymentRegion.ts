export type PaymentRegion = "africa" | "international";

// Codes ISO 3166-1 alpha-2 des 54 pays africains. La détection repose sur le
// pays fourni par l'infrastructure (Vercel/Cloudflare), sans demander la
// position précise de l'utilisateur ni conserver cette information.
const AFRICAN_COUNTRY_CODES = new Set([
  "AO", "BF", "BI", "BJ", "BW", "CD", "CF", "CG", "CI", "CM", "CV",
  "DJ", "DZ", "EG", "ER", "ET", "GA", "GH", "GM", "GN", "GQ", "GW",
  "KE", "KM", "LR", "LS", "LY", "MA", "MG", "ML", "MR", "MU", "MW",
  "MZ", "NA", "NE", "NG", "RW", "SC", "SD", "SL", "SN", "SO", "SS",
  "ST", "SZ", "TD", "TG", "TN", "TZ", "UG", "ZA", "ZM", "ZW",
]);

export function paymentRegionFromCountry(
  countryCode: string | null | undefined,
): PaymentRegion | null {
  const normalized = countryCode?.trim().toUpperCase();
  if (!normalized || !/^[A-Z]{2}$/.test(normalized) || normalized === "XX") {
    return null;
  }
  return AFRICAN_COUNTRY_CODES.has(normalized) ? "africa" : "international";
}
