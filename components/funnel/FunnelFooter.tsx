"use client";

import type { Funnel } from "@/lib/funnels/types";

type Props = {
  funnel: Funnel;
};

export default function FunnelFooter({ funnel }: Props) {
  const meta = funnel.meta as
    | { businessName?: string; legalNotice?: string; contactEmail?: string }
    | undefined;

  const businessName = meta?.businessName?.trim();
  const legalNotice = meta?.legalNotice?.trim();
  const contactEmail = meta?.contactEmail?.trim();
  const year = new Date().getFullYear();

  // Nom à afficher : business name > nom de marque extrait > nom du funnel
  const displayName =
    businessName ||
    extractBrandName(funnel.funnelName) ||
    "FunnelFlow";

  return (
    <footer
      className="ff-footer"
      style={{
        // Même fond sombre que la brand bar (header)
        background: "var(--ff-brand-surface, var(--ff-ink, #0f172a))",
        color: "var(--ff-brand-on-surface, rgba(255,255,255,0.85))",
        padding: "2rem 1.5rem",
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
          gap: "0.5rem",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#ffffff" }}>
          {displayName}
        </div>

        {legalNotice && (
          <div style={{ opacity: 0.7, lineHeight: 1.5 }}>{legalNotice}</div>
        )}

        {contactEmail && (
          <div>
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

        <div
          style={{
            opacity: 0.5,
            fontSize: "0.75rem",
            marginTop: "0.5rem",
            paddingTop: "0.75rem",
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          © {year} {displayName} — Tous droits réservés
        </div>
      </div>
    </footer>
  );
}

function extractBrandName(fullName: string): string {
  if (!fullName) return "";
  const separators = [" - ", " – ", " — ", " | ", " : "];
  for (const sep of separators) {
    const idx = fullName.indexOf(sep);
    if (idx > 0) return fullName.slice(0, idx).trim();
  }
  return fullName.trim();
}
