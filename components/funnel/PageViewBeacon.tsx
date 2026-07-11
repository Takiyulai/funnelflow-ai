"use client";

// components/funnel/PageViewBeacon.tsx
// Deux signaux distincts, tous deux invisibles et best-effort :
//   1. 🆕 VAGUE 1 / LOT 2 — Comptage ANONYME des visites (analytics v1) :
//      envoyé pour TOUS les visiteurs des tunnels publiés. Aucune donnée
//      personnelle : `ff_vid` est un UUID aléatoire localStorage, jamais relié
//      à un compte/email. Dédupliqué par session de navigation.
//   2. Signal "page visitée" pour le déclencheur Workflow `page.visited` :
//      UNIQUEMENT les contacts déjà identifiés sur ce navigateur (id posé en
//      localStorage par FormRenderer après capture d'un lead).

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { extractSlugsFromPath } from "@/lib/funnels/nextDestination";

function getOrCreateVisitorId(): string | null {
  try {
    let vid = window.localStorage.getItem("ff_vid");
    if (!vid) {
      vid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      window.localStorage.setItem("ff_vid", vid);
    }
    return vid;
  } catch {
    return null; // localStorage indisponible → pas de comptage
  }
}

/** Hôte du référent uniquement s'il est EXTERNE (jamais le chemin complet). */
function externalReferrerHost(): string | null {
  try {
    if (!document.referrer) return null;
    const host = new URL(document.referrer).hostname;
    return host && host !== window.location.hostname ? host.slice(0, 255) : null;
  } catch {
    return null;
  }
}

function utmParam(name: string): string | null {
  try {
    const v = new URLSearchParams(window.location.search).get(name);
    return v ? v.slice(0, 120) : null;
  } catch {
    return null;
  }
}

export function PageViewBeacon() {
  const pathname = usePathname();

  // 1. 🆕 Comptage anonyme des visites (tous visiteurs, tunnels publiés).
  useEffect(() => {
    const { funnelSlug, pageSlug } = extractSlugsFromPath(pathname);
    if (!funnelSlug) return;

    // Déduplication : une même page n'est comptée qu'une fois par session de
    // navigation (re-renders et retours arrière exclus).
    try {
      const seenKey = `ff_seen_${pathname}`;
      if (window.sessionStorage.getItem(seenKey)) return;
      window.sessionStorage.setItem(seenKey, "1");
    } catch {
      /* sessionStorage indisponible : on compte quand même */
    }

    const visitorId = getOrCreateVisitorId();
    if (!visitorId) return;

    fetch("/api/track/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        funnelSlug,
        pageSlug: pageSlug || null,
        visitorId,
        referrerHost: externalReferrerHost(),
        utmSource: utmParam("utm_source"),
        utmMedium: utmParam("utm_medium"),
        utmCampaign: utmParam("utm_campaign"),
      }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  // 2. Déclencheur workflow `page.visited` (contacts identifiés uniquement).
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
