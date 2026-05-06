"use client";

import type { Funnel } from "@/lib/funnels/types";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";

type Props = {
  funnel: Funnel;
};

export function PublicFunnelView({ funnel }: Props) {
  return (
    <main
      className="min-h-screen"
      id="top"
      style={{ background: "var(--ff-bg, #ffffff)", color: "var(--ff-ink, #0f172a)" }}
    >
      <FunnelPreview
        funnel={funnel}
        forcedMode="desktop"
        showToolbar={false}
        viewportHeight="auto"
        className="!rounded-none !border-0 !shadow-none"
      />

      <PublicLeadForm language={funnel.language} />
    </main>
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
