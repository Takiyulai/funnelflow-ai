"use client";

import { ExternalLink } from "lucide-react";
import type {
  AnimationPreset,
  CtaConfig,
  FunnelSection,
  SectionAnimations,
} from "@/lib/funnels/types";
import { ctaHref, ctaTarget, ctaRel, ctaIsExternal } from "@/lib/funnels/cta";
import { getVideoEmbed } from "@/lib/funnels/video";
import { useScrollReveal } from "@/hooks/useScrollReveal";

// Helper : lit un preset d'animation pour une cible donnée, avec fallback fade-up.
function animOf(
  animations: SectionAnimations | undefined,
  target: keyof SectionAnimations,
  fallback: AnimationPreset = "fade-up"
): AnimationPreset {
  return animations?.[target] ?? fallback;
}

type Props = {
  sections: FunnelSection[];
  accent: string;
  dark: string;
};

/**
 * Rendu animé de la liste des sections du tunnel public.
 * Chaque élément clé porte data-ff-anim pour être révélé au scroll
 * via le hook useScrollReveal (IntersectionObserver).
 */
export function FunnelSectionsAnimated({ sections, accent, dark }: Props) {
  const containerRef = useScrollReveal<HTMLDivElement>();

  return (
    <div ref={containerRef}>
      {sections.map((section) => (
        <SectionRenderer
          key={section.id}
          section={section}
          accent={accent}
          dark={dark}
        />
      ))}
    </div>
  );
}

function SectionRenderer({
  section,
  accent,
  dark,
}: {
  section: FunnelSection;
  accent: string;
  dark: string;
}) {
  const hasUploadedImage = section.image?.mode === "upload" && section.image?.url;

  return (
    <section
      id={section.id}
      data-ff-section={section.type}
      data-ff-layout={section.layoutVariant ?? "centered"}
      className="border-b border-line px-6 py-20 sm:px-10"
    >
      <div className="mx-auto max-w-4xl">
        {section.eyebrow && (
          <span
            data-ff-anim={animOf(section.animations, "eyebrow", "fade-in")}
            className="inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
            style={{ background: `${accent}20`, color: dark }}
          >
            {section.eyebrow}
          </span>
        )}

        <h2
          data-ff-anim={animOf(section.animations, "headline", "fade-up")}
          className="mt-4 text-4xl font-black leading-tight text-ink sm:text-5xl"
        >
          {section.headline}
        </h2>

        {section.subheadline && (
          <p
            data-ff-anim={animOf(section.animations, "subheadline", "fade-up")}
            className="mt-4 max-w-3xl text-lg leading-relaxed text-muted"
          >
            {section.subheadline}
          </p>
        )}

        {section.body && (
          <p
            data-ff-anim={animOf(section.animations, "body", "fade-up")}
            className="mt-5 max-w-3xl leading-8 text-muted whitespace-pre-line"
          >
            {section.body}
          </p>
        )}

        {section.bullets?.length ? (
          <ul data-ff-bullets="stagger" className="mt-6 grid gap-3">
            {section.bullets.map((item, i) => (
              <li
                key={`${section.id}-bullet-${i}`}
                data-ff-anim={animOf(section.animations, "bullets", "fade-up")}
                className="flex gap-2"
              >
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: accent }}
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {section.video?.url && (
          <VideoEmbedBlock
            url={section.video.url}
            anim={animOf(section.animations, "video", "zoom-in")}
          />
        )}

        {hasUploadedImage && (
          <figure
            data-ff-anim={animOf(section.animations, "image", "fade-in")}
            className="mt-8 overflow-hidden rounded-xl border border-line"
          >
            <img
              src={section.image!.url!}
              alt={section.image!.alt ?? ""}
              className="h-auto w-full"
              loading="lazy"
            />
          </figure>
        )}

        {section.cta && (
          <CtaButton
            cta={section.cta}
            accent={accent}
            dark={dark}
            anim={animOf(section.animations, "cta", "fade-up")}
          />
        )}
      </div>
    </section>
  );
}

function VideoEmbedBlock({
  url,
  anim,
}: {
  url: string;
  anim?: AnimationPreset;
}) {
  const embed = getVideoEmbed(url);
  if (!embed.embedUrl) return null;
  return (
    <div
      data-ff-anim={anim ?? "zoom-in"}
      className="mt-8 overflow-hidden rounded-xl border border-line"
    >
      <div className="relative aspect-video w-full bg-black">
        <iframe
          src={embed.embedUrl}
          title="Vidéo"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
}

function CtaButton({
  cta,
  accent,
  dark,
  anim,
}: {
  cta: CtaConfig;
  accent: string;
  dark: string;
  anim?: AnimationPreset;
}) {
  const href = ctaHref(cta);
  const target = ctaTarget(cta);
  const rel = ctaRel(cta);
  const external = ctaIsExternal(cta);

  return (
    <a
      href={href}
      target={target}
      rel={rel}
      data-ff-anim={anim ?? "fade-up"}
      className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-6 font-black transition hover:opacity-90"
      style={{ background: accent, color: dark }}
    >
      {cta.label}
      {external && <ExternalLink size={14} />}
    </a>
  );
}
