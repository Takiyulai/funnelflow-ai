"use client";

import { CtaButton } from "@/components/funnel/CtaButton";
import { RichText } from "@/components/funnel/RichText";
import { effectiveLayoutVariant } from "@/lib/funnels/resolveMedia";
import type {
  AnimationPreset,
  Funnel,
  FunnelSection,
  SectionLayoutVariant,
} from "@/lib/funnels/types";

type Props = {
  section: FunnelSection;
  funnel?: Funnel;
  /**
   * Mode de rendu :
   *  - "preview" : utilisé dans la preview wizard (CTA non actifs)
   *  - "public"  : utilisé dans /tunnel/[slug] (CTA actifs)
   */
  mode?: "preview" | "public";
  /** Source vidéo intégrée (URL embed déjà transformée) */
  videoEmbedUrl?: string | null;
};

const DEFAULT_ANIM: AnimationPreset = "fade-up";

type AnimKey =
  | "eyebrow"
  | "headline"
  | "subheadline"
  | "body"
  | "bullets"
  | "image"
  | "video"
  | "cta";

type AnimOf = (key: AnimKey) => AnimationPreset;

// ─────────────────────────────────────────────────────────────────────────────
// Section root
// ─────────────────────────────────────────────────────────────────────────────

export function SectionRenderer({
  section,
  funnel,
  mode = "public",
  videoEmbedUrl,
}: Props) {
  const layout = effectiveLayoutVariant(section, funnel) as SectionLayoutVariant;
  const anims = section.animations ?? {};
  const visible = section.visible !== false;
  if (!visible) return null;

  const sectionId = section.id || section.type;
  const animOf: AnimOf = (key) => anims[key] ?? "none";

  return (
    <section
      id={sectionId}
      data-ff-section={section.type}
      data-ff-layout={layout}
      className={`ff-section ff-${section.type} ff-layout-${layout}`}
    >
      <div className="ff-section-inner">
        <LayoutBody
          section={section}
          layout={layout}
          mode={mode}
          videoEmbedUrl={videoEmbedUrl ?? null}
          animOf={animOf}
        />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout switch
// ─────────────────────────────────────────────────────────────────────────────

type LayoutBodyProps = {
  section: FunnelSection;
  layout: SectionLayoutVariant;
  mode: "preview" | "public";
  videoEmbedUrl: string | null;
  animOf: AnimOf;
};

function LayoutBody(props: LayoutBodyProps) {
  switch (props.layout) {
    case "split-text-image":
      return <SplitLayout {...props} reverse={false} />;
    case "split-image-text":
      return <SplitLayout {...props} reverse={true} />;
    case "feature-grid":
      return <FeatureGridLayout {...props} />;
    case "stacked-card":
      return <StackedCardLayout {...props} />;
    case "wide-banner":
      return <WideBannerLayout {...props} />;
    case "dense-list":
      return <DenseListLayout {...props} />;
    case "left-aligned":
      return <CenteredLayout {...props} align="left" />;
    case "centered":
    default:
      return <CenteredLayout {...props} align="center" />;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Layouts — DOM sémantique aligné sur theme-css.ts
// ─────────────────────────────────────────────────────────────────────────────

function CenteredLayout({
  section,
  mode,
  videoEmbedUrl,
  animOf,
}: LayoutBodyProps & { align: "left" | "center" }) {
  return (
    <>
      <Eyebrow section={section} animOf={animOf} />
      <Headline section={section} animOf={animOf} />
      <Subheadline section={section} animOf={animOf} />
      {videoEmbedUrl && <VideoEmbed url={videoEmbedUrl} anim={animOf("video")} />}
      <Body section={section} animOf={animOf} />
      <Bullets section={section} animOf={animOf} />
      <CtaBlock section={section} mode={mode} animOf={animOf} />
    </>
  );
}

function SplitLayout({
  section,
  mode,
  videoEmbedUrl,
  animOf,
  reverse,
}: LayoutBodyProps & { reverse: boolean }) {
  // Le sens visuel (image gauche/droite) est géré en CSS via .ff-layout-split-image-text
  // (flex-direction: row-reverse). On garde le markup identique pour les deux.
  void reverse;
  return (
    <div className="ff-split-grid">
      <div className="ff-split-text">
        <Eyebrow section={section} animOf={animOf} />
        <Headline section={section} animOf={animOf} />
        <Subheadline section={section} animOf={animOf} />
        <Body section={section} animOf={animOf} />
        <Bullets section={section} animOf={animOf} />
        <CtaBlock section={section} mode={mode} animOf={animOf} />
      </div>
      <div className="ff-split-media">
        {videoEmbedUrl ? (
          <VideoEmbed url={videoEmbedUrl} anim={animOf("video")} />
        ) : section.image?.url ? (
          <ImageBlock section={section} animOf={animOf} />
        ) : (
          <ImagePlaceholder anim={animOf("image")} />
        )}
      </div>
    </div>
  );
}

function FeatureGridLayout({ section, mode, animOf }: LayoutBodyProps) {
  const bullets: string[] = section.bullets ?? [];
  return (
    <>
      <Eyebrow section={section} animOf={animOf} />
      <Headline section={section} animOf={animOf} />
      <Subheadline section={section} animOf={animOf} />
      <Body section={section} animOf={animOf} />
      {bullets.length > 0 && (
        <div className="ff-feature-grid" data-ff-bullets="stagger">
          {bullets.map((b, i) => (
            <RichText
              key={i}
              as="div"
              className="ff-feature-card"
              text={b}
              dataAnim={animOf("bullets") || DEFAULT_ANIM}
            />
          ))}
        </div>
      )}
      <CtaBlock section={section} mode={mode} animOf={animOf} />
    </>
  );
}

function StackedCardLayout({
  section,
  mode,
  videoEmbedUrl,
  animOf,
}: LayoutBodyProps) {
  return (
    <div
      data-ff-anim={animOf("headline") || DEFAULT_ANIM}
      className="ff-stacked-card"
    >
      <Eyebrow section={section} animOf={animOf} />
      <Headline section={section} animOf={animOf} />
      <Subheadline section={section} animOf={animOf} />
      {videoEmbedUrl && <VideoEmbed url={videoEmbedUrl} anim={animOf("video")} />}
      <Body section={section} animOf={animOf} />
      <Bullets section={section} animOf={animOf} />
      <CtaBlock section={section} mode={mode} animOf={animOf} />
    </div>
  );
}

function WideBannerLayout({
  section,
  mode,
  videoEmbedUrl,
  animOf,
}: LayoutBodyProps) {
  return (
    <>
      <Eyebrow section={section} animOf={animOf} />
      <Headline section={section} animOf={animOf} />
      <Subheadline section={section} animOf={animOf} />
      {videoEmbedUrl && <VideoEmbed url={videoEmbedUrl} anim={animOf("video")} />}
      <Body section={section} animOf={animOf} />
      <Bullets section={section} animOf={animOf} />
      <CtaBlock section={section} mode={mode} animOf={animOf} />
    </>
  );
}

function DenseListLayout({ section, mode, animOf }: LayoutBodyProps) {
  const bullets: string[] = section.bullets ?? [];
  return (
    <>
      <Headline section={section} animOf={animOf} />
      <Body section={section} animOf={animOf} />
      {bullets.length > 0 && (
        <ul className="ff-dense-list" data-ff-bullets="stagger">
          {bullets.map((b, i) => (
            <RichText
              key={i}
              as="li"
              text={b}
              dataAnim={animOf("bullets") || DEFAULT_ANIM}
            />
          ))}
        </ul>
      )}
      <CtaBlock section={section} mode={mode} animOf={animOf} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-blocs réutilisables — classes sémantiques uniquement
// 🆕 Tous les textes passent désormais par <RichText> pour parser
//     la syntaxe de surlignage [[texte]] / [[texte|#hex]].
// ─────────────────────────────────────────────────────────────────────────────

function Eyebrow({
  section,
  animOf,
}: {
  section: FunnelSection;
  animOf: AnimOf;
}) {
  if (!section.eyebrow) return null;
  return (
    <RichText
      as="span"
      className="ff-eyebrow"
      text={section.eyebrow}
      dataAnim={animOf("eyebrow") || DEFAULT_ANIM}
    />
  );
}

function Headline({
  section,
  animOf,
}: {
  section: FunnelSection;
  animOf: AnimOf;
}) {
  if (!section.headline) return null;
  return (
    <RichText
      as="h2"
      className="ff-headline"
      text={section.headline}
      dataAnim={animOf("headline") || DEFAULT_ANIM}
    />
  );
}

function Subheadline({
  section,
  animOf,
}: {
  section: FunnelSection;
  animOf: AnimOf;
}) {
  if (!section.subheadline) return null;
  return (
    <RichText
      as="p"
      className="ff-subheadline"
      text={section.subheadline}
      dataAnim={animOf("subheadline") || DEFAULT_ANIM}
    />
  );
}

function Body({
  section,
  animOf,
}: {
  section: FunnelSection;
  animOf: AnimOf;
}) {
  if (!section.body) return null;
  return (
    <RichText
      as="p"
      className="ff-body"
      text={section.body}
      dataAnim={animOf("body") || DEFAULT_ANIM}
    />
  );
}

function Bullets({
  section,
  animOf,
}: {
  section: FunnelSection;
  animOf: AnimOf;
}) {
  const bullets: string[] = section.bullets ?? [];
  if (bullets.length === 0) return null;
  return (
    <ul className="ff-bullets" data-ff-bullets="stagger">
      {bullets.map((b, i) => (
        <RichText
          key={i}
          as="li"
          text={b}
          dataAnim={animOf("bullets") || DEFAULT_ANIM}
        />
      ))}
    </ul>
  );
}

function ImageBlock({
  section,
  animOf,
}: {
  section: FunnelSection;
  animOf: AnimOf;
}) {
  if (!section.image?.url) return null;
  return (
    <figure
      className="ff-image-wrap"
      data-ff-anim={animOf("image") || "fade-in"}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={section.image.url}
        alt={section.image.alt ?? ""}
        className="ff-image"
      />
    </figure>
  );
}

function ImagePlaceholder({ anim }: { anim: AnimationPreset }) {
  return (
    <div data-ff-anim={anim || "fade-in"} className="ff-image-placeholder">
      Visuel
    </div>
  );
}

function VideoEmbed({ url, anim }: { url: string; anim: AnimationPreset }) {
  return (
    <div data-ff-anim={anim || "zoom-in"} className="ff-video">
      <iframe
        src={url}
        title="Video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

function CtaBlock({
  section,
  mode,
  animOf,
}: {
  section: FunnelSection;
  mode: "preview" | "public";
  animOf: AnimOf;
}) {
  if (!section.cta) return null;
  return (
    <div
      data-ff-anim={animOf("cta") || DEFAULT_ANIM}
      className="ff-cta-wrap"
    >
      <CtaButton cta={section.cta} disabled={mode === "preview"} />
    </div>
  );
}
