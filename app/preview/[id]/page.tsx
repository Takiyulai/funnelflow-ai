"use client";

// app/preview/[id]/page.tsx
// Aperçu CLIENT d'un tunnel généré/édité mais pas encore publié.
// Lit le tunnel depuis le stockage local du navigateur (funnelStore) et le rend
// via FunnelPreview, sans le chrome de l'éditeur. Évite le 404 de /tunnel/[slug]
// qui, lui, exige un tunnel publié côté serveur (Supabase).

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { loadFunnelWithMedia } from "@/lib/store/funnelStore";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";
import type { Funnel } from "@/lib/funnels/types";

export default function LocalPreviewPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    if (!id) return;
    let alive = true;
    loadFunnelWithMedia(id)
      .then((stored) => {
        if (!alive) return;
        if (stored?.funnel) {
          setFunnel(stored.funnel);
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
          <p style={{ maxWidth: 420, lineHeight: 1.5 }}>
            Ce tunnel n&apos;a pas été trouvé sur cet appareil. Ouvre l&apos;aperçu depuis
            l&apos;éditeur du tunnel, sur le même navigateur.
          </p>
        </div>
      </div>
    );
  }

  if (status === "loading" || !funnel) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748b",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        Chargement de l&apos;aperçu…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <FunnelPreview funnel={funnel} showToolbar={false} viewportHeight="auto" />
    </div>
  );
}
