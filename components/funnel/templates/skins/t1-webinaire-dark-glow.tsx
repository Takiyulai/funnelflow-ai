"use client";

// T1 — Webinaire Dark Glow (id template : "sharp-launch").
// Reproduction DATA-DRIVEN du design du zip Claude Design : mêmes visuels et
// animations (reveal, tilt, parallax, pulse, countdown, accordéon), mais
// alimentés par les sections réelles du tunnel (copy généré, 100% éditable).
// Aucun contenu de démo : chaque bloc ne s'affiche que si la donnée existe.

import type {
  FaqItem,
  PricingPlanItem,
  TestimonialItem,
  TimerItem,
} from "@/lib/funnels/types";
import { DEFAULT_TIMER_LABELS } from "@/lib/funnels/types";
import { getVideoEmbed } from "@/lib/funnels/video";
import { formatEventParts } from "@/lib/funnels/eventDate";
import { RichText } from "@/components/funnel/RichText";
import { CtaLink } from "@/components/funnel/CtaLink";
import { getIconByName } from "@/components/editor/IconPicker";
import {
  SkinSection,
  splitTitleDesc,
  initialsOf,
  firstTimer,
  timerTarget,
} from "./shared";
import type { SkinSectionProps, TemplateSkin } from "./types";

/* ─── Tokens (surchargés par funnel-theme.css / éditeur de couleurs) ────── */

const ACCENT = "var(--ff-accent, #FF2D78)";
const ACCENT2 = "var(--t1-accent2, #6C1BF2)";
const ACCENT_SOFT = "var(--t1-accent-soft, #FF7FA9)";
const GRAD = "var(--t1-grad, linear-gradient(100deg,#FF2D78,#6C1BF2))";
const GLASS_BG = "rgba(255,255,255,.05)";
const GLASS_BORDER = "1px solid rgba(255,255,255,.12)";
const CARD_BG = "rgba(255,255,255,.03)";
const CARD_BORDER = "1px solid rgba(255,255,255,.09)";

const CTA_BASE =
  "af-cta t1-cta inline-flex items-center gap-2 font-bold no-underline";

/* ─── Petits blocs réutilisés ──────────────────────────────────────────── */

function SectionHead({
  eyebrow,
  headline,
  subheadline,
  h = "h2",
}: {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  h?: "h2" | "h3";
}) {
  if (!eyebrow && !headline && !subheadline) return null;
  return (
    <div data-reveal style={{ textAlign: "center", marginBottom: 48 }}>
      {eyebrow && (
        <RichText
          as="div"
          text={eyebrow}
          className="t1-eyebrow"
        />
      )}
      {headline && (
        <RichText
          as={h}
          text={headline}
          className="t1-h2"
        />
      )}
      {subheadline && (
        <RichText
          as="p"
          text={subheadline}
          className="t1-sub"
        />
      )}
    </div>
  );
}

function SkinCta({
  section,
  funnel,
  page,
  pageLinks,
  slugLinks,
  block = false,
  className = "",
}: SkinSectionProps & { block?: boolean; className?: string }) {
  if (!section.cta?.label) return null;
  return (
    <CtaLink
      cta={section.cta}
      funnel={funnel}
      page={page}
      section={section}
      pageLinks={pageLinks}
      slugLinks={slugLinks}
      arrow
      baseClassName={`${CTA_BASE} ${block ? "t1-cta--block" : ""} ${className}`}
    />
  );
}

/* ─── HERO ─────────────────────────────────────────────────────────────── */

function T1Hero(props: SkinSectionProps) {
  const { section, funnel } = props;
  const brand =
    funnel.meta?.businessName || funnel.header?.brandName || funnel.funnelName;
  const embed = section.video?.url ? getVideoEmbed(section.video.url) : null;
  const imageUrl =
    section.image && section.image.mode !== "none" ? section.image.url : undefined;
  const hasMedia = !!embed?.embedUrl || !!imageUrl;
  const timer = firstTimer(section);
  // 🆕 Badge date via le helper STABLE (fuseau-indépendant) au lieu de getters
  // locaux (qui donnaient un jour/mois décalé côté serveur).
  const badgeParts =
    timer?.mode === "countdown-date" && timer.targetDate
      ? formatEventParts(timer.targetDate, funnel.language)
      : null;

  return (
    <SkinSection section={section} className="t1-hero">
      {/* Glow blobs d'ambiance (parallax) */}
      <div
        aria-hidden
        data-parallax="0.06"
        className="t1-blob"
        style={{
          top: -160,
          right: -140,
          background: `radial-gradient(circle, color-mix(in srgb, ${ACCENT} 50%, transparent), transparent 62%)`,
          animation: "hp-float-a 14s ease-in-out infinite",
        }}
      />
      <div
        aria-hidden
        data-parallax="0.09"
        className="t1-blob"
        style={{
          top: 420,
          left: -180,
          background: `radial-gradient(circle, color-mix(in srgb, ${ACCENT2} 50%, transparent), transparent 62%)`,
          animation: "hp-float-b 16s ease-in-out infinite",
        }}
      />

      <div style={{ textAlign: "center", position: "relative" }}>
        {/* 🆕 Badge ✓ des pages de succès */}
        {props.isSuccess && (
          <div data-reveal style={{ marginBottom: 18 }}>
            <span
              aria-hidden
              style={{
                display: "inline-flex",
                width: 72,
                height: 72,
                borderRadius: "50%",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 34,
                color: "#fff",
                background: GRAD,
                boxShadow: `0 0 0 8px color-mix(in srgb, ${ACCENT} 14%, transparent)`,
              }}
            >
              ✓
            </span>
          </div>
        )}
        {section.eyebrow && (
          <div
            data-reveal
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 30,
              background: `color-mix(in srgb, ${ACCENT} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${ACCENT} 35%, transparent)`,
              fontSize: 13,
              fontWeight: 600,
              color: ACCENT_SOFT,
              marginBottom: 26,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: ACCENT,
                boxShadow: `0 0 10px ${ACCENT}`,
              }}
            />
            <RichText as="span" text={section.eyebrow} />
          </div>
        )}

        {section.headline && (
          <div data-reveal data-delay="80">
            <RichText as="h1" text={section.headline} className="t1-h1" />
          </div>
        )}

        {section.subheadline && (
          <RichText as="p" text={section.subheadline} className="t1-hero-sub" />
        )}

        {section.body && (
          <RichText as="p" text={section.body} className="t1-hero-body" />
        )}

        {/* Média : vidéo ou image dans un cadre "navigateur" avec tilt */}
        {hasMedia && (
          <div
            style={{
              marginTop: 8,
              position: "relative",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div data-tilt style={{ width: "min(760px,100%)", perspective: 1000 }}>
              <div
                data-tilt-inner
                style={{
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,.12)",
                  background:
                    "linear-gradient(160deg,rgba(255,255,255,.06),rgba(255,255,255,.02))",
                  backdropFilter: "blur(10px)",
                  boxShadow: `0 40px 100px color-mix(in srgb, ${ACCENT2} 30%, transparent)`,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "12px 16px",
                    borderBottom: "1px solid rgba(255,255,255,.08)",
                  }}
                >
                  <span style={{ width: 11, height: 11, borderRadius: "50%", background: ACCENT }} />
                  <span style={{ width: 11, height: 11, borderRadius: "50%", background: ACCENT2 }} />
                  <span style={{ width: 11, height: 11, borderRadius: "50%", background: "rgba(255,255,255,.25)" }} />
                  <span
                    style={{
                      marginLeft: 12,
                      fontSize: 12,
                      color: "#7A7A7A",
                      fontFamily: "monospace",
                    }}
                  >
                    {brand ? `${brand.toLowerCase().replace(/\s+/g, "")} / live` : "live"}
                  </span>
                </div>
                {embed?.embedUrl ? (
                  <div style={{ aspectRatio: "16/9", background: "#000", position: "relative" }}>
                    <iframe
                      src={embed.embedUrl}
                      title="Vidéo"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
                    />
                  </div>
                ) : (
                  <img
                    src={imageUrl}
                    alt={section.image?.alt ?? ""}
                    style={{ display: "block", width: "100%", height: "auto" }}
                    loading="lazy"
                  />
                )}
              </div>
            </div>

            {/* Badge date flottant (uniquement si un timer daté existe) */}
            {badgeParts && (
              <div className="t1-date-badge">
                <div style={{ fontSize: 11, letterSpacing: ".12em", color: "#8A8A8A", textTransform: "uppercase" }}>
                  {badgeParts.weekday}
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
                  {badgeParts.day}
                </div>
                <div style={{ fontSize: 12, color: ACCENT_SOFT }}>
                  {badgeParts.month}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Puces du héros : liste centrée, checks accent */}
        {Array.isArray(section.bullets) && section.bullets.length > 0 && (
          <ul data-reveal className="t1-hero-bullets">
            {section.bullets.map((b, i) => (
              <li key={i}>
                <span style={{ color: ACCENT_SOFT }}>✓</span>
                <RichText as="span" text={b} />
              </li>
            ))}
          </ul>
        )}

        {(section.cta?.label || section.reassurance) && (
          <div
            data-reveal
            data-delay="120"
            style={{
              marginTop: hasMedia ? 44 : 34,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <SkinCta {...props} className="t1-cta--pulse" />
            {section.reassurance && (
              <RichText
                as="div"
                text={section.reassurance}
                className="t1-reassure"
              />
            )}
          </div>
        )}

      </div>
    </SkinSection>
  );
}

/* ─── URGENCY / COUNTDOWN ──────────────────────────────────────────────── */

function CountdownBlock({
  value,
  label,
  pulse,
}: {
  value: string;
  label: string;
  pulse?: boolean;
}) {
  const cdAttr: Record<string, string> = { [`data-cd-${value}`]: "" };
  return (
    <div
      style={{
        minWidth: 110,
        padding: 20,
        borderRadius: 16,
        background: "rgba(255,255,255,.04)",
        border: "1px solid rgba(255,255,255,.1)",
        animation: pulse ? "hp-pulse-ring 2.6s ease-out infinite" : undefined,
      }}
    >
      <div
        {...cdAttr}
        style={{
          fontSize: "clamp(38px, 6cqw, 60px)",
          fontWeight: 700,
          color: "#fff",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        00
      </div>
      <div
        style={{
          fontSize: 12,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: ACCENT2,
          marginTop: 8,
          filter: "brightness(1.6)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function T1Urgency(props: SkinSectionProps) {
  const { section, funnel } = props;
  const timer: TimerItem | undefined = firstTimer(section);
  const target = timerTarget(timer);
  const lang = (funnel.language ?? "fr") as keyof typeof DEFAULT_TIMER_LABELS;
  const L = DEFAULT_TIMER_LABELS[lang] ?? DEFAULT_TIMER_LABELS.fr;
  const labels = {
    d: timer?.labels?.days ?? L.days,
    h: timer?.labels?.hours ?? L.hours,
    m: timer?.labels?.minutes ?? L.minutes,
    s: timer?.labels?.seconds ?? L.seconds,
  };
  const showDays = timer?.showDays !== false;
  const title = timer?.label || section.headline || section.eyebrow;

  return (
    <SkinSection section={section} className="t1-pad-sm">
      <div
        data-reveal
        style={{
          background: `linear-gradient(120deg, color-mix(in srgb, ${ACCENT} 16%, #14090f), color-mix(in srgb, ${ACCENT2} 16%, #100a18))`,
          border: "1px solid rgba(255,255,255,.1)",
          borderRadius: 22,
          padding: "40px 28px",
          textAlign: "center",
        }}
      >
        {title && <RichText as="div" text={title} className="t1-eyebrow" />}
        <div
          data-cd
          data-cd-row=""
          {...(target ? { "data-target": target } : {})}
          style={{ display: "flex", justifyContent: "center", gap: 22, flexWrap: "wrap", marginTop: 22 }}
        >
          {showDays && <CountdownBlock value="d" label={labels.d} pulse />}
          <CountdownBlock value="h" label={labels.h} />
          <CountdownBlock value="m" label={labels.m} />
          <CountdownBlock value="s" label={labels.s} />
        </div>
        {(section.subheadline || section.body) && (
          <RichText
            as="p"
            text={section.subheadline || section.body}
            className="t1-sub"
          />
        )}
        {section.cta?.label && (
          <div style={{ marginTop: 26 }}>
            <SkinCta {...props} />
          </div>
        )}
      </div>
    </SkinSection>
  );
}

/* ─── QUALIFICATION (« Pour qui ») ─────────────────────────────────────── */

function T1Qualification(props: SkinSectionProps) {
  const { section } = props;
  const bullets = Array.isArray(section.bullets) ? section.bullets : [];
  return (
    <SkinSection section={section}>
      <SectionHead
        eyebrow={section.eyebrow}
        headline={section.headline}
        subheadline={section.subheadline}
      />
      {section.body && (
        <RichText as="p" text={section.body} className="t1-body" />
      )}
      {bullets.length > 0 && (
        <div className="t1-grid" data-t1-cols={Math.min(4, Math.max(2, bullets.length))}>
          {bullets.map((b, i) => {
            const split = splitTitleDesc(b);
            const Icon = getIconByName(
              (section.bulletIcons?.[i] as string) || section.iconName || "target",
            );
            const edge = i % 2 === 0 ? ACCENT : ACCENT2;
            return (
              <div key={i} data-reveal data-delay={String(i * 80)} data-tilt style={{ perspective: 900 }}>
                <div
                  data-tilt-inner
                  style={{
                    height: "100%",
                    background: GLASS_BG,
                    border: GLASS_BORDER,
                    borderLeft: `3px solid ${edge}`,
                    borderRadius: 16,
                    padding: 26,
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <Icon
                    aria-hidden
                    style={{ width: 26, height: 26, marginBottom: 14, color: edge }}
                  />
                  {split ? (
                    <>
                      <RichText as="h3" text={split.title} className="t1-card-title" />
                      <RichText as="p" text={split.description} className="t1-card-desc" />
                    </>
                  ) : (
                    <RichText as="p" text={b} className="t1-card-desc" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SkinSection>
  );
}

/* ─── PROCESS (étapes numérotées) ──────────────────────────────────────── */

function T1Process(props: SkinSectionProps) {
  const { section } = props;
  const bullets = Array.isArray(section.bullets) ? section.bullets : [];
  return (
    <SkinSection section={section}>
      <SectionHead
        eyebrow={section.eyebrow}
        headline={section.headline}
        subheadline={section.subheadline}
      />
      {section.body && <RichText as="p" text={section.body} className="t1-body" />}
      {bullets.length > 0 && (
        <div className="t1-grid" data-t1-cols={Math.min(3, Math.max(2, bullets.length))}>
          {bullets.map((b, i) => {
            const split = splitTitleDesc(b);
            return (
              <div
                key={i}
                data-reveal
                data-delay={String(i * 120)}
                style={{
                  position: "relative",
                  padding: "32px 26px",
                  borderRadius: 18,
                  background: CARD_BG,
                  border: CARD_BORDER,
                }}
              >
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 14,
                    background: GRAD,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    fontWeight: 700,
                    color: "#fff",
                    boxShadow: `0 0 26px color-mix(in srgb, ${ACCENT} 45%, transparent)`,
                    marginBottom: 20,
                  }}
                >
                  {i + 1}
                </div>
                {split ? (
                  <>
                    <RichText as="h3" text={split.title} className="t1-card-title t1-card-title--lg" />
                    <RichText as="p" text={split.description} className="t1-card-desc t1-card-desc--lg" />
                  </>
                ) : (
                  <RichText as="p" text={b} className="t1-card-desc t1-card-desc--lg" />
                )}
              </div>
            );
          })}
        </div>
      )}
      {section.cta?.label && (
        <div style={{ textAlign: "center", marginTop: 40 }}>
          <SkinCta {...props} />
        </div>
      )}
    </SkinSection>
  );
}

/* ─── BENEFITS (grille de checks) ──────────────────────────────────────── */

function T1Benefits(props: SkinSectionProps) {
  const { section } = props;
  const bullets = Array.isArray(section.bullets) ? section.bullets : [];
  return (
    <SkinSection section={section}>
      <SectionHead
        eyebrow={section.eyebrow}
        headline={section.headline}
        subheadline={section.subheadline}
      />
      {section.body && <RichText as="p" text={section.body} className="t1-body" />}
      {bullets.length > 0 && (
        <div className="t1-grid" data-t1-cols="3">
          {bullets.map((b, i) => {
            const split = splitTitleDesc(b);
            return (
              <div
                key={i}
                data-reveal
                data-delay={String((i % 3) * 80)}
                style={{
                  display: "flex",
                  gap: 14,
                  padding: 22,
                  borderRadius: 14,
                  background: CARD_BG,
                  border: "1px solid rgba(255,255,255,.08)",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    flex: "none",
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: `color-mix(in srgb, ${ACCENT} 18%, transparent)`,
                    color: ACCENT_SOFT,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                  }}
                >
                  ✓
                </span>
                <div>
                  {split ? (
                    <>
                      <RichText as="h4" text={split.title} className="t1-card-title t1-card-title--sm" />
                      <RichText as="p" text={split.description} className="t1-card-desc t1-card-desc--sm" />
                    </>
                  ) : (
                    <RichText as="p" text={b} className="t1-card-desc" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {section.cta?.label && (
        <div style={{ textAlign: "center", marginTop: 40 }}>
          <SkinCta {...props} />
        </div>
      )}
    </SkinSection>
  );
}

/* ─── TESTIMONIALS ─────────────────────────────────────────────────────── */

function T1Testimonials(props: SkinSectionProps) {
  const { section } = props;
  const items: TestimonialItem[] = Array.isArray(section.items)
    ? section.items
        .filter((it): it is { kind: "testimonial"; data: TestimonialItem } => it.kind === "testimonial")
        .map((it) => it.data)
    : [];
  const quotes: TestimonialItem[] =
    items.length > 0
      ? items
      : (section.bullets ?? []).map((b) => {
          const split = splitTitleDesc(b);
          return split
            ? { quote: split.description, authorName: split.title }
            : { quote: b, authorName: "" };
        });

  if (quotes.length === 0 && !section.headline) return null;

  return (
    <SkinSection section={section}>
      <SectionHead
        eyebrow={section.eyebrow}
        headline={section.headline}
        subheadline={section.subheadline}
      />
      {quotes.length > 0 && (
        <div className="t1-grid" data-t1-cols={String(Math.min(3, Math.max(1, quotes.length)))}>
          {quotes.map((t, i) => (
            <figure
              key={i}
              data-reveal
              data-delay={String(i * 120)}
              style={{
                margin: 0,
                padding: 28,
                borderRadius: 16,
                background: GLASS_BG,
                border: GLASS_BORDER,
                backdropFilter: "blur(8px)",
              }}
            >
              {typeof t.rating === "number" && t.rating > 0 && (
                <div style={{ color: ACCENT, fontSize: 15, letterSpacing: 2, marginBottom: 14 }}>
                  {"★".repeat(Math.max(1, Math.min(5, Math.round(t.rating))))}
                  <span style={{ opacity: 0.25 }}>
                    {"★".repeat(5 - Math.max(1, Math.min(5, Math.round(t.rating))))}
                  </span>
                </div>
              )}
              <blockquote
                style={{
                  margin: "0 0 20px",
                  fontSize: 15.5,
                  lineHeight: 1.65,
                  color: "#D8D8D8",
                }}
              >
                <RichText as="span" text={t.quote} />
              </blockquote>
              {(t.authorName || t.authorRole) && (
                <figcaption style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {t.avatarUrl ? (
                    <img
                      src={t.avatarUrl}
                      alt={t.authorName}
                      style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    <span
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        background: i % 2 === 0 ? GRAD : `linear-gradient(135deg, ${ACCENT2}, ${ACCENT})`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        color: "#fff",
                        fontSize: 14,
                      }}
                    >
                      {initialsOf(t.authorName || "•")}
                    </span>
                  )}
                  <span>
                    <b style={{ display: "block", color: "#fff", fontSize: 14.5 }}>{t.authorName}</b>
                    {t.authorRole && (
                      <span style={{ fontSize: 13, color: "#8A8A8A" }}>{t.authorRole}</span>
                    )}
                  </span>
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
    </SkinSection>
  );
}

/* ─── OFFER / PRICING (carte unique, bordure lumineuse) ────────────────── */

function T1Offer(props: SkinSectionProps) {
  const { section } = props;
  const plan: PricingPlanItem | undefined = Array.isArray(section.items)
    ? section.items.find(
        (it): it is { kind: "pricing"; data: PricingPlanItem } => it.kind === "pricing",
      )?.data
    : undefined;

  const badge = plan?.badge || section.eyebrow;
  const features =
    plan?.features && plan.features.length > 0 ? plan.features : section.bullets ?? [];
  const cta = plan?.cta?.label ? plan.cta : section.cta;

  return (
    <SkinSection section={section} maxWidth={720} className="t1-offer">
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: -40,
          background: `radial-gradient(circle, color-mix(in srgb, ${ACCENT} 28%, transparent), transparent 70%)`,
          filter: "blur(40px)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />
      <div
        data-reveal
        style={{
          position: "relative",
          zIndex: 1,
          borderRadius: 24,
          padding: 2,
          background: GRAD,
        }}
      >
        <div
          style={{
            borderRadius: 22,
            background: "var(--t1-offer-bg, #161016)",
            padding: "44px 36px",
            textAlign: "center",
            backdropFilter: "blur(12px)",
          }}
        >
          {badge && (
            <div
              style={{
                display: "inline-block",
                padding: "6px 14px",
                borderRadius: 20,
                background: `color-mix(in srgb, ${ACCENT} 15%, transparent)`,
                color: ACCENT_SOFT,
                fontSize: 12.5,
                fontWeight: 600,
                letterSpacing: ".08em",
                marginBottom: 20,
                textTransform: "uppercase",
              }}
            >
              <RichText as="span" text={badge} />
            </div>
          )}

          {(plan?.name || section.headline) && (
            <RichText
              as="h2"
              text={plan?.name || section.headline}
              className="t1-offer-title"
            />
          )}

          {plan?.price && (
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "center",
                gap: 10,
                margin: "18px 0 26px",
              }}
            >
              <span className="t1-price">{plan.price}</span>
              {plan.period && (
                <span style={{ fontSize: 16, color: "#8A8A8A" }}>{plan.period}</span>
              )}
            </div>
          )}

          {(section.subheadline || plan?.description) && (
            <RichText
              as="p"
              text={section.subheadline || plan?.description}
              className="t1-sub"
            />
          )}
          {section.body && <RichText as="p" text={section.body} className="t1-body" />}

          {features.length > 0 && (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "22px auto 30px",
                maxWidth: 400,
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {features.map((f, i) => (
                <li key={i} style={{ display: "flex", gap: 11, color: "#D8D8D8", fontSize: 15 }}>
                  <span style={{ color: ACCENT_SOFT }}>✓</span>
                  <RichText as="span" text={f} />
                </li>
              ))}
            </ul>
          )}

          {cta?.label && (
            <CtaLink
              cta={cta}
              funnel={props.funnel}
              page={props.page}
              section={section}
              pageLinks={props.pageLinks}
              slugLinks={props.slugLinks}
              arrow
              baseClassName={`${CTA_BASE} t1-cta--block`}
            />
          )}

          {section.reassurance && (
            <RichText as="p" text={section.reassurance} className="t1-reassure" />
          )}
        </div>
      </div>
    </SkinSection>
  );
}

/* ─── FAQ (accordéon) ──────────────────────────────────────────────────── */

function T1Faq(props: SkinSectionProps) {
  const { section } = props;
  const items: FaqItem[] = Array.isArray(section.items)
    ? section.items
        .filter((it): it is { kind: "faq"; data: FaqItem } => it.kind === "faq")
        .map((it) => it.data)
    : [];
  const faqs: FaqItem[] =
    items.length > 0
      ? items
      : (section.bullets ?? [])
          .map((b) => splitTitleDesc(b))
          .filter((s): s is { title: string; description: string } => !!s)
          .map((s) => ({ question: s.title, answer: s.description }));

  return (
    <SkinSection section={section} maxWidth={800}>
      <SectionHead
        eyebrow={section.eyebrow}
        headline={section.headline}
        subheadline={section.subheadline}
      />
      {faqs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {faqs.map((f, i) => (
            <div
              key={i}
              data-faq-item
              data-reveal
              data-delay={String(i * 60)}
              style={{
                background: "var(--t1-faq-bg, #1A1A1A)",
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                data-acc-toggle
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  padding: "20px 22px",
                  background: "none",
                  border: "none",
                  color: "#fff",
                  fontSize: 16.5,
                  fontWeight: 600,
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <RichText as="span" text={f.question} />
                <span
                  data-acc-chev
                  style={{ flex: "none", transition: "transform .3s", color: ACCENT_SOFT }}
                >
                  ▾
                </span>
              </button>
              <div data-acc-panel>
                <RichText
                  as="p"
                  text={f.answer}
                  className="t1-faq-answer"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </SkinSection>
  );
}

/* ─── CTA FINAL ────────────────────────────────────────────────────────── */

function T1FinalCta(props: SkinSectionProps) {
  const { section } = props;
  return (
    <SkinSection section={section}>
      <div
        data-reveal
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 26,
          padding: "64px 32px",
          textAlign: "center",
          background: `linear-gradient(120deg, color-mix(in srgb, ${ACCENT} 16%, #14090f), color-mix(in srgb, ${ACCENT2} 16%, #100a18))`,
          border: "1px solid rgba(255,255,255,.1)",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -80,
            left: "50%",
            transform: "translateX(-50%)",
            width: 400,
            height: 400,
            background: `radial-gradient(circle, color-mix(in srgb, ${ACCENT} 35%, transparent), transparent 65%)`,
            filter: "blur(40px)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          {section.eyebrow && (
            <RichText as="div" text={section.eyebrow} className="t1-eyebrow" />
          )}
          {section.headline && (
            <RichText as="h2" text={section.headline} className="t1-h2 t1-h2--xl" />
          )}
          {(section.subheadline || section.body) && (
            <RichText
              as="p"
              text={section.subheadline || section.body}
              className="t1-sub"
            />
          )}
          {section.cta?.label && (
            <div style={{ marginTop: 30 }}>
              <SkinCta {...props} className="t1-cta--pulse" />
            </div>
          )}
          {section.reassurance && (
            <RichText as="p" text={section.reassurance} className="t1-reassure" />
          )}
        </div>
      </div>
    </SkinSection>
  );
}

/* ─── Export du skin ───────────────────────────────────────────────────── */

export const T1_WEBINAIRE_DARK_GLOW: TemplateSkin = {
  id: "sharp-launch",
  sections: {
    hero: T1Hero,
    urgency: T1Urgency,
    qualification: T1Qualification,
    process: T1Process,
    program: T1Process,
    benefits: T1Benefits,
    solution: T1Benefits,
    testimonials: T1Testimonials,
    offer: T1Offer,
    pricing: T1Offer,
    faq: T1Faq,
    cta: T1FinalCta,
  },
};
