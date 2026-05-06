"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Undo2, Redo2, Eye, Loader2 } from "lucide-react";

import { AppShell } from "@/components/dashboard/AppShell";
import { Button } from "@/components/ui/Button";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
import { SectionEditor } from "@/components/editor/SectionEditor";
import { GlobalStylePanel } from "@/components/editor/GlobalStylePanel";
import { useToast } from "@/components/ui/Toast";
import {
  useFunnel,
  saveFunnel,
  publishFunnel,
  loadFunnelBySlug,
  type StoredFunnel,
} from "@/lib/store/funnelStore";
import type { Funnel, FunnelSection } from "@/lib/funnels/types";

type HistoryState = {
  past: Funnel[];
  present: Funnel | null;
  future: Funnel[];
};

const HISTORY_LIMIT = 50;
const AUTO_SAVE_DEBOUNCE_MS = 600;
/**
 * Extrait le nom de marque depuis un titre de tunnel.
 * Exemple : "KHALIS NATURE - Ebook Gratuit" → "KHALIS NATURE"
 *           "Mon site | Page de vente"      → "Mon site"
 *           "Acme — Offre"                   → "Acme"
 */
function extractBrandName(fullName: string): string {
  if (!fullName) return "";
  const separators = [" - ", " – ", " — ", " | ", " : "];
  for (const sep of separators) {
    const idx = fullName.indexOf(sep);
    if (idx > 0) return fullName.slice(0, idx).trim();
  }
  return fullName.trim();
}

export default function EditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const funnelId = params?.id ?? "";

  // Le hook retourne directement StoredFunnel | null
  const stored = useFunnel(funnelId);

  // Petit délai d'hydratation pour éviter de rediriger avant le 1er rendu localStorage
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHydrated(true), 80);
    return () => clearTimeout(t);
  }, []);
  const loading = !hydrated;

  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: null,
    future: [],
  });
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [showGlobalStyle, setShowGlobalStyle] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoadRef = useRef(true);

  // ─── Initial load from store ─────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!stored) {
      toast.show({ title: "Tunnel introuvable", variant: "error" });
      router.replace("/dashboard");
      return;
    }
    if (isInitialLoadRef.current) {
      setHistory({ past: [], present: stored.funnel, future: [] });
      setSelectedSectionId(stored.funnel.sections[0]?.id ?? null);
      setLastSavedAt(new Date(stored.updatedAt).getTime());
      isInitialLoadRef.current = false;
    }
  }, [loading, stored, router, toast]);

  const funnel = history.present;

  // ─── Auto-save (debounced) ───────────────────────────────────────
  useEffect(() => {
    if (!funnel || !stored || isInitialLoadRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    setSaveState("saving");
    saveTimerRef.current = setTimeout(() => {
      try {
        const updated: StoredFunnel = {
          ...stored,
          funnel,
          updatedAt: new Date().toISOString(),
        };
        saveFunnel(updated);
        setSaveState("saved");
        setLastSavedAt(Date.now());
      } catch (err) {
        console.error("[editor] auto-save failed", err);
        setSaveState("idle");
        toast.show({ title: "Erreur d'enregistrement", variant: "error" });
      }
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funnel]);

  // ─── History helpers ─────────────────────────────────────────────
  const pushHistory = useCallback((next: Funnel) => {
    setHistory((h) => {
      if (!h.present) return { past: [], present: next, future: [] };
      const past = [...h.past, h.present].slice(-HISTORY_LIMIT);
      return { past, present: next, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0 || !h.present) return h;
      const previous = h.past[h.past.length - 1];
      return {
        past: h.past.slice(0, -1),
        present: previous,
        future: [h.present, ...h.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0 || !h.present) return h;
      const next = h.future[0];
      return {
        past: [...h.past, h.present],
        present: next,
        future: h.future.slice(1),
      };
    });
  }, []);

  // ─── Manual save ─────────────────────────────────────────────────
  const handleManualSave = useCallback(() => {
    if (!funnel || !stored) return;
    try {
      const updated: StoredFunnel = {
        ...stored,
        funnel,
        updatedAt: new Date().toISOString(),
      };
      saveFunnel(updated);
      setSaveState("saved");
      setLastSavedAt(Date.now());
      toast.show({ title: "Tunnel enregistré", variant: "success" });
    } catch {
      toast.show({ title: "Erreur d'enregistrement", variant: "error" });
    }
  }, [funnel, stored, toast]);

  // ─── Keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;

      if (e.key === "s") {
        e.preventDefault();
        handleManualSave();
      } else if (e.key === "z" && !e.shiftKey && !isInInput) {
        e.preventDefault();
        undo();
      } else if ((e.key === "y" || (e.key === "z" && e.shiftKey)) && !isInInput) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, handleManualSave]);

  // ─── Section CRUD ────────────────────────────────────────────────
  const updateSection = useCallback(
    (sectionId: string, patch: Partial<FunnelSection>) => {
      if (!funnel) return;
      const next: Funnel = {
        ...funnel,
        sections: funnel.sections.map((s) =>
          s.id === sectionId ? { ...s, ...patch } : s,
        ),
      };
      pushHistory(next);
    },
    [funnel, pushHistory],
  );

  const reorderSections = useCallback(
    (orderedIds: string[]) => {
      if (!funnel) return;
      const map = new Map(funnel.sections.map((s) => [s.id, s]));
      const reordered = orderedIds
        .map((id) => map.get(id))
        .filter((s): s is FunnelSection => Boolean(s));
      if (reordered.length !== funnel.sections.length) return;
      pushHistory({ ...funnel, sections: reordered });
    },
    [funnel, pushHistory],
  );

  const toggleVisibility = useCallback(
    (sectionId: string) => {
      if (!funnel) return;
      const next: Funnel = {
        ...funnel,
        sections: funnel.sections.map((s) =>
          s.id === sectionId
            ? { ...s, visible: s.visible === false ? true : false }
            : s,
        ),
      };
      pushHistory(next);
    },
    [funnel, pushHistory],
  );

  const duplicateSection = useCallback(
    (sectionId: string) => {
      if (!funnel) return;
      const idx = funnel.sections.findIndex((s) => s.id === sectionId);
      if (idx < 0) return;
      const original = funnel.sections[idx];
      const copy: FunnelSection = {
        ...original,
        id: `${original.id}-copy-${Date.now().toString(36)}`,
      };
      const sections = [...funnel.sections];
      sections.splice(idx + 1, 0, copy);
      pushHistory({ ...funnel, sections });
      setSelectedSectionId(copy.id);
    },
    [funnel, pushHistory],
  );

  const deleteSection = useCallback(
    (sectionId: string) => {
      if (!funnel) return;
      const sections = funnel.sections.filter((s) => s.id !== sectionId);
      pushHistory({ ...funnel, sections });
      if (selectedSectionId === sectionId) {
        setSelectedSectionId(sections[0]?.id ?? null);
      }
    },
    [funnel, pushHistory, selectedSectionId],
  );

  const addSection = useCallback(
    (newSection: FunnelSection) => {
      if (!funnel) return;
      const sections = [...funnel.sections, newSection];
      pushHistory({ ...funnel, sections });
      setSelectedSectionId(newSection.id);
    },
    [funnel, pushHistory],
  );

  const updateSlug = useCallback(
    (rawSlug: string) => {
      if (!stored) return;
      const cleaned = rawSlug
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
      if (!cleaned || cleaned === stored.slug) return;
      const conflict = loadFunnelBySlug(cleaned);
      if (conflict && conflict.id !== stored.id) {
        toast.show({
          title: "Slug déjà utilisé",
          description: "Choisis-en un autre",
          variant: "error",
        });
        return;
      }
      const updated: StoredFunnel = {
        ...stored,
        slug: cleaned,
        updatedAt: new Date().toISOString(),
      };
      saveFunnel(updated);
      toast.show({ title: "Slug mis à jour", variant: "success" });
    },
    [stored, toast],
  );

  const updateFunnelMeta = useCallback(
    (patch: Partial<Funnel>) => {
      if (!funnel) return;
      pushHistory({ ...funnel, ...patch });
    },
    [funnel, pushHistory],
  );

  // ─── Publish ─────────────────────────────────────────────────────
  const handlePublish = useCallback(() => {
    if (!funnel || !stored) return;
    try {
      const updated: StoredFunnel = {
        ...stored,
        funnel,
        updatedAt: new Date().toISOString(),
      };
      saveFunnel(updated);
      publishFunnel(updated.id);
      toast.show({
        title: "Tunnel publié",
        description: `Disponible sur /tunnel/${updated.slug}`,
        variant: "success",
      });
    } catch {
      toast.show({ title: "Erreur de publication", variant: "error" });
    }
  }, [funnel, stored, toast]);

  // ─── Render guards ───────────────────────────────────────────────
  if (loading || !funnel || !stored) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center text-white/60">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Chargement du tunnel…
        </div>
      </AppShell>
    );
  }

  const selectedSection =
    funnel.sections.find((s) => s.id === selectedSectionId) ?? null;

  return (
    <AppShell>
      {/* Toolbar */}
<div className="sticky top-0 z-20 -mx-4 -mt-4 mb-4 border-b border-white/10 bg-black/60 px-4 py-3 backdrop-blur md:-mx-8 md:-mt-8 md:px-8">
  <div className="grid grid-cols-3 items-center gap-3">
    {/* Gauche : retour + indicateur de sauvegarde */}
    <div className="flex items-center gap-3 min-w-0">
      <Link
        href="/dashboard"
        className="flex items-center gap-1 text-sm text-white/60 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Dashboard</span>
      </Link>
      <SaveIndicator state={saveState} lastSavedAt={lastSavedAt} />
    </div>

    {/* Centre : nom de marque uniquement */}
    <div className="flex flex-col items-center justify-center min-w-0">
      <h1 className="truncate text-center text-sm font-semibold text-white">
        {extractBrandName(funnel.funnelName)}
      </h1>
      <div className="flex items-center gap-1 text-[10px] text-white/40">
        <span>/tunnel/</span>
        <input
          type="text"
          defaultValue={stored.slug}
          onBlur={(e) => updateSlug(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-32 rounded border border-transparent bg-transparent px-1 py-0.5 font-mono text-white/60 outline-none hover:border-white/10 focus:border-amber-300/40 focus:text-white"
        />
        {stored.publishedAt && (
          <span className="ml-1 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
            Publié
          </span>
        )}
      </div>
    </div>

    {/* Droite : actions */}
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={undo}
        disabled={history.past.length === 0}
        title="Annuler (Ctrl+Z)"
        className="rounded-lg border border-white/10 p-2 text-white/70 hover:border-white/20 hover:text-white disabled:opacity-40"
      >
        <Undo2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={history.future.length === 0}
        title="Rétablir (Ctrl+Y)"
        className="rounded-lg border border-white/10 p-2 text-white/70 hover:border-white/20 hover:text-white disabled:opacity-40"
      >
        <Redo2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleManualSave}
        title="Enregistrer (Ctrl+S)"
        className="hidden md:flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/80 hover:border-white/20 hover:text-white"
      >
        <Save className="h-4 w-4" />
        Enregistrer
      </button>
      <Link
        href={`/tunnel/${stored.slug}`}
        target="_blank"
        className="hidden md:flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/80 hover:border-white/20 hover:text-white"
      >
        <Eye className="h-4 w-4" />
        Aperçu public
      </Link>
      <Button onClick={handlePublish} className="text-xs">
        Publier
      </Button>
    </div>
  </div>
</div>


      {/* 3-column layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_minmax(0,1fr)]">
        {/* Sidebar */}
        <EditorSidebar
          sections={funnel.sections}
          selectedId={selectedSectionId}
          onSelect={setSelectedSectionId}
          onReorder={reorderSections}
          onToggleVisibility={toggleVisibility}
          onDuplicate={duplicateSection}
          onDelete={deleteSection}
          onAdd={addSection}
          onOpenGlobalStyle={() => setShowGlobalStyle(true)}
        />

        {/* Center: editor */}
        <div className="min-w-0">
          {selectedSection ? (
            <SectionEditor
              key={selectedSection.id}
              section={selectedSection}
              language={funnel.language}
              onChange={(patch: Partial<FunnelSection>) =>
                updateSection(selectedSection.id, patch)
              }
            />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
              Sélectionne une section dans la barre latérale pour l'éditer.
            </div>
          )}
        </div>

        {/* Right: live preview */}
        <div className="min-w-0">
          <div className="sticky top-20">
            <FunnelPreview funnel={funnel} />
          </div>
        </div>
      </div>

      {/* Global style modal */}
      {showGlobalStyle && (
        <GlobalStylePanel
          funnel={funnel}
          onChange={updateFunnelMeta}
          onClose={() => setShowGlobalStyle(false)}
        />
      )}
    </AppShell>
  );
}

// ─── Save indicator ────────────────────────────────────────────────
function SaveIndicator({
  state,
  lastSavedAt,
}: {
  state: "idle" | "saving" | "saved";
  lastSavedAt: number | null;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-white/40">
        <Loader2 className="h-3 w-3 animate-spin" />
        Enregistrement…
      </span>
    );
  }
  if (state === "saved" && lastSavedAt) {
    const diff = Date.now() - lastSavedAt;
    const label =
      diff < 5_000
        ? "À l'instant"
        : diff < 60_000
          ? `Il y a ${Math.floor(diff / 1000)}s`
          : diff < 3_600_000
            ? `Il y a ${Math.floor(diff / 60_000)} min`
            : "Il y a > 1 h";
    return (
      <span className="text-xs text-white/40" data-tick={tick}>
        Enregistré · {label}
      </span>
    );
  }
  return null;
}
