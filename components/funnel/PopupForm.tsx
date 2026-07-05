// components/funnel/PopupForm.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import type {
  CtaConfig,
  Funnel,
  FunnelPage,
  FunnelSection,
  FormFieldItem,
} from "@/lib/funnels/types";
import { DEFAULT_REASSURANCE } from "@/lib/funnels/types";
import {
  extractSlugsFromPath,
  resolveNextDestination,
} from "@/lib/funnels/nextDestination";

type Props = {
  cta: CtaConfig;
  section: FunnelSection;
  funnel?: Funnel;
  page?: FunnelPage;
  buttonClassName?: string;
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  customFields?: FormFieldItem[];
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

const DEFAULT_FIELDS: FormFieldItem[] = [
  {
    name: "name",
    type: "text",
    label: "Prénom",
    placeholder: "Votre prénom",
    required: true,
    width: "full",
  },
  {
    name: "email",
    type: "email",
    label: "Email",
    placeholder: "vous@exemple.com",
    required: true,
    width: "full",
  },
];

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

function computeReassurance(raw: string | undefined): string | null {
  if (raw === undefined) return DEFAULT_REASSURANCE;
  if (raw.trim() === "") return null;
  return raw;
}

export function PopupForm({
  cta,
  section,
  funnel,
  page,
  buttonClassName,
  buttonProps,
  customFields,
}: Props) {
  // ─── Cas Systeme.io : on délègue à la popup SIO native ─────────────
  if (cta.popupProvider === "systeme" && cta.systemePopupId) {
    const sioClass = `systeme-show-popup-${cta.systemePopupId}`;
    return (
      <button
        type="button"
        className={`${buttonClassName ?? ""} ${sioClass}`.trim()}
        data-ff-cta
        {...buttonProps}
      >
        {cta.label}
      </button>
    );
  }

  // ─── Cas embed externe : popup contenant une iframe sandboxée ──────
  if (cta.popupProvider === "embed" && cta.popupEmbedHtml) {
    return (
      <EmbedPopup
        cta={cta}
        section={section}
        funnel={funnel}
        page={page}
        buttonClassName={buttonClassName}
        buttonProps={buttonProps}
      />
    );
  }

  // ─── Cas interne : popup React + soumission /api/leads ─────────────
  return (
    <InternalPopup
      cta={cta}
      section={section}
      funnel={funnel}
      page={page}
      buttonClassName={buttonClassName}
      buttonProps={buttonProps}
      customFields={customFields}
    />
  );
}

function InternalPopup({
  cta,
  section,
  funnel,
  page,
  buttonClassName,
  buttonProps,
  customFields,
}: Props) {
  const pathname = usePathname();
  const { funnelSlug, pageSlug } = useMemo(
    () => extractSlugsFromPath(pathname),
    [pathname],
  );
  const isPreview = !funnelSlug;

  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const fields =
    customFields && customFields.length > 0 ? customFields : DEFAULT_FIELDS;

  const reassuranceText = computeReassurance(cta.popupReassurance);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      firstInputRef.current?.focus();
    }, 50);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
    };
  }, [open]);

  function close() {
    if (state.kind === "submitting") return;
    setOpen(false);
    window.setTimeout(() => {
      if (state.kind !== "success") setState({ kind: "idle" });
    }, 200);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "submitting" || state.kind === "success") return;

    // En aperçu (pas de slug de tunnel), une vraie soumission à /api/leads
    // échouerait : on SIMULE le succès pour pouvoir tester le rendu du popup,
    // sans envoyer aucune donnée.
    if (isPreview) {
      const previewMsg =
        section.formConfig?.successMessage ||
        "Merci ! (aperçu — aucune donnée envoyée)";
      setState({ kind: "success", message: previewMsg });
      return;
    }

    const formEl = e.currentTarget;
    const formData = new FormData(formEl);

    let email = "";
    let name: string | null = null;
    let phone: string | null = null;
    let consent = false;
    const metadata: Record<string, unknown> = {};

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
          metadata: { ...metadata, source: "popup-cta" },
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

      setState({ kind: "success", message: successMessage });

      if (redirectTo) {
        window.setTimeout(() => {
          window.location.href = redirectTo;
        }, 600);
      } else {
        window.setTimeout(() => {
          formEl.reset();
          close();
        }, 1800);
      }
    } catch (err) {
      console.error("[PopupForm] submit error", err);
      setState({
        kind: "error",
        message: "Impossible de contacter le serveur. Vérifiez votre connexion.",
      });
    }
  }

  const title = cta.popupTitle ?? "Inscrivez-vous";
  const body = cta.popupBody ?? "";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName ?? ""}
        data-ff-cta
        {...buttonProps}
      >
        {cta.label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ff-popup-title"
          className="ff-popup-overlay fixed inset-0 z-[9999] flex items-center justify-center px-4"
          style={{
            background: "rgba(0,0,0,0.6)",
            animation: "ffPopupFade 180ms ease-out",
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            className="ff-popup-card relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{
              background: "var(--ff-bg, #ffffff)",
              color: "var(--ff-ink, #0f172a)",
              border: "1px solid var(--ff-border, rgba(0,0,0,0.08))",
              animation: "ffPopupScale 220ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Fermer"
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-black/5"
              disabled={state.kind === "submitting"}
            >
              <X size={16} />
            </button>

            <div className="mb-4 px-8">
              <h2
                id="ff-popup-title"
                className="text-xl font-black uppercase leading-tight text-center"
                style={{ color: "var(--ff-ink, #0f172a)" }}
              >
                {title}
              </h2>
              {body && (
                <p className="mt-1.5 text-center text-sm" style={{ opacity: 0.75 }}>
                  {body}
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {fields.map((f, idx) => (
                <PopupField
                  key={`${f.name}-${idx}`}
                  field={f}
                  disabled={state.kind === "submitting" || state.kind === "success"}
                  inputRef={idx === 0 ? firstInputRef : undefined}
                />
              ))}

              <button
                type="submit"
                disabled={
                  state.kind === "submitting" || state.kind === "success"
                }
                className="mt-2 w-full rounded-lg px-4 py-3 text-sm font-bold transition disabled:opacity-70 disabled:cursor-not-allowed"
                style={{
                  background: "var(--ff-accent, #2563eb)",
                  color: "var(--ff-accent-ink, #ffffff)",
                  border: "none",
                  cursor:
                    state.kind === "submitting" || state.kind === "success"
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {state.kind === "submitting"
                  ? "Envoi…"
                  : state.kind === "success"
                    ? "Envoyé ✓"
                    : cta.label || "Valider"}
              </button>

              {isPreview && state.kind !== "success" && (
                <p className="text-center text-[11px]" style={{ opacity: 0.5 }}>
                  Aperçu — soumission simulée, aucune donnée n'est envoyée.
                </p>
              )}

              {state.kind === "success" && (
                <p
                  role="status"
                  className="rounded-lg px-3 py-2 text-center text-sm font-medium"
                  style={{
                    background: "rgba(34, 197, 94, 0.12)",
                    color: "rgb(22, 163, 74)",
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                  }}
                >
                  {state.message}
                </p>
              )}

              {state.kind === "error" && (
                <p
                  role="alert"
                  className="rounded-lg px-3 py-2 text-center text-sm font-medium"
                  style={{
                    background: "rgba(239, 68, 68, 0.12)",
                    color: "rgb(220, 38, 38)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                  }}
                >
                  {state.message}
                </p>
              )}
            </form>

            {reassuranceText && (
              <p className="mt-4 text-center text-[11px]" style={{ opacity: 0.6 }}>
                {reassuranceText}
              </p>
            )}
          </div>

          <style jsx>{`
            @keyframes ffPopupFade {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }
            @keyframes ffPopupScale {
              from {
                opacity: 0;
                transform: scale(0.95) translateY(8px);
              }
              to {
                opacity: 1;
                transform: scale(1) translateY(0);
              }
            }
          `}</style>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 EmbedPopup — affiche un code de formulaire externe dans une iframe sandboxée.
// AutoFunnel ne capture PAS ces leads : ils partent directement vers l'outil tiers.
// ─────────────────────────────────────────────────────────────────────────────

function EmbedPopup({
  cta,
  section,
  funnel,
  page,
  buttonClassName,
  buttonProps,
}: {
  cta: CtaConfig;
  section: FunnelSection;
  funnel?: Funnel;
  page?: FunnelPage;
  buttonClassName?: string;
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}) {
  const [open, setOpen] = useState(false);
  // 🆕 Nombre de chargements de l'iframe : le 1er = affichage initial ; un 2e
  // chargement = le formulaire a été soumis (navigation vers la page de
  // confirmation du fournisseur) → on redirige vers la page suivante du tunnel.
  const loadCountRef = useRef(0);
  const [submitted, setSubmitted] = useState(false);
  const pathname = usePathname();

  // 🆕 Page suivante du tunnel : même résolution que le popup interne
  // (formConfig → CTA → nextPageId → page suivante). Null hors page publiée.
  const nextHref = useMemo(() => {
    const { funnelSlug } = extractSlugsFromPath(pathname);
    if (!funnelSlug) return null;
    return resolveNextDestination({ section, funnel, page, funnelSlug });
  }, [pathname, section, funnel, page]);

  useEffect(() => {
    if (!open) return;
    loadCountRef.current = 0;
    setSubmitted(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // 🆕 DÉTECTION DE SOUMISSION : les formulaires tiers soumettent souvent en
  // AJAX (aucune navigation → l'iframe ne se recharge pas). Un script injecté
  // dans l'iframe écoute l'événement `submit` (+ clic sur bouton submit d'un
  // <form>) et prévient FunnelFlow via postMessage → on peut alors rediriger
  // le prospect vers la page suivante du tunnel.
  useEffect(() => {
    if (!open) return;
    const onMessage = (ev: MessageEvent) => {
      const d = ev?.data as { type?: string } | undefined;
      if (d?.type !== "ff-embed-submitted") return;
      setSubmitted(true);
      if (nextHref) {
        window.setTimeout(() => {
          window.location.href = nextHref;
        }, 1600);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open, nextHref]);

  // 🆕 CSS de base soigné DANS l'iframe : les codes embed bruts (form nu sans
  // la feuille de style du fournisseur) restent présentables — champs, labels
  // et bouton stylés proprement au lieu du rendu « cassé » par défaut.
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *,*::before,*::after{box-sizing:border-box}
  body{margin:0;padding:18px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111827;font-size:15px;line-height:1.5}
  img,iframe{max-width:100%}
  form{display:flex;flex-direction:column;gap:12px}
  label{font-size:13px;font-weight:600;color:#374151}
  input:not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]),select,textarea{
    width:100%;padding:11px 13px;border:1px solid #D1D5DB;border-radius:10px;
    font:inherit;background:#fff;outline:none;transition:border-color .15s, box-shadow .15s}
  input:focus,select:focus,textarea:focus{border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,.15)}
  button,input[type=submit],input[type=button]{
    width:100%;padding:12px 16px;border:none;border-radius:10px;background:#111827;color:#fff;
    font:inherit;font-weight:700;cursor:pointer;transition:opacity .15s}
  button:hover,input[type=submit]:hover{opacity:.9}
  p{margin:.35em 0}
</style>
<script>
(function () {
  var notified = false;
  function notify(delay) {
    if (notified) return;
    notified = true;
    setTimeout(function () {
      try { parent.postMessage({ type: "ff-embed-submitted" }, "*"); } catch (e) {}
    }, delay);
  }
  // 1) Soumission native (capture : fonctionne même si le vendor preventDefault + AJAX)
  document.addEventListener("submit", function () { notify(1400); }, true);
  // 2) Filet : clic sur un bouton submit DANS un <form> (certains widgets
  //    n'émettent pas d'événement submit standard)
  document.addEventListener("click", function (e) {
    var el = e.target;
    if (!el || !el.closest) return;
    var btn = el.closest('button[type="submit"],input[type="submit"],form button:not([type="button"])');
    if (btn && btn.closest("form")) notify(2200);
  }, true);
})();
</script>
</head><body>${cta.popupEmbedHtml ?? ""}</body></html>`;

  const handleIframeLoad = () => {
    loadCountRef.current += 1;
    if (loadCountRef.current >= 2) {
      // Le formulaire a navigué (soumission) → petite pause pour laisser voir
      // la confirmation du fournisseur, puis on poursuit le tunnel.
      setSubmitted(true);
      if (nextHref) {
        window.setTimeout(() => {
          window.location.href = nextHref;
        }, 1600);
      }
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName ?? ""}
        data-ff-cta
        {...buttonProps}
      >
        {cta.label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white p-2 shadow-2xl"
            style={{ maxHeight: "85vh" }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow transition hover:bg-black/5"
            >
              <X size={16} />
            </button>
            <iframe
              title={cta.popupTitle || "Formulaire"}
              srcDoc={srcDoc}
              sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
              className="w-full rounded-xl border-0"
              style={{ height: nextHref || submitted ? "62vh" : "70vh" }}
              onLoad={handleIframeLoad}
            />
            {/* 🆕 Poursuite du tunnel : bouton toujours disponible + message
                après soumission détectée (redirection automatique). */}
            {(nextHref || submitted) && (
              <div className="px-2 pb-2 pt-1.5 text-center">
                {submitted && (
                  <p className="mb-1.5 text-xs font-semibold text-emerald-600">
                    ✓ Formulaire envoyé{nextHref ? " — redirection…" : ""}
                  </p>
                )}
                {nextHref && (
                  <a
                    href={nextHref}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                  >
                    Continuer →
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function PopupField({
  field,
  disabled,
  inputRef,
}: {
  field: FormFieldItem;
  disabled: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const inputClass =
    "w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors disabled:opacity-60";
  const inputStyle: React.CSSProperties = {
    border: "1px solid var(--ff-border, rgba(0,0,0,0.12))",
    background: "rgba(255,255,255,0.06)",
    color: "var(--ff-ink, #0f172a)",
  };

  if (field.type === "checkbox") {
    return (
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name={field.name}
          required={field.required}
          disabled={disabled}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-current disabled:cursor-not-allowed"
        />
        <span style={{ opacity: 0.85 }}>
          {field.label || "J'accepte"}
          {field.required && <span style={{ color: "#ef4444" }}> *</span>}
        </span>
      </label>
    );
  }

  return (
    <div>
      {field.label && (
        <label className="mb-1 block text-xs font-medium" style={{ opacity: 0.85 }}>
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
          ref={inputRef as React.RefObject<HTMLInputElement>}
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
