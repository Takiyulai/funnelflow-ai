"use client";

import { useMemo, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import type { Funnel, FunnelPage, Language } from "@/lib/funnels/types";
import { extractSlugsFromPath } from "@/lib/funnels/nextDestination";

type FooterVariant =
  | "footer-minimal-centered"
  | "footer-grid-sitemap"
  | "footer-cta-newsletter";

type Props = {
  funnel: Funnel;
};

// Traductions
const I18N = {
  fr: {
    rights: "Tous droits réservés",
    legalFallback:
      "Ce site n'est pas affilié à Facebook, Google, ou toute autre plateforme tierce. Les résultats mentionnés ne sont pas garantis et peuvent varier selon votre engagement et votre situation personnelle.",
    contactLabel: "Contact",
    nav: "Navigation",
    newsletterTitle: "Reste informé",
    newsletterSubtitle:
      "Reçois nos meilleurs conseils et nos nouveautés directement par email.",
    emailPlaceholder: "Votre adresse email",
    subscribe: "Je m'inscris",
    subscribing: "Envoi…",
    successMsg: "Merci ! Votre inscription est confirmée.",
    errorMsg: "Une erreur est survenue. Réessayez dans un instant.",
    emailRequired: "Veuillez renseigner votre adresse email.",
    previewMsg: "Merci ! (aperçu — aucune donnée envoyée)",
  },
  en: {
    rights: "All rights reserved",
    legalFallback:
      "This site is not affiliated with Facebook, Google, or any other third-party platform. Results mentioned are not guaranteed and may vary based on your engagement and personal situation.",
    contactLabel: "Contact",
    nav: "Navigation",
    newsletterTitle: "Stay in the loop",
    newsletterSubtitle:
      "Get our best tips and latest updates straight to your inbox.",
    emailPlaceholder: "Your email address",
    subscribe: "Subscribe",
    subscribing: "Sending…",
    successMsg: "Thanks! Your subscription is confirmed.",
    errorMsg: "Something went wrong. Please try again.",
    emailRequired: "Please enter your email address.",
    previewMsg: "Thanks! (preview — no data sent)",
  },
  es: {
    rights: "Todos los derechos reservados",
    legalFallback:
      "Este sitio no está afiliado a Facebook, Google ni a ninguna otra plataforma de terceros. Los resultados mencionados no están garantizados y pueden variar según su compromiso y situación personal.",
    contactLabel: "Contacto",
    nav: "Navegación",
    newsletterTitle: "Mantente al día",
    newsletterSubtitle:
      "Recibe nuestros mejores consejos y novedades directamente en tu correo.",
    emailPlaceholder: "Tu correo electrónico",
    subscribe: "Suscribirme",
    subscribing: "Enviando…",
    successMsg: "¡Gracias! Tu suscripción está confirmada.",
    errorMsg: "Ocurrió un error. Inténtalo de nuevo.",
    emailRequired: "Por favor ingresa tu correo electrónico.",
    previewMsg: "¡Gracias! (vista previa — no se envió nada)",
  },
} as const;

type Strings = (typeof I18N)[keyof typeof I18N];

// Composant principal : sélection de variante
export default function FunnelFooter({ funnel }: Props) {
  const lang: Language = (funnel.language as Language) || "fr";
  const t = I18N[lang] ?? I18N.fr;

  const meta = funnel.meta as
    | {
        businessName?: string;
        legalNotice?: string;
        contactEmail?: string;
        footerVariant?: string;
      }
    | undefined;

  const displayName =
    meta?.businessName?.trim() ||
    funnel.header?.brandName?.trim() ||
    extractBrandName(funnel.funnelName) ||
    funnel.funnelName?.trim() ||
    "—";

  const legalNotice = meta?.legalNotice?.trim() || t.legalFallback;
  const contactEmail = meta?.contactEmail?.trim();
  const year = new Date().getFullYear();

  const variant = normalizeVariant(meta?.footerVariant);
  const shared = { displayName, legalNotice, contactEmail, year, t };

  if (variant === "footer-grid-sitemap") {
    return <FooterSitemap funnel={funnel} {...shared} />;
  }
  if (variant === "footer-cta-newsletter") {
    return <FooterNewsletter {...shared} />;
  }
  return <FooterMinimal {...shared} />;
}

function normalizeVariant(v: string | undefined): FooterVariant {
  if (v === "footer-grid-sitemap" || v === "footer-cta-newsletter") return v;
  return "footer-minimal-centered";
}

// Styles partagés
const footerBase = {
  background: "var(--ff-brand-surface, var(--ff-ink, #0f172a))",
  color: "var(--ff-brand-on-surface, rgba(255,255,255,0.85))",
  borderTop: "1px solid rgba(255,255,255,0.08)",
} as const;

type SharedProps = {
  displayName: string;
  legalNotice: string;
  contactEmail?: string;
  year: number;
  t: Strings;
};

function BrandName({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontWeight: 700, fontSize: "1rem", color: "#ffffff", letterSpacing: "0.01em" }}>
      {children}
    </div>
  );
}

function Copyright({ displayName, year, t }: { displayName: string; year: number; t: Strings }) {
  return (
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
  );
}

function ContactLine({ contactEmail, t }: { contactEmail: string; t: Strings }) {
  return (
    <div style={{ marginTop: "0.25rem" }}>
      <span style={{ opacity: 0.6, marginRight: "0.4rem" }}>{t.contactLabel} :</span>
      <a
        href={`mailto:${contactEmail}`}
        style={{ color: "var(--ff-accent, #C7A436)", textDecoration: "none", fontWeight: 500 }}
      >
        {contactEmail}
      </a>
    </div>
  );
}

// Variante 1 : minimal centré (comportement historique — défaut)
function FooterMinimal({ displayName, legalNotice, contactEmail, year, t }: SharedProps) {
  return (
    <footer
      className="ff-footer"
      style={{ ...footerBase, padding: "2.5rem 1.5rem 1.75rem", fontSize: "0.8125rem", textAlign: "center" }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <BrandName>{displayName}</BrandName>
        <div style={{ opacity: 0.7, lineHeight: 1.5, maxWidth: 720, margin: "0 auto" }}>{legalNotice}</div>
        {contactEmail && <ContactLine contactEmail={contactEmail} t={t} />}
        <Copyright displayName={displayName} year={year} t={t} />
      </div>
    </footer>
  );
}

// Variante 2 : grille sitemap (navigation vers les pages du tunnel)
function FooterSitemap({
  funnel,
  displayName,
  legalNotice,
  contactEmail,
  year,
  t,
}: SharedProps & { funnel: Funnel }) {
  const pathname = usePathname();
  const { funnelSlug } = useMemo(() => extractSlugsFromPath(pathname), [pathname]);

  const pages: FunnelPage[] = Array.isArray(funnel.pages)
    ? funnel.pages.filter((p) => p.visible !== false)
    : [];

  const pageHref = (p: FunnelPage): string | null => {
    if (!funnelSlug) return null;
    return p.isHome ? `/tunnel/${funnelSlug}` : `/tunnel/${funnelSlug}/${p.slug}`;
  };

  const linkStyle: React.CSSProperties = {
    color: "var(--ff-brand-on-surface, rgba(255,255,255,0.75))",
    textDecoration: "none",
    fontSize: "0.8125rem",
    opacity: 0.75,
    lineHeight: 1.9,
  };

  return (
    <footer className="ff-footer" style={{ ...footerBase, padding: "3rem 1.5rem 1.75rem", fontSize: "0.8125rem" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div
          className="ff-footer-grid"
          style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr", gap: "2rem", alignItems: "start" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <BrandName>{displayName}</BrandName>
            <div style={{ opacity: 0.7, lineHeight: 1.5, maxWidth: 420 }}>{legalNotice}</div>
          </div>

          {pages.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <FooterColTitle>{t.nav}</FooterColTitle>
              {pages.map((p) => {
                const href = pageHref(p);
                return href ? (
                  <a key={p.id} href={href} style={linkStyle}>
                    {p.name || p.slug}
                  </a>
                ) : (
                  <span key={p.id} style={linkStyle}>
                    {p.name || p.slug}
                  </span>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column" }}>
            <FooterColTitle>{t.contactLabel}</FooterColTitle>
            {contactEmail ? (
              <a href={`mailto:${contactEmail}`} style={{ ...linkStyle, color: "var(--ff-accent, #C7A436)", opacity: 1 }}>
                {contactEmail}
              </a>
            ) : (
              <span style={linkStyle}>—</span>
            )}
          </div>
        </div>

        <Copyright displayName={displayName} year={year} t={t} />
      </div>
    </footer>
  );
}

function FooterColTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: "#ffffff",
        fontWeight: 600,
        fontSize: "0.8125rem",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        opacity: 0.9,
        marginBottom: "0.6rem",
      }}
    >
      {children}
    </div>
  );
}

// Variante 3 : bloc newsletter (capture email) + minimal en dessous
type NlState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function FooterNewsletter({ displayName, legalNotice, contactEmail, year, t }: SharedProps) {
  const pathname = usePathname();
  const { funnelSlug, pageSlug } = useMemo(() => extractSlugsFromPath(pathname), [pathname]);
  const isPreview = !funnelSlug;

  const [email, setEmail] = useState("");
  const [state, setState] = useState<NlState>({ kind: "idle" });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "submitting" || state.kind === "success") return;

    const value = email.trim();
    if (!value) {
      setState({ kind: "error", message: t.emailRequired });
      return;
    }

    if (isPreview) {
      setState({ kind: "success", message: t.previewMsg });
      return;
    }

    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          funnelSlug,
          pageSlug: pageSlug || null,
          sectionId: null,
          email: value,
          name: null,
          phone: null,
          consent: false,
          metadata: { source: "footer-newsletter" },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setState({ kind: "error", message: t.errorMsg });
        return;
      }
      setState({ kind: "success", message: t.successMsg });
      setEmail("");
    } catch {
      setState({ kind: "error", message: t.errorMsg });
    }
  }

  const submitting = state.kind === "submitting";
  const done = state.kind === "success";

  return (
    <footer className="ff-footer" style={{ ...footerBase, padding: "3rem 1.5rem 1.75rem", fontSize: "0.8125rem" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontWeight: 700, fontSize: "1.25rem", color: "#ffffff" }}>{t.newsletterTitle}</div>
          <p style={{ opacity: 0.72, lineHeight: 1.55, marginTop: "0.5rem", maxWidth: 460, marginInline: "auto" }}>
            {t.newsletterSubtitle}
          </p>

          {done ? (
            <div role="status" style={{ marginTop: "1.25rem", color: "var(--ff-accent, #C7A436)", fontWeight: 600 }}>
              {state.message}
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              style={{
                marginTop: "1.25rem",
                display: "flex",
                gap: "0.5rem",
                maxWidth: 440,
                marginInline: "auto",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                aria-label={t.emailPlaceholder}
                required
                disabled={submitting}
                style={{
                  flex: "1 1 240px",
                  minWidth: 0,
                  padding: "0.7rem 0.95rem",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#ffffff",
                  fontSize: "0.875rem",
                }}
              />
              <button
                type="submit"
                disabled={submitting}
                className="ff-btn"
                style={{
                  padding: "0.7rem 1.4rem",
                  borderRadius: 10,
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  cursor: submitting ? "default" : "pointer",
                  background: "var(--ff-accent, #C7A436)",
                  color: "var(--ff-on-accent, #0f172a)",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? t.subscribing : t.subscribe}
              </button>
            </form>
          )}

          {state.kind === "error" && (
            <div role="alert" style={{ marginTop: "0.75rem", color: "#ff9d9d", fontSize: "0.8125rem" }}>
              {state.message}
            </div>
          )}
        </div>

        <div
          style={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <BrandName>{displayName}</BrandName>
          <div style={{ opacity: 0.65, lineHeight: 1.5, maxWidth: 620, margin: "0 auto", fontSize: "0.75rem" }}>
            {legalNotice}
          </div>
          {contactEmail && <ContactLine contactEmail={contactEmail} t={t} />}
          <Copyright displayName={displayName} year={year} t={t} />
        </div>
      </div>
    </footer>
  );
}

// Helpers
function extractBrandName(fullName: string | undefined): string {
  if (!fullName) return "";
  const separators = [" - ", " – ", " — ", " | ", " : "];
  for (const sep of separators) {
    const idx = fullName.indexOf(sep);
    if (idx > 0) return fullName.slice(0, idx).trim();
  }
  return fullName.trim();
}
