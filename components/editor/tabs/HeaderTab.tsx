"use client";

import type { Funnel, FunnelHeader, CtaConfig } from "@/lib/funnels/types";
import { LogoUploader } from "@/components/editor/ui/LogoUploader";

type Props = {
  funnel: Funnel;
  onChange: (patch: Partial<Funnel>) => void;
};

type DisplayMode = "logo" | "name" | "both";

export function HeaderTab({ funnel, onChange }: Props) {
  const header: FunnelHeader = funnel.header ?? {};

  const update = (patch: Partial<FunnelHeader>) => {
    onChange({ header: { ...header, ...patch } });
  };

  const updateCta = (patch: Partial<CtaConfig>) => {
    const current: CtaConfig = header.cta ?? {
      mode: "redirect",
      label: "",
      url: "",
      target: "_blank",
    };
    update({ cta: { ...current, ...patch } });
  };

  const enabled = header.enabled !== false;
  const hasCta = Boolean(header.cta?.label);
  const displayMode: DisplayMode = header.displayMode ?? "both";

  const showLogoField = displayMode === "logo" || displayMode === "both";
  const showNameField = displayMode === "name" || displayMode === "both";

  return (
    <div className="space-y-5">
      {/* Activation */}
      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-950/40 p-3">
        <div>
          <div className="text-sm font-semibold text-white">Afficher le header</div>
          <div className="text-xs text-white/60">Logo, nom de marque et CTA</div>
        </div>
        <Toggle checked={enabled} onChange={(v) => update({ enabled: v })} />
      </div>

      {enabled && (
        <>
          {/* Mode d'affichage */}
          <Section title="Affichage">
            <div className="grid grid-cols-3 gap-2">
              <ModeButton
                active={displayMode === "logo"}
                onClick={() => update({ displayMode: "logo" })}
                label="Logo"
                hint="Logo seul"
              />
              <ModeButton
                active={displayMode === "name"}
                onClick={() => update({ displayMode: "name" })}
                label="Nom"
                hint="Texte seul"
              />
              <ModeButton
                active={displayMode === "both"}
                onClick={() => update({ displayMode: "both" })}
                label="Les deux"
                hint="Logo + texte"
              />
            </div>
          </Section>

          {/* Identité */}
          <Section title="Identité">
            {showLogoField && (
              <LogoUploader
                label="Logo"
                value={header.logoUrl}
                onChange={(dataUrl) => update({ logoUrl: dataUrl })}
                maxSizeMb={2}
              />
            )}

            {showNameField && (
              <Field label="Nom de marque">
                <input
                  type="text"
                  value={header.brandName ?? ""}
                  onChange={(e) => update({ brandName: e.target.value })}
                  placeholder="Par défaut : extrait du nom du funnel"
                  className="ff-input"
                />
              </Field>
            )}

            {!showLogoField && !showNameField && (
              <p className="text-xs italic text-white/50">
                Sélectionne un mode d'affichage ci-dessus.
              </p>
            )}
          </Section>

          {/* Comportement */}
          <Section title="Comportement">
            <CheckRow
              checked={header.sticky === true}
              onChange={(v) => update({ sticky: v })}
              label="Header sticky"
              hint="Reste visible en haut quand on scrolle"
            />
            <CheckRow
              checked={header.transparent === true}
              onChange={(v) => update({ transparent: v })}
              label="Fond semi-transparent"
              hint="Utile combiné au sticky pour un effet flou"
            />
          </Section>

          {/* CTA */}
          <Section title="Bouton CTA (optionnel)">
            <Field label="Texte du bouton">
              <input
                type="text"
                value={header.cta?.label ?? ""}
                onChange={(e) => updateCta({ label: e.target.value })}
                placeholder="Ex. Commencer maintenant"
                className="ff-input"
              />
            </Field>

            {hasCta && (
              <>
                <Field label="Type de lien">
                  <select
                    value={header.cta?.mode ?? "redirect"}
                    onChange={(e) =>
                      updateCta({ mode: e.target.value as CtaConfig["mode"] })
                    }
                    className="ff-input"
                  >
                    <option value="redirect">Lien externe (URL)</option>
                    <option value="anchor">Ancre interne (#section)</option>
                  </select>
                </Field>

                {header.cta?.mode === "redirect" && (
                  <>
                    <Field label="URL">
                      <input
                        type="text"
                        value={header.cta?.url ?? ""}
                        onChange={(e) => updateCta({ url: e.target.value })}
                        placeholder="https://…"
                        className="ff-input"
                      />
                    </Field>
                    <CheckRow
                      checked={header.cta?.target === "_blank"}
                      onChange={(v) =>
                        updateCta({ target: v ? "_blank" : "_self" })
                      }
                      label="Ouvrir dans un nouvel onglet"
                    />
                  </>
                )}

                {header.cta?.mode === "anchor" && (
                  <Field label="ID de l'ancre">
                    <input
                      type="text"
                      value={header.cta?.anchorId ?? ""}
                      onChange={(e) => updateCta({ anchorId: e.target.value })}
                      placeholder="ex. pricing"
                      className="ff-input"
                    />
                  </Field>
                )}

                <button
                  type="button"
                  onClick={() => update({ cta: undefined })}
                  className="text-xs text-rose-300/80 underline hover:text-rose-300"
                >
                  Supprimer le CTA
                </button>
              </>
            )}
          </Section>
        </>
      )}

      <style jsx>{`
        .ff-input {
          width: 100%;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 0.5rem;
          padding: 0.5rem 0.625rem;
          font-size: 0.8125rem;
          color: #fff;
          outline: none;
        }
        .ff-input:focus {
          border-color: rgba(252, 211, 77, 0.5);
        }
      `}</style>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
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
    <label className="block">
      <div className="mb-1 text-xs font-medium text-white/70">{label}</div>
      {children}
    </label>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md p-2 hover:bg-white/5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-white/20 bg-zinc-950 accent-amber-300"
      />
      <div className="flex-1">
        <div className="text-xs font-medium text-white/90">{label}</div>
        {hint && <div className="text-[11px] text-white/50">{hint}</div>}
      </div>
    </label>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition-colors ${
        checked ? "bg-amber-300" : "bg-white/15"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg border p-2.5 text-center transition-all",
        active
          ? "border-amber-300/60 bg-amber-300/10 text-amber-200"
          : "border-white/10 bg-zinc-950/40 text-white/70 hover:border-white/20 hover:text-white",
      ].join(" ")}
    >
      <div className="text-xs font-semibold">{label}</div>
      <div className="text-[10px] opacity-70">{hint}</div>
    </button>
  );
}
