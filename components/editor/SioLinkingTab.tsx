"use client";

import { useMemo, useState } from "react";
import type { Funnel, FunnelPage } from "@/lib/funnels/types";

interface Props {
  funnel: Funnel;
  onChange: (patch: Partial<Funnel>) => void;
  onClose: () => void;
}

function getPageLabel(page: FunnelPage): string {
  const p = page as FunnelPage & {
    name?: string;
    title?: string;
    label?: string;
    slug?: string;
  };
  return (
    p.name?.trim() ||
    p.title?.trim() ||
    p.label?.trim() ||
    p.role ||
    p.slug ||
    p.id
  );
}

export default function SioLinkingTab({ funnel, onChange, onClose }: Props) {
  const integrations = funnel.integrations ?? {};
  const scriptValue = integrations.systemeIoScriptId ?? "";
  const pageUrls = integrations.sioPageUrls ?? {};
  const extraUrls = integrations.sioExtraUrls ?? [];
  const [copied, setCopied] = useState(false);

  const pages = useMemo(() => funnel.pages ?? [], [funnel.pages]);

  const updateIntegrations = (patch: Partial<typeof integrations>) => {
    onChange({
      integrations: { ...integrations, ...patch },
    });
  };

  const setScript = (value: string) =>
    updateIntegrations({ systemeIoScriptId: value });

  const setPageUrl = (pageId: string, url: string) => {
    const next = { ...pageUrls };
    if (url.trim()) next[pageId] = url.trim();
    else delete next[pageId];
    updateIntegrations({ sioPageUrls: next });
  };

  // 🆕 Liens SIO supplémentaires, sans limite — pour les tunnels qui ont plus
  // d'étapes côté Systeme.io que de pages AutoFunnel (ex : webinaire avec
  // plusieurs relances de replay, upsell, etc.).
  const addExtraUrl = () => {
    updateIntegrations({
      sioExtraUrls: [
        ...extraUrls,
        { id: `extra-${Date.now()}-${extraUrls.length}`, label: "", url: "" },
      ],
    });
  };

  const updateExtraUrl = (id: string, patch: Partial<{ label: string; url: string }>) => {
    updateIntegrations({
      sioExtraUrls: extraUrls.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  };

  const removeExtraUrl = (id: string) => {
    updateIntegrations({ sioExtraUrls: extraUrls.filter((e) => e.id !== id) });
  };

  const copyScript = async () => {
    if (!scriptValue) return;
    try {
      await navigator.clipboard.writeText(scriptValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const openSio = () => {
    window.open(
      "https://systeme.io/dashboard/funnels",
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Liaison Systeme.io
            </h2>
            <p className="text-xs text-gray-500">
              Centralise la configuration Systeme.io de ce tunnel — quel que
              soit son type (webinaire, vente directe/VSL, lead magnet,
              coaching, e-commerce…).
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Fermer
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">
          {/* 1. Script Systeme.io */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">
              1. Script du formulaire Systeme.io
            </h3>
            <p className="mb-3 text-xs text-gray-600">
              Colle ici la balise{" "}
              <code className="rounded bg-gray-100 px-1">
                &lt;script id="form-script-tag-…"&gt;
              </code>{" "}
              fournie par Systeme.io. Elle sera injectée dans l'aperçu et
              incluse dans l'export "page complète".
            </p>
            <textarea
              value={scriptValue}
              onChange={(e) => setScript(e.target.value)}
              placeholder={`<script id="form-script-tag-XXXXXXXX" src="https://…/remote/page/….js"></script>`}
              className="h-28 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={copyScript}
                disabled={!scriptValue}
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-40"
              >
                {copied ? "Copié ✓" : "Copier le script"}
              </button>
              <span className="text-xs text-gray-500">
                À coller aussi dans{" "}
                <strong>
                  SIO → Paramètres du tunnel → Codes personnalisés
                </strong>{" "}
                si tu utilises l'export par blocs.
              </span>
            </div>
          </section>

          {/* 2. URLs des pages publiées */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">
              2. URLs des pages publiées sur Systeme.io
            </h3>
            <p className="mb-3 text-xs text-gray-600">
              Une fois chaque étape publiée dans Systeme.io, reporte ici son
              URL. AutoFunnel pourra résoudre automatiquement les liens entre
              pages lors du prochain export.
            </p>
            {pages.length === 0 ? (
              <p className="text-xs italic text-gray-500">
                Aucune page dans ce tunnel.
              </p>
            ) : (
              <div className="space-y-2">
                {pages.map((page, idx) => (
                  <div
                    key={page.id}
                    className="grid grid-cols-[1fr_2fr] items-center gap-3 rounded-lg border border-gray-200 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-gray-900">
                        {idx + 1}. {getPageLabel(page)}
                      </div>
                      <div className="truncate text-[11px] text-gray-500">
                        {page.role ?? "page"}
                      </div>
                    </div>
                    <input
                      type="url"
                      value={pageUrls[page.id] ?? ""}
                      onChange={(e) => setPageUrl(page.id, e.target.value)}
                      placeholder="https://monsite.systeme.io/ma-page"
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 2bis. Liens SIO supplémentaires — sans limite, pour les étapes qui
              n'ont pas de page AutoFunnel correspondante (ex : plus de pages
              côté Systeme.io que dans ce tunnel). */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                2bis. Autres liens Systeme.io (optionnel)
              </h3>
              <button
                type="button"
                onClick={addExtraUrl}
                className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                + Ajouter un lien
              </button>
            </div>
            <p className="mb-3 text-xs text-gray-600">
              Pour les étapes qui existent côté Systeme.io mais n'ont pas de
              page correspondante dans ce tunnel (ex : plus de 4 pages, relance
              replay, upsell…). Purement pour ta référence — contrairement à la
              section 2, ces liens ne sont pas résolus automatiquement dans les
              CTA du tunnel.
            </p>
            {extraUrls.length === 0 ? (
              <p className="text-xs italic text-gray-500">Aucun lien ajouté.</p>
            ) : (
              <div className="space-y-2">
                {extraUrls.map((e) => (
                  <div
                    key={e.id}
                    className="grid grid-cols-[1fr_2fr_auto] items-center gap-2 rounded-lg border border-gray-200 px-3 py-2"
                  >
                    <input
                      type="text"
                      value={e.label}
                      onChange={(ev) => updateExtraUrl(e.id, { label: ev.target.value })}
                      placeholder="Ex. Relance replay J+2"
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="url"
                      value={e.url}
                      onChange={(ev) => updateExtraUrl(e.id, { url: ev.target.value })}
                      placeholder="https://monsite.systeme.io/ma-page"
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeExtraUrl(e.id)}
                      aria-label="Supprimer ce lien"
                      className="rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-500 hover:border-red-300 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 3. Checklist d'intégration */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">
              3. Checklist d'intégration
            </h3>
            <p className="mb-3 text-xs text-gray-600">
              Cette procédure s'applique à{" "}
              <strong>tous les types de tunnels</strong> — webinaire, page de
              vente/VSL, lead magnet, coaching, prise de rendez-vous,
              e-commerce… Adapte simplement le nombre et le rôle des étapes
              (capture, vente, remerciement, livraison…) à ton propre tunnel.
            </p>
            <ol className="space-y-2 text-xs text-gray-700">
              <li className="flex gap-2">
                <span className="font-semibold text-blue-600">①</span>
                <span>
                  Crée le tunnel et toutes ses étapes (vides) dans Systeme.io —
                  autant que de pages dans ton tunnel AutoFunnel (capture,
                  vente, confirmation, remerciement, livraison…).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-blue-600">②</span>
                <span>
                  Pour chaque étape qui contient un{" "}
                  <strong>formulaire de capture</strong> (inscription
                  webinaire, opt-in, prise de coordonnées avant paiement…) :
                  choisis "Commencer de zéro" ou "Choisir un template", puis
                  configure{" "}
                  <em>
                    Action après soumission → rediriger vers l'étape suivante
                  </em>
                  . Les étapes sans formulaire (vente, remerciement…) n'ont pas
                  besoin de ce réglage.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-blue-600">③</span>
                <span>
                  Copie la balise{" "}
                  <code>&lt;script id="form-script-tag-…"&gt;</code> depuis SIO
                  et colle‑la dans le champ ci‑dessus (section 1).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-blue-600">④</span>
                <span>
                  Pour chaque étape, copie le bloc HTML depuis le menu "Export
                  Systeme.io" et colle‑le dans le bloc "Code HTML" de l'étape
                  SIO correspondante.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-blue-600">⑤</span>
                <span>
                  Publie chaque étape, copie son URL définitive et reporte‑la
                  dans le tableau ci‑dessus (section 2).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-blue-600">⑥</span>
                <span>
                  Ré‑exporte le tunnel : les CTA inter‑pages pointeront
                  automatiquement vers les bonnes URLs.
                </span>
              </li>
            </ol>
          </section>

          {/* 4. Action */}
          <section>
            <button
              onClick={openSio}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Ouvrir Systeme.io ↗
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
