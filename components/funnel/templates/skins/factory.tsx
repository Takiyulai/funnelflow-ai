"use client";

// Factory de skins : composants de sections génériques, pilotés par un objet
// de tokens (couleurs, polices, rayons, variantes de layout) qui reproduit
// l'identité de chaque template du zip Claude Design en restant 100%
// data-driven (copy généré, éditable). Les couleurs éditables passent par les
// variables --ff-* (accent, boutons) avec fallback sur la palette du zip.

import type { CSSProperties } from "react";
import type {
  FaqItem,
  PricingPlanItem,
  TestimonialItem,
  TimerItem,
} from "@/lib/funnels/types";
import { DEFAULT_TIMER_LABELS } from "@/lib/funnels/types";
import { getVideoEmbed } from "@/lib/funnels/video";
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

/* ─── Tokens ───────────────────────────────────────────────────────────── */

export type SkinTokens = {
  id: string;
  dark: boolean;
  /** Couleurs (expressions CSS ; utiliser var(--ff-accent, X) pour l'éditable) */
  accent: string;
  accent2: string;
  accentSoft: string;
  ink: string;
  body: string;
  muted: string;
  grad: string;
  /** Cartes */
  cardBg: string;
  cardBorder: string;
  cardBorderWidth?: number;
  cardShadow?: string;
  cardGlass?: boolean;
  cardEdgeLeft?: boolean;
  cardTilt?: boolean;
  cardRadius: number;
  /** Badge / chip d'eyebrow */
  chipBg: string;
  chipInk: string;
  chipRadius: number;
  /** Boutons */
  btnRadius: number;
  btnUppercase?: boolean;
  /** Titres */
  headFont?: string;
  headWeight?: number;
  headTransform?: "uppercase" | "none";
  headTracking?: string;
  h1Size: string;
  h2Size: string;
  /** Variantes de layout */
  heroVariant: "centered" | "split";
  heroMedia: "browser" | "book" | "plain";
  headAlign?: "center" | "left";
  numberVariant: "circle" | "chip-grad" | "editorial";
  processRows?: boolean;
  quoteBig?: boolean;
  priceColor?: string;
  /** FAQ */
  faqBg: string;
  faqBorder: string;
  /** Panneau CTA final */
  ctaPanelBg: string;
  ctaPanelInk: string;
  ctaPanelSub: string;
  /** Panneau urgence/countdown */
  urgencyBg: string;
  urgencyBlockBg: string;
  urgencyBlockBorder: string;
  urgencyNumInk: string;
  urgencyLabelInk: string;
};

const CTA_BASE = "af-cta sk-cta inline-flex items-center gap-2 font-bold no-underline";

function headStyle(t: SkinTokens, size: string): CSSProperties {
  return {
    fontFamily: t.headFont,
    fontSize: size,
    fontWeight: t.headWeight ?? 700,
    letterSpacing: t.headTracking ?? "-.02em",
    textTransform: t.headTransform ?? "none",
    color: t.ink,
    margin: 0,
    lineHeight: 1.12,
  };
}

function skinVars(t: SkinTokens): CSSProperties {
  return {
    ["--sk-btn-radius" as string]: `${t.btnRadius}px`,
    ["--sk-btn-tt" as string]: t.btnUppercase ? "uppercase" : "none",
    ["--sk-h1" as string]: t.h1Size,
    ["--sk-h2" as string]: t.h2Size,
    ["--sk-head-font" as string]: t.headFont ?? "inherit",
    ["--sk-head-weight" as string]: String(t.headWeight ?? 700),
    ["--sk-head-tt" as string]: t.headTransform ?? "none",
    ["--sk-head-track" as string]: t.headTracking ?? "-.02em",
    ["--sk-ink" as string]: t.ink,
  } as CSSProperties;
}
const ctaStyleVars = skinVars;

/* ─── Briques ──────────────────────────────────────────────────────────── */

function Head({
  t,
  section,
}: {
  t: SkinTokens;
  section: SkinSectionProps["section"];
}) {
  // 🆕 Règle typographique révisée : SEUL le titre est centré. Les autres
  // textes (sous-titre) sont justifiés par défaut, pas centrés.
  if (!section.eyebrow && !section.headline && !section.subheadline) return null;
  return (
    <div data-reveal style={{ textAlign: "center", marginBottom: 44 }}>
      {section.eyebrow && (
        <div
          style={{
            fontSize: 13,
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: t.accent,
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          <RichText as="span" text={section.eyebrow} />
        </div>
      )}
      {section.headline && (
        <RichText as="h2" text={section.headline} className="sk-h2" />
      )}
      {section.subheadline && (
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.6,
            color: t.body,
            maxWidth: 620,
            margin: "14px auto 0",
            textAlign: "justify",
          }}
        >
          <RichText as="span" text={section.subheadline} />
        </p>
      )}
    </div>
  );
}

function Cta({
  t,
  props,
  block,
  pulse,
  cta,
}: {
  t: SkinTokens;
  props: SkinSectionProps;
  block?: boolean;
  pulse?: boolean;
  cta?: NonNullable<SkinSectionProps["section"]["cta"]>;
}) {
  const c = cta ?? props.section.cta;
  if (!c?.label) return null;
  return (
    <CtaLink
      cta={c}
      funnel={props.funnel}
      page={props.page}
      section={props.section}
      pageLinks={props.pageLinks}
      slugLinks={props.slugLinks}
      arrow
      baseClassName={`${CTA_BASE} ${block ? "sk-cta--block" : ""} ${pulse ? "sk-cta--pulse" : ""}`}
    />
  );
}

// 🆕 Liens/CTA supplémentaires (section.ctas) — rangée de boutons secondaires
// (ex : « Rejoindre le groupe WhatsApp »). Les skins les IGNORAIENT (le rendu
// standard les affichait, pas les composants de skin) → ils n'apparaissaient pas
// sur les templates skinnés.
function ExtraCtas({ props }: { props: SkinSectionProps }) {
  const ctas = props.section.ctas;
  if (!Array.isArray(ctas) || ctas.length === 0) return null;
  return (
    <div className="ff-extra-ctas">
      {ctas.map((extra, i) =>
        extra?.label ? (
          <CtaLink
            key={`${props.section.id}-extra-${i}`}
            cta={extra}
            funnel={props.funnel}
            page={props.page}
            section={props.section}
            pageLinks={props.pageLinks}
            slugLinks={props.slugLinks}
            baseClassName="ff-btn-extra"
          />
        ) : null,
      )}
    </div>
  );
}

/* ─── HERO ─────────────────────────────────────────────────────────────── */

function makeHero(t: SkinTokens) {
  return function SkinHero(props: SkinSectionProps) {
    const { section, funnel } = props;
    const brand =
      funnel.meta?.businessName || funnel.header?.brandName || funnel.funnelName;
    const embed = section.video?.url ? getVideoEmbed(section.video.url) : null;
    const imageUrl =
      section.image && section.image.mode !== "none" ? section.image.url : undefined;
    const hasMedia = !!embed?.embedUrl || !!imageUrl || t.heroMedia === "book";
    // 🆕 Une IMAGE réelle uploadée dans le hero force le layout split (texte |
    // image côte à côte), même sur un template « centered » — comportement
    // attendu (comme la section about). Les médias « book »/vidéo gardent le
    // layout par défaut du template (mieux centrés).
    const split = t.heroVariant === "split" || !!imageUrl;
    // 🆕 Le layout "split" (texte | média côte à côte) ne s'applique
    // réellement que si un média est affiché. Sans média (ou sur les pages
    // de succès), on retombe sur une colonne unique → le CTA doit alors être
    // centré (et non hérité du style "split" en row/flex-start).
    const isSplitLayout = split && hasMedia && !props.isSuccess;

    // 🆕 Ombrage de l'image piloté par l'onglet Style (section.style.shadow) :
    // si défini, l'image du hero suit CE réglage (via data-ff-shadow + la couleur
    // --ff-shadow-color, stylés dans funnel-theme.css) au lieu de l'ombre figée
    // du token — comportement du rendu standard, régressé sur les skins.
    const shadowCfg = (section.style as { shadow?: { size?: string; color?: string } } | undefined)?.shadow;
    const shadowSize = shadowCfg?.size && shadowCfg.size !== "none" ? shadowCfg.size : undefined;
    const shadowColor = shadowCfg?.color ?? "#000000";
    const mediaShadowStyle: React.CSSProperties = shadowSize
      ? ({ ["--ff-shadow-color" as string]: shadowColor } as React.CSSProperties)
      : { boxShadow: t.cardShadow ?? "0 30px 70px rgba(0,0,0,.18)" };

    const media = hasMedia ? (
      <div
        data-reveal
        data-delay="120"
        {...(t.cardTilt ? { "data-tilt": "" } : {})}
        style={{ perspective: 1000, display: "flex", justifyContent: "center" }}
      >
        <div
          {...(t.cardTilt ? { "data-tilt-inner": "" } : {})}
          data-ff-shadow={shadowSize}
          style={
            t.heroMedia === "book" && !embed?.embedUrl && !imageUrl
              ? {
                  position: "relative",
                  width: 270,
                  height: 360,
                  borderRadius: 10,
                  background: `linear-gradient(150deg, ${t.dark ? "#1a1a22" : "#0B1D3A"}, ${t.dark ? "#26262e" : "#14315C"})`,
                  boxShadow: "0 30px 60px rgba(0,0,0,.3)",
                  padding: "32px 26px",
                  color: "#fff",
                  overflow: "hidden",
                }
              : {
                  borderRadius: 14,
                  border: `${t.cardBorderWidth ?? 1}px solid ${t.cardBorder}`,
                  ...mediaShadowStyle,
                  overflow: "hidden",
                  background: t.dark ? "rgba(255,255,255,.04)" : "#fff",
                  width: split ? "100%" : "min(760px,100%)",
                }
          }
        >
          {t.heroMedia === "book" && !embed?.embedUrl && !imageUrl ? (
            <>
              <div style={{ position: "absolute", top: 0, left: 0, width: 6, height: "100%", background: t.accent }} />
              <div style={{ fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: t.accent2, marginBottom: 14 }}>
                {brand}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.18 }}>
                <RichText as="span" text={section.headline ? section.headline.replace(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g, "$1") : brand} />
              </div>
              <div style={{ position: "absolute", bottom: -30, right: -30, width: 130, height: 130, borderRadius: "50%", background: `color-mix(in srgb, ${t.accent2} 25%, transparent)` }} />
            </>
          ) : (
            <>
              {t.heroMedia === "browser" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "11px 14px",
                    background: t.dark ? "rgba(255,255,255,.05)" : "#F3F4F6",
                    borderBottom: `1px solid ${t.cardBorder}`,
                  }}
                >
                  <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#EF4444" }} />
                  <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#F59E0B" }} />
                  <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#22C55E" }} />
                  <span style={{ marginLeft: 10, fontSize: 12, color: t.muted, fontFamily: "monospace" }}>
                    {brand ? brand.toLowerCase().replace(/\s+/g, "") : ""}
                  </span>
                </div>
              )}
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
              ) : imageUrl ? (
                <img
                  src={imageUrl}
                  alt={section.image?.alt ?? ""}
                  style={{ display: "block", width: "100%", height: "auto" }}
                  loading="lazy"
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    ) : null;

    const textBlock = (
      // 🆕 Règle typographique : en SPLIT (image présente) le contenu s'aligne
      // à GAUCHE (titre, eyebrow, sous-titre) — le corps reste justifié via son
      // style inline, et le CTA est déjà en flex-start. Sans image (hero
      // centré), tout reste centré.
      <div style={{ textAlign: isSplitLayout ? "left" : "center" }}>
        {/* 🆕 Badge ✓ des pages de succès (merci/confirmation/livraison) */}
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
                background: t.grad,
                boxShadow: `0 0 0 8px color-mix(in srgb, ${t.accent} 12%, transparent)`,
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
              padding: "7px 15px",
              borderRadius: t.chipRadius,
              background: t.chipBg,
              color: t.chipInk,
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 24,
            }}
          >
            <RichText as="span" text={section.eyebrow} />
          </div>
        )}
        {section.headline && (
          <div data-reveal data-delay="80">
            <RichText as="h1" text={section.headline} className="sk-h1" />
          </div>
        )}
        {section.subheadline && (
          <p
            data-reveal
            data-delay="160"
            style={{
              fontSize: 18,
              lineHeight: 1.6,
              color: t.body,
              margin: isSplitLayout ? "0 0 26px" : "0 auto 30px",
              maxWidth: isSplitLayout ? 560 : 620,
            }}
          >
            <RichText as="span" text={section.subheadline} />
          </p>
        )}
        {section.body && (
          <p
            data-reveal
            style={{
              fontSize: 16,
              lineHeight: 1.7,
              color: t.body,
              margin: isSplitLayout ? "0 0 24px" : "0 auto 26px",
              maxWidth: isSplitLayout ? 560 : 660,
              textAlign: "justify",
            }}
          >
            <RichText as="span" text={section.body} />
          </p>
        )}
        {Array.isArray(section.bullets) && section.bullets.length > 0 && (
          <ul
            data-reveal
            data-delay="200"
            style={{
              listStyle: "none",
              padding: 0,
              margin: isSplitLayout ? "0 0 28px" : "0 auto 28px",
              maxWidth: isSplitLayout ? undefined : 520,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              textAlign: "left",
            }}
          >
            {section.bullets.map((b, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 11, fontSize: 15.5, color: t.body }}>
                <span
                  aria-hidden
                  style={{
                    flex: "none",
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: t.accent2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 12,
                    marginTop: 1,
                  }}
                >
                  ✓
                </span>
                <RichText as="span" text={b} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );

    // 🆕 CTA extrait du bloc texte : en layout split réel, il reste dans la
    // colonne texte (row, aligné au texte) ; sinon (pas de média / page de
    // succès / média affiché en dessous du texte) il est toujours centré et
    // placé APRÈS le média (jamais au-dessus d'une image).
    const ctaRow =
      section.cta?.label || section.reassurance ? (
        <div
          data-reveal
          data-delay="240"
          style={{
            display: "flex",
            flexDirection: isSplitLayout ? "row" : "column",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: isSplitLayout ? "flex-start" : "center",
            gap: 16,
            ...(isSplitLayout ? {} : { marginTop: hasMedia ? 32 : 8 }),
          }}
        >
          <Cta t={t} props={props} pulse />
          <ExtraCtas props={props} />
          {section.reassurance && (
            <div style={{ fontSize: 14, color: t.muted }}>
              <RichText as="span" text={section.reassurance} />
            </div>
          )}
        </div>
      ) : null;

    return (
      <SkinSection
        section={section}
        className={isSplitLayout ? "sk-hero sk-hero--split" : "sk-hero"}
        style={ctaStyleVars(t)}
      >
        {isSplitLayout ? (
          <div className="sk-split">
            <div>
              {textBlock}
              {ctaRow}
            </div>
            {media}
          </div>
        ) : (
          <>
            {textBlock}
            {media && <div style={{ marginTop: 40 }}>{media}</div>}
            {ctaRow}
          </>
        )}
      </SkinSection>
    );
  };
}

/* ─── 🆕 Split automatique : contenu + image côte à côte ────────────────
   RÈGLE : une image dans une section de contenu → layout split (texte à
   gauche, image à droite). Sur mobile, le CSS .sk-split empile
   texte → image (→ CTA). */
function withSectionImage(
  t: SkinTokens,
  section: SkinSectionProps["section"],
  inner: React.ReactNode,
): React.ReactNode {
  const url =
    section.image && section.image.mode !== "none" ? section.image.url : undefined;
  if (!url) return inner;
  const img = (
    <img
      src={url}
      alt={section.image?.alt ?? ""}
      loading="lazy"
      style={{
        display: "block",
        width: "100%",
        height: "auto",
        borderRadius: t.cardRadius + 4,
        boxShadow: t.cardShadow ?? "0 24px 60px rgba(0,0,0,.18)",
        border: `1px solid ${t.cardBorder}`,
      }}
    />
  );
  // Pas de contenu à côté → image seule, centrée.
  if (!inner) {
    return (
      <div data-reveal style={{ maxWidth: 760, margin: "0 auto" }}>
        {img}
      </div>
    );
  }
  return (
    <div className="sk-split" style={{ alignItems: "center" }}>
      <div style={{ minWidth: 0 }}>{inner}</div>
      <div data-reveal data-delay="120">
        {img}
      </div>
    </div>
  );
}

/* ─── Cartes (qualification / benefits / solution) — 3 variantes anti-monotonie ─
   V0 = grille (icône) · V1 = liste en rangées · V2 = grille numérotée.
   La variante est choisie par FunnelPreview (déterministe, seedée, sans deux
   sections cartes voisines identiques) et passée via props.variant. */

function cardText(t: SkinTokens, b: string) {
  const split = splitTitleDesc(b);
  return split ? (
    <>
      {/* 🆕 Titre de carte : on suit le POIDS réel de la police du template
          (t.headWeight) et son interlettrage (t.headTracking). Sur bold-energy,
          la police Bebas Neue n'existe qu'en 400 → un fontWeight:600 provoquait
          un faux-gras qui « chevauchait » les lettres. */}
      <h3
        style={{
          fontSize: 18,
          fontWeight: t.headWeight ?? 600,
          letterSpacing: t.headTracking ?? undefined,
          margin: "0 0 8px",
          color: t.ink,
          fontFamily: t.headFont,
        }}
      >
        <RichText as="span" text={split.title} />
      </h3>
      <p style={{ fontSize: 14.5, lineHeight: 1.6, color: t.body, margin: 0, textAlign: "justify" }}>
        <RichText as="span" text={split.description} />
      </p>
    </>
  ) : (
    <p style={{ fontSize: 15, lineHeight: 1.6, color: t.body, margin: 0 }}>
      <RichText as="span" text={b} />
    </p>
  );
}

function cardMarker(
  t: SkinTokens,
  i: number,
  mode: "check" | "icon" | "number",
  iconName: string,
) {
  const edge = i % 2 === 0 ? t.accent : t.accent2;
  if (mode === "number") {
    return (
      <div
        aria-hidden
        style={{
          flex: "none",
          width: 46,
          height: 46,
          borderRadius: t.numberVariant === "circle" ? "50%" : 12,
          background: t.grad,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 19,
          fontWeight: 700,
          fontFamily: t.headFont,
        }}
      >
        {i + 1}
      </div>
    );
  }
  if (mode === "check") {
    return (
      <span
        aria-hidden
        style={{
          display: "flex",
          flex: "none",
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: `color-mix(in srgb, ${t.accent} 16%, transparent)`,
          color: t.accent,
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
        }}
      >
        ✓
      </span>
    );
  }
  const Icon = getIconByName(iconName);
  return <Icon aria-hidden style={{ width: 26, height: 26, color: edge, flexShrink: 0 }} />;
}

function renderCardsVariant(
  t: SkinTokens,
  opts: { check?: boolean } | undefined,
  section: SkinSectionProps["section"],
  bullets: string[],
  variant: number,
  hasImage: boolean,
): React.ReactNode {
  const markerMode: "check" | "icon" | "number" =
    variant === 2 ? "number" : opts?.check ? "check" : "icon";
  const iconName = (i: number) =>
    (section.bulletIcons?.[i] as string) || section.iconName || "sparkles";

  // V1 — LISTE : rangées pleine largeur (marqueur à gauche, texte à droite).
  if (variant === 1 && !hasImage) {
    return (
      <div style={{ maxWidth: 780, margin: "0 auto", display: "flex", flexDirection: "column" }}>
        {bullets.map((b, i) => (
          <div
            key={i}
            data-reveal
            data-delay={String((i % 4) * 70)}
            style={{
              display: "flex",
              gap: 18,
              alignItems: "flex-start",
              padding: "22px 0",
              borderTop: i > 0 ? `1px solid ${t.cardBorder}` : "none",
            }}
          >
            {cardMarker(t, i, markerMode, iconName(i))}
            <div style={{ minWidth: 0 }}>{cardText(t, b)}</div>
          </div>
        ))}
      </div>
    );
  }

  // V0 (grille) & V2 (grille numérotée).
  const cols = hasImage
    ? 1
    : Math.min(bullets.length >= 4 ? 4 : 3, Math.max(2, bullets.length));
  return (
    <div className="t1-grid" data-t1-cols={String(cols)}>
      {bullets.map((b, i) => {
        const edge = i % 2 === 0 ? t.accent : t.accent2;
        const card = (
          <div
            {...(t.cardTilt ? { "data-tilt-inner": "" } : {})}
            style={{
              height: "100%",
              background: t.cardBg,
              border: `${t.cardBorderWidth ?? 1}px solid ${t.cardBorder}`,
              ...(t.cardEdgeLeft && variant !== 2 ? { borderLeft: `3px solid ${edge}` } : {}),
              borderRadius: t.cardRadius,
              padding: 26,
              boxShadow: t.cardShadow,
              ...(t.cardGlass ? { backdropFilter: "blur(10px)" } : {}),
            }}
          >
            <div style={{ marginBottom: 14 }}>{cardMarker(t, i, markerMode, iconName(i))}</div>
            {cardText(t, b)}
          </div>
        );
        return t.cardTilt ? (
          <div key={i} data-reveal data-delay={String((i % 4) * 80)} data-tilt style={{ perspective: 900 }}>
            {card}
          </div>
        ) : (
          <div key={i} data-reveal data-delay={String((i % 4) * 80)}>
            {card}
          </div>
        );
      })}
    </div>
  );
}

function makeCards(t: SkinTokens, opts?: { check?: boolean }) {
  return function SkinCards(props: SkinSectionProps) {
    const { section } = props;
    const bullets = Array.isArray(section.bullets) ? section.bullets : [];
    const hasImage = !!(section.image && section.image.mode !== "none" && section.image.url);
    // Une image force la grille simple (variante 0) pour rester lisible en split.
    const variant = hasImage ? 0 : props.variant ?? 0;
    const content =
      bullets.length > 0
        ? renderCardsVariant(t, opts, section, bullets, variant, hasImage)
        : null;
    return (
      <SkinSection section={section} style={ctaStyleVars(t)}>
        <Head t={t} section={section} />
        {withSectionImage(t, section, content)}
        {section.cta?.label && (
          <div style={{ textAlign: "center", marginTop: 40 }}>
            <Cta t={t} props={props} />
          </div>
        )}
      </SkinSection>
    );
  };
}

/* ─── Process (étapes) ─────────────────────────────────────────────────── */

function makeProcess(t: SkinTokens) {
  return function SkinProcess(props: SkinSectionProps) {
    const { section } = props;
    const bullets = Array.isArray(section.bullets) ? section.bullets : [];
    return (
      <SkinSection section={section} style={ctaStyleVars(t)}>
        <Head t={t} section={section} />
        {withSectionImage(
          t,
          section,
          t.processRows ? (
          <div>
            {bullets.map((b, i) => {
              const split = splitTitleDesc(b);
              return (
                <div
                  key={i}
                  data-reveal
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr",
                    gap: 24,
                    padding: "28px 0",
                    borderTop: `1px solid ${t.cardBorder}`,
                    ...(i === bullets.length - 1 ? { borderBottom: `1px solid ${t.cardBorder}` } : {}),
                  }}
                >
                  <div style={{ fontFamily: t.headFont, fontSize: 28, color: t.accent }}>
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div>
                    {split ? (
                      <>
                        <h3 style={{ fontSize: 20, fontWeight: 600, color: t.ink, margin: "0 0 8px", fontFamily: t.headFont }}>
                          <RichText as="span" text={split.title} />
                        </h3>
                        <p style={{ fontSize: 15.5, lineHeight: 1.7, color: t.body, margin: 0, maxWidth: 640, textAlign: "justify" }}>
                          <RichText as="span" text={split.description} />
                        </p>
                      </>
                    ) : (
                      <p style={{ fontSize: 15.5, lineHeight: 1.7, color: t.body, margin: 0 }}>
                        <RichText as="span" text={b} />
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="t1-grid" data-t1-cols={String(Math.min(3, Math.max(2, bullets.length)))}>
            {bullets.map((b, i) => {
              const split = splitTitleDesc(b);
              return (
                <div
                  key={i}
                  data-reveal
                  data-delay={String(i * 120)}
                  style={{
                    padding: "32px 26px",
                    borderRadius: t.cardRadius,
                    background: t.cardBg,
                    border: `${t.cardBorderWidth ?? 1}px solid ${t.cardBorder}`,
                    boxShadow: t.cardShadow,
                  }}
                >
                  <div
                    style={{
                      width: t.numberVariant === "circle" ? 50 : 58,
                      height: t.numberVariant === "circle" ? 50 : 58,
                      borderRadius: t.numberVariant === "circle" ? "50%" : 14,
                      background: t.numberVariant === "chip-grad" ? t.grad : i % 2 === 0 ? t.accent : t.accent2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                      fontWeight: 700,
                      color: "#fff",
                      marginBottom: 18,
                      ...(t.numberVariant === "chip-grad"
                        ? { boxShadow: `0 0 26px color-mix(in srgb, ${t.accent} 45%, transparent)` }
                        : {}),
                    }}
                  >
                    {i + 1}
                  </div>
                  {split ? (
                    <>
                      <h3 style={{ fontSize: 19, fontWeight: 700, color: t.ink, margin: "0 0 8px", fontFamily: t.headFont }}>
                        <RichText as="span" text={split.title} />
                      </h3>
                      <p style={{ fontSize: 14.5, lineHeight: 1.6, color: t.body, margin: 0, textAlign: "justify" }}>
                        <RichText as="span" text={split.description} />
                      </p>
                    </>
                  ) : (
                    <p style={{ fontSize: 15, lineHeight: 1.65, color: t.body, margin: 0 }}>
                      <RichText as="span" text={b} />
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          ),
        )}
        {section.cta?.label && (
          <div style={{ textAlign: "center", marginTop: 40 }}>
            <Cta t={t} props={props} />
          </div>
        )}
      </SkinSection>
    );
  };
}

/* ─── Témoignages ──────────────────────────────────────────────────────── */

function makeTestimonials(t: SkinTokens) {
  return function SkinTestimonials(props: SkinSectionProps) {
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
            const s = splitTitleDesc(b);
            return s ? { quote: s.description, authorName: s.title } : { quote: b, authorName: "" };
          });
    if (quotes.length === 0 && !section.headline) return null;

    if (t.quoteBig && quotes.length === 1) {
      const q = quotes[0];
      return (
        <SkinSection section={section} maxWidth={860} style={skinVars(t)}>
          <div style={{ textAlign: "center" }}>
            <div data-reveal style={{ fontFamily: "Georgia, serif", fontSize: 90, lineHeight: 0.4, color: t.accent2, marginBottom: 10 }}>
              “
            </div>
            <blockquote data-reveal data-delay="80" style={{ margin: "0 0 26px", fontSize: 23, lineHeight: 1.5, fontWeight: 500, color: t.ink }}>
              <RichText as="span" text={q.quote} />
            </blockquote>
            {(q.authorName || q.authorRole) && (
              <div data-reveal data-delay="120" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 13 }}>
                {q.avatarUrl ? (
                  <img src={q.avatarUrl} alt={q.authorName} style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <span style={{ width: 48, height: 48, borderRadius: "50%", background: t.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                    {initialsOf(q.authorName || "•")}
                  </span>
                )}
                <span style={{ textAlign: "left" }}>
                  <b style={{ display: "block", color: t.ink, fontSize: 15.5 }}>{q.authorName}</b>
                  {q.authorRole && <span style={{ fontSize: 13.5, color: t.muted }}>{q.authorRole}</span>}
                </span>
              </div>
            )}
          </div>
        </SkinSection>
      );
    }

    return (
      <SkinSection section={section} style={skinVars(t)}>
        <Head t={t} section={section} />
        <div className="t1-grid" data-t1-cols={String(Math.min(3, Math.max(1, quotes.length)))}>
          {quotes.map((q, i) => (
            <figure
              key={i}
              data-reveal
              data-delay={String(i * 120)}
              style={{
                margin: 0,
                padding: 28,
                borderRadius: t.cardRadius,
                background: t.cardBg,
                border: `${t.cardBorderWidth ?? 1}px solid ${t.cardBorder}`,
                boxShadow: t.cardShadow,
                ...(t.cardGlass ? { backdropFilter: "blur(8px)" } : {}),
              }}
            >
              {typeof q.rating === "number" && q.rating > 0 && (
                <div style={{ color: t.accent, fontSize: 15, letterSpacing: 2, marginBottom: 14 }}>
                  {"★".repeat(Math.max(1, Math.min(5, Math.round(q.rating))))}
                </div>
              )}
              <blockquote style={{ margin: "0 0 20px", fontSize: 15.5, lineHeight: 1.65, color: t.body }}>
                <RichText as="span" text={q.quote} />
              </blockquote>
              {(q.authorName || q.authorRole) && (
                <figcaption style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {q.avatarUrl ? (
                    <img src={q.avatarUrl} alt={q.authorName} style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <span
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        background: i % 2 === 0 ? t.accent : t.accent2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        color: "#fff",
                        fontSize: 14,
                      }}
                    >
                      {initialsOf(q.authorName || "•")}
                    </span>
                  )}
                  <span>
                    <b style={{ display: "block", color: t.ink, fontSize: 14.5 }}>{q.authorName}</b>
                    {q.authorRole && <span style={{ fontSize: 13, color: t.muted }}>{q.authorRole}</span>}
                  </span>
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </SkinSection>
    );
  };
}

/* ─── Offre / Pricing (1 ou N plans) ───────────────────────────────────── */

function makeOffer(t: SkinTokens) {
  return function SkinOffer(props: SkinSectionProps) {
    const { section } = props;
    const plans: PricingPlanItem[] = Array.isArray(section.items)
      ? section.items
          .filter((it): it is { kind: "pricing"; data: PricingPlanItem } => it.kind === "pricing")
          .map((it) => it.data)
      : [];

    const renderPlan = (plan: PricingPlanItem | undefined, single: boolean, i = 0) => {
      const badge = plan?.badge || (single ? section.eyebrow : undefined);
      const features = plan?.features?.length ? plan.features : single ? section.bullets ?? [] : [];
      const cta = plan?.cta?.label ? plan.cta : section.cta;
      const highlighted = plan?.highlighted;
      const inner = (
        <div
          style={{
            borderRadius: t.cardRadius + 6,
            background: t.cardBg,
            border: highlighted ? undefined : `1px solid ${t.cardBorder}`,
            padding: "40px 32px",
            textAlign: single ? "center" : "left",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            boxShadow: t.cardShadow,
            ...(t.cardGlass ? { backdropFilter: "blur(12px)" } : {}),
          }}
        >
          {badge && (
            <div
              style={{
                display: "inline-block",
                alignSelf: single ? "center" : "flex-start",
                padding: "6px 14px",
                borderRadius: t.chipRadius,
                background: t.chipBg,
                color: t.chipInk,
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                marginBottom: 18,
              }}
            >
              <RichText as="span" text={badge} />
            </div>
          )}
          {(plan?.name || (single && section.headline)) && (
            <h3 style={{ ...headStyle(t, "26px"), marginBottom: 8 }}>
              <RichText as="span" text={plan?.name || section.headline} />
            </h3>
          )}
          {plan?.price && (
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: single ? "center" : "flex-start", gap: 8, margin: "14px 0 20px" }}>
              <span
                style={{
                  fontSize: 48,
                  fontWeight: 800,
                  lineHeight: 1,
                  fontFamily: t.headFont,
                  color: t.priceColor ?? t.accent,
                }}
              >
                {plan.price}
              </span>
              {plan.period && <span style={{ fontSize: 15, color: t.muted }}>{plan.period}</span>}
            </div>
          )}
          {(plan?.description || (single && section.subheadline)) && (
            <p style={{ fontSize: 15.5, lineHeight: 1.6, color: t.body, margin: "0 0 18px" }}>
              <RichText as="span" text={plan?.description || section.subheadline} />
            </p>
          )}
          {single && section.body && (
            <p style={{ fontSize: 15, lineHeight: 1.7, color: t.body, margin: "0 0 18px", textAlign: "justify" }}>
              <RichText as="span" text={section.body} />
            </p>
          )}
          {features.length > 0 && (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: single ? "8px auto 28px" : "0 0 26px",
                maxWidth: single ? 400 : undefined,
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {features.map((f, j) => (
                <li key={j} style={{ display: "flex", gap: 11, color: t.body, fontSize: 15 }}>
                  <span style={{ color: t.accent, fontWeight: 700 }}>✓</span>
                  <RichText as="span" text={f} />
                </li>
              ))}
            </ul>
          )}
          {cta?.label && (
            <div style={{ marginTop: "auto" }}>
              <Cta t={t} props={props} cta={cta} block />
            </div>
          )}
          {single && section.reassurance && (
            <p style={{ margin: "16px 0 0", fontSize: 13, color: t.muted }}>
              <RichText as="span" text={section.reassurance} />
            </p>
          )}
        </div>
      );
      // Bordure dégradée pour la carte unique ou le plan mis en avant
      return single || highlighted ? (
        <div key={i} data-reveal data-delay={String(i * 100)} style={{ borderRadius: t.cardRadius + 8, padding: 2, background: t.grad, height: "100%" }}>
          {inner}
        </div>
      ) : (
        <div key={i} data-reveal data-delay={String(i * 100)} style={{ height: "100%" }}>
          {inner}
        </div>
      );
    };

    return (
      <SkinSection section={section} maxWidth={plans.length > 1 ? 1080 : 760} style={ctaStyleVars(t)}>
        {plans.length > 1 && <Head t={t} section={section} />}
        {plans.length > 1 ? (
          <div className="t1-grid" data-t1-cols={String(Math.min(3, plans.length))} style={{ alignItems: "stretch" }}>
            {plans.map((p, i) => renderPlan(p, false, i))}
          </div>
        ) : (
          renderPlan(plans[0], true)
        )}
      </SkinSection>
    );
  };
}

/* ─── FAQ ──────────────────────────────────────────────────────────────── */

function makeFaq(t: SkinTokens) {
  return function SkinFaq(props: SkinSectionProps) {
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
      <SkinSection section={section} maxWidth={800} style={skinVars(t)}>
        <Head t={t} section={section} />
        {faqs.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {faqs.map((f, i) => (
              <div
                key={i}
                data-faq-item
                data-reveal
                data-delay={String(i * 60)}
                style={{
                  background: t.faqBg,
                  border: `${t.cardBorderWidth ?? 1}px solid ${t.faqBorder}`,
                  borderRadius: t.cardRadius,
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
                    padding: "19px 22px",
                    background: "none",
                    border: "none",
                    color: t.ink,
                    fontSize: 16.5,
                    fontWeight: 600,
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <RichText as="span" text={f.question} />
                  <span data-acc-chev style={{ flex: "none", transition: "transform .3s", color: t.accent }}>
                    ▾
                  </span>
                </button>
                <div data-acc-panel>
                  <p style={{ margin: 0, padding: "0 22px 20px", color: t.body, fontSize: 15, lineHeight: 1.65, textAlign: "justify" }}>
                    <RichText as="span" text={f.answer} />
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SkinSection>
    );
  };
}

/* ─── CTA final ────────────────────────────────────────────────────────── */

function makeFinalCta(t: SkinTokens) {
  return function SkinFinalCta(props: SkinSectionProps) {
    const { section } = props;
    return (
      <SkinSection section={section} style={ctaStyleVars(t)}>
        <div
          data-reveal
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: t.cardRadius + 10,
            padding: "64px 32px",
            textAlign: "center",
            background: t.ctaPanelBg,
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
              background: `radial-gradient(circle, color-mix(in srgb, ${t.accent} 30%, transparent), transparent 65%)`,
              filter: "blur(40px)",
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            {section.eyebrow && (
              <div style={{ fontSize: 13, letterSpacing: ".16em", textTransform: "uppercase", color: t.accent, fontWeight: 700, marginBottom: 14 }}>
                <RichText as="span" text={section.eyebrow} />
              </div>
            )}
            {section.headline && (
              <h2 style={{ ...headStyle(t, t.h2Size), color: t.ctaPanelInk, marginBottom: 14 }}>
                <RichText as="span" text={section.headline} />
              </h2>
            )}
            {(section.subheadline || section.body) && (
              <p style={{ fontSize: 17, color: t.ctaPanelSub, maxWidth: 540, margin: "0 auto 28px", lineHeight: 1.6 }}>
                <RichText as="span" text={section.subheadline || section.body} />
              </p>
            )}
            <Cta t={t} props={props} pulse />
            <ExtraCtas props={props} />
            {section.reassurance && (
              <p style={{ margin: "16px 0 0", fontSize: 13.5, color: t.ctaPanelSub }}>
                <RichText as="span" text={section.reassurance} />
              </p>
            )}
          </div>
        </div>
      </SkinSection>
    );
  };
}

/* ─── Urgence / countdown ──────────────────────────────────────────────── */

function makeUrgency(t: SkinTokens) {
  return function SkinUrgency(props: SkinSectionProps) {
    const { section, funnel } = props;
    const timer: TimerItem | undefined = firstTimer(section);
    const target = timerTarget(timer);
    const lang = (funnel.language ?? "fr") as keyof typeof DEFAULT_TIMER_LABELS;
    const L = DEFAULT_TIMER_LABELS[lang] ?? DEFAULT_TIMER_LABELS.fr;
    const labels = [
      ["d", timer?.labels?.days ?? L.days],
      ["h", timer?.labels?.hours ?? L.hours],
      ["m", timer?.labels?.minutes ?? L.minutes],
      ["s", timer?.labels?.seconds ?? L.seconds],
    ] as const;
    const showDays = timer?.showDays !== false;
    const title = timer?.label || section.headline || section.eyebrow;

    return (
      <SkinSection section={section} className="sk-pad-sm" style={ctaStyleVars(t)}>
        <div
          data-reveal
          style={{
            background: t.urgencyBg,
            border: `${t.cardBorderWidth ?? 1}px solid ${t.cardBorder}`,
            borderRadius: t.cardRadius + 8,
            padding: "40px 28px",
            textAlign: "center",
          }}
        >
          {title && (
            <div style={{ fontSize: 13, letterSpacing: ".18em", textTransform: "uppercase", color: t.accent, fontWeight: 700, marginBottom: 22 }}>
              <RichText as="span" text={title} />
            </div>
          )}
          <div
            data-cd
            {...(target ? { "data-target": target } : {})}
            style={{ display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap" }}
          >
            {labels.map(([k, label], i) =>
              k === "d" && !showDays ? null : (
                <div
                  key={k}
                  style={{
                    minWidth: 104,
                    padding: 20,
                    borderRadius: t.cardRadius,
                    background: t.urgencyBlockBg,
                    border: `1px solid ${t.urgencyBlockBorder}`,
                    animation: i === 0 ? "hp-pulse-ring 2.6s ease-out infinite" : undefined,
                  }}
                >
                  <div
                    {...({ [`data-cd-${k}`]: "" } as Record<string, string>)}
                    style={{
                      fontSize: "clamp(36px, 6cqw, 58px)",
                      fontWeight: 700,
                      color: t.urgencyNumInk,
                      lineHeight: 1,
                      fontVariantNumeric: "tabular-nums",
                      fontFamily: t.headFont,
                    }}
                  >
                    00
                  </div>
                  <div style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", color: t.urgencyLabelInk, marginTop: 8 }}>
                    {label}
                  </div>
                </div>
              ),
            )}
          </div>
          {(section.subheadline || section.body) && (
            <p style={{ fontSize: 16.5, color: t.body, maxWidth: 560, margin: "22px auto 0", lineHeight: 1.6 }}>
              <RichText as="span" text={section.subheadline || section.body} />
            </p>
          )}
          {section.cta?.label && (
            <div style={{ marginTop: 26 }}>
              <Cta t={t} props={props} />
            </div>
          )}
        </div>
      </SkinSection>
    );
  };
}

/* ─── Assemblage ───────────────────────────────────────────────────────── */

// 🆕 Rend les tokens « conscients de la marque » : le texte (ink/body/muted) et
// les surfaces de cartes (cardBg/cardBorder/faqBg/faqBorder) consomment des
// variables `--ff-brand-*` posées UNIQUEMENT quand une couleur de marque est
// active (TemplateThemeProvider), avec le défaut du template en repli. Sans
// marque → valeurs identiques à l'origine (aucune régression) ; avec marque →
// contraste correct (plus de texte foncé illisible sur fond de marque sombre).
function brandAware(t: SkinTokens): SkinTokens {
  const isHex = (v: string) => /^#([0-9a-f]{3,8})$/i.test(v.trim());
  const wrap = (v: string, name: string) => (isHex(v) ? `var(${name}, ${v})` : v);
  return {
    ...t,
    ink: `var(--ff-brand-ink, ${t.ink})`,
    body: `var(--ff-brand-body, ${t.body})`,
    muted: `var(--ff-brand-muted, ${t.muted})`,
    cardBg: wrap(t.cardBg, "--ff-brand-card-bg"),
    cardBorder: wrap(t.cardBorder, "--ff-brand-card-border"),
    faqBg: wrap(t.faqBg, "--ff-brand-card-bg"),
    faqBorder: wrap(t.faqBorder, "--ff-brand-card-border"),
  };
}

export function makeSkin(rawTokens: SkinTokens): TemplateSkin {
  const t = brandAware(rawTokens);
  const Hero = makeHero(t);
  const Cards = makeCards(t);
  const Checks = makeCards(t, { check: true });
  const Process = makeProcess(t);
  const Testimonials = makeTestimonials(t);
  const Offer = makeOffer(t);
  const Faq = makeFaq(t);
  const FinalCta = makeFinalCta(t);
  const Urgency = makeUrgency(t);
  return {
    id: t.id,
    sections: {
      hero: Hero,
      urgency: Urgency,
      qualification: Cards,
      solution: Checks,
      benefits: Checks,
      process: Process,
      program: Process,
      testimonials: Testimonials,
      offer: Offer,
      pricing: Offer,
      faq: Faq,
      cta: FinalCta,
    },
  };
}
