"use client";

import { useEffect, useState } from "react";
import type { Funnel } from "@/lib/funnels/types";
import { loadPublishedFunnel, loadFunnelBySlug } from "@/lib/store/funnelStore";
import { hasIdbRefs, resolveMedias } from "@/lib/store/mediaStore";
import { PublicFunnelView } from "@/components/funnel/PublicFunnelView";

type State =
  | { status: "loading" }
  | { status: "found"; funnel: Funnel }
  | { status: "not-found" };

type Props = {
  slug: string;
  activePageSlug?: string;
};

export function PublicFunnelClient({ slug, activePageSlug }: Props) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    // 1. Funnel publié explicitement (ff:public:<slug>)
    const published = loadPublishedFunnel(slug);
    // 2. Fallback : funnel non publié mais existant en local (preview live)
    const stored = published ?? loadFunnelBySlug(slug);

    if (!stored) {
      setState({ status: "not-found" });
      return;
    }

    // 🔑 Si le funnel contient des références idb-media://, on les résout
    // depuis IndexedDB avant d'afficher (sinon les <img> auront des src
    // invalides → ERR_UNKNOWN_URL_SCHEME).
    if (hasIdbRefs(stored.funnel)) {
      // Clone profond pour ne pas muter l'objet en mémoire dans le store
      const cloned = JSON.parse(JSON.stringify(stored.funnel)) as Funnel;
      resolveMedias(cloned)
        .then(() => {
          if (cancelled) return;
          setState({ status: "found", funnel: cloned });
        })
        .catch((e) => {
          console.warn(
            "[PublicFunnelClient] resolveMedias a échoué, affichage avec placeholders:",
            e,
          );
          if (cancelled) return;
          // On affiche quand même le tunnel, juste sans les images
          setState({ status: "found", funnel: stored.funnel });
        });
    } else {
      // Pas de média externalisé → affichage direct
      setState({ status: "found", funnel: stored.funnel });
    }

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state.status === "loading") {
    return (
      <main className="grid min-h-screen place-items-center bg-white">
        <p className="text-sm text-slate-500">Chargement du tunnel...</p>
      </main>
    );
  }

  if (state.status === "not-found") {
    return (
      <main className="grid min-h-screen place-items-center bg-white px-6 text-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            Tunnel introuvable
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Ce tunnel n&apos;existe pas ou n&apos;a pas encore été publié sur cet appareil
          </p>
        </div>
      </main>
    );
  }

  return (
    <PublicFunnelView
      funnel={state.funnel}
      activePageSlug={activePageSlug}
    />
  );
}
