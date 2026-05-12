"use client";

import { CtaButton } from "@/components/funnel/CtaButton";
import type {
  AnimationPreset,
  FunnelSection,
  SectionLayoutVariant,
} from "@/lib/funnels/types";

type Props = {
  section: FunnelSection;
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

export function SectionRenderer({ section, mode = "public", videoEmbedUrl }: Props) {
  const layout: SectionLayoutVariant = section.layoutVariant ?? "centered";
  const anims = section.animations ?? {};
  const visible = section.visible !== false;
  if (!visible) return null;

  const sectionId = section.id || section.type;

  const animOf = (key: keyof typeof anims): AnimationPreset =>
    anims[key] ?? "none";

  return (
    <section
      id={sectionId}
      data-ff-section={section.type}
      data-ff-layout={layout}
      className={layoutClass(layout)}
    >
      <div className={containerClass(layout)}>
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
// Choix du layout
// ─────────────────────────────────────────────────────────────────────────────

function LayoutBody({
  section,
  layout,
  mode,
  videoEmbedUrl,
  animOf,
}: {
  section: FunnelSection;
  layout: SectionLayoutVariant;
  mode: "preview" | "public";
  videoEmbedUrl: string | null;
  animOf: (
    key:
      | "eyebrow"
      | "headline"
      | "subheadline"
      | "body"
      | "bullets"
      | "image"
      | "video"
      | "cta"
  ) => AnimationPreset;
}) {
  switch (layout) {
    case "split-text-image":
      return (
        <SplitLayout
          section={section}
          reverse={false}
          mode={mode}
          videoEmbedUrl={videoEmbedUrl}
          animOf={animOf}
        />
      );
    case "split-image-text":
      return (
        <SplitLayout
          section={section}
          reverse={true}
          mode={mode}
          videoEmbedUrl={videoEmbedUrl}
          animOf={animOf}
        />
      );
    case "feature-grid":
      return <FeatureGridLayout section={section} mode={mode} animOf={animOf} />;
    case "stacked-card":
      return (
        <StackedCardLayout
          section={section}
          mode={mode}
          videoEmbedUrl={videoEmbedUrl}
          animOf={animOf}
        />
      );
    case "wide-banner":
      return (
        <WideBannerLayout
          section={section}
          mode={mode}
          videoEmbedUrl={videoEmbedUrl}
          animOf={animOf}
        />
      );
    case "dense-list":
      return <DenseListLayout section={section} mode={mode} animOf={animOf} />;
    case "left-aligned":
      return (
        <CenteredLayout
          section={section}
          align="left"
          mode={mode}
          videoEmbedUrl={videoEmbedUrl}
          animOf={animOf}
        />
      );
    case "centered":
    default:
      return (
        <CenteredLayout
          section={section}
          align="center"
          mode={mode}
          videoEmbedUrl={videoEmbedUrl}
          animOf={animOf}
        />
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Layouts
// ─────────────────────────────────────────────────────────────────────────────

function CenteredLayout({ section, align, mode, videoEmbedUrl, animOf }: any) {
  const alignClass =
    align === "left" ? "text-left items-start" : "text-center items-center";
  return (
    <div className={`flex flex-col gap-4 ${alignClass}`}>
      <Eyebrow section={section} animOf={animOf} />
      <Headline section={section} animOf={animOf} />
      <Subheadline section={section} animOf={animOf} />
      {videoEmbedUrl && <VideoEmbed url={videoEmbedUrl} anim={animOf("video")} />}
      <Body section={section} animOf={animOf} />
      <Bullets section={section} animOf={animOf} center={align !== "left"} />
      <CtaBlock section={section} mode={mode} animOf={animOf} />
    </div>
  );
}

function SplitLayout({ section, reverse, mode, videoEmbedUrl, animOf }: any) {
  const order = reverse ? "md:flex-row-reverse" : "md:flex-row";
  return (
    <div className={`flex flex-col ${order} items-center gap-8`}>
      <div className="flex-1 flex flex-col gap-4">
        <Eyebrow section={section} animOf={animOf} />
        <Headline section={section} animOf={animOf} />
        <Subheadline section={section} animOf={animOf} />
        <Body section={section} animOf={animOf} />
        <Bullets section={section} animOf={animOf} />
        <CtaBlock section={section} mode={mode} animOf={animOf} />
      </div>
      <div className="flex-1 w-full">
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

function FeatureGridLayout({ section, mode, animOf }: any) {
  const bullets: string[] = section.bullets ?? [];
  return (
    <div className="flex flex-col gap-6 text-center items-center">
      <Eyebrow section={section} animOf={animOf} />
      <Headline section={section} animOf={animOf} />
      <Subheadline section={section} animOf={animOf} />
      <Body section={section} animOf={animOf} />
      {bullets.length > 0 && (
        <div
          data-ff-bullets="stagger"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full"
        >
          {bullets.map((b, i) => (
            <div
              key={i}
              data-ff-anim={animOf("bullets") || DEFAULT_ANIM}
              className="ff-card rounded-xl p-5 text-left"
            >
              <p className="ff-body text-sm leading-relaxed">{b}</p>
            </div>
          ))}
        </div>
      )}
      <CtaBlock section={section} mode={mode} animOf={animOf} />
    </div>
  );
}

function StackedCardLayout({ section, mode, videoEmbedUrl, animOf }: any) {
  return (
    <div className="flex justify-center">
      <div
        data-ff-anim={animOf("headline") || DEFAULT_ANIM}
        className="ff-card-elevated w-full max-w-2xl rounded-2xl p-8 flex flex-col gap-4 text-center items-center"
      >
        <Eyebrow section={section} animOf={animOf} />
        <Headline section={section} animOf={animOf} />
        <Subheadline section={section} animOf={animOf} />
        {videoEmbedUrl && <VideoEmbed url={videoEmbedUrl} anim={animOf("video")} />}
        <Body section={section} animOf={animOf} />
        <Bullets section={section} animOf={animOf} center />
        <CtaBlock section={section} mode={mode} animOf={animOf} />
      </div>
    </div>
  );
}

function WideBannerLayout({ section, mode, videoEmbedUrl, animOf }: any) {
  return (
    <div className="flex flex-col gap-6 items-center text-center">
      <Eyebrow section={section} animOf={animOf} />
      <Headline section={section} animOf={animOf} large />
      <Subheadline section={section} animOf={animOf} />
      {videoEmbedUrl && (
        <div className="w-full max-w-4xl">
          <VideoEmbed url={videoEmbedUrl} anim={animOf("video")} />
        </div>
      )}
      <Body section={section} animOf={animOf} />
      <Bullets section={section} animOf={animOf} center />
      <CtaBlock section={section} mode={mode} animOf={animOf} />
    </div>
  );
}

function DenseListLayout({ section, mode, animOf }: any) {
  const bullets: string[] = section.bullets ?? [];
  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      <Headline section={section} animOf={animOf} />
      <Body section={section} animOf={animOf} />
      {bullets.length > 0 && (
        <ul data-ff-bullets="stagger" className="ff-divide-list flex flex-col">
          {bullets.map((b, i) => (
            <li
              key={i}
              data-ff-anim={animOf("bullets") || DEFAULT_ANIM}
              className="ff-body py-3 text-sm leading-relaxed"
            >
              {b}
            </li>
          ))}
        </ul>
      )}
      <CtaBlock section={section} mode={mode} animOf={animOf} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-blocs réutilisables — utilisent les CSS variables du thème
// ─────────────────────────────────────────────────────────────────────────────

function Eyebrow({ section, animOf }: any) {
  if (!section.eyebrow) return null;
  return (
    <span
      data-ff-anim={animOf("eyebrow") || DEFAULT_ANIM}
      className="ff-eyebrow text-[11px] font-semibold uppercase tracking-[0.2em]"
    >
      {section.eyebrow}
    </span>
  );
}

function Headline({ section, animOf, large }: any) {
  if (!section.headline) return null;
  return (
    <h2
      data-ff-anim={animOf("headline") || DEFAULT_ANIM}
      className="ff-headline ff-headline-scaled leading-tight"
    >
      {section.headline}
    </h2>
  );
}


function Subheadline({ section, animOf }: any) {
  if (!section.subheadline) return null;
  return (
    <p
      data-ff-anim={animOf("subheadline") || DEFAULT_ANIM}
      className="ff-subheadline text-base md:text-lg max-w-2xl"
    >
      {section.subheadline}
    </p>
  );
}

function Body({ section, animOf }: any) {
  if (!section.body) return null;
  return (
    <p
      data-ff-anim={animOf("body") || DEFAULT_ANIM}
      className="ff-body text-sm md:text-base leading-relaxed max-w-2xl whitespace-pre-line"
    >
      {section.body}
    </p>
  );
}

function Bullets({ section, animOf, center }: any) {
  const bullets: string[] = section.bullets ?? [];
  if (bullets.length === 0) return null;
  return (
    <ul
      data-ff-bullets="stagger"
      className={`flex flex-col gap-2 ${
        center ? "items-center text-center" : "items-start text-left"
      }`}
    >
      {bullets.map((b, i) => (
        <li
          key={i}
          data-ff-anim={animOf("bullets") || DEFAULT_ANIM}
          className="ff-body text-sm md:text-base max-w-2xl"
        >
          • {b}
        </li>
      ))}
    </ul>
  );
}

function ImageBlock({ section, animOf }: any) {
  if (!section.image?.url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={section.image.url}
      alt={section.image.alt ?? ""}
      data-ff-anim={animOf("image") || "fade-in"}
      className="ff-image w-full h-auto rounded-2xl object-cover"
    />
  );
}

function ImagePlaceholder({ anim }: { anim: AnimationPreset }) {
  return (
    <div
      data-ff-anim={anim || "fade-in"}
      className="ff-image-placeholder w-full aspect-video rounded-2xl grid place-items-center text-xs"
    >
      Visuel
    </div>
  );
}

function VideoEmbed({ url, anim }: { url: string; anim: AnimationPreset }) {
  return (
    <div
      data-ff-anim={anim || "zoom-in"}
      className="ff-video relative w-full aspect-video rounded-2xl overflow-hidden bg-black"
    >
      <iframe
        src={url}
        title="Video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
}

function CtaBlock({ section, mode, animOf }: any) {
  if (!section.cta) return null;
  return (
    <div data-ff-anim={animOf("cta") || DEFAULT_ANIM} className="ff-cta-wrap mt-2">
      <CtaButton cta={section.cta} disabled={mode === "preview"} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Classes Tailwind par layout (espacement section)
// ─────────────────────────────────────────────────────────────────────────────

function layoutClass(_layout: SectionLayoutVariant): string {
  // L'espacement vertical vient du thème via --ff-section-py
  return "ff-section py-[var(--ff-section-py)] md:py-[var(--ff-section-py-md)] px-6";
}

function containerClass(layout: SectionLayoutVariant): string {
  switch (layout) {
    case "wide-banner":
    case "feature-grid":
    case "split-text-image":
    case "split-image-text":
      return "max-w-6xl mx-auto";
    case "stacked-card":
    case "dense-list":
      return "max-w-3xl mx-auto";
    case "centered":
    case "left-aligned":
    default:
      return "max-w-3xl mx-auto";
  }
}
