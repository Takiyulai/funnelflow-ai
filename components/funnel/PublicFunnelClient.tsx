"use client";

import { useEffect, useState } from "react";
import type { Funnel } from "@/lib/funnels/types";
import { loadPublishedFunnel, loadFunnelBySlug } from "@/lib/store/funnelStore";
import { PublicFunnelView } from "@/components/funnel/PublicFunnelView";

type State =
  | { status: "loading" }
  | { status: "found"; funnel: Funnel }
  | { status: "not-found" };

type Props = { slug: string };

export function PublicFunnelClient({ slug }: Props) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    // 1. Funnel publié explicitement (ff:public:<slug>)
    const published = loadPublishedFunnel(slug);
    if (published) {
      setState({ status: "found", funnel: published.funnel });
      return;
    }
    // 2. Fallback : funnel non publié mais existant en local (preview live)
    const local = loadFunnelBySlug(slug);
    if (local) {
      setState({ status: "found", funnel: local.funnel });
      return;
    }
    setState({ status: "not-found" });
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
            Ce tunnel n'existe pas ou n'a pas encore été publié sur cet appareil
          </p>
        </div>
      </main>
    );
  }

  return <PublicFunnelView funnel={state.funnel} />;
}
