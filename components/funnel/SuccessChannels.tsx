"use client";

// 🆕 Bloc « Rejoins-nous » des pages de SUCCÈS (merci/confirmation/livraison) :
// boutons WhatsApp + Telegram (canaux communautaires du créateur) et CTA
// optionnel vers une autre destination. Configuré dans Style global →
// funnel.meta.socialChannels. Rien ne s'affiche si aucun lien n'est renseigné.

import type { Funnel } from "@/lib/funnels/types";

function normalizeUrl(u?: string): string | null {
  const v = (u ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

export function SuccessChannels({
  funnel,
  nextHref,
  nextLabel,
}: {
  funnel: Funnel;
  /** 🆕 Étape suivante du tunnel (page après celle-ci), si elle existe. */
  nextHref?: string;
  nextLabel?: string;
}) {
  const sc = funnel.meta?.socialChannels;
  const whatsapp = normalizeUrl(sc?.whatsapp);
  const telegram = normalizeUrl(sc?.telegram);
  const ctaUrl = normalizeUrl(sc?.ctaUrl);
  const ctaLabel = sc?.ctaLabel?.trim();
  const hasNext = Boolean(nextHref && nextLabel);

  if (!whatsapp && !telegram && !(ctaUrl && ctaLabel) && !hasNext) return null;

  const lang = funnel.language ?? "fr";
  const title =
    lang === "en"
      ? "Join the community"
      : lang === "es"
        ? "Únete a la comunidad"
        : "Rejoins la communauté";

  const btnBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "13px 26px",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 15,
    textDecoration: "none",
    color: "#fff",
    minWidth: 220,
  };

  return (
    <section
      data-ff-section="success-channels"
      className="ff-section"
      style={{ padding: "8px 24px 56px", textAlign: "center" }}
    >
      {(whatsapp || telegram) && (
        <div
          style={{
            fontSize: 13,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            fontWeight: 700,
            opacity: 0.65,
            marginBottom: 16,
          }}
        >
          {title}
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 12,
        }}
      >
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...btnBase, background: "#25D366", boxShadow: "0 8px 22px rgba(37,211,102,.35)" }}
          >
            <svg viewBox="0 0 32 32" width="20" height="20" fill="#fff" aria-hidden="true">
              <path d="M16.003 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.26.6 4.46 1.73 6.4L3.2 28.8l6.57-1.72a12.74 12.74 0 0 0 6.23 1.6h.01c7.06 0 12.8-5.74 12.8-12.8s-5.74-12.8-12.8-12.8zm5.84 15.07c-.27.75-1.56 1.44-2.17 1.53-.55.08-1.24.11-2.01-.13a18.5 18.5 0 0 1-1.82-.68c-3.21-1.38-5.3-4.61-5.46-4.82-.16-.21-1.3-1.72-1.3-3.29 0-1.57.82-2.34 1.11-2.66.29-.32.64-.4.85-.4l.61.01c.2.01.46-.07.72.55.27.64.91 2.22.99 2.38.08.16.14.35.03.56-.11.21-.16.34-.32.53-.16.19-.34.42-.48.56-.16.16-.33.33-.14.65.19.32.83 1.36 1.78 2.21 1.22 1.09 2.25 1.43 2.57 1.59.32.16.5.13.69-.08.19-.21.8-.93 1.01-1.25.22-.32.43-.27.72-.16.29.1 1.87.88 2.19 1.04.32.16.53.24.61.37.08.14.08.78-.19 1.53z" />
            </svg>
            WhatsApp
          </a>
        )}
        {telegram && (
          <a
            href={telegram}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...btnBase, background: "#229ED9", boxShadow: "0 8px 22px rgba(34,158,217,.35)" }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff" aria-hidden="true">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            Telegram
          </a>
        )}
      </div>
      {ctaUrl && ctaLabel && (
        <div style={{ marginTop: 18 }}>
          <a
            href={ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ff-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "13px 30px",
              borderRadius: "var(--ff-btn-radius, 12px)",
              background: "var(--ff-btn-bg, #111827)",
              color: "var(--ff-btn-ink, #fff)",
              boxShadow: "var(--ff-btn-shadow, none)",
              fontWeight: 700,
              fontSize: 15,
              textDecoration: "none",
            }}
          >
            {ctaLabel}
            <span aria-hidden className="sk-cta-arrow">→</span>
          </a>
        </div>
      )}
      {/* 🆕 CTA "étape suivante" : n'apparaît QUE si une page suit réellement
          celle-ci dans le tunnel (calculé par l'appelant, jamais fabriqué). */}
      {hasNext && (
        <div style={{ marginTop: 18 }}>
          <a
            href={nextHref}
            className="ff-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "13px 30px",
              borderRadius: "var(--ff-btn-radius, 12px)",
              background: "var(--ff-btn-bg, #111827)",
              color: "var(--ff-btn-ink, #fff)",
              boxShadow: "var(--ff-btn-shadow, none)",
              fontWeight: 700,
              fontSize: 15,
              textDecoration: "none",
            }}
          >
            {nextLabel}
            <span aria-hidden className="sk-cta-arrow">→</span>
          </a>
        </div>
      )}
    </section>
  );
}

export default SuccessChannels;
