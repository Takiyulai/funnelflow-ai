"use client";

// app/templates/[id]/preview/page.tsx
// 🆕 Aperçu PUBLIC d'un modèle de la Galerie communautaire. Sert à la fois :
//   - de miniature (iframe scalée dans la carte de la galerie, ?thumb=1) ;
//   - d'aperçu plein écran (ouvert dans un nouvel onglet).
// Le contenu est récupéré via /api/templates/[id] puis rendu avec FunnelPreview,
// sans le chrome de l'éditeur. Aucune authentification requise (lecture publique).

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";
import { normalizeFunnel } from "@/lib/store/normalizeFunnel";
import type { Funnel, FunnelPage } from "@/lib/funnels/types";

export default function TemplatePreviewPage() {
  return (
    <Suspense fallback={null}>
      <TemplatePreviewInner />
    </Suspense>
  );
}

function TemplatePreviewInner() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const searchParams = useSearchParams();
  const isThumb = (searchParams?.get("thumb") ?? "") === "1";

  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");

  const activePage = useMemo<FunnelPage | undefined>(() => {
    if (!funnel?.pages || funnel.pages.length === 0) return undefined;
    const home = funnel.pages.find((p) => p.isHome) ?? funnel.pages[0];
    // 🆕 Miniature : on ne rend que la 1ʳᵉ section (haut du tunnel) → 1 seule
    // iframe au lieu de N, la galerie reste fluide même avec beaucoup de cartes.
    if (isThumb && home) {
      return { ...home, sections: home.sections.slice(0, 3) };
    }
    return home;
  }, [funnel, isThumb]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    fetch(`/api/templates/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        if (d?.ok && d.content) {
          setFunnel(normalizeFunnel(d.content));
          setStatus("ready");
        } else {
          setStatus("missing");
        }
      })
      .catch(() => {
        if (alive) setStatus("missing");
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (status === "missing") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
          color: "#334155",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Aperçu indisponible</h1>
          <p style={{ maxWidth: 420, lineHeight: 1.5 }}>Ce modèle n&apos;est plus disponible.</p>
        </div>
      </div>
    );
  }

  if (status === "loading" || !funnel) {
    return (
      <div
        style={{
          minHeight: isThumb ? "auto" : "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          color: "#94a3b8",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 13,
        }}
      >
        Chargement de l&apos;aperçu…
      </div>
    );
  }

  return (
    <div style={{ minHeight: isThumb ? "auto" : "100vh", background: "#ffffff" }}>
      <FunnelPreview
        funnel={funnel}
        activePage={activePage}
        showToolbar={false}
        defaultMode="desktop"
        viewportHeight="auto"
        pageRole={activePage?.role}
      />
    </div>
  );
}
