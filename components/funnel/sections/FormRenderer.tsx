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

type Props = {
  section: FunnelSection;
  /** Slug du funnel (si connu en dehors de /tunnel/[slug]) */
  funnelSlug?: string;
  /** 🆕 Funnel complet (pour résoudre la page suivante automatiquement) */
  funnel?: Funnel;
  /** 🆕 Page courante (pour lire nextPageId) */
  page?: FunnelPage;
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function classifyField(field: FormFieldItem): "email" | "name" | "phone" | "consent" | "other" {
  const t = (field.type || "").toLowerCase();
  const n = (field.name || "").toLowerCase();
  if (t === "email" || n.includes("email") || n.includes("mail")) return "email";
  if (t === "checkbox" && (n.includes("consent") || n.includes("rgpd") || n.includes("agree"))) return "consent";
  if (t === "tel" || n.includes("phone") || n.includes("tel") || n.includes("mobile")) return "phone";
  if (n === "name" || n.includes("nom") || n.includes("prenom") || n.includes("firstname") || n.includes("lastname") || n.includes("fullname")) return "name";
  return "other";
}

function extractSlugsFromPath(pathname: string | null): {
  funnelSlug: string | null;
  pageSlug: string | null;
} {
  if (!pathname) return { funnelSlug: null, pageSlug: null };
  const match = pathname.match(/^\/tunnel\/([^/]+)(?:\/([^/]+))?/);
  if (!match) return { funnelSlug: null, pageSlug: null };
  return {
    funnelSlug: match[1] || null,
    pageSlug: match[2] || null,
  };
}

/**
 * 🆕 Résout la page suivante selon l'ordre de priorité :
 *  1. section.formConfig.redirectToPageId
 *  2. section.formConfig.redirectToUrl
 *  3. section.cta.pageId / section.cta.pageSlug / section.cta.url
 *  4. page.nextPageId (chaînage auto via chainPagesNavigation)
 *  5. page suivante dans funnel.pages[] (fallback ultime)
 */
function resolveNextDestination(args: {
  section: FunnelSection;
  funnel?: Funnel;
  page?: FunnelPage;
  funnelSlug: string | null;
}): string | null {
  const { section, funnel, page, funnelSlug } = args;

  const pages = funnel?.pages ?? [];
  const findPageById = (id?: string) =>
    id ? pages.find((p) => p.id === id) : undefined;
  const findPageBySlug = (slug?: string) => {
    if (!slug) return undefined;
    const clean = slug.replace(/^\/+/, "").replace(/\/+$/, "");
    return pages.find(
      (p) =>
        p.slug.replace(/^\/+/, "").replace(/\/+$/, "") === clean,
    );
  };
  const buildUrlForPage = (target: FunnelPage): string => {
    if (!funnelSlug) return "/";
    if (target.isHome) return `/tunnel/${funnelSlug}`;
    const clean = target.slug
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");
    return `/tunnel/${funnelSlug}/${clean}`;
  };

  // 1) formConfig — redirection explicite définie par l'utilisateur
  const fc = section.formConfig;
  if (fc?.redirectToPageId) {
    const target = findPageById(fc.redirectToPageId);
    if (target) return buildUrlForPage(target);
  }
  if (fc?.redirectToUrl) {
    return fc.redirectToUrl;
  }

  // 2) CTA configuré sur la section (compatibilité existante)
  const ctaAny = section.cta as
    | { mode?: string; url?: string; pageId?: string; pageSlug?: string }
    | undefined;
  if (ctaAny?.pageId) {
    const target = findPageById(ctaAny.pageId);
    if (target) return buildUrlForPage(target);
  }
  if (ctaAny?.pageSlug) {
    const target = findPageBySlug(ctaAny.pageSlug);
    if (target) return buildUrlForPage(target);
  }
  if (ctaAny?.url && ctaAny.mode === "redirect") {
    const raw = ctaAny.url.trim();
    const isAbsolute = /^https?:\/\//i.test(raw) || raw.startsWith("//");
    const isMailto = raw.startsWith("mailto:") || raw.startsWith("tel:");
    if (isAbsolute || isMailto) return raw;
    // URL relative → on tente de la résoudre comme un pageSlug interne
    const target = findPageBySlug(raw);
    if (target) return buildUrlForPage(target);
    return raw; // fallback
  }

  // 3) page.nextPageId (chaînage automatique injecté à la génération)
  if (page?.nextPageId) {
    const target = findPageById(page.nextPageId);
    if (target) return buildUrlForPage(target);
  }

  // 4) Fallback : page suivante dans l'ordre du tableau pages[]
  if (page && pages.length > 0) {
    const idx = pages.findIndex((p) => p.id === page.id);
    if (idx >= 0 && idx < pages.length - 1) {
      return buildUrlForPage(pages[idx + 1]);
    }
  }

  return null;
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
    section.formConfig?.submitLabel ||
    section.cta?.label ||
    "Envoyer";
  const isSubmitting = state.kind === "submitting";
  const isPreview = !funnelSlug;
  const isSuccess = state.kind === "success";

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
      setState({ kind: "error", message: "Veuillez renseigner votre adresse email." });
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

      // 🆕 Résolution de la prochaine étape
      const redirectTo = resolveNextDestination({
        section,
        funnel,
        page,
        funnelSlug,
      });

      const successMessage =
        section.formConfig?.successMessage ||
        (redirectTo
          ? "Merci ! Redirection…"
          : "Merci ! Votre inscription a bien été enregistrée.");

      if (redirectTo) {
        setState({ kind: "success", message: successMessage });
        setTimeout(() => {
          window.location.href = redirectTo;
        }, 600);
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

  // ─── Rendu (inchangé) ────────────────────────────────────────────
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
    </form>
  );
}

// ─── Sous-composants inchangés (inputStyle, SubmitButton, FeedbackMessage, FieldBlock) ──

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
          className="mb-1 block text-xs font-medium"
          style={{ color: "var(--ff-ink, #0f172a)", opacity: 0.85 }}
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
