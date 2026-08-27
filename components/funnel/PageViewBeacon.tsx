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
import {
  CONTACT_IDENTIFIED_EVENT,
  readIdentifiedContact,
  type ContactIdentifiedDetail,
} from "@/lib/tracking/contactIdentity";

const PAGE_TIME_FLUSH_MS = 15_000;
const PAGE_TIME_MAX_INCREMENT_MS = 60_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Mémoire propre au contexte JavaScript de l'onglet : deux onglets ne peuvent
// pas hériter du même session_id, contrairement à sessionStorage qui peut être
// cloné lors de l'ouverture d'un nouvel onglet depuis un onglet existant.
const pageTimeSessionIds = new Map<string, string>();
const pageTimeTotals = new Map<string, number>();

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

function createSessionId(): string {
  const browserCrypto = globalThis.crypto as Crypto & {
    randomUUID?: () => `${string}-${string}-${string}-${string}-${string}`;
  };
  if (typeof browserCrypto?.randomUUID === "function") {
    return browserCrypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof browserCrypto?.getRandomValues === "function") {
    browserCrypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

/** Une session par onglet, funnel et contact identifié. */
function getOrCreatePageTimeSessionId(funnelSlug: string, contactId: string): string {
  const key = `ff_time_session_${funnelSlug}_${contactId}`;
  const existing = pageTimeSessionIds.get(key);
  if (existing && UUID_PATTERN.test(existing)) return existing;
  const created = createSessionId();
  pageTimeSessionIds.set(key, created);
  return created;
}

function sendPageTimeSnapshot(payload: {
  funnelSlug: string;
  pageSlug: string | null;
  contactId: string;
  sessionId: string;
  activeMs: number;
}): void {
  const body = JSON.stringify(payload);
  try {
    if (
      typeof navigator.sendBeacon === "function" &&
      navigator.sendBeacon(
        "/api/track/page-time",
        new Blob([body], { type: "application/json" }),
      )
    ) {
      return;
    }
  } catch {
    // Repli fetch keepalive ci-dessous.
  }

  fetch("/api/track/page-time", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
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

    let sentContactId: string | null = null;
    const send = (contactId: string) => {
      if (!contactId || sentContactId === contactId) return;
      sentContactId = contactId;
      fetch("/api/track/page-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funnelSlug, pageSlug: pageSlug || null, contactId }),
        keepalive: true,
      }).catch(() => {});
    };

    const existingContactId = readIdentifiedContact(funnelSlug);
    if (existingContactId) send(existingContactId);

    const onContactIdentified = (event: Event) => {
      const detail = (event as CustomEvent<ContactIdentifiedDetail>).detail;
      if (detail?.funnelSlug === funnelSlug && detail.contactId) send(detail.contactId);
    };
    window.addEventListener(CONTACT_IDENTIFIED_EVENT, onContactIdentified);
    return () => window.removeEventListener(CONTACT_IDENTIFIED_EVENT, onContactIdentified);
  }, [pathname]);

  // 3. Temps ACTIF par page. Aucun chronomètre et aucun envoi ne démarrent tant
  // qu'un leadId n'est pas connu. Le temps antérieur à la capture est donc
  // volontairement ignoré, même si le composant était déjà monté.
  useEffect(() => {
    const { funnelSlug, pageSlug } = extractSlugsFromPath(pathname);
    if (!funnelSlug) return;

    let contactId = readIdentifiedContact(funnelSlug);
    let sessionId = contactId
      ? getOrCreatePageTimeSessionId(funnelSlug, contactId)
      : null;
    let activeStartedAt: number | null = null;
    let pendingActiveMs = 0;

    const start = () => {
      if (
        contactId &&
        sessionId &&
        document.visibilityState === "visible" &&
        activeStartedAt === null
      ) {
        activeStartedAt = performance.now();
      }
    };

    const pause = () => {
      if (activeStartedAt === null) return;
      pendingActiveMs += Math.max(0, performance.now() - activeStartedAt);
      activeStartedAt = null;
    };

    const checkpoint = () => {
      if (activeStartedAt === null) return;
      const now = performance.now();
      pendingActiveMs += Math.max(0, now - activeStartedAt);
      activeStartedAt = document.visibilityState === "visible" ? now : null;
    };

    const flush = () => {
      if (!contactId || !sessionId) return;
      checkpoint();
      const activeMs = Math.min(
        PAGE_TIME_MAX_INCREMENT_MS,
        Math.floor(pendingActiveMs),
      );
      if (activeMs < 1) return;
      pendingActiveMs -= activeMs;
      const totalKey = `${sessionId}:${pageSlug || ""}`;
      const cumulativeActiveMs = (pageTimeTotals.get(totalKey) ?? 0) + activeMs;
      pageTimeTotals.set(totalKey, cumulativeActiveMs);
      sendPageTimeSnapshot({
        funnelSlug,
        pageSlug: pageSlug || null,
        contactId,
        sessionId,
        activeMs: cumulativeActiveMs,
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        start();
      } else {
        pause();
        flush();
      }
    };
    const onPageHide = () => {
      pause();
      flush();
    };
    const onPageShow = () => start();
    const onContactIdentified = (event: Event) => {
      const detail = (event as CustomEvent<ContactIdentifiedDetail>).detail;
      if (!detail?.contactId || detail.funnelSlug !== funnelSlug) return;
      if (detail.contactId === contactId) {
        start();
        return;
      }

      // Si une autre capture intervient dans le même onglet, termine proprement
      // l'ancienne session puis repart avec une session propre au nouveau lead.
      pause();
      flush();
      pendingActiveMs = 0;
      contactId = detail.contactId;
      sessionId = getOrCreatePageTimeSessionId(funnelSlug, contactId);
      start();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener(CONTACT_IDENTIFIED_EVENT, onContactIdentified);
    const intervalId = window.setInterval(flush, PAGE_TIME_FLUSH_MS);
    start();

    return () => {
      pause();
      flush();
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener(CONTACT_IDENTIFIED_EVENT, onContactIdentified);
    };
  }, [pathname]);

  return null;
}
