// app/tunnel/[slug]/page.tsx
import { notFound } from "next/navigation";
import { demoFunnel } from "@/lib/funnels/demo";
import type { Funnel, CtaConfig } from "@/lib/funnels/types";

// Map des slugs vers les funnels disponibles
// Pour le MVP : un seul tunnel "demo". Plus tard on lira en base.
const FUNNELS: Record<string, Funnel> = {
  demo: demoFunnel,
};

// Next.js 15 : params est une Promise
type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function TunnelPublicPage({ params }: PageProps) {
  const { slug } = await params;
  const funnel = FUNNELS[slug];
  if (!funnel) notFound();

  const visibleSections = funnel.sections.filter((s) => s.visible !== false);
  const dark = funnel.design?.primaryColor ?? "#080E1A";
  const accent = funnel.design?.secondaryColor ?? "#C7A436";

  return (
    <main className="min-h-screen bg-white text-ink" id="top">
      {visibleSections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className="border-b border-line px-6 py-20 sm:px-10"
        >
          <div className="mx-auto max-w-4xl">
            {section.eyebrow && (
              <span
                className="inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
                style={{ background: `${accent}20`, color: dark }}
              >
                {section.eyebrow}
              </span>
            )}

            <h2 className="mt-4 text-4xl font-black leading-tight text-ink sm:text-5xl">
              {section.headline}
            </h2>

            {section.subheadline && (
              <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted">
                {section.subheadline}
              </p>
            )}

            {section.body && (
              <p className="mt-5 max-w-3xl leading-8 text-muted whitespace-pre-line">
                {section.body}
              </p>
            )}

            {section.bullets?.length ? (
              <ul className="mt-6 grid gap-3">
                {section.bullets.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: accent }}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {section.image?.mode !== "none" && section.image?.url && (
              <figure className="mt-8 overflow-hidden rounded-xl border border-line">
                <img
                  src={section.image.url}
                  alt={section.image.alt ?? ""}
                  className="h-auto w-full"
                  loading="lazy"
                />
              </figure>
            )}

            {section.cta && <CtaButton cta={section.cta} accent={accent} dark={dark} />}
          </div>
        </section>
      ))}

      {/* Formulaire lead intégré */}
      <section
        id="lead-form"
        className="px-6 py-20 sm:px-10"
        style={{ background: dark, color: "white" }}
      >
        <div className="mx-auto max-w-md">
          <h2 className="text-3xl font-black">Recevoir les détails</h2>
          <form className="mt-6 grid gap-3">
            <input
              type="text"
              name="name"
              placeholder="Votre nom"
              required
              className="min-h-12 rounded-lg border border-white/20 bg-white/5 px-4 text-white placeholder:text-white/50 focus:border-white/40 focus:outline-none"
            />
            <input
              type="email"
              name="email"
              placeholder="Votre email"
              required
              className="min-h-12 rounded-lg border border-white/20 bg-white/5 px-4 text-white placeholder:text-white/50 focus:border-white/40 focus:outline-none"
            />
            <button
              type="submit"
              className="min-h-12 rounded-lg font-black"
              style={{ background: accent, color: dark }}
            >
              Continuer
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

// Construit l'URL et le comportement du CTA selon son mode
function ctaHref(cta: CtaConfig): string {
  if (cta.mode === "anchor") {
    const id = (cta.anchorId ?? "lead-form").replace(/^#/, "");
    return `#${id}`;
  }
  if (cta.mode === "popup") {
    return `#${cta.popupId ?? "popup"}`;
  }
  if (cta.mode === "redirect" && cta.url) {
    return cta.url;
  }
  return "#lead-form";
}

function CtaButton({
  cta,
  accent,
  dark,
}: {
  cta: CtaConfig;
  accent: string;
  dark: string;
}) {
  const href = ctaHref(cta);
  const target = cta.mode === "redirect" && cta.target === "_blank" ? "_blank" : "_self";
  const rel = target === "_blank" ? "noopener" : undefined;

  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className="mt-8 inline-flex min-h-12 items-center justify-center rounded-lg px-6 font-black transition hover:opacity-90"
      style={{ background: accent, color: dark }}
    >
      {cta.label}
    </a>
  );
}
