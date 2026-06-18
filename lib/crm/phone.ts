// lib/crm/phone.ts
// Helpers téléphone / WhatsApp : E.164 + pays ISO. Réutilisés par le CRM ET
// (à terme) par les formulaires de tunnel, pour rester cohérents.

/** Indicatifs des pays courants (extensible). ISO 3166-1 alpha-2 → dial code. */
const DIAL_CODES: Record<string, string> = {
  FR: "33", BE: "32", CH: "41", LU: "352", MC: "377",
  CA: "1", US: "1",
  CI: "225", SN: "221", CM: "237", BJ: "229", TG: "228", BF: "226",
  ML: "223", NE: "227", GN: "224", CD: "243", CG: "242", GA: "241",
  MA: "212", DZ: "213", TN: "216",
  GB: "44", ES: "34", DE: "49", IT: "39", PT: "351", NL: "31",
};

export type CountryOption = { iso: string; label: string; dial: string };

/** Liste affichable (sélecteur d'indicatif) — francophonie d'abord. */
export const COUNTRY_OPTIONS: CountryOption[] = [
  { iso: "FR", label: "France", dial: "33" },
  { iso: "BE", label: "Belgique", dial: "32" },
  { iso: "CH", label: "Suisse", dial: "41" },
  { iso: "CA", label: "Canada", dial: "1" },
  { iso: "CI", label: "Côte d’Ivoire", dial: "225" },
  { iso: "SN", label: "Sénégal", dial: "221" },
  { iso: "CM", label: "Cameroun", dial: "237" },
  { iso: "MA", label: "Maroc", dial: "212" },
  { iso: "DZ", label: "Algérie", dial: "213" },
  { iso: "TN", label: "Tunisie", dial: "216" },
  { iso: "CD", label: "RD Congo", dial: "243" },
  { iso: "BJ", label: "Bénin", dial: "229" },
  { iso: "TG", label: "Togo", dial: "228" },
  { iso: "BF", label: "Burkina Faso", dial: "226" },
  { iso: "ML", label: "Mali", dial: "223" },
  { iso: "GB", label: "Royaume-Uni", dial: "44" },
  { iso: "US", label: "États-Unis", dial: "1" },
  { iso: "ES", label: "Espagne", dial: "34" },
  { iso: "DE", label: "Allemagne", dial: "49" },
  { iso: "PT", label: "Portugal", dial: "351" },
];

export function dialCodeForCountry(iso?: string | null): string | null {
  if (!iso) return null;
  return DIAL_CODES[iso.toUpperCase()] ?? null;
}

/** Emoji drapeau à partir d'un code pays ISO (ex. "FR" → 🇫🇷). */
export function isoToFlag(iso?: string | null): string {
  if (!iso || iso.length !== 2) return "🏳️";
  const base = 0x1f1e6;
  const cps = [...iso.toUpperCase()].map((c) => base + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...cps);
}

/**
 * URL d'une image de drapeau (flagcdn.com) à partir d'un code pays ISO.
 * Les emoji drapeaux ne s'affichent pas sous Windows/Chrome : on utilise donc
 * de vraies images. `w` = largeur disponible chez flagcdn (20, 40, 80…).
 */
export function flagUrl(iso?: string | null, w: number = 20): string | null {
  if (!iso || iso.length !== 2) return null;
  return `https://flagcdn.com/w${w}/${iso.toLowerCase()}.png`;
}

/**
 * Normalise un numéro en E.164 (`+chiffres`) à partir d'un pays ISO optionnel.
 * - "+33 6 12…" → "+33612…"
 * - "0612345678" + FR → "+33612345678" (retrait du 0 national)
 * - "612345678" + FR → "+33612345678"
 */
export function normalizePhoneE164(
  raw?: string | null,
  countryIso?: string | null,
): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  if (s.startsWith("+")) {
    const digits = s.replace(/[^\d]/g, "");
    return digits ? `+${digits}` : null;
  }

  let digits = s.replace(/[^\d]/g, "");
  if (!digits) return null;

  const dial = dialCodeForCountry(countryIso);
  if (dial) {
    if (digits.startsWith("0")) digits = digits.slice(1);
    if (!digits.startsWith(dial)) digits = dial + digits;
    return `+${digits}`;
  }
  return `+${digits}`;
}

/** Lien wa.me cliquable (chiffres uniquement). */
export function waMeLink(phoneE164?: string | null): string | null {
  if (!phoneE164) return null;
  const digits = phoneE164.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}
