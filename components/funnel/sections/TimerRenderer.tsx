"use client";

import { useEffect, useState, useMemo } from "react";
import type { TimerItem } from "@/lib/funnels/types";
import { DEFAULT_TIMER_LABELS } from "@/lib/funnels/types";

type Props = {
  timer: TimerItem;
  funnelId?: string;      // Pour différencier le localStorage par funnel
  pageId?: string;        // Pour différencier le localStorage par page
  language?: "fr" | "en" | "es";
};

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;          // ms restants
  expired: boolean;
};

const SIZE_CONFIG: Record<
  NonNullable<TimerItem["size"]>,
  { numFs: string; lblFs: string; gap: string; padX: string; padY: string }
> = {
  sm: { numFs: "1.25rem", lblFs: "0.625rem", gap: "0.375rem", padX: "0.5rem", padY: "0.375rem" },
  md: { numFs: "2rem",    lblFs: "0.75rem",  gap: "0.5rem",   padX: "0.75rem", padY: "0.625rem" },
  lg: { numFs: "3rem",    lblFs: "0.8125rem", gap: "0.75rem",  padX: "1rem",    padY: "0.875rem" },
  xl: { numFs: "4rem",    lblFs: "0.875rem", gap: "1rem",      padX: "1.25rem", padY: "1.125rem" },
};

/** Calcule le temps restant pour les modes countdown */
function computeTimeLeft(targetMs: number): TimeLeft {
  const now = Date.now();
  const total = Math.max(0, targetMs - now);
  const expired = total === 0;
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((total / (1000 * 60)) % 60);
  const seconds = Math.floor((total / 1000) % 60);
  return { days, hours, minutes, seconds, total, expired };
}

/** Récupère ou initialise le timestamp de départ d'un visiteur (mode durée) */
function getOrInitStartTime(timerId: string, scopeKey: string): number {
  if (typeof window === "undefined") return Date.now();
  const key = `ff_timer_${scopeKey}_${timerId}`;
  const existing = window.localStorage.getItem(key);
  if (existing) {
    const parsed = parseInt(existing, 10);
    if (!isNaN(parsed)) return parsed;
  }
  const now = Date.now();
  try {
    window.localStorage.setItem(key, String(now));
  } catch {
    // localStorage indisponible (mode privé) — pas grave, on retourne now()
  }
  return now;
}

export function TimerRenderer({ timer, funnelId = "default", pageId = "default", language = "fr" }: Props) {
  const scopeKey = `${funnelId}_${pageId}`;
  const labels = {
    ...DEFAULT_TIMER_LABELS[language],
    ...(timer.labels ?? {}),
  };

  // Calcule le target timestamp (ms) selon le mode
    const targetMs = useMemo(() => {
      if (timer.mode === "countdown-date" && timer.targetDate) {
        const d = new Date(timer.targetDate).getTime();
        if (isNaN(d)) return Date.now() + 24 * 60 * 60 * 1000;
        return d;
      }
      if (timer.mode === "countdown-duration") {
        const hours = (timer.durationHours && timer.durationHours > 0)
          ? timer.durationHours
          : 24;
        const start = getOrInitStartTime(timer.id, scopeKey);
        return start + hours * 60 * 60 * 1000;
      }
      return 0;
    }, [timer.id, timer.mode, timer.durationHours, timer.targetDate, scopeKey]);


  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    timer.mode === "seats-counter"
      ? { days: 0, hours: 0, minutes: 0, seconds: 0, total: 1, expired: false }
      : computeTimeLeft(targetMs)
  );

  useEffect(() => {
    if (timer.mode === "seats-counter") return;
    if (targetMs === 0) return;

    const tick = () => setTimeLeft(computeTimeLeft(targetMs));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timer.mode, targetMs]);

  /* ─── Mode "seats-counter" ─── */
  if (timer.mode === "seats-counter") {
    const remaining = timer.seatsRemaining ?? 0;
    const total = timer.seatsTotal ?? 100;
    const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
    return (
      <div className="ff-timer ff-timer--seats my-4" data-ff-timer-size={timer.size ?? "md"}>
        {timer.label && (
          <div
            className="ff-timer-label text-center font-medium"
            style={{ fontSize: SIZE_CONFIG[timer.size ?? "md"].lblFs, marginBottom: "0.5rem" }}
          >
            {timer.label}
          </div>
        )}
        <div className="flex flex-col items-center gap-2">
          <div
            className="font-bold"
            style={{
              fontSize: SIZE_CONFIG[timer.size ?? "md"].numFs,
              color: timer.color ?? "var(--ff-accent, #2563eb)",
            }}
          >
            {remaining} / {total}
          </div>
          <div
            className="h-2 w-full max-w-md overflow-hidden rounded-full"
            style={{ background: "rgba(0,0,0,0.08)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: timer.color ?? "var(--ff-accent, #2563eb)",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  /* ─── Expiration ─── */
  if (timeLeft.expired) {
    if (timer.onExpire === "hide") return null;
    if (timer.onExpire === "show-message") {
      return (
        <div className="ff-timer ff-timer--expired my-4 text-center">
          <span
            className="font-semibold"
            style={{
              color: timer.color ?? "var(--ff-accent, #2563eb)",
              fontSize: SIZE_CONFIG[timer.size ?? "md"].lblFs,
            }}
          >
            {timer.expiredMessage ?? "Offre terminée"}
          </span>
        </div>
      );
    }
    // keep-zero → continuer à afficher 00:00:00
  }

  /* ─── Rendu commun pour countdown ─── */
  const style = timer.style ?? "cards";
  const sizeConf = SIZE_CONFIG[timer.size ?? "md"];
  const accentColor = timer.color ?? "var(--ff-accent, #2563eb)";

  const units = [
    ...(timer.showDays ? [{ value: timeLeft.days, label: labels.days, key: "d" }] : []),
    { value: timeLeft.hours, label: labels.hours, key: "h" },
    { value: timeLeft.minutes, label: labels.minutes, key: "m" },
    { value: timeLeft.seconds, label: labels.seconds, key: "s" },
  ];

  const pad = (n: number) => String(n).padStart(2, "0");

  /* ─── Style "inline" : texte fluide ─── */
  if (style === "inline") {
    return (
      <div className="ff-timer ff-timer--inline my-4 text-center" data-ff-timer-size={timer.size ?? "md"}>
        {timer.label && (
          <span style={{ fontSize: sizeConf.lblFs, marginRight: "0.5rem", opacity: 0.85 }}>
            {timer.label}
          </span>
        )}
        <span
          style={{
            fontSize: sizeConf.numFs,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: accentColor,
          }}
        >
          {units.map((u) => pad(u.value)).join(" : ")}
        </span>
      </div>
    );
  }

  /* ─── Style "digital" : grands chiffres LED ─── */
  if (style === "digital") {
    return (
      <div
        className="ff-timer ff-timer--digital my-4"
        data-ff-timer-size={timer.size ?? "md"}
        style={timer.backgroundColor ? { background: timer.backgroundColor, padding: "1rem", borderRadius: "12px" } : {}}
      >
        {timer.label && (
          <div
            className="text-center font-medium mb-2"
            style={{ fontSize: sizeConf.lblFs, opacity: 0.85 }}
          >
            {timer.label}
          </div>
        )}
        <div
          className="flex items-center justify-center"
          style={{ gap: sizeConf.gap, fontVariantNumeric: "tabular-nums" }}
        >
          {units.map((u, i) => (
            <div key={u.key} className="flex items-center" style={{ gap: sizeConf.gap }}>
              <div className="flex flex-col items-center">
                <span
                  style={{
                    fontSize: sizeConf.numFs,
                    fontWeight: 800,
                    color: accentColor,
                    lineHeight: 1,
                    fontFamily: "'Courier New', monospace",
                    letterSpacing: "0.05em",
                  }}
                >
                  {pad(u.value)}
                </span>
                <span style={{ fontSize: sizeConf.lblFs, opacity: 0.7, marginTop: "0.25rem" }}>
                  {u.label}
                </span>
              </div>
              {i < units.length - 1 && (
                <span
                  style={{
                    fontSize: sizeConf.numFs,
                    fontWeight: 800,
                    color: accentColor,
                    opacity: 0.5,
                    lineHeight: 1,
                  }}
                >
                  :
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ─── Style "cards" (défaut) : cartes individuelles ─── */
  return (
    <div
      className="ff-timer ff-timer--cards my-4"
      data-ff-timer-size={timer.size ?? "md"}
      style={timer.backgroundColor ? { background: timer.backgroundColor, padding: "1rem", borderRadius: "12px" } : {}}
    >
      {timer.label && (
        <div
          className="text-center font-medium mb-3"
          style={{ fontSize: sizeConf.lblFs, opacity: 0.85 }}
        >
          {timer.label}
        </div>
      )}
      <div
        className="flex items-stretch justify-center flex-wrap"
        style={{ gap: sizeConf.gap, fontVariantNumeric: "tabular-nums" }}
      >
        {units.map((u) => (
          <div
            key={u.key}
            className="flex flex-col items-center justify-center rounded-lg"
            style={{
              minWidth: `calc(${sizeConf.numFs} * 1.6)`,
              padding: `${sizeConf.padY} ${sizeConf.padX}`,
              background: timer.backgroundColor
                ? "rgba(255,255,255,0.08)"
                : "color-mix(in srgb, currentColor 6%, transparent)",
              border: "1px solid color-mix(in srgb, currentColor 12%, transparent)",
            }}
          >
            <span
              style={{
                fontSize: sizeConf.numFs,
                fontWeight: 800,
                color: accentColor,
                lineHeight: 1,
              }}
            >
              {pad(u.value)}
            </span>
            <span style={{ fontSize: sizeConf.lblFs, opacity: 0.7, marginTop: "0.25rem" }}>
              {u.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
