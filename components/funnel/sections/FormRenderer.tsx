"use client";

import { useState, useMemo } from "react";
import type { FormEvent } from "react";
import { usePathname } from "next/navigation";
import type {
  Funnel,
  FunnelPage,
  FunnelSection,
  SectionItem,
  FormFieldItem,
} from "@/lib/funnels/types";
import { DEFAULT_REASSURANCE } from "@/lib/funnels/types";
import {
  extractSlugsFromPath,
  resolveNextDestination,
} from "@/lib/funnels/nextDestination";

type Props = {
  section: FunnelSection;
  /** Slug du funnel (si connu en dehors de /tunnel/[slug]) */
  funnelSlug?: string;
  /** Funnel complet (pour résoudre la page suivante automatiquement) */
  funnel?: Funnel;
  /** Page courante (pour lire nextPageId) */
  page?: FunnelPage;
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function classifyField(
  field: FormFieldItem,
): "email" | "name" | "phone" | "consent" | "other" {
  const t = (field.type || "").toLowerCase();
  const n = (field.name || "").toLowerCase();
  if (t === "email" || n.includes("email") || n.includes("mail")) return "email";
  if (
    t === "checkbox" &&
    (n.includes("consent") || n.includes("rgpd") || n.includes("agree"))
  )
    return "consent";
  if (t === "tel" || n.includes("phone") || n.includes("tel") || n.includes("mobile"))
    return "phone";
  if (
    n === "name" ||
    n.includes("nom") ||
    n.includes("prenom") ||
    n.includes("firstname") ||
    n.includes("lastname") ||
    n.includes("fullname")
  )
    return "name";
  return "other";
}

/**
 * Calcule le texte de réassurance à afficher.
 * - undefined → message par défaut
 * - chaîne vide ou espaces → masqué (null)
 * - sinon → texte fourni
 */
function computeReassurance(raw: string | undefined): string | null {
  if (raw === undefined) return DEFAULT_REASSURANCE;
  if (raw.trim() === "") return null;
  return raw;
}

export function FormRenderer({
  section,
  funnelSlug: funnelSlugProp,
  funnel,
  page,
}: Props) {
  const pathname = usePathname();
  const { funnelSlug: funnelSlugFromUrl, pageSlug } = useMemo(
    () => extractSlugsFromPath(pathname),
    [pathname],
  );
  const funnelSlug = funnelSlugProp ?? funnelSlugFromUrl;

  const fields = useMemo(
    () =>
      (section.items || [])
        .filter(
          (it): it is SectionItem & { kind: "formField" } =>
            it.kind === "formField",
        )
        .map((it) => it.data),
    [section.items],
  );

  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  const ctaLabel =
    section.formConfig?.submitLabel || section.cta?.label || "Envoyer";
  const isSubmitting = state.kind === "submitting";
  const isPreview = !funnelSlug;
  const isSuccess = state.kind === "success";

  const reassuranceText = computeReassurance(section.reassurance);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPreview || isSubmitting || isSuccess) return;

    const formEl = e.currentTarget;
    const formData = new FormData(formEl);

    let email = "";
    let name: string | null = null;
    let phone: string | null = null;
    let consent = false;
    const metadata: Record<string, unknown> = {};

    if (fields.length === 0) {
      const all = Array.from(formEl.querySelectorAll<HTMLInputElement>("input"));
      for (const inp of all) {
        if (inp.type === "email") email = inp.value.trim();
        else if (inp.type === "text") name = inp.value.trim();
      }
    } else {
      for (const f of fields) {
        const raw = formData.get(f.name);
        const role = classifyField(f);
        if (f.type === "checkbox") {
          const checked = raw !== null;
          if (role === "consent") consent = checked;
          else metadata[f.name] = checked;
          continue;
        }
        const value = typeof raw === "string" ? raw.trim() : "";
        if (!value) continue;
        switch (role) {
          case "email":
            email = value;
            break;
          case "name":
            name = value;
            break;
          case "phone":
            phone = value;
            break;
          default:
            metadata[f.name] = value;
        }
      }
    }

    if (!email) {
      setState({
        kind: "error",
        message: "Veuillez renseigner votre adresse email.",
      });
      return;
    }

    setState({ kind: "submitting" });

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          funnelSlug,
          pageSlug: pageSlug || null,
          sectionId: section.id || null,
          email,
          name,
          phone,
          consent,
          metadata,
        }),
      });

      const data = await res.json().catch(() => ({}));

      // 🆕 LOT 2 — Mémorise l'id du contact pour ce tunnel (déclencheur
      // Workflow `page.visited` sur les revisites). Best-effort, jamais
      // bloquant (navigation privée stricte, etc.).
      if (data?.ok && typeof data.leadId === "string" && funnelSlug) {
        try {
          window.localStorage.setItem(`ff_contact_${funnelSlug}`, data.leadId);
          // 🆕 LOT 5 — Ancre pour les timers "countdown-since-registration"
          // (webinaire Evergreen) : moment EXACT de l'inscription, partagé
          // entre toutes les pages du tunnel (live/replay/sales).
          if (!window.localStorage.getItem(`ff_registered_at_${funnelSlug}`)) {
            window.localStorage.setItem(`ff_registered_at_${funnelSlug}`, String(Date.now()));
          }
        } catch {
          /* ignore */
        }
      }

      if (!res.ok || !data?.ok) {
        const code = data?.error || "unknown";
        const message =
          code === "rate_limited"
            ? "Trop de tentatives. Réessayez dans une minute."
            : code === "validation"
              ? "Certains champs sont invalides. Vérifiez votre saisie."
              : code === "funnel_not_found" || code === "funnel_not_published"
                ? "Ce formulaire n'est pas actif pour le moment."
                : "Une erreur est survenue. Réessayez dans un instant.";
        setState({ kind: "error", message });
        return;
      }

      const redirectTo = resolveNextDestination({
        section,
        funnel,
        page,
        funnelSlug,
      });

      const successMessage =
        section.formConfig?.successMessage ||
        (redirectTo
          ? "Merci, c'est confirmé !"
          : "Merci ! Votre inscription a bien été enregistrée.");

      if (redirectTo) {
        setState({ kind: "success", message: successMessage });
        // 🆕 Redirection quasi immédiate (200 ms, juste le temps que l'état
        // « confirmé » s'affiche). Le prospect ne voit plus « Redirection… ».
        setTimeout(() => {
          window.location.href = redirectTo;
        }, 200);
      } else {
        setState({ kind: "success", message: successMessage });
        formEl.reset();
      }
    } catch (err) {
      console.error("[FormRenderer] submit error", err);
      setState({
        kind: "error",
        message: "Impossible de contacter le serveur. Vérifiez votre connexion.",
      });
    }
  }

  // ─── Rendu ─────────────────────────────────────────────────────────
  if (fields.length === 0) {
    return (
      <form
        id="lead-form"
        onSubmit={handleSubmit}
        className="mx-auto mt-4 max-w-md space-y-3 rounded-lg p-4"
      >
        <input
          type="text"
          name="name"
          placeholder="Votre prénom"
          disabled={isSubmitting || isSuccess}
          className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors disabled:opacity-60"
          style={inputStyle}
        />
        <input
          type="email"
          name="email"
          placeholder="Votre email"
          required
          disabled={isSubmitting || isSuccess}
          className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors disabled:opacity-60"
          style={inputStyle}
        />
        <SubmitButton label={ctaLabel} state={state} isPreview={isPreview} />
        <FeedbackMessage state={state} isPreview={isPreview} />
        {reassuranceText && (
          <p
            className="mt-3 text-center text-[11px]"
            style={{ color: "var(--ff-ink, #0f172a)", opacity: 0.6 }}
          >
            {reassuranceText}
          </p>
        )}
      </form>
    );
  }

  return (
    <form
      id="lead-form"
      onSubmit={handleSubmit}
      className="mx-auto mt-4 max-w-md rounded-lg p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f, idx) => (
          <FieldBlock
            key={`${f.name}-${idx}`}
            field={f}
            disabled={isSubmitting || isSuccess}
          />
        ))}
      </div>
      <SubmitButton label={ctaLabel} state={state} isPreview={isPreview} />
      <FeedbackMessage state={state} isPreview={isPreview} />
      {reassuranceText && (
        <p
          className="mt-3 text-center text-[11px]"
          style={{ color: "var(--ff-ink, #0f172a)", opacity: 0.6 }}
        >
          {reassuranceText}
        </p>
      )}
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--ff-border, rgba(0,0,0,0.12))",
  background: "rgba(255,255,255,0.06)",
  color: "var(--ff-ink, #0f172a)",
};

function SubmitButton({
  label,
  state,
  isPreview,
}: {
  label: string;
  state: SubmitState;
  isPreview: boolean;
}) {
  const isSubmitting = state.kind === "submitting";
  const isSuccess = state.kind === "success";
  const disabled = isSubmitting || isSuccess || isPreview;

  let display = label;
  if (isSubmitting) display = "Envoi…";
  else if (isSuccess) display = "Envoyé ✓";

  return (
    <button
      type="submit"
      disabled={disabled}
      className="mt-4 w-full px-4 py-2.5 text-sm font-bold transition rounded-lg disabled:opacity-70 disabled:cursor-not-allowed"
      data-ff-cta
      style={{
        background: "var(--ff-accent, #2563eb)",
        color: "var(--ff-accent-ink, #ffffff)",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {display}
    </button>
  );
}

function FeedbackMessage({
  state,
  isPreview,
}: {
  state: SubmitState;
  isPreview: boolean;
}) {
  if (isPreview) {
    return (
      <p
        className="mt-2 text-center text-[11px]"
        style={{ color: "var(--ff-ink, #0f172a)", opacity: 0.5 }}
      >
        Aperçu : le formulaire est désactivé.
      </p>
    );
  }
  if (state.kind === "success") {
    return (
      <p
        role="status"
        className="mt-3 rounded-lg px-3 py-2 text-center text-sm font-medium"
        style={{
          background: "rgba(34, 197, 94, 0.12)",
          color: "rgb(22, 163, 74)",
          border: "1px solid rgba(34, 197, 94, 0.3)",
        }}
      >
        {state.message}
      </p>
    );
  }
  if (state.kind === "error") {
    return (
      <p
        role="alert"
        className="mt-3 rounded-lg px-3 py-2 text-center text-sm font-medium"
        style={{
          background: "rgba(239, 68, 68, 0.12)",
          color: "rgb(220, 38, 38)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
        }}
      >
        {state.message}
      </p>
    );
  }
  return null;
}

function FieldBlock({
  field,
  disabled,
}: {
  field: FormFieldItem;
  disabled: boolean;
}) {
  const colSpan = field.width === "half" ? "col-span-1" : "col-span-2";
  const inputClass =
    "w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors disabled:opacity-60";

  if (field.type === "checkbox") {
    return (
      <label className={`${colSpan} flex items-center gap-2 text-sm`}>
        <input
          type="checkbox"
          name={field.name}
          required={field.required}
          disabled={disabled}
          className="h-4 w-4 cursor-pointer accent-current disabled:cursor-not-allowed"
        />
        <span style={{ color: "var(--ff-ink, #0f172a)", opacity: 0.85 }}>
          {field.label || "Cocher"}
          {field.required && <span style={{ color: "#ef4444" }}> *</span>}
        </span>
      </label>
    );
  }

  return (
    <div className={colSpan}>
      {field.label && (
        <label
          className="mb-1 block text-xs font-medium text-left"
          style={{ color: "var(--ff-ink, #0f172a)", opacity: 0.85, textAlign: "left" }}
        >
          {field.label}
          {field.required && <span style={{ color: "#ef4444" }}> *</span>}
        </label>
      )}
      {field.type === "textarea" ? (
        <textarea
          name={field.name}
          placeholder={field.placeholder}
          required={field.required}
          disabled={disabled}
          rows={3}
          className={`${inputClass} resize-y`}
          style={inputStyle}
        />
      ) : field.type === "select" ? (
        <select
          name={field.name}
          required={field.required}
          disabled={disabled}
          className={inputClass}
          style={inputStyle}
          defaultValue=""
        >
          <option value="" disabled>
            {field.placeholder || "Sélectionner…"}
          </option>
          {(field.options || []).map((opt, i) => (
            <option key={i} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type}
          name={field.name}
          placeholder={field.placeholder}
          required={field.required}
          disabled={disabled}
          className={inputClass}
          style={inputStyle}
        />
      )}
    </div>
  );
}
