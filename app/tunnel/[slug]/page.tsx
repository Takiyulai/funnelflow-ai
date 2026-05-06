// app/tunnel/[slug]/page.tsx
import { demoFunnel } from "@/lib/funnels/demo";
import type { Funnel } from "@/lib/funnels/types";
import { FunnelSectionsAnimated } from "@/components/funnel/FunnelSectionsAnimated";
import { PublicFunnelClient } from "@/components/funnel/PublicFunnelClient";
import { TemplateThemeProvider } from "@/components/funnel/TemplateThemeProvider";
import { getTemplateButtonAnim } from "@/lib/funnels/templates";
import FunnelFooter from "@/components/funnel/FunnelFooter";

// Slugs résolus côté serveur (statiques / démo)
const SERVER_FUNNELS: Record<string, Funnel> = {
  demo: demoFunnel,
};

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function TunnelPublicPage({ params }: PageProps) {
  const { slug } = await params;
  const funnel = SERVER_FUNNELS[slug];

  // Slug serveur (demo) : on rend tout côté serveur
  if (funnel) {
    return <PublicFunnelView funnel={funnel} />;
  }

  // Slug inconnu côté serveur : on délègue au client qui lira localStorage
  return <PublicFunnelClient slug={slug} />;
}

// Vue partagée serveur (demo) — extraite pour clarté
function PublicFunnelView({ funnel }: { funnel: Funnel }) {
  const visibleSections = funnel.sections.filter((s) => s.visible !== false);
  const templateId =
    (funnel.meta as { templateId?: string } | undefined)?.templateId ??
    "story-sell";
  const accent = funnel.design?.secondaryColor;
  const primary = funnel.design?.primaryColor;
  const animationsEnabled =
    (funnel.design as { animationsEnabled?: boolean } | undefined)
      ?.animationsEnabled !== false;
  const userButtonAnim = (funnel.design as { buttonAnim?: "lift" | "glow" | "pulse" | "shine" } | undefined)?.buttonAnim;
const buttonAnim = userButtonAnim ?? getTemplateButtonAnim(templateId);
  return (
    <TemplateThemeProvider
  templateId={templateId}
  buttonAnim={buttonAnim}
  animationsEnabled={animationsEnabled}
  overrides={{
    accent: accent || undefined,
    primary: primary || undefined,
  }}
>
      <main
        className="min-h-screen"
        id="top"
        style={{ background: "var(--ff-bg)", color: "var(--ff-ink)" }}
      >
        <FunnelSectionsAnimated
          sections={visibleSections}
          accent={accent ?? "#C7A436"}
          dark={primary ?? "#080E1A"}
        />
        <FunnelFooter funnel={funnel} />

        <PublicLeadForm language={funnel.language} />
      </main>
    </TemplateThemeProvider>
  );
}

// Formulaire de lead intégré, pleinement thémé
function PublicLeadForm({ language }: { language: Funnel["language"] }) {
  const labels = {
    fr: {
      title: "Recevoir les détails",
      name: "Votre nom",
      submit: "Continuer",
    },
    en: { title: "Get the details", name: "Your name", submit: "Continue" },
    es: {
      title: "Recibir los detalles",
      name: "Tu nombre",
      submit: "Continuar",
    },
  } as const;
  const l = labels[language] ?? labels.fr;

  return (
    <section
      id="lead-form"
      className="ff-section px-6 py-20 sm:px-10"
    >
      <div className="mx-auto max-w-md">
        <h2 className="ff-headline text-3xl">{l.title}</h2>
        <form className="mt-6 grid gap-3">
          <input
            type="text"
            name="name"
            placeholder={l.name}
            required
            className="min-h-12 rounded-lg border border-[color:var(--ff-border)] bg-[color:var(--ff-card-bg)] px-4 text-[color:var(--ff-ink)] placeholder:text-[color:var(--ff-muted)] focus:border-[color:var(--ff-accent)] focus:outline-none"
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            required
            className="min-h-12 rounded-lg border border-[color:var(--ff-border)] bg-[color:var(--ff-card-bg)] px-4 text-[color:var(--ff-ink)] placeholder:text-[color:var(--ff-muted)] focus:border-[color:var(--ff-accent)] focus:outline-none"
          />
          <button type="submit" className="ff-btn min-h-12" data-ff-cta>
            {l.submit}
          </button>
        </form>
      </div>
    </section>
  );
}
