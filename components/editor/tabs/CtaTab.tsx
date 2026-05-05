"use client";

import type {
  FunnelSection,
  Language,
  CtaConfig,
  CtaMode,
} from "@/lib/funnels/types";

type Props = {
  section: FunnelSection;
  language: Language;
  onChange: (patch: Partial<FunnelSection>) => void;
};

export function CtaTab({ section, onChange }: Props) {
  const cta: CtaConfig | undefined = section.cta;
  const enabled = Boolean(cta);

  const toggleEnabled = (next: boolean) => {
    if (next) {
      onChange({
        cta: {
          mode: "anchor",
          label: "Je veux y accéder",
          anchorId: "lead-form",
          target: "_self",
        },
      });
    } else {
      onChange({ cta: undefined });
    }
  };

  const updateCta = (patch: Partial<CtaConfig>) => {
    if (!cta) return;
    onChange({ cta: { ...cta, ...patch } });
  };

  const setMode = (mode: CtaMode) => {
    if (!cta) return;
    if (mode === "redirect") {
      onChange({
        cta: {
          mode: "redirect",
          label: cta.label,
          url: cta.url ?? "",
          target: cta.target ?? "_blank",
        },
      });
    } else if (mode === "anchor") {
      onChange({
        cta: {
          mode: "anchor",
          label: cta.label,
          anchorId: cta.anchorId ?? "lead-form",
          target: "_self",
        },
      });
    } else if (mode === "popup") {
      onChange({
        cta: {
          mode: "popup",
          label: cta.label,
          popupId: cta.popupId ?? `popup-${section.id}`,
          popupTitle: cta.popupTitle ?? "Recevez votre accès",
          popupBody:
            cta.popupBody ??
            "Laissez vos coordonnées, l'accès vous est envoyé immédiatement.",
          popupEmbed: cta.popupEmbed ?? "",
        },
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2.5">
        <div>
          <div className="text-xs font-medium text-white">Bouton CTA actif</div>
          <div className="text-[10px] text-white/50">
            Affiche un appel à l'action dans cette section
          </div>
        </div>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => toggleEnabled(e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-amber-300"
        />
      </label>

      {enabled && cta && (
        <>
          <Field label="Texte du bouton" required>
            <input
              type="text"
              value={cta.label}
              onChange={(e) => updateCta({ label: e.target.value })}
              className={inputClass}
              placeholder="Ex : Je commence maintenant"
            />
          </Field>

          <Field label="Action au clic">
            <div className="flex flex-wrap gap-1.5">
              <ModeBtn active={cta.mode === "anchor"} onClick={() => setMode("anchor")}>
                ⬇ Aller au formulaire
              </ModeBtn>
              <ModeBtn
                active={cta.mode === "redirect"}
                onClick={() => setMode("redirect")}
              >
                🔗 Redirection
              </ModeBtn>
              <ModeBtn active={cta.mode === "popup"} onClick={() => setMode("popup")}>
                💬 Ouvrir un popup
              </ModeBtn>
            </div>
          </Field>

          {/* Mode ANCRE */}
          {cta.mode === "anchor" && (
            <Field
              label="ID de la section cible"
              hint="Le formulaire intégré utilise par défaut id='lead-form'. Laissez tel quel sauf cas particulier."
            >
              <input
                type="text"
                value={cta.anchorId ?? ""}
                onChange={(e) => updateCta({ anchorId: e.target.value })}
                className={inputClass}
                placeholder="lead-form"
              />
            </Field>
          )}

          {/* Mode REDIRECTION */}
          {cta.mode === "redirect" && (
            <>
              <Field
                label="URL de destination"
                required
                hint="Page de paiement systeme.io, Calendly, Stripe Checkout, etc."
              >
                <input
                  type="url"
                  value={cta.url ?? ""}
                  onChange={(e) => updateCta({ url: e.target.value })}
                  className={inputClass}
                  placeholder="https://exemple.com/checkout"
                />
              </Field>
              <Field label="Ouverture">
                <div className="flex gap-1.5">
                  <ModeBtn
                    active={(cta.target ?? "_blank") === "_blank"}
                    onClick={() => updateCta({ target: "_blank" })}
                  >
                    Nouvel onglet
                  </ModeBtn>
                  <ModeBtn
                    active={cta.target === "_self"}
                    onClick={() => updateCta({ target: "_self" })}
                  >
                    Même onglet
                  </ModeBtn>
                </div>
              </Field>
            </>
          )}

          {/* Mode POPUP */}
          {cta.mode === "popup" && (
            <>
              <div className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2.5 text-[11px] text-amber-100/80">
                Le popup est <strong>embarqué dans le bloc HTML exporté</strong>.
                Aucune configuration systeme.io supplémentaire nécessaire — collez
                le bloc, ça fonctionne.
              </div>

              <Field label="Titre du popup" required>
                <input
                  type="text"
                  value={cta.popupTitle ?? ""}
                  onChange={(e) => updateCta({ popupTitle: e.target.value })}
                  className={inputClass}
                  placeholder="Recevez votre accès"
                />
              </Field>

              <Field label="Texte d'introduction" hint="1 à 2 phrases courtes">
                <textarea
                  value={cta.popupBody ?? ""}
                  onChange={(e) => updateCta({ popupBody: e.target.value })}
                  className={`${inputClass} min-h-[60px] resize-y py-2`}
                  placeholder="Laissez vos coordonnées, l'accès vous est envoyé immédiatement."
                />
              </Field>

              <Field
                label="Code d'embed formulaire systeme.io"
                hint="Dans systeme.io : Formulaires → votre formulaire → Code d'intégration → copier/coller ici. Laissez vide pour un formulaire de démonstration."
              >
                <textarea
                  value={cta.popupEmbed ?? ""}
                  onChange={(e) => updateCta({ popupEmbed: e.target.value })}
                  className={`${inputClass} min-h-[100px] resize-y py-2 font-mono text-[11px]`}
                  placeholder={'<form action="https://systeme.io/..." method="POST">\n  ...\n</form>'}
                />
              </Field>

              <Field
                label="Identifiant technique"
                hint="Généré automatiquement, modifiez seulement si nécessaire"
              >
                <input
                  type="text"
                  value={cta.popupId ?? ""}
                  onChange={(e) =>
                    updateCta({
                      popupId: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "-"),
                    })
                  }
                  className={inputClass}
                  placeholder={`popup-${section.id}`}
                />
              </Field>
            </>
          )}
        </>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-amber-300/40 placeholder:text-white/30";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-white/70">
        {label}
        {required && <span className="text-amber-300">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-white/40">{hint}</p>}
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md border px-2.5 py-1 text-[11px] transition-colors",
        active
          ? "border-amber-300/40 bg-amber-300/10 text-amber-200"
          : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
