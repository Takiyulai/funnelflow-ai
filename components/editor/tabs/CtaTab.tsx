"use client";

import type {
  FunnelSection,
  Language,
  CtaConfig,
  CtaMode,
  CtaIcon,
  CtaSpacing,
  PopupProvider,
} from "@/lib/funnels/types";

type Props = {
  section: FunnelSection;
  language: Language;
  onChange: (patch: Partial<FunnelSection>) => void;
};

const ICON_OPTIONS: { value: CtaIcon; label: string }[] = [
  { value: "none", label: "Aucune" },
  { value: "arrow-right", label: "→ Flèche droite" },
  { value: "arrow-down", label: "↓ Flèche bas" },
  { value: "external", label: "↗ Lien externe" },
];

const DEFAULT_SPACING: CtaSpacing = {
  marginTop: 18,
  paddingX: 22,
  paddingY: 0,
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
          icon: "none",
          spacing: { ...DEFAULT_SPACING },
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

  const updateSpacing = (patch: Partial<CtaSpacing>) => {
    if (!cta) return;
    const next: CtaSpacing = { ...(cta.spacing ?? DEFAULT_SPACING), ...patch };
    onChange({ cta: { ...cta, spacing: next } });
  };

  const resetSpacing = () => {
    if (!cta) return;
    onChange({ cta: { ...cta, spacing: { ...DEFAULT_SPACING } } });
  };

  const setMode = (mode: CtaMode) => {
    if (!cta) return;
    // Préserver icon + spacing dans tous les cas
    const preserved = {
      label: cta.label,
      icon: cta.icon,
      spacing: cta.spacing,
    };
    if (mode === "redirect") {
      onChange({
        cta: {
          ...preserved,
          mode: "redirect",
          url: cta.url ?? "",
          target: cta.target ?? "_blank",
        },
      });
    } else if (mode === "anchor") {
      onChange({
        cta: {
          ...preserved,
          mode: "anchor",
          anchorId: cta.anchorId ?? "lead-form",
          target: "_self",
        },
      });
    } else if (mode === "popup") {
      onChange({
        cta: {
          ...preserved,
          mode: "popup",
          popupProvider: cta.popupProvider ?? "internal",
          popupId: cta.popupId ?? `popup-${section.id}`,
          popupTitle: cta.popupTitle ?? "Recevez votre accès",
          popupBody:
            cta.popupBody ??
            "Laissez vos coordonnées, l'accès vous est envoyé immédiatement.",
          popupEmbed: cta.popupEmbed ?? "",
          systemePopupId: cta.systemePopupId ?? "",
        },
      });
    }
  };

  const setPopupProvider = (provider: PopupProvider) => {
    if (!cta || cta.mode !== "popup") return;
    updateCta({ popupProvider: provider });
  };

  const spacing = cta?.spacing ?? DEFAULT_SPACING;

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
              <Field label="Type de popup">
                <div className="flex flex-wrap gap-1.5">
                  <ModeBtn
                    active={(cta.popupProvider ?? "internal") === "internal"}
                    onClick={() => setPopupProvider("internal")}
                  >
                    🧩 FunnelFlow (intégré)
                  </ModeBtn>
                  <ModeBtn
                    active={cta.popupProvider === "systeme"}
                    onClick={() => setPopupProvider("systeme")}
                  >
                    ⚡ Systeme.io
                  </ModeBtn>
                </div>
              </Field>

              {/* === Popup FunnelFlow interne === */}
              {(cta.popupProvider ?? "internal") === "internal" && (
                <>
                  <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-3 py-2 text-[11px] text-emerald-200/80">
                    ✓ Ce popup s'affiche directement sur votre tunnel FunnelFlow.
                    Aucune configuration externe nécessaire.
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

              {/* === Popup Systeme.io === */}
              {cta.popupProvider === "systeme" && (
                <>
                  <div className="rounded-lg border border-violet-300/20 bg-violet-300/5 px-3 py-2.5 text-[11px] text-violet-100/85">
                    <p className="mb-1.5 font-semibold text-violet-200">
                      Procédure Systeme.io
                    </p>
                    <ol className="ml-3 list-decimal space-y-1 text-violet-100/75">
                      <li>
                        Dans Systeme.io, créez une étape « Formulaire » et notez son
                        <strong> ID</strong> (ex : 24034535).
                      </li>
                      <li>
                        Copiez le <code className="text-amber-200">&lt;script id="form-script-tag-…"&gt;</code> fourni.
                      </li>
                      <li>
                        Collez-le dans <strong>Style global → Intégrations → Script Systeme.io</strong>.
                      </li>
                      <li>Renseignez ci-dessous l'ID du popup à ouvrir.</li>
                    </ol>
                  </div>

                  <Field
                    label="ID du popup Systeme.io"
                    required
                    hint="Chiffres uniquement, ex : 24034535 (visible dans l'URL ou les paramètres du formulaire)"
                  >
                    <input
                      type="text"
                      value={cta.systemePopupId ?? ""}
                      onChange={(e) =>
                        updateCta({
                          systemePopupId: e.target.value.replace(/[^0-9]/g, ""),
                        })
                      }
                      className={inputClass}
                      placeholder="24034535"
                      inputMode="numeric"
                    />
                  </Field>
                </>
              )}
            </>
          )}

          {/* === Icône du bouton === */}
          <Field label="Icône" hint="Affichée à droite du texte">
            <div className="flex flex-wrap gap-1.5">
              {ICON_OPTIONS.map((opt) => (
                <ModeBtn
                  key={opt.value}
                  active={(cta.icon ?? "none") === opt.value}
                  onClick={() => updateCta({ icon: opt.value })}
                >
                  {opt.label}
                </ModeBtn>
              ))}
            </div>
          </Field>

          {/* === Espacement du CTA === */}
          <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                Espacement
              </div>
              <button
                type="button"
                onClick={resetSpacing}
                className="rounded border border-white/10 bg-white/[0.02] px-2 py-0.5 text-[10px] font-medium text-white/60 hover:border-white/20 hover:text-white"
              >
                Reset
              </button>
            </div>

            <Field label={`Marge au-dessus : ${spacing.marginTop ?? 18}px`}>
              <input
                type="range"
                min={0}
                max={80}
                step={2}
                value={spacing.marginTop ?? 18}
                onChange={(e) => updateSpacing({ marginTop: Number(e.target.value) })}
                className="w-full accent-amber-300"
              />
            </Field>

            <Field label={`Padding horizontal : ${spacing.paddingX ?? 22}px`}>
              <input
                type="range"
                min={16}
                max={48}
                step={1}
                value={spacing.paddingX ?? 22}
                onChange={(e) => updateSpacing({ paddingX: Number(e.target.value) })}
                className="w-full accent-amber-300"
              />
            </Field>

            <Field label={`Padding vertical : ${spacing.paddingY ?? 0}px (0 = auto)`}>
              <input
                type="range"
                min={0}
                max={32}
                step={1}
                value={spacing.paddingY ?? 0}
                onChange={(e) => updateSpacing({ paddingY: Number(e.target.value) })}
                className="w-full accent-amber-300"
              />
            </Field>
          </div>
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
