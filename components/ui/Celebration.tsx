"use client";

// components/ui/Celebration.tsx
//
// 🆕 MICRO-VICTOIRES — système unifié de feedback positif « coach ».
//
// 3 niveaux d'intensité pour éviter la lassitude :
//   - "s" (micro)  → toast discret (succès).
//   - "m" (étape)  → toast riche (succès), message de progression.
//   - "l" (jalon)  → MODALE de félicitation + CONFETTIS (grands moments).
//
// Règles :
//   - `once: <clé>` réserve le niveau L à la 1ʳᵉ fois ; ensuite on retombe en L→M.
//   - Respect de `prefers-reduced-motion` : pas de confettis, le message reste.
//   - Anti-spam : une seule modale L à la fois ; throttle léger.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PartyPopper, X, ArrowRight } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { markMilestone } from "@/lib/ux/milestones";

const PENDING_KEY = "ff:pendingCelebration";

/**
 * Met une célébration EN FILE pour qu'elle se déclenche APRÈS la prochaine
 * navigation (ex. wizard → éditeur : la modale se perdrait sinon au démontage).
 * ⚠️ Le CTA ne peut porter qu'un `href` (pas de fonction sérialisable).
 */
export function queueCelebration(opts: CelebrateOptions): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(opts));
  } catch {
    /* non bloquant */
  }
}

export type CelebrateLevel = "s" | "m" | "l";

export type CelebrateOptions = {
  level: CelebrateLevel;
  title: string;
  message?: string;
  /** Bouton d'action « prochaine étape » (niveau L). */
  cta?: { label: string; href?: string; onClick?: () => void };
  /** Clé de jalon : le niveau L n'est plein qu'à la 1ʳᵉ fois (sinon → toast). */
  once?: string;
  /** Emoji d'accent (niveau L). Défaut 🎉. */
  emoji?: string;
};

type CelebrationContextValue = {
  celebrate: (opts: CelebrateOptions) => void;
};

const CelebrationContext = createContext<CelebrationContextValue | null>(null);

const FALLBACK: CelebrationContextValue = { celebrate: () => {} };

export function useCelebrate(): CelebrationContextValue {
  return useContext(CelebrationContext) ?? FALLBACK;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

type ModalState = {
  title: string;
  message?: string;
  cta?: CelebrateOptions["cta"];
  emoji: string;
} | null;

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const pathname = usePathname();
  const [modal, setModal] = useState<ModalState>(null);
  const lastAtRef = useRef(0);

  const celebrate = useCallback(
    (opts: CelebrateOptions) => {
      const firstTime = opts.once ? markMilestone(opts.once) : true;
      // Le niveau L n'est plein qu'à la 1ʳᵉ fois ; ensuite → toast d'étape.
      let level = opts.level;
      if (level === "l" && opts.once && !firstTime) level = "m";

      if (level !== "l") {
        toast.show({
          title: opts.title,
          description: opts.message,
          variant: "success",
          durationMs: level === "m" ? 5000 : 3200,
        });
        return;
      }

      // Niveau L : throttle léger (évite deux modales quasi simultanées).
      const now = Date.now();
      if (now - lastAtRef.current < 700) {
        toast.show({ title: opts.title, description: opts.message, variant: "success", durationMs: 5000 });
        return;
      }
      lastAtRef.current = now;

      setModal({ title: opts.title, message: opts.message, cta: opts.cta, emoji: opts.emoji ?? "🎉" });
      if (!prefersReducedMotion()) fireConfetti();
    },
    [toast],
  );

  // 🆕 Déclenche une célébration MISE EN FILE juste après une navigation
  // (ex. wizard → éditeur). Se ré-évalue à chaque changement de route.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(PENDING_KEY);
      if (raw) window.sessionStorage.removeItem(PENDING_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      const opts = JSON.parse(raw) as CelebrateOptions;
      // Petit délai : laisser la nouvelle page se monter avant la modale.
      const id = setTimeout(() => celebrate(opts), 400);
      return () => clearTimeout(id);
    } catch {
      /* payload illisible : ignoré */
    }
  }, [pathname, celebrate]);

  const value = useMemo<CelebrationContextValue>(() => ({ celebrate }), [celebrate]);

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      {modal && <CelebrationModal modal={modal} onClose={() => setModal(null)} />}
    </CelebrationContext.Provider>
  );
}

function CelebrationModal({ modal, onClose }: { modal: NonNullable<ModalState>; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      style={{ animation: "ffCelebFade 0.2s ease-out" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-gold/25 p-6 text-center shadow-2xl"
        style={{
          animation: "ffCelebPop 0.28s cubic-bezier(0.34,1.56,0.64,1)",
          background:
            "radial-gradient(120% 90% at 50% 0%, rgba(199,164,54,0.16), transparent 60%), #0D1628",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-md text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <X size={15} />
        </button>

        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gold/15 text-3xl">
          <span aria-hidden>{modal.emoji}</span>
        </div>
        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent-ink">
          <PartyPopper size={12} /> Victoire débloquée
        </div>
        <h2 className="mt-2 text-xl font-black text-white">{modal.title}</h2>
        {modal.message && <p className="mt-1.5 text-sm text-white/70">{modal.message}</p>}

        <div className="mt-5 flex flex-col gap-2">
          {modal.cta &&
            (modal.cta.href ? (
              <Link
                href={modal.cta.href}
                onClick={onClose}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:opacity-90"
              >
                {modal.cta.label} <ArrowRight size={15} />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  modal.cta?.onClick?.();
                  onClose();
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:opacity-90"
              >
                {modal.cta.label} <ArrowRight size={15} />
              </button>
            ))}
          <button
            type="button"
            onClick={onClose}
            className={
              modal.cta
                ? "rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                : "inline-flex items-center justify-center rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:opacity-90"
            }
          >
            Continuer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Confettis — petit canvas autonome (aucune dépendance). ~2,2 s puis nettoyage.
// ─────────────────────────────────────────────────────────────────────────────
function fireConfetti(): void {
  if (typeof document === "undefined") return;
  const COLORS = ["#C7A436", "#31845C", "#08498D", "#22C55E", "#F59E0B", "#ffffff"];
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483001";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const N = 90;
  type P = { x: number; y: number; vx: number; vy: number; s: number; rot: number; vr: number; c: string };
  const parts: P[] = [];
  for (let i = 0; i < N; i++) {
    parts.push({
      x: W / 2 + (Math.random() - 0.5) * 120,
      y: H * 0.35 + (Math.random() - 0.5) * 60,
      vx: (Math.random() - 0.5) * 12,
      vy: Math.random() * -9 - 4,
      s: Math.random() * 6 + 4,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      c: COLORS[(Math.random() * COLORS.length) | 0],
    });
  }

  const start = performance.now();
  const DURATION = 2200;
  function frame(now: number) {
    const t = now - start;
    ctx!.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.35; // gravité
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      const alpha = Math.max(0, 1 - t / DURATION);
      ctx!.save();
      ctx!.globalAlpha = alpha;
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.fillStyle = p.c;
      ctx!.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
      ctx!.restore();
    }
    if (t < DURATION) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(frame);
}

export default CelebrationProvider;
