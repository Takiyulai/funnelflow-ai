"use client";

import type { Funnel } from "@/lib/funnels/types";

interface Props {
  funnel: Funnel;
  onChange: (patch: Partial<Funnel>) => void;
  onClose: () => void;
}

type DeliveryEmail = NonNullable<NonNullable<Funnel["meta"]>["deliveryEmail"]>;

const EMPTY: DeliveryEmail = {
  enabled: false,
  subject: "",
  body: "",
  attachmentUrl: "",
};

export default function DeliveryEmailTab({ funnel, onChange, onClose }: Props) {
  const current: DeliveryEmail = { ...EMPTY, ...(funnel.meta?.deliveryEmail ?? {}) };

  const update = (patch: Partial<DeliveryEmail>) => {
    onChange({
      meta: {
        ...(funnel.meta ?? {}),
        deliveryEmail: { ...current, ...patch },
      },
    });
  };

  const hasContent = current.subject.trim().length > 0 || current.body.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Email de livraison / bienvenue
            </h2>
            <p className="text-xs text-gray-500">
              Envoyé automatiquement au lead dès qu’il s’inscrit sur ce tunnel.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Fermer
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Incitation / état */}
          {!current.enabled && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <strong>Pas encore activé.</strong> Activez l’email pour livrer
              instantanément votre ebook, lien d’accès ou message de bienvenue —
              et faire une première impression pro. Aucun email n’est envoyé tant
              que c’est désactivé.
            </div>
          )}

          {/* Toggle */}
          <label className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
            <span className="text-sm font-medium text-gray-900">
              Activer l’email de livraison
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={current.enabled}
              onClick={() => update({ enabled: !current.enabled })}
              className={`relative h-6 w-11 rounded-full transition ${
                current.enabled ? "bg-green-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                  current.enabled ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </label>

          {/* Objet */}
          <label className="block">
            <span className="text-xs font-semibold uppercase text-gray-500">
              Objet
            </span>
            <input
              value={current.subject}
              onChange={(e) => update({ subject: e.target.value })}
              placeholder="Votre ebook est arrivé 🎉"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>

          {/* Corps */}
          <label className="block">
            <span className="text-xs font-semibold uppercase text-gray-500">
              Message
            </span>
            <textarea
              value={current.body}
              onChange={(e) => update({ body: e.target.value })}
              rows={7}
              placeholder={
                "Bonjour {{name}},\n\nMerci pour votre inscription ! Voici votre accès.\n\nÀ très vite."
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="mt-1 block text-[11px] text-gray-500">
              Variables disponibles :{" "}
              <code className="rounded bg-gray-100 px-1">{"{{name}}"}</code> et{" "}
              <code className="rounded bg-gray-100 px-1">{"{{email}}"}</code>.
            </span>
          </label>

          {/* Lien / pièce jointe */}
          <label className="block">
            <span className="text-xs font-semibold uppercase text-gray-500">
              Lien d’accès / téléchargement (optionnel)
            </span>
            <input
              type="url"
              value={current.attachmentUrl ?? ""}
              onChange={(e) => update({ attachmentUrl: e.target.value })}
              placeholder="https://…/mon-ebook.pdf"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="mt-1 block text-[11px] text-gray-500">
              Ajouté en bas de l’email sous forme de bouton « Accéder à votre
              contenu ».
            </span>
          </label>

          {current.enabled && !hasContent && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Ajoutez au moins un objet ou un message : un email vide ne sera pas
              envoyé.
            </p>
          )}

          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            ℹ️ Les modifications prennent effet après <strong>publication</strong>{" "}
            du tunnel.
          </p>
        </div>

        <footer className="flex justify-end border-t px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Terminé
          </button>
        </footer>
      </div>
    </div>
  );
}
