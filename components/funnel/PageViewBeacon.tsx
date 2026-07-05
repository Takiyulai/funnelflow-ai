"use client";

// components/funnel/PageViewBeacon.tsx
// 🆕 LOT 2 — Signal léger de "page visitée" pour le déclencheur Workflow
// `page.visited`. Ne suit QUE les contacts déjà identifiés sur ce navigateur
// (id posé en localStorage par FormRenderer après capture d'un lead) — aucun
// tracking de visiteur anonyme. Composant invisible, aucune UI.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { extractSlugsFromPath } from "@/lib/funnels/nextDestination";

export function PageViewBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    const { funnelSlug, pageSlug } = extractSlugsFromPath(pathname);
    if (!funnelSlug) return;

    let contactId: string | null = null;
    try {
      contactId = window.localStorage.getItem(`ff_contact_${funnelSlug}`);
    } catch {
      return; // localStorage indisponible (navigation privée stricte, etc.)
    }
    if (!contactId) return;

    fetch("/api/track/page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ funnelSlug, pageSlug: pageSlug || null, contactId }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
