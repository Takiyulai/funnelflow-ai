"use client";

import { useEffect, useState } from "react";
import type { Funnel } from "@/lib/funnels/types";
import { loadPublishedFunnel, loadFunnelBySlug } from "@/lib/store/funnelStore";
import { FunnelSectionsAnimated } from "@/components/funnel/FunnelSectionsAnimated";
import { TemplateThemeProvider } from "@/components/funnel/TemplateThemeProvider";
import { getTemplateButtonAnim } from "@/lib/funnels/templates";
import FunnelFooter from "@/components/funnel/FunnelFooter";

type State =
  | { status: "loading" }
  | { status: "found"; funnel: Funnel }
  | { status: "not-found" };

type Props = { slug: string };

export function PublicFunnelClient({ slug }: Props) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    // 1. Funnel publié explicitement (ff:public:<slug>)
    const published = loadPublishedFunnel(slug);
    if (published) {
      setState({ status: "found", funnel: published.funnel });
      return;
    }
    // 2. Fallback : funnel non publié mais existant en local (preview live)
    const local = loadFunnelBySlug(slug);
    if (local) {
      setState({ status: "found", funnel: local.funnel });
      return;
    }
    setState({ status: "not-found" });
  }, [slug]);

  if (state.status === "loading") {
    return (
      <main className="grid min-h-screen place-items-center bg-white">
        <p className="text-sm text-slate-500">Chargement du tunnel...</p>
      </main>
    );
  }

  if (state.status === "not-found") {
    return (
      <main className="grid min-h-screen place-items-center bg-white px-6 text-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            Tunnel introuvable
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Ce tunnel n'existe pas ou n'a pas encore été publié sur cet appareil
          </p>
        </div>
      </main>
    );
  }

  const { funnel } = state;
  const visibleSections = funnel.sections.filter((s) => s.visible !== false);
  const templateId =
    (funnel.meta as { templateId?: string } | undefined)?.templateId ??
    "story-sell";
  const accent = funnel.design?.secondaryColor;
  const primary = funnel.design?.primaryColor;
  const animationsEnabled =
    (funnel.design as { animationsEnabled?: boolean } | undefined)
      ?.animationsEnabled !== false;
  const buttonAnim = getTemplateButtonAnim(templateId);

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
    <section id="lead-form" className="ff-section px-6 py-20 sm:px-10">
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
