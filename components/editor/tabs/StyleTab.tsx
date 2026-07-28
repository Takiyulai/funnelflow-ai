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
  { value: "split-text-image", label: "Texte | Image (desktop)" },
  { value: "split-image-text", label: "Image | Texte (desktop)" },
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

/**
 * 🆕 Valeurs PAR DÉFAUT réellement appliquées au rendu quand la section ne
 * porte aucune configuration d'animation (cas de toutes les sections générées
 * par l'IA). Doit rester aligné avec :
 *  - components/funnel/FunnelPreview.tsx  → animOf(…, fallback)
 *  - components/funnel/SectionRenderer.tsx → animOf(key, fallback)
 *  - lib/export/html.ts                    → anim(section, target, fallback)
 * Avant, le sélecteur affichait « none » alors que le rendu animait en
 * fade-up : l'utilisateur croyait les animations désactivées.
 */
const ANIM_DEFAULTS: Partial<Record<AnimationTarget, AnimationPreset>> = {
  eyebrow: "fade-in",
  image: "fade-in",
  video: "zoom-in",
};

function defaultAnimFor(key: AnimationTarget): AnimationPreset {
  return ANIM_DEFAULTS[key] ?? "fade-up";
}

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

type ShadowSize = "none" | "sm" | "md" | "lg" | "xl";
const SHADOW_SIZES: { value: ShadowSize; label: string }[] = [
  { value: "none", label: "Aucune" },
  { value: "sm",   label: "S" },
  { value: "md",   label: "M" },
  { value: "lg",   label: "L" },
  { value: "xl",   label: "XL" },
];

export function StyleTab({ section, onChange }: Props) {
  const animations: SectionAnimations = section.animations ?? {};
  const style = (section.style ?? {}) as SectionStyle & {
    shadow?: { size?: ShadowSize; color?: string };
    userColorsOverride?: boolean;
  };
  const currentAlign: SectionAlign = style.align ?? "left";
  const colors = style.colors ?? {};
  const shadow = style.shadow ?? {};
  const shadowSize: ShadowSize = shadow.size ?? "none";
  const shadowColor: string = shadow.color ?? "#000000";

  const updateAnim = (target: AnimationTarget, preset: AnimationPreset) => {
    onChange({ animations: { ...animations, [target]: preset } });
  };

  const updateAlign = (align: SectionAlign) => {
    onChange({ style: { ...style, align } as SectionStyle });
  };

  const updateSpacing = (spacing: NonNullable<SectionStyle["spacing"]>) => {
    onChange({ style: { ...style, spacing } as SectionStyle });
  };

  /**
   * Lot K — Mise à jour d'une couleur de section.
   * On pose `userColorsOverride: true` dès qu'au moins une couleur est définie,
   * pour passer le garde-fou de getSectionColors() dans FunnelPreview.
   */
  const updateColor = (
    key: "bg" | "ink" | "accent",
    value: string | undefined
  ) => {
    const nextColors = { ...colors };
    if (value && value.trim()) {
      nextColors[key] = value;
    } else {
      delete nextColors[key];
    }
    const hasAny = Boolean(nextColors.bg || nextColors.ink || nextColors.accent);
    onChange({
      style: {
        ...style,
        colors: hasAny ? nextColors : undefined,
        userColorsOverride: hasAny ? true : undefined,
      } as SectionStyle,
    });
  };

  const resetColors = () => {
    onChange({
      style: {
        ...style,
        colors: undefined,
        userColorsOverride: undefined,
      } as SectionStyle,
    });
  };

  const updateShadowSize = (size: ShadowSize) => {
    if (size === "none") {
      // Supprime complètement l'ombre
      const { shadow: _omit, ...rest } = style;
      onChange({ style: rest as SectionStyle });
    } else {
      onChange({
        style: {
          ...style,
          shadow: { size, color: shadow.color ?? "#000000" },
        } as SectionStyle,
      });
    }
  };

  const updateShadowColor = (color: string) => {
    onChange({
      style: {
        ...style,
        shadow: { size: shadowSize === "none" ? "md" : shadowSize, color },
      } as SectionStyle,
    });
  };

  return (
    <div className="space-y-5">
      {/* Layout */}
      <Field
        label="Layout"
        hint="« Texte | Image » et « Image | Texte » mettent les deux côte-à-côte sur desktop, empilés sur mobile."
      >
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

      {/* 🆕 Puces numérotées (alternative aux icônes) */}
      <Field
        label="Style des puces"
        hint="Affiche des numéros (1, 2, 3…) au lieu des icônes — idéal pour des étapes."
      >
        <div className="flex gap-1.5">
          <ModeBtn
            active={!style.numberedBullets}
            onClick={() =>
              onChange({ style: { ...style, numberedBullets: false } as SectionStyle })
            }
          >
            Icônes
          </ModeBtn>
          <ModeBtn
            active={!!style.numberedBullets}
            onClick={() =>
              onChange({ style: { ...style, numberedBullets: true } as SectionStyle })
            }
          >
            Numéros
          </ModeBtn>
        </div>
      </Field>

      {/* Couleurs de section */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/70">
            Couleurs de cette section
          </h3>
          {(colors.bg || colors.ink || colors.accent) && (
            <button
              type="button"
              onClick={resetColors}
              className="text-[10px] text-white/40 underline hover:text-white/70"
            >
              Réinitialiser
            </button>
          )}
        </div>
        <p className="mb-3 text-[10px] text-white/40">
          Surcharge les couleurs du template uniquement pour cette section.
        </p>

        <div className="space-y-2">
          <ColorField label="Fond" value={colors.bg} onChange={(v) => updateColor("bg", v)} />
          <ColorField label="Texte" value={colors.ink} onChange={(v) => updateColor("ink", v)} />
          <ColorField label="Accent" value={colors.accent} onChange={(v) => updateColor("accent", v)} />
        </div>
      </div>

      {/* Ombrage des médias et cards */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/70">
          Ombrage (image, vidéo, cards)
        </h3>
        <p className="mb-3 text-[10px] text-white/40">
          Applique une ombre aux médias et cartes de cette section.
        </p>

        <Field label="Intensité">
          <div className="flex gap-1.5">
            {SHADOW_SIZES.map((s) => (
              <ModeBtn
                key={s.value}
                active={shadowSize === s.value}
                onClick={() => updateShadowSize(s.value)}
              >
                {s.label}
              </ModeBtn>
            ))}
          </div>
        </Field>

        {shadowSize !== "none" && (
          <div className="mt-3">
            <label className="mb-1.5 block text-[11px] font-medium text-white/70">
              Couleur de l'ombre
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={shadowColor}
                onChange={(e) => updateShadowColor(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
              />
              <input
                type="text"
                value={shadowColor}
                onChange={(e) => updateShadowColor(e.target.value)}
                className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-[11px] text-white outline-none focus:border-amber-300/40"
                placeholder="#000000"
              />
            </div>
          </div>
        )}
      </div>

      {/* Animations */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/70">
          Animations au scroll
        </h3>
        <p className="mb-3 text-[10px] text-white/40">
          Une animation par cible, jouée quand la section entre dans l'écran.
          « none » désactive l'animation (le titre pilote aussi la section
          entière). Ignoré si le visiteur a activé « réduire les animations ».
        </p>
        <div className="space-y-1.5">
          {ANIM_TARGETS.map((t) => (
            <div
              key={t.key}
              className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/20 px-2.5 py-1.5"
            >
              <span className="w-20 shrink-0 text-[11px] text-white/60">{t.label}</span>
              <select
                value={animations[t.key] ?? defaultAnimFor(t.key)}
                onChange={(e) => updateAnim(t.key, e.target.value as AnimationPreset)}
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
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-white/70">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-white/40">{hint}</p>}
    </div>
  );
}

function ModeBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

function ColorField({
  label, value, onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const hasValue = Boolean(value && value.trim());
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[11px] text-white/60">{label}</span>
      <input
        type="color"
        value={value ?? "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
      />
      <input
        type="text"
        value={value ?? ""}
        placeholder="hérite du template"
        onChange={(e) => onChange(e.target.value || undefined)}
        className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-[11px] text-white outline-none focus:border-amber-300/40"
      />
      {hasValue && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          title="Effacer"
          className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
      )}
    </div>
  );
}
