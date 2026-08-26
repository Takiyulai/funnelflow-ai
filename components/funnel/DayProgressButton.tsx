"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, CheckCircle2, Sparkles } from "lucide-react";

type Props = {
  funnelSlug: string;
  dayIndex: number;
  dayTotal: number;
  className?: string;
};

export function challengeDayStorageKey(funnelSlug: string, dayIndex: number): string {
  return `ff_challenge_done_${funnelSlug.trim()}_${dayIndex}`;
}

/** Progression locale d'une page Challenge, sans accès navigateur pendant le SSR. */
export function DayProgressButton({
  funnelSlug,
  dayIndex,
  dayTotal,
  className = "",
}: Props) {
  const reduceMotion = useReducedMotion();
  const safeDayTotal = Math.max(1, Math.trunc(dayTotal));
  const safeDayIndex = Math.min(safeDayTotal, Math.max(1, Math.trunc(dayIndex)));
  const storageKey = useMemo(
    () => challengeDayStorageKey(funnelSlug, safeDayIndex),
    [funnelSlug, safeDayIndex],
  );
  const [completed, setCompleted] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    // localStorage est volontairement lu après montage : le HTML serveur et le
    // premier rendu client partent tous deux de l'état « non terminé ».
    let saved = false;
    try {
      saved = window.localStorage.getItem(storageKey) === "1";
    } catch {
      // Navigation privée stricte / stockage bloqué : progression en mémoire.
    }
    setCompleted(saved);
    setStorageReady(true);
  }, [storageKey]);

  const completeDay = () => {
    if (!storageReady || completed) return;
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // L'action reste confirmée pour la session même si le stockage est bloqué.
    }
    setCompleted(true);
  };

  const completedDays = completed ? safeDayIndex : Math.max(0, safeDayIndex - 1);
  const progressPercent = Math.round((completedDays / safeDayTotal) * 100);
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.45, ease: "easeOut" as const };

  return (
    <motion.aside
      initial={false}
      animate={completed && !reduceMotion ? { scale: [1, 1.015, 1] } : { scale: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.55 }}
      className={`ff-card rounded-2xl border border-[color:var(--ff-border)] p-4 shadow-sm ${className}`}
      aria-label={`Progression du challenge, jour ${safeDayIndex} sur ${safeDayTotal}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
            Progression du challenge
          </p>
          <p className="mt-1 text-lg font-black text-[color:var(--ff-ink)]">
            Jour {safeDayIndex} sur {safeDayTotal}
          </p>
        </div>
        <motion.div
          initial={false}
          animate={
            completed
              ? { rotate: reduceMotion ? 0 : [0, -8, 8, 0], scale: reduceMotion ? 1 : [1, 1.15, 1] }
              : { rotate: 0, scale: 1 }
          }
          transition={{ duration: reduceMotion ? 0 : 0.5 }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--ff-accent)] text-[color:var(--ff-accent-ink)]"
          aria-hidden="true"
        >
          {completed ? <CheckCircle2 className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
        </motion.div>
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-black/10"
        role="progressbar"
        aria-label="Jours terminés"
        aria-valuemin={0}
        aria-valuemax={safeDayTotal}
        aria-valuenow={completedDays}
      >
        <motion.div
          initial={false}
          animate={{ width: `${progressPercent}%` }}
          transition={transition}
          className="h-full rounded-full bg-[color:var(--ff-accent)]"
        />
      </div>

      <motion.button
        type="button"
        onClick={completeDay}
        disabled={!storageReady || completed}
        whileHover={!completed && storageReady && !reduceMotion ? { y: -2 } : undefined}
        whileTap={!completed && storageReady && !reduceMotion ? { scale: 0.98 } : undefined}
        className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--ff-accent)] px-4 py-2.5 text-sm font-bold text-[color:var(--ff-accent-ink)] shadow-sm transition-opacity disabled:cursor-default disabled:opacity-80"
        aria-pressed={completed}
        aria-busy={!storageReady}
      >
        <AnimatePresence mode="wait" initial={false}>
          {completed ? (
            <motion.span
              key="completed"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              className="flex items-center gap-2"
            >
              <Check className="h-4 w-4" /> Jour terminé
            </motion.span>
          ) : (
            <motion.span
              key="pending"
              initial={false}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
            >
              Marquer ce jour comme terminé
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence initial={false}>
        {completed && (
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={transition}
            className="mt-3 text-center text-sm font-semibold text-[color:var(--ff-ink)]"
            role="status"
          >
            Bravo, cette étape est accomplie. Continue à ton rythme ✨
          </motion.p>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
