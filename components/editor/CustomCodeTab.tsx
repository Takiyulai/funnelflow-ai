"use client";

// components/editor/CustomCodeTab.tsx
// 🆕 VAGUE CUSTOM-CODE — Panneau « Code personnalisé » (head/body).
// ⚠️ Fonctionnalité SENSIBLE, réservée au plan Agency :
//   - L'UI se verrouille pour les autres plans (lecture du plan via
//     /api/billing/me) avec une invitation à upgrader.
//   - MAIS la vraie barrière est CÔTÉ SERVEUR au rendu public
//     (lib/funnels/customCode.ts) : masquer l'UI n'est qu'un confort.

import { useEffect, useState } from "react";
import { ShieldAlert, Lock } from "lucide-react";
import type { Funnel } from "@/lib/funnels/types";
import { MAX_CUSTOM_CODE_LEN } from "@/lib/funnels/types";

interface Props {
  funnel: Funnel;
  onChange: (patch: Partial<Funnel>) => void;
  onClose: () => void;
}

type CustomCode = NonNullable<Funnel["customCode"]>;
type PlanState = "loading" | "agency" | "locked";

export default function CustomCodeTab({ funnel, onChange, onClose }: Props) {
  const current: CustomCode = { ...(funnel.customCode ?? {}) };
  const [planState, setPlanState] = useState<PlanState>("loading");

  useEffect(() => {
    let active = true;
    fetch("/api/billing/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active) return;
        setPlanState(d?.ok && d.planId === "agency" ? "agency" : "locked");
      })
      .catch(() => {
        if (active) setPlanState("locked"); // prudent : verrouillé en cas de doute
      });
    return () => {
      active = false;
    };
  }, []);

  const update = (key: keyof CustomCode, value: string) => {
    onChange({ customCode: { ...current, [key]: value } });
  };

  const disabled = planState !== "agency";

  const zoneField = (
    key: keyof CustomCode,
    label: string,
    hint: string,
  ) => {
    const value = current[key] ?? "";
    const tooLong = value.length > MAX_CUSTOM_CODE_LEN;
    return (
      <label className="block">
        <span className="text-xs font-semibold uppercase text-gray-500">{label}</span>
        <textarea
          value={value}
          onChange={(e) => update(key, e.target.value)}
          disabled={disabled}
          rows={7}
          spellCheck={false}
          placeholder={disabled ? "Réservé au plan Agency" : "<script>…</script>"}
          className={`mt-1 w-full rounded-lg border px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 ${
            tooLong
              ? "border-red-400 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
          } ${disabled ? "bg-gray-50 text-gray-400" : ""}`}
        />
        <span className={`mt-1 block text-xs ${tooLong ? "text-red-600 font-semibold" : "text-gray-500"}`}>
          {tooLong
            ? `Trop long (${value.length.toLocaleString("fr-FR")} / ${MAX_CUSTOM_CODE_LEN.toLocaleString("fr-FR")} caractères) — cette zone ne sera PAS injectée.`
            : hint}
        </span>
      </label>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Code personnalisé
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                Agency
              </span>
            </h2>
            <p className="text-xs text-gray-500">
              Scripts et balises injectés sur les pages publiées de CE tunnel
              uniquement — jamais dans l&apos;éditeur ni l&apos;aperçu.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Fermer
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* ⚠️ Avertissement (exigence n°4) */}
          <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <div>
              <strong>Le code est exécuté tel quel, sous votre entière
              responsabilité.</strong>{" "}
              Un script mal écrit peut casser l&apos;affichage de votre tunnel,
              ralentir vos pages ou compromettre les données de vos visiteurs.
              Aucun contrôle n&apos;est effectué sur son contenu. Tout usage
              abusif (phishing, malware, collecte déloyale) entraîne la
              suspension du compte — les tunnels concernés sont journalisés.
            </div>
          </div>

          {planState === "locked" && (
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <Lock className="h-4 w-4 shrink-0" />
              <span>
                Le code personnalisé est réservé au plan <strong>Agency</strong>.{" "}
                <a href="/abonnement" className="font-semibold text-blue-600 underline">
                  Passer au plan Agency
                </a>{" "}
                pour le débloquer. (Même enregistré, un code ne sera jamais
                injecté sans plan Agency actif — la vérification est faite côté
                serveur.)
              </span>
            </div>
          )}

          {zoneField(
            "head",
            "Code début de page (head)",
            "Injecté tout en haut de la page, exécuté avant le contenu. Pour les scripts de mesure, balises meta de vérification, styles.",
          )}
          {zoneField(
            "body",
            "Code fin de page (body)",
            "Injecté tout en bas de la page. Pour les widgets (chat, avis), scripts non critiques.",
          )}

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>Pensez à re-publier le tunnel</strong> après modification :
            le code n&apos;est injecté que sur la version publiée
            (<code className="font-mono text-xs">/tunnel/votre-slug</code>) —
            jamais dans l&apos;éditeur ni l&apos;aperçu. Ne collez pas le même
            script dans les deux zones (double exécution).
          </div>

          <p className="text-xs text-gray-400">
            Rappel : vos pixels Meta / GA4 / GTM / TikTok par identifiant (panneau
            « Pixels publicitaires ») restent le moyen le plus sûr — n&apos;utilisez
            le code personnalisé que pour ce qu&apos;ils ne couvrent pas.
          </p>
        </div>

        <footer className="flex justify-end border-t px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          >
            Terminé
          </button>
        </footer>
      </div>
    </div>
  );
}
