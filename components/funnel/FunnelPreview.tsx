import { Badge } from "@/components/ui/Badge";
import type { Funnel } from "@/lib/funnels/types";

export function FunnelPreview({ funnel, mode = "desktop", logoSrc }: { funnel: Funnel; mode?: "desktop" | "mobile"; logoSrc?: string }) {
  const primary = funnel.design.primaryColor || "#082B4C";
  const gold = funnel.design.secondaryColor || "#F4C542";
  const green = funnel.design.accentColor || "#35B779";
  const hero = funnel.sections[0];
  const rest = funnel.sections.slice(1);

  return (
    <div className={`mx-auto overflow-hidden rounded-lg border border-line bg-white shadow-premium ${mode === "mobile" ? "max-w-[360px]" : "w-full"}`}>
      <div className="flex items-center gap-2 border-b border-line bg-canvas px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-300" />
        <span className="h-3 w-3 rounded-full bg-gold" />
        <span className="h-3 w-3 rounded-full bg-green" />
      </div>
      <div className="bg-[#F8FAFC]">
        <section className={`grid gap-8 px-6 py-10 ${mode === "mobile" ? "" : "md:grid-cols-[1.08fr_.92fr] md:px-10 md:py-14"}`} style={{ background: primary, color: "white" }}>
          <div>
            <div className="mb-8 flex items-center gap-3">
              {logoSrc ? <img src={logoSrc} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-lg text-sm font-black" style={{ background: gold, color: primary }}>FF</span>}
              <span className="text-sm font-black">{funnel.funnelName.split(" - ")[0]}</span>
            </div>
            {hero?.eyebrow ? <Badge tone="gold">{hero.eyebrow}</Badge> : null}
            <h2 className={`mt-4 font-black leading-tight ${mode === "mobile" ? "text-3xl" : "text-6xl"}`}>{hero?.headline}</h2>
            {hero?.subheadline ? <p className="mt-5 max-w-2xl text-base leading-7 text-white/75">{hero.subheadline}</p> : null}
            {hero?.cta ? <button className="mt-7 min-h-12 rounded-lg px-5 text-sm font-black shadow-lg" style={{ background: gold, color: primary }}>{hero.cta}</button> : null}
            <div className="mt-7 flex flex-wrap gap-2 text-xs font-bold text-white/80">
              <span className="rounded-full bg-white/10 px-3 py-1">Mobile-first</span>
              <span className="rounded-full bg-white/10 px-3 py-1">Systeme.io ready</span>
              <span className="rounded-full bg-white/10 px-3 py-1">Email sequence</span>
            </div>
          </div>
          <div className="rounded-lg bg-white p-4 text-ink shadow-premium">
            <div className="rounded-lg border border-line p-4">
              <p className="text-xs font-black uppercase" style={{ color: green }}>Plan du tunnel</p>
              <div className="mt-4 grid gap-3">
                {["Page de vente", "Formulaire lead", "Page merci", "3 emails", "Export HTML"].map((item, index) => (
                  <div key={item} className="flex items-center gap-3 rounded-lg bg-canvas p-3 text-sm font-bold">
                    <span className="grid h-7 w-7 place-items-center rounded-full text-xs" style={{ background: index === 0 ? gold : "#EAF3FF", color: primary }}>{index + 1}</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {rest.map((section, index) => (
          <section key={section.id} className={`px-6 py-10 ${index % 2 === 0 ? "bg-white" : "bg-canvas"}`}>
            <div className={`${mode === "mobile" ? "" : "mx-auto grid max-w-5xl grid-cols-[.8fr_1.2fr] gap-8"}`}>
              <div>
                {section.eyebrow ? <p className="text-xs font-black uppercase" style={{ color: green }}>{section.eyebrow}</p> : null}
                <h2 className={`mt-2 font-black leading-tight text-ink ${mode === "mobile" ? "text-2xl" : "text-4xl"}`}>{section.headline}</h2>
              </div>
              <div>
                {section.subheadline ? <p className="text-base leading-7 text-muted">{section.subheadline}</p> : null}
                {section.body ? <p className="text-base leading-7 text-muted">{section.body}</p> : null}
                {section.type === "form" ? (
                  <div className="mt-5 grid gap-3 rounded-lg border border-line bg-white p-4">
                    <input className="min-h-11 rounded-lg border border-line px-3 text-sm" placeholder="Nom" />
                    <input className="min-h-11 rounded-lg border border-line px-3 text-sm" placeholder="Email" />
                    <button className="min-h-11 rounded-lg text-sm font-black" style={{ background: gold, color: primary }}>{section.cta ?? "Continuer"}</button>
                  </div>
                ) : null}
                {section.bullets?.length ? (
                  <div className="mt-5 grid gap-3">
                    {section.bullets.map((item) => (
                      <div key={item} className="flex gap-3 rounded-lg border border-line bg-white p-3 text-sm font-semibold text-ink">
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: green }} />
                        {item}
                      </div>
                    ))}
                  </div>
                ) : null}
                {section.cta && section.type !== "form" ? <button className="mt-6 min-h-11 rounded-lg px-5 text-sm font-black" style={{ background: gold, color: primary }}>{section.cta}</button> : null}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
