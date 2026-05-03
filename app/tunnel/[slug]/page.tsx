import { PublicLeadForm } from "@/components/funnel/PublicLeadForm";
import { demoFunnel } from "@/lib/funnels/demo";

export default function PublicTunnelPage() {
  return (
    <main className="bg-canvas">
      {demoFunnel.sections.map((section, index) => (
        <section
          key={section.id}
          className={`px-4 py-16 sm:px-6 lg:px-8 ${
            index === 0 ? "bg-navy text-white" : "bg-white text-ink"
          }`}
        >
          <div className="mx-auto max-w-5xl">
            {section.eyebrow ? (
              <p className="text-sm font-black uppercase text-gold">
                {section.eyebrow}
              </p>
            ) : null}

            <h1 className="mt-3 text-4xl font-black leading-tight sm:text-6xl">
              {section.headline}
            </h1>

            {section.subheadline ? (
              <p
                className={`mt-5 max-w-3xl text-lg leading-8 ${
                  index === 0 ? "text-white/75" : "text-muted"
                }`}
              >
                {section.subheadline}
              </p>
            ) : null}

            {section.body ? (
              <p className="mt-5 max-w-3xl leading-8 text-muted">
                {section.body}
              </p>
            ) : null}

            {section.bullets?.length ? (
              <ul className="mt-6 grid gap-3">
                {section.bullets.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            ) : null}

            {/* ✅ CTA corrigé (Option A) */}
            {section.cta ? (
              <a
                href="#lead"
                className="mt-8 inline-flex min-h-12 items-center rounded-lg bg-gold px-6 font-black text-navy"
              >
                {section.cta.label}
              </a>
            ) : null}
          </div>
        </section>
      ))}

      <section id="lead" className="px-4 py-16 sm:px-6 lg:px-8">
        <PublicLeadForm funnelId="demo" />
      </section>
    </main>
  );
}