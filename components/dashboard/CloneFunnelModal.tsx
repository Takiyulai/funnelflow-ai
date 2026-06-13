// components/dashboard/CloneFunnelModal.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFunnelFromAi } from "@/lib/store/funnelStore";
import type { Funnel, FunnelBrief, Language } from "@/lib/funnels/types";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Step = "input" | "fetching" | "parsing" | "uploading" | "saving" | "error";

const STEP_LABELS: Record<Step, string> = {
  input: "",
  fetching: "Récupération de la page…",
  parsing: "Analyse de la structure…",
  uploading: "Téléchargement des médias…",
  saving: "Sauvegarde du tunnel…",
  error: "",
};

export function CloneFunnelModal({ open, onClose }: Props) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState<Language>("fr");
  const [step, setStep] = useState<Step>("input");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!open) return null;

  const isLoading =
    step === "fetching" ||
    step === "parsing" ||
    step === "uploading" ||
    step === "saving";

  async function handleClone() {
    setErrorMessage(null);

    // Validation basique côté client
    const trimmed = url.trim();
    if (!trimmed) {
      setErrorMessage("Veuillez saisir une URL.");
      return;
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("URL non http/https");
      }
    } catch {
      setErrorMessage("L'URL doit être au format https://exemple.com/...");
      return;
    }

    // Génère un funnelId temporaire utilisé pour nommer les médias Supabase
    const tempFunnelId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `ff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Animation de progression (les étapes serveur sont opaques côté client,
    // on cycle visuellement pour donner du feedback à l'utilisateur)
    setStep("fetching");
    const progressTimer = setTimeout(() => setStep("parsing"), 5000);
    const progressTimer2 = setTimeout(() => setStep("uploading"), 12000);

    try {
      const res = await fetch("/api/clone-funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: trimmed,
          language,
          funnelId: tempFunnelId,
        }),
      });

      clearTimeout(progressTimer);
      clearTimeout(progressTimer2);

      const data = await res.json();

      if (!res.ok || !data.success) {
        setStep("error");
        setErrorMessage(
          data?.error || `Erreur ${res.status} : impossible de cloner le tunnel.`
        );
        return;
      }

      setStep("saving");

      // Sauvegarde dans localStorage via le store existant
      const funnel = data.funnel as Funnel;
      const brief = buildCloneBrief(funnel, trimmed, language);
      const stored = createFunnelFromAi(funnel, brief);

      // Redirection vers l'éditeur
      router.push(`/editor/${stored.id}`);
    } catch (err) {
      clearTimeout(progressTimer);
      clearTimeout(progressTimer2);
      console.error("[CloneFunnelModal] Erreur :", err);
      setStep("error");
      setErrorMessage(
        (err as Error)?.message ||
          "Une erreur inattendue est survenue. Veuillez réessayer."
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={isLoading ? undefined : onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-gray-900">
          Cloner un tunnel
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Collez l'URL d'un tunnel existant. Notre IA va le dupliquer
          (structure, design, médias) en quelques secondes.
        </p>

        {step === "input" && (
          <div className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="clone-url"
                className="block text-sm font-medium text-gray-700"
              >
                URL du tunnel à cloner
              </label>
              <input
                id="clone-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://exemple.com/landing"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                autoFocus
              />
            </div>

            <div>
              <label
                htmlFor="clone-language"
                className="block text-sm font-medium text-gray-700"
              >
                Langue du tunnel cloné
              </label>
              <select
                id="clone-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>

            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              ⚠️ Respectez les droits d'auteur. Cette fonctionnalité est
              destinée à cloner vos propres tunnels ou des templates publics.
            </p>

            {errorMessage && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {errorMessage}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleClone}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Cloner
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="mt-6 flex flex-col items-center gap-4 py-6">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
            <p className="text-sm font-medium text-gray-700">
              {STEP_LABELS[step]}
            </p>
            <p className="text-xs text-gray-500">
              Cela peut prendre jusqu'à 30 secondes.
            </p>
          </div>
        )}

        {step === "error" && (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">
                Échec du clonage
              </p>
              <p className="mt-1 text-sm text-red-700">
                {errorMessage ?? "Une erreur inconnue est survenue."}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => setStep("input")}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Réessayer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Construit un FunnelBrief synthétique pour un funnel cloné.
 * Le brief est exigé par createFunnelFromAi mais n'a pas vraiment de sens
 * pour un clone : on le remplit avec des valeurs minimales cohérentes.
 */
function buildCloneBrief(
  funnel: Funnel,
  sourceUrl: string,
  language: Language
): FunnelBrief {
  return {
    brandName: funnel.funnelName || "Cloned brand",
    offerName: funnel.funnelName || "Cloned offer",
    price: "",
    targetAudience: "",
    mainPain: "",
    promise: funnel.seo?.description ?? "",
    tone: "neutre",
    funnelType: "custom",
    designStyle: funnel.design?.style ?? "modern",
    language,
    creationMode: "free",
    mainColor: funnel.design?.primaryColor,
    secondaryColor: funnel.design?.secondaryColor,
    aboutText: `Cloné depuis : ${sourceUrl}`,
  };
}
