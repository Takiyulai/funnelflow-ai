"use client";

import { X } from "lucide-react";
import type { Funnel } from "@/lib/funnels/types";
import { getTemplateButtonAnim } from "@/lib/funnels/templates";

type Props = {
  funnel: Funnel;
  onChange: (patch: Partial<Funnel>) => void;
  onClose: () => void;
};

type ButtonAnim = "lift" | "glow" | "pulse" | "shine";

// Type étendu pour les champs ajoutés (animationsEnabled, buttonAnim) qui
// ne sont peut-être pas encore typés dans Funnel["design"]. Quand le type
// sera consolidé, ces casts pourront être retirés.
type DesignExt = Funnel["design"] & {
  animationsEnabled?: boolean;
  buttonAnim?: ButtonAnim;
};

const STYLE_PRESETS: { value: string; label: string }[] = [
  { value: "premium", label: "Premium" },
  { value: "luxury", label: "Luxe" },
  { value: "soft", label: "Doux" },
  { value: "bold", label: "Audacieux" },
  { value: "minimal", label: "Minimal" },
];

const BUTTON_ANIMS: { value: ButtonAnim; label: string; hint: string }[] = [
  { value: "lift", label: "⬆ Lift", hint: "Soulèvement subtil" },
  { value: "glow", label: "✨ Glow", hint: "Lueur autour du bouton" },
  { value: "pulse", label: "💓 Pulse", hint: "Battement continu" },
  { value: "shine", label: "🌟 Shine", hint: "Reflet qui balaie" },
];

const DEFAULT_DESIGN: Funnel["design"] = {
  primaryColor: "#fbbf24",
  secondaryColor: "#0a0a0a",
  accentColor: "#f59e0b",
  style: "premium",
};

export function GlobalStylePanel({ funnel, onChange, onClose }: Props) {
  const design = (funnel.design ?? DEFAULT_DESIGN) as DesignExt;
  const templateId = (funnel.meta as { templateId?: string } | undefined)
    ?.templateId;

  const animationsEnabled = design.animationsEnabled !== false;
  const currentButtonAnim: ButtonAnim =
    design.buttonAnim ?? getTemplateButtonAnim(templateId);

  const updateDesign = (patch: Partial<DesignExt>) => {
    onChange({ design: { ...design, ...patch } as Funnel["design"] });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Style global</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-white/60 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5">
          {/* === Identité === */}
          <SectionTitle>Identité</SectionTitle>

          <Field label="Nom du tunnel">
            <input
              type="text"
              value={funnel.funnelName}
              onChange={(e) => onChange({ funnelName: e.target.value })}
              className={inputClass}
            />
          </Field>

          {/* === Couleurs === */}
          <SectionTitle>Couleurs</SectionTitle>

          <Field label="Couleur primaire">
            <ColorRow
              value={design.primaryColor}
              onChange={(c) => updateDesign({ primaryColor: c })}
            />
          </Field>

          <Field label="Couleur secondaire">
            <ColorRow
              value={design.secondaryColor}
              onChange={(c) => updateDesign({ secondaryColor: c })}
            />
          </Field>

          <Field label="Couleur d'accent">
            <ColorRow
              value={design.accentColor}
              onChange={(c) => updateDesign({ accentColor: c })}
            />
          </Field>

          <Field label="Style visuel">
            <select
              value={design.style ?? "premium"}
              onChange={(e) => updateDesign({ style: e.target.value })}
              className={inputClass}
            >
              {STYLE_PRESETS.map((p) => (
                <option key={p.value} value={p.value} className="bg-zinc-900">
                  {p.label}
                </option>
              ))}
            </select>
          </Field>

          {/* === Animations === */}
          <SectionTitle>Animations</SectionTitle>

          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2.5">
            <div>
              <div className="text-xs font-medium text-white">
                Animations activées
              </div>
              <div className="text-[10px] text-white/50">
                Désactivez pour un rendu statique sans transitions ni effets
              </div>
            </div>
            <input
              type="checkbox"
              checked={animationsEnabled}
              onChange={(e) =>
                updateDesign({ animationsEnabled: e.target.checked })
              }
              className="h-4 w-4 cursor-pointer accent-amber-300"
            />
          </label>

          <Field label="Animation des boutons">
            <div className="grid grid-cols-2 gap-1.5">
              {BUTTON_ANIMS.map((anim) => {
                const active = currentButtonAnim === anim.value;
                const disabled = !animationsEnabled;
                return (
                  <button
                    key={anim.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => updateDesign({ buttonAnim: anim.value })}
                    title={anim.hint}
                    className={[
                      "rounded-md border px-2.5 py-2 text-[11px] font-medium transition-colors",
                      disabled
                        ? "cursor-not-allowed border-white/5 bg-white/[0.01] text-white/30"
                        : active
                        ? "border-amber-300/40 bg-amber-300/10 text-amber-200"
                        : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20 hover:text-white",
                    ].join(" ")}
                  >
                    {anim.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[10px] text-white/40">
              {animationsEnabled
                ? `Actuel : ${
                    BUTTON_ANIMS.find((a) => a.value === currentButtonAnim)
                      ?.hint ?? ""
                  }`
                : "Activez les animations pour personnaliser les boutons"}
            </p>
          </Field>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-amber-300 px-4 py-1.5 text-xs font-semibold text-black hover:bg-amber-200"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-300/40";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-white/70">
        {label}
      </label>
      {children}
    </div>
  );
}

function ColorRow({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-white outline-none focus:border-amber-300/40"
      />
    </div>
  );
}
