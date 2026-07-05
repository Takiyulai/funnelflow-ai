"use client";

import type {
  FunnelSection,
  Language,
  CtaConfig,
  CtaMode,
  CtaIcon,
  CtaSpacing,
  PopupProvider,
  FormFieldItem,
  FormFieldType,
} from "@/lib/funnels/types";
import { TagsInput } from "./items/TagsInput";

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

const DEFAULT_POPUP_FIELDS: FormFieldItem[] = [
  { name: "name", type: "text", label: "Prénom", placeholder: "Votre prénom", required: true, width: "full" },
  { name: "email", type: "email", label: "Email", placeholder: "vous@exemple.com", required: true, width: "full" },
];

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

  // ─── Gestion des champs personnalisés du popup interne ───────────────
  const popupFields = cta?.popupFields;

  const setPopupFields = (fields: FormFieldItem[]) => {
    if (!cta) return;
    onChange({ cta: { ...cta, popupFields: fields } });
  };

  const addPopupField = () => {
    const current = popupFields ?? DEFAULT_POPUP_FIELDS;
    setPopupFields([
      ...current,
      {
        name: `field_${current.length + 1}`,
        type: "text",
        label: "Nouveau champ",
        required: false,
        width: "full",
      },
    ]);
  };

  const updatePopupField = (idx: number, patch: Partial<FormFieldItem>) => {
    const current = popupFields ?? DEFAULT_POPUP_FIELDS;
    setPopupFields(current.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removePopupField = (idx: number) => {
    const current = popupFields ?? DEFAULT_POPUP_FIELDS;
    if (current.length <= 1) return;
    setPopupFields(current.filter((_, i) => i !== idx));
  };

  const setMode = (mode: CtaMode) => {
    if (!cta) return;
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
          popupEmbedHtml: cta.popupEmbedHtml ?? "",
          systemePopupId: cta.systemePopupId ?? "",
          popupFields: cta.popupFields,
        },
      });
    }
  };

  const setPopupProvider = (provider: PopupProvider) => {
    if (!cta || cta.mode !== "popup") return;
    updateCta({ popupProvider: provider });
  };

  const spacing = cta?.spacing ?? DEFAULT_SPACING;

  // ─── 🆕 Liens/CTA supplémentaires (canaux : WhatsApp, Telegram, Instagram…)
  // Indépendant du CTA principal ci-dessus — utile notamment sur une page de
  // remerciement pour rediriger vers plusieurs canaux à la fois.
  const extraCtas: CtaConfig[] = section.ctas ?? [];

  const setExtraCtas = (next: CtaConfig[]) => {
    onChange({ ctas: next });
  };

  const addExtraCta = () => {
    setExtraCtas([
      ...extraCtas,
      {
        mode: "redirect",
        label: "Rejoindre le groupe",
        url: "",
        target: "_blank",
        icon: "external",
      },
    ]);
  };

  const updateExtraCta = (idx: number, patch: Partial<CtaConfig>) => {
    setExtraCtas(extraCtas.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const removeExtraCta = (idx: number) => {
    setExtraCtas(extraCtas.filter((_, i) => i !== idx));
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
              <ModeBtn active={cta.mode === "redirect"} onClick={() => setMode("redirect")}>
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
                hint="Lien produit Chariow, page de paiement systeme.io, Calendly, Stripe Checkout, etc."
              >
                <input
                  type="url"
                  value={cta.url ?? ""}
                  onChange={(e) => updateCta({ url: e.target.value })}
                  className={inputClass}
                  placeholder="https://exemple.com/checkout"
                />
              </Field>

              {/* 🆕 Chariow Niveau 2 : lien produit Chariow */}
              <label className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5">
                <div>
                  <div className="text-xs font-medium text-white">
                    💳 Lien produit Chariow
                  </div>
                  <div className="mt-0.5 text-[10px] leading-relaxed text-white/50">
                    Cochez si l'URL ci-dessus est votre page produit Chariow.
                    Chariow encaisse ET livre le produit : AutoFunnel n'enverra
                    donc pas d'email de livraison en double.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={cta.chariow === true}
                  onChange={(e) => updateCta({ chariow: e.target.checked || undefined })}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-amber-300"
                />
              </label>
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
                    🧩 AutoFunnel (intégré)
                  </ModeBtn>
                  <ModeBtn
                    active={cta.popupProvider === "systeme"}
                    onClick={() => setPopupProvider("systeme")}
                  >
                    ⚡ Systeme.io
                  </ModeBtn>
                  <ModeBtn
                    active={cta.popupProvider === "embed"}
                    onClick={() => setPopupProvider("embed")}
                  >
                    🔌 Code externe
                  </ModeBtn>
                </div>
              </Field>

              {/* === Popup AutoFunnel interne === */}
              {(cta.popupProvider ?? "internal") === "internal" && (
                <>
                  <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-3 py-2 text-[11px] text-emerald-200/80">
                    ✓ Ce popup s'affiche directement sur votre tunnel AutoFunnel.
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

                  {/* === Éditeur de champs à capturer === */}
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                        Champs à capturer
                      </div>
                      <button
                        type="button"
                        onClick={addPopupField}
                        className="rounded border border-white/10 bg-white/[0.02] px-2 py-0.5 text-[10px] font-medium text-white/60 hover:border-white/20 hover:text-white"
                      >
                        + Ajouter
                      </button>
                    </div>

                    {(popupFields ?? DEFAULT_POPUP_FIELDS).map((f, idx) => (
                      <div
                        key={idx}
                        className="rounded-md border border-white/10 bg-black/30 p-2 space-y-1.5"
                      >
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={f.label ?? ""}
                            onChange={(e) => updatePopupField(idx, { label: e.target.value })}
                            className={`${inputClass} flex-1`}
                            placeholder="Libellé"
                          />
                          <select
                            value={f.type}
                            onChange={(e) =>
                              updatePopupField(idx, { type: e.target.value as FormFieldType })
                            }
                            className={inputClass}
                            style={{ width: 120 }}
                          >
                            <option value="text">Texte</option>
                            <option value="email">Email</option>
                            <option value="tel">Téléphone</option>
                            <option value="number">Nombre</option>
                            <option value="textarea">Zone texte</option>
                            <option value="checkbox">Case à cocher</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => removePopupField(idx)}
                            className="rounded border border-white/10 px-2 py-1 text-[11px] text-white/50 hover:border-red-300/40 hover:text-red-300"
                            aria-label="Supprimer ce champ"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={f.name}
                            onChange={(e) =>
                              updatePopupField(idx, {
                                name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                              })
                            }
                            className={`${inputClass} flex-1`}
                            placeholder="nom_technique"
                          />
                          <label className="flex items-center gap-1 whitespace-nowrap text-[11px] text-white/60">
                            <input
                              type="checkbox"
                              checked={f.required ?? false}
                              onChange={(e) => updatePopupField(idx, { required: e.target.checked })}
                              className="h-3.5 w-3.5 accent-amber-300"
                            />
                            Requis
                          </label>
                        </div>
                      </div>
                    ))}

                    <p className="text-[10px] text-white/40">
                      Au moins un champ Email est recommandé, sinon le lead ne pourra pas
                      être enregistré.
                    </p>
                  </div>

                  {/* 🆕 Tags CRM appliqués aux leads capturés par ce popup */}
                  <Field
                    label="Tags appliqués"
                    hint="Tags CRM posés automatiquement sur chaque lead capturé par ce popup. Un tag inexistant est créé."
                  >
                    <TagsInput
                      value={cta.captureTags ?? []}
                      onChange={(next) => updateCta({ captureTags: next })}
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
                          popupId: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
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
                        Copiez le{" "}
                        <code className="text-amber-200">
                          &lt;script id="form-script-tag-…"&gt;
                        </code>{" "}
                        fourni.
                      </li>
                      <li>
                        Collez-le dans{" "}
                        <strong>Style global → Intégrations → Script Systeme.io</strong>.
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

              {/* === Code externe (embed) === */}
              {cta.popupProvider === "embed" && (
                <Field
                  label="Code du formulaire externe"
                  required
                  hint="Collez le code HTML/embed fourni par votre outil (Brevo, MailerLite, Systeme.io…). Il s'affichera dans une fenêtre sécurisée. AutoFunnel ne capture pas ces leads."
                >
                  <textarea
                    value={cta.popupEmbedHtml ?? ""}
                    onChange={(e) => updateCta({ popupEmbedHtml: e.target.value })}
                    className={`${inputClass} min-h-[120px] resize-y py-2 font-mono text-[11px]`}
                    placeholder="<div>...votre code embed...</div>"
                  />
                </Field>
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

      {/* === 🆕 Liens/CTA supplémentaires (canaux) === */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
              Liens supplémentaires
            </div>
            <div className="mt-0.5 text-[10px] text-white/40">
              Ex : rejoindre WhatsApp, Telegram, Instagram — utile sur une page
              de remerciement. Indépendant du CTA principal ci-dessus.
            </div>
          </div>
          <button
            type="button"
            onClick={addExtraCta}
            className="shrink-0 rounded border border-white/10 bg-white/[0.02] px-2 py-1 text-[10px] font-medium text-white/60 hover:border-amber-300/40 hover:text-amber-300"
          >
            + Ajouter
          </button>
        </div>

        {extraCtas.length === 0 && (
          <p className="text-[11px] text-white/40">Aucun lien supplémentaire.</p>
        )}

        {extraCtas.map((c, idx) => (
          <div
            key={idx}
            className="space-y-2 rounded-md border border-white/10 bg-black/30 p-2.5"
          >
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={c.label ?? ""}
                onChange={(e) => updateExtraCta(idx, { label: e.target.value })}
                className={`${inputClass} flex-1`}
                placeholder="Ex : Rejoindre le groupe WhatsApp"
              />
              <button
                type="button"
                onClick={() => removeExtraCta(idx)}
                className="shrink-0 rounded border border-white/10 px-2 py-2 text-[11px] text-white/50 hover:border-red-300/40 hover:text-red-300"
                aria-label="Supprimer ce lien"
              >
                ✕
              </button>
            </div>
            <input
              type="url"
              value={c.url ?? ""}
              onChange={(e) => updateExtraCta(idx, { url: e.target.value, mode: "redirect" })}
              className={inputClass}
              placeholder="https://chat.whatsapp.com/..."
            />
            <div className="flex items-center gap-1.5">
              <ModeBtn
                active={(c.target ?? "_blank") === "_blank"}
                onClick={() => updateExtraCta(idx, { target: "_blank" })}
              >
                Nouvel onglet
              </ModeBtn>
              <ModeBtn
                active={c.target === "_self"}
                onClick={() => updateExtraCta(idx, { target: "_self" })}
              >
                Même onglet
              </ModeBtn>
            </div>
          </div>
        ))}
      </div>
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
