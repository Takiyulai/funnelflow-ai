"use client";

import type { Funnel, Language } from "@/lib/funnels/types";

type Props = {
  funnel: Funnel;
};

// ─────────────────────────────────────────────────────────────────────────────
// Traductions
// ─────────────────────────────────────────────────────────────────────────────
const I18N = {
  fr: {
    rights: "Tous droits réservés",
    legalFallback:
      "Ce site n'est pas affilié à Facebook, Google, ou toute autre plateforme tierce. Les résultats mentionnés ne sont pas garantis et peuvent varier selon votre engagement et votre situation personnelle.",
    contactLabel: "Contact",
    legal: "Mentions légales",
    privacy: "Politique de confidentialité",
    terms: "Conditions générales",
  },
  en: {
    rights: "All rights reserved",
    legalFallback:
      "This site is not affiliated with Facebook, Google, or any other third-party platform. Results mentioned are not guaranteed and may vary based on your engagement and personal situation.",
    contactLabel: "Contact",
    legal: "Legal notice",
    privacy: "Privacy policy",
    terms: "Terms of service",
  },
  es: {
    rights: "Todos los derechos reservados",
    legalFallback:
      "Este sitio no está afiliado a Facebook, Google ni a ninguna otra plataforma de terceros. Los resultados mencionados no están garantizados y pueden variar según su compromiso y situación personal.",
    contactLabel: "Contacto",
    legal: "Aviso legal",
    privacy: "Política de privacidad",
    terms: "Términos y condiciones",
  },
} as const;

export default function FunnelFooter({ funnel }: Props) {
  const lang: Language = (funnel.language as Language) || "fr";
  const t = I18N[lang] ?? I18N.fr;

  const meta = funnel.meta as
    | { businessName?: string; legalNotice?: string; contactEmail?: string }
    | undefined;

  // ─── Nom à afficher : cascade de fallbacks robuste ──────────────────────
  // 1. meta.businessName (peuplé par generate.ts depuis brief.brandName)
  // 2. header.brandName (si l'utilisateur l'a édité)
  // 3. extractBrandName(funnelName) (legacy)
  // 4. funnelName brut
  // 5. "—" (jamais "FunnelFlow" qui pollue les funnels client)
  const displayName =
    meta?.businessName?.trim() ||
    funnel.header?.brandName?.trim() ||
    extractBrandName(funnel.funnelName) ||
    funnel.funnelName?.trim() ||
    "—";

  // ─── Mention légale : meta > fallback générique traduit ─────────────────
  const legalNotice = meta?.legalNotice?.trim() || t.legalFallback;

  // ─── Email de contact : meta uniquement (pas de fallback inventé) ───────
  const contactEmail = meta?.contactEmail?.trim();

  const year = new Date().getFullYear();

  return (
    <footer
      className="ff-footer"
      style={{
        background: "var(--ff-brand-surface, var(--ff-ink, #0f172a))",
        color: "var(--ff-brand-on-surface, rgba(255,255,255,0.85))",
        padding: "2.5rem 1.5rem 1.75rem",
        fontSize: "0.8125rem",
        textAlign: "center",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          maxWidth: 920,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        {/* Nom de marque */}
        <div
          style={{
            fontWeight: 700,
            fontSize: "1rem",
            color: "#ffffff",
            letterSpacing: "0.01em",
          }}
        >
          {displayName}
        </div>

        {/* Mention légale (toujours affichée, fallback générique sinon) */}
        <div
          style={{
            opacity: 0.7,
            lineHeight: 1.5,
            maxWidth: 720,
            margin: "0 auto",
          }}
        >
          {legalNotice}
        </div>

        {/* Email de contact (uniquement si fourni) */}
        {contactEmail && (
          <div style={{ marginTop: "0.25rem" }}>
            <span style={{ opacity: 0.6, marginRight: "0.4rem" }}>
              {t.contactLabel} :
            </span>
            <a
              href={`mailto:${contactEmail}`}
              style={{
                color: "var(--ff-accent, #C7A436)",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              {contactEmail}
            </a>
          </div>
        )}

        {/* Copyright */}
        <div
          style={{
            opacity: 0.5,
            fontSize: "0.75rem",
            marginTop: "0.75rem",
            paddingTop: "0.875rem",
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          © {year} {displayName} — {t.rights}
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractBrandName(fullName: string | undefined): string {
  if (!fullName) return "";
  const separators = [" - ", " – ", " — ", " | ", " : "];
  for (const sep of separators) {
    const idx = fullName.indexOf(sep);
    if (idx > 0) return fullName.slice(0, idx).trim();
  }
  return fullName.trim();
}
