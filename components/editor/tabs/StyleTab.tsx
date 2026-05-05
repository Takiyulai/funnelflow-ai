"use client";

import type {
  FunnelSection,
  Language,
  SectionAlign,
  SectionLayoutVariant,
  AnimationPreset,
  AnimationTarget,
  SectionAnimations,
  SectionStyle,
} from "@/lib/funnels/types";

type Props = {
  section: FunnelSection;
  language: Language;
  onChange: (patch: Partial<FunnelSection>) => void;
};

const LAYOUTS: { value: SectionLayoutVariant; label: string }[] = [
  { value: "centered", label: "Centré" },
  { value: "left-aligned", label: "Aligné à gauche" },
  { value: "split-text-image", label: "Texte | Image" },
  { value: "split-image-text", label: "Image | Texte" },
  { value: "stacked-card", label: "Carte empilée" },
  { value: "wide-banner", label: "Bannière large" },
  { value: "feature-grid", label: "Grille de features" },
  { value: "dense-list", label: "Liste dense" },
];

const ALIGNS: { value: SectionAlign; label: string }[] = [
  { value: "left", label: "Gauche" },
  { value: "center", label: "Centré" },
  { value: "right", label: "Droite" },
];

const PRESETS: AnimationPreset[] = [
  "none",
  "fade-in",
  "fade-up",
  "fade-down",
  "slide-left",
  "slide-right",
  "zoom-in",
  "zoom-out",
  "pulse",
];

const ANIM_TARGETS: { key: AnimationTarget; label: string }[] = [
  { key: "eyebrow", label: "Eyebrow" },
  { key: "headline", label: "Headline" },
  { key: "subheadline", label: "Subheadline" },
  { key: "body", label: "Body" },
  { key: "bullets", label: "Bullets" },
  { key: "image", label: "Image" },
  { key: "video", label: "Vidéo" },
  { key: "cta", label: "CTA" },
];

export function StyleTab({ section, onChange }: Props) {
  const animations: SectionAnimations = section.animations ?? {};
  const style: SectionStyle = section.style ?? {};
  const currentAlign: SectionAlign = style.align ?? "left";

  const updateAnim = (target: AnimationTarget, preset: AnimationPreset) => {
    onChange({
      animations: {
        ...animations,
        [target]: preset,
      },
    });
  };

  const updateAlign = (align: SectionAlign) => {
    onChange({
      style: { ...style, align },
    });
  };

  const updateSpacing = (spacing: NonNullable<SectionStyle["spacing"]>) => {
    onChange({
      style: { ...style, spacing },
    });
  };

  return (
    <div className="space-y-5">
      {/* Layout */}
      <Field label="Layout (variante de mise en page)">
        <select
          value={section.layoutVariant ?? "centered"}
          onChange={(e) =>
            onChange({ layoutVariant: e.target.value as SectionLayoutVariant })
          }
          className={selectClass}
        >
          {LAYOUTS.map((l) => (
            <option key={l.value} value={l.value} className="bg-zinc-900">
              {l.label}
            </option>
          ))}
        </select>
      </Field>

      {/* Align */}
      <Field label="Alignement du texte">
        <div className="flex gap-1.5">
          {ALIGNS.map((a) => (
            <ModeBtn
              key={a.value}
              active={currentAlign === a.value}
              onClick={() => updateAlign(a.value)}
            >
              {a.label}
            </ModeBtn>
          ))}
        </div>
      </Field>

      {/* Spacing */}
      <Field label="Espacement">
        <div className="flex gap-1.5">
          <ModeBtn
            active={(style.spacing ?? "default") === "compact"}
            onClick={() => updateSpacing("compact")}
          >
            Compact
          </ModeBtn>
          <ModeBtn
            active={(style.spacing ?? "default") === "default"}
            onClick={() => updateSpacing("default")}
          >
            Normal
          </ModeBtn>
          <ModeBtn
            active={(style.spacing ?? "default") === "large"}
            onClick={() => updateSpacing("large")}
          >
            Aéré
          </ModeBtn>
        </div>
      </Field>

      {/* Animations */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/70">
          Animations au scroll
        </h3>
        <p className="mb-3 text-[10px] text-white/40">
          Une animation par cible. « none » désactive l'animation.
        </p>
        <div className="space-y-1.5">
          {ANIM_TARGETS.map((t) => (
            <div
              key={t.key}
              className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/20 px-2.5 py-1.5"
            >
              <span className="w-20 shrink-0 text-[11px] text-white/60">
                {t.label}
              </span>
              <select
                value={animations[t.key] ?? "none"}
                onChange={(e) =>
                  updateAnim(t.key, e.target.value as AnimationPreset)
                }
                className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-white outline-none focus:border-amber-300/40"
              >
                {PRESETS.map((p) => (
                  <option key={p} value={p} className="bg-zinc-900">
                    {p}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const selectClass =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-300/40";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-white/70">{label}</label>
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
