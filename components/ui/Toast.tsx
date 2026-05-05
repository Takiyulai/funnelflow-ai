"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastItem = ToastInput & {
  id: string;
  variant: ToastVariant;
  durationMs: number;
};

type ToastContextValue = {
  show: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

// Fallback stable hors provider : même référence à chaque appel
// Évite les boucles infinies dans les useEffect qui ont `toast` en deps
const FALLBACK_TOAST: ToastContextValue = {
  show: (t) => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.log(
        `[toast] ${t.variant ?? "info"} · ${t.title}${
          t.description ? " — " + t.description : ""
        }`,
      );
    }
  },
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  return ctx ?? FALLBACK_TOAST;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((input: ToastInput) => {
    const id = `t-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    const toast: ToastItem = {
      id,
      title: input.title,
      description: input.description,
      variant: input.variant ?? "info",
      durationMs: input.durationMs ?? 3500,
    };
    setToasts((list) => [...list, toast]);
  }, []);

  // ⚠️ ESSENTIEL : mémoïse la valeur du context pour que useToast()
  // retourne la même référence à chaque render
  const value = useMemo<ToastContextValue>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onClose={remove} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onClose,
}: {
  toasts: ToastItem[];
  onClose: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={onClose} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onClose,
}: {
  toast: ToastItem;
  onClose: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(toast.id), toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, onClose]);

  const styles = VARIANT_STYLES[toast.variant];
  const Icon = styles.icon;

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border ${styles.border} ${styles.bg} px-3 py-2.5 shadow-lg shadow-black/40 backdrop-blur`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${styles.iconColor}`} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-white">{toast.title}</div>
        {toast.description && (
          <div className="mt-0.5 text-[11px] text-white/70">
            {toast.description}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className="shrink-0 rounded p-0.5 text-white/40 hover:bg-white/10 hover:text-white"
        aria-label="Fermer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const VARIANT_STYLES: Record<
  ToastVariant,
  {
    border: string;
    bg: string;
    icon: typeof CheckCircle2;
    iconColor: string;
  }
> = {
  success: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-950/90",
    icon: CheckCircle2,
    iconColor: "text-emerald-400",
  },
  error: {
    border: "border-rose-500/30",
    bg: "bg-rose-950/90",
    icon: AlertCircle,
    iconColor: "text-rose-400",
  },
  info: {
    border: "border-white/10",
    bg: "bg-zinc-950/90",
    icon: Info,
    iconColor: "text-amber-300",
  },
};
