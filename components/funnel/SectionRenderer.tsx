"use client";

import { CtaButton } from "@/components/funnel/CtaButton";
import { RichText } from "@/components/funnel/RichText";
import {
  effectiveLayoutVariant,
  resolveImageUrl,
  sectionHasUsableImage,
} from "@/lib/funnels/resolveMedia";
import type {
  AnimationPreset,
  Funnel,
  FunnelSection,
  SectionLayoutVariant,
} from "@/lib/funnels/types";
import { RawHtmlRenderer } from "@/components/funnel/sections/RawHtmlRenderer";


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

type AnimOf = (key: AnimKey, fallback?: AnimationPreset) => AnimationPreset;

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
    // Early return pour les sections HTML brutes (clonage) :
  // pas de layout standard, le HTML s'affiche dans une iframe sandboxée.
if (section.type === "raw-html") {
  const clonedMeta = funnel?.meta as
    | {
        clonedHead?: string;
        clonedBody?: { className?: string; id?: string; style?: string };
      }
    | undefined;
  const clonedHead = clonedMeta?.clonedHead;
  const clonedBody = clonedMeta?.clonedBody;
  return (
    <section
      id={section.id || section.type}
      data-ff-section="raw-html"
      className="ff-section ff-raw-html"
      style={{ padding: 0, margin: 0, background: "transparent" }}
    >
      <RawHtmlRenderer
        section={section}
        clonedHead={clonedHead}
        clonedBody={clonedBody}
        editMode={mode === "preview"}   /* 🆕 active uniquement en preview/éditeur */
      />
    </section>
  );
}

  const sectionId = section.id || section.type;
  // 🆕 FIX « animations absentes » : le repli était "none", ce qui rendait
  // data-ff-anim="none" sur TOUTES les sections générées par l'IA (elles ne
  // portent pas de bloc `animations`) → aucune transition au scroll. On
  // s'aligne désormais sur FunnelPreview et lib/export/html.ts, qui replient
  // tous deux sur "fade-up". L'utilisateur peut toujours choisir "Aucune"
  // explicitement dans l'éditeur (StyleTab) : la valeur "none" est alors
  // stockée dans section.animations et respectée.
  const animOf: AnimOf = (key, fallback = DEFAULT_ANIM) =>
    anims[key] ?? fallback;

  return (
    <section
      id={sectionId}
      data-ff-section={section.type}
      data-ff-layout={layout}
      data-ff-anim={animOf("headline")}
      data-ff-anim-scope={animOf("headline")}
      className={`ff-section ff-${section.type} ff-layout-${layout}`}
    >
      <div className="ff-section-inner">
        <LayoutBody
          section={section}
          funnel={funnel}
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
  funnel?: Funnel;
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
      {videoEmbedUrl && <VideoEmbed url={videoEmbedUrl} anim={animOf("video", "zoom-in")} />}
      <Body section={section} animOf={animOf} />
      <Bullets section={section} animOf={animOf} />
      <CtaBlock section={section} mode={mode} animOf={animOf} />
    </>
  );
}

function SplitLayout({
  section,
  funnel,
  mode,
  videoEmbedUrl,
  animOf,
  reverse,
}: LayoutBodyProps & { reverse: boolean }) {
  // Le sens visuel (image gauche/droite) est géré en CSS via .ff-layout-split-image-text
  // (flex-direction: row-reverse). On garde le markup identique pour les deux.
  void reverse;

  const hasVideo = !!videoEmbedUrl;
  const hasImage = sectionHasUsableImage(section, funnel);
  const hasMedia = hasVideo || hasImage;

  const TextBlock = (
    <div className="ff-split-text">
      <Eyebrow section={section} animOf={animOf} />
      <Headline section={section} animOf={animOf} />
      <Subheadline section={section} animOf={animOf} />
      <Body section={section} animOf={animOf} />
      <Bullets section={section} animOf={animOf} />
      <CtaBlock section={section} mode={mode} animOf={animOf} />
    </div>
  );

  // 🆕 Pas de média réel → on NE réserve PAS de colonne vide / placeholder :
  // le texte occupe toute la largeur. L'utilisateur ajoutera un média via
  // l'éditeur s'il le souhaite (le layout s'adaptera alors).
  if (!hasMedia) {
    return TextBlock;
  }

  return (
    <div className="ff-split-grid">
      {TextBlock}
      <div className="ff-split-media">
        {hasVideo ? (
          <VideoEmbed url={videoEmbedUrl as string} anim={animOf("video", "zoom-in")} />
        ) : (
          <ImageBlock section={section} funnel={funnel} animOf={animOf} />
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
      {videoEmbedUrl && <VideoEmbed url={videoEmbedUrl} anim={animOf("video", "zoom-in")} />}
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
      {videoEmbedUrl && <VideoEmbed url={videoEmbedUrl} anim={animOf("video", "zoom-in")} />}
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
  funnel,
  animOf,
}: {
  section: FunnelSection;
  funnel?: Funnel;
  animOf: AnimOf;
}) {
  const url = resolveImageUrl(section.image, funnel);
  if (!url) return null;
  return (
    <figure
      className="ff-image-wrap"
      data-ff-anim={animOf("image", "fade-in")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={section.image?.alt ?? ""}
        className="ff-image"
      />
    </figure>
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
