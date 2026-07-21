"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, Undo2, Redo2, ExternalLink, Loader2,
  Copy, Check, Globe, Rocket, Layers, Eye,
} from "lucide-react";

import { AppShell } from "@/components/dashboard/AppShell";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
import { PageSelector } from "@/components/editor/PageSelector";
import { PageRegenPanel } from "@/components/editor/PageRegenPanel";
import { ShareTemplateButton } from "@/components/editor/ShareTemplateButton";
import { SectionEditor } from "@/components/editor/SectionEditor";
import { GlobalStylePanel } from "@/components/editor/GlobalStylePanel";
import { SectionEditorDrawer } from "@/components/editor/SectionEditorDrawer";
import { SystemeIoExportMenu } from "@/components/editor/SystemeIoExportMenu";
import { HeaderTab } from "@/components/editor/tabs/HeaderTab";
import { useToast } from "@/components/ui/Toast";
import { useCelebrate } from "@/components/ui/Celebration";
import {
  useFunnelWithStatus,
  saveFunnel,
  publishFunnel,
  loadFunnelBySlug,
  updatePageSections,
  type StoredFunnel,
} from "@/lib/store/funnelStore";
import type { Funnel, FunnelPage, FunnelSection } from "@/lib/funnels/types";
import SioLinkingTab from "@/components/editor/SioLinkingTab";
import TrackingPixelsTab from "@/components/editor/TrackingPixelsTab";
import CustomCodeTab from "@/components/editor/CustomCodeTab";
import { InlineColorToolbar } from "@/components/editor/InlineColorToolbar";

type HistoryState = {
  past: Funnel[];
  present: Funnel | null;
  future: Funnel[];
};

const HISTORY_LIMIT = 50;
const AUTO_SAVE_DEBOUNCE_MS = 600;

function extractBrandName(fullName: string): string {
  if (!fullName) return "";
  const separators = [" - ", " – ", " — ", " | ", " : "];
  for (const sep of separators) {
    const idx = fullName.indexOf(sep);
    if (idx > 0) return fullName.slice(0, idx).trim();
  }
  return fullName.trim();
}

function resolveActivePage(
  funnel: Funnel,
  selectedPageId: string | null
): FunnelPage | null {
  if (!funnel.pages || funnel.pages.length === 0) return null;
  if (selectedPageId) {
    const found = funnel.pages.find((p) => p.id === selectedPageId);
    if (found) return found;
  }
  return funnel.pages.find((p) => p.isHome) ?? funnel.pages[0];
}

export default function EditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const funnelId = params?.id ?? "";

  const { stored, status } = useFunnelWithStatus(funnelId);
  const loading = status === "loading";
  const { celebrate } = useCelebrate();

  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: null,
    future: [],
  });
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [showGlobalStyle, setShowGlobalStyle] = useState(false);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  // 🆕 Échec de synchronisation distante (Supabase) : l'auto-save LOCAL réussit
  // toujours, mais si le push serveur échoue durablement, ce drapeau prévient
  // l'utilisateur (sinon « Enregistré ✓ » ment → 404 à la publication).
  const [syncError, setSyncError] = useState(false);
  const [copied, setCopied] = useState(false);

  const [mobileTab, setMobileTab] = useState<"sections" | "preview">("sections");
  const [sioLinkingOpen, setSioLinkingOpen] = useState(false);
  // 🆕 LOT 4 — Panneau « Pixels publicitaires ».
  const [trackingOpen, setTrackingOpen] = useState(false);
  // 🆕 VAGUE CUSTOM-CODE — Panneau « Code personnalisé » (Agency).
  const [customCodeOpen, setCustomCodeOpen] = useState(false);

  const previewWrapperRef = useRef<HTMLDivElement | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "not-found") {
      toast.show({ title: "Tunnel introuvable", variant: "error" });
      router.replace("/dashboard");
      return;
    }
    if (!stored) return;

    if (isInitialLoadRef.current) {
      setHistory({ past: [], present: stored.funnel, future: [] });

      const homePage =
        stored.funnel.pages?.find((p) => p.isHome) ??
        stored.funnel.pages?.[0] ??
        null;
      setSelectedPageId(homePage?.id ?? null);

      const firstSection =
        homePage?.sections[0] ?? stored.funnel.sections[0] ?? null;
      setSelectedSectionId(firstSection?.id ?? null);

      setLastSavedAt(new Date(stored.updatedAt).getTime());
      isInitialLoadRef.current = false;
      return;
    }

    if (
      history.past.length === 0 &&
      history.future.length === 0 &&
      history.present !== stored.funnel
    ) {
      setHistory({ past: [], present: stored.funnel, future: [] });
    }
  }, [status, stored, router, toast, history.past.length, history.future.length, history.present]);

  const funnel = history.present;

  const activePage = useMemo<FunnelPage | null>(
    () => (funnel ? resolveActivePage(funnel, selectedPageId) : null),
    [funnel, selectedPageId]
  );

  const activeSections: FunnelSection[] = useMemo(() => {
    if (activePage) return activePage.sections;
    return funnel?.sections ?? [];
  }, [activePage, funnel]);

  const previewFunnel = useMemo<Funnel | null>(() => {
    if (!funnel) return null;
    return { ...funnel, sections: activeSections };
  }, [funnel, activeSections]);

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

  // 🆕 Écoute le résultat de la synchro distante émise par funnelStore
  // (scheduleRemoteSave → event `ff:remote-save`). On prévient UNE fois quand le
  // serveur devient injoignable, et on efface l'alerte dès qu'un push réussit.
  useEffect(() => {
    const onRemoteSave = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string; ok: boolean }>).detail;
      if (!detail || (stored && detail.id !== stored.id)) return;
      setSyncError((prev) => {
        if (detail.ok) return false;
        if (!prev) {
          toast.show({
            title: "Non synchronisé au serveur",
            description:
              "Tes changements sont enregistrés localement mais PAS sur le serveur (session expirée ou connexion ?). Recharge la page ou reconnecte-toi, sinon la publication échouera.",
            variant: "error",
          });
        }
        return true;
      });
    };
    window.addEventListener("ff:remote-save", onRemoteSave);
    return () => window.removeEventListener("ff:remote-save", onRemoteSave);
  }, [stored, toast]);

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

  // ─────────────────────────────────────────────────────────────────────────
  // 🆕 Écoute des messages venant des iframes en mode édition.
  //    - ff-edit-background : ouvre l'éditeur de fond pour la section cliquée.
  //    - ff-edit-click      : sélectionne la bonne section + ouvre le drawer
  //                           sur le spot cliqué, même si on était sur une
  //                           autre section auparavant.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = ev?.data;
      if (!data || typeof data !== "object") return;

      // ─── Click sur zone neutre → édition du fond ────────────────────────
      if (data.type === "ff-edit-background") {
        const sectionId = data.sectionId as string | undefined;
        if (!sectionId) return;

        const exists = activeSections.some((s) => s.id === sectionId);
        if (!exists) return;

        const wasAlreadySelected = selectedSectionId === sectionId;
        setSelectedSectionId(sectionId);
        setDrawerOpen(true);
        setMobileTab("preview");

        const delay = wasAlreadySelected ? 80 : 200;
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("ff-open-background-editor", {
              detail: { sectionId },
            }),
          );
        }, delay);
        return;
      }

      // ─── Click sur un spot (texte / lien / image) ───────────────────────
      if (data.type === "ff-edit-click") {
        const sectionId = data.sectionId as string | undefined;
        if (!sectionId) return;

        const exists = activeSections.some((s) => s.id === sectionId);
        if (!exists) return;

        const wasAlreadySelected = selectedSectionId === sectionId;

        setSelectedSectionId(sectionId);
        setDrawerOpen(true);
        setMobileTab("preview");

        // Re-dispatch le payload vers RawHtmlContentTab quand la section
        // vient de changer (le listener "message" interne du tab se
        // remonte avec le nouveau section.id et raterait le message d'origine).
        // Si la section était déjà sélectionnée, le listener "message" du
        // tab a déjà capté l'événement → pas besoin de re-dispatcher.
        if (!wasAlreadySelected) {
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent("ff-relay-edit-click", { detail: data }),
            );
          }, 200);
        }
        return;
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [activeSections, selectedSectionId]);

  const mutateActivePageSections = useCallback(
    (transform: (sections: FunnelSection[]) => FunnelSection[]) => {
      if (!funnel || !activePage) return;
      const nextSections = transform(activePage.sections);
      const next = updatePageSections(funnel, activePage.id, nextSections);
      pushHistory(next);
    },
    [funnel, activePage, pushHistory]
  );

  const updateSection = useCallback(
    (sectionId: string, patch: Partial<FunnelSection>) => {
      mutateActivePageSections((sections) =>
        sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s))
      );
    },
    [mutateActivePageSections]
  );

  const reorderSections = useCallback(
    (orderedIds: string[]) => {
      mutateActivePageSections((sections) => {
        const map = new Map(sections.map((s) => [s.id, s]));
        const reordered = orderedIds
          .map((id) => map.get(id))
          .filter((s): s is FunnelSection => Boolean(s));
        return reordered.length === sections.length ? reordered : sections;
      });
    },
    [mutateActivePageSections]
  );

  const toggleVisibility = useCallback(
    (sectionId: string) => {
      mutateActivePageSections((sections) =>
        sections.map((s) =>
          s.id === sectionId
            ? { ...s, visible: s.visible === false ? true : false }
            : s
        )
      );
    },
    [mutateActivePageSections]
  );

  const duplicateSection = useCallback(
    (sectionId: string) => {
      if (!activePage) return;
      const idx = activePage.sections.findIndex((s) => s.id === sectionId);
      if (idx < 0) return;
      const original = activePage.sections[idx];
      const copy: FunnelSection = {
        ...original,
        id: `${original.id}-copy-${Date.now().toString(36)}`,
      };
      mutateActivePageSections((sections) => {
        const next = [...sections];
        next.splice(idx + 1, 0, copy);
        return next;
      });
      setSelectedSectionId(copy.id);
    },
    [activePage, mutateActivePageSections]
  );

  const deleteSection = useCallback(
    (sectionId: string) => {
      mutateActivePageSections((sections) => sections.filter((s) => s.id !== sectionId));
      if (selectedSectionId === sectionId) {
        const remaining = activePage?.sections.filter((s) => s.id !== sectionId) ?? [];
        setSelectedSectionId(remaining[0]?.id ?? null);
        setDrawerOpen(false);
      }
    },
    [mutateActivePageSections, selectedSectionId, activePage]
  );

  const addSection = useCallback(
    (newSection: FunnelSection) => {
      mutateActivePageSections((sections) => [...sections, newSection]);
      setSelectedSectionId(newSection.id);
      setDrawerOpen(true);
    },
    [mutateActivePageSections]
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
    [stored, toast]
  );

  const updateFunnelMeta = useCallback(
    (patch: Partial<Funnel>) => {
      if (!funnel) return;
      pushHistory({ ...funnel, ...patch });
    },
    [funnel, pushHistory]
  );

  const handlePublish = useCallback(async () => {
    if (!funnel || !stored) return;

    // 🆕 Gating : publier est une action importante qui, contrairement à la
    // génération, écrit en direct dans Supabase (hors route API gardée). On
    // vérifie donc l'accès EFFECTIF (respecte BILLING_ENFORCED) avant de publier :
    // sans forfait actif → on notifie et on redirige vers les forfaits. En cas
    // d'échec de la vérif, on ne bloque pas (dégradation gracieuse).
    try {
      const meRes = await fetch("/api/billing/me", { cache: "no-store" });
      const me = await meRes.json().catch(() => ({}));
      if (meRes.ok && me?.hasAccess === false) {
        toast.show({
          title: "Aucun forfait actif",
          description:
            "Passe à un forfait pour publier ton tunnel. Redirection vers les forfaits…",
          variant: "error",
        });
        setTimeout(() => {
          window.location.href = "/abonnement";
        }, 1300);
        return;
      }
    } catch {
      /* vérif indisponible → on laisse passer (le gating serveur reste la référence) */
    }

    const updated: StoredFunnel = {
      ...stored,
      funnel,
      updatedAt: new Date().toISOString(),
    };
    try {
      saveFunnel(updated);
      const res = await publishFunnel(updated.id);
      if (res.remoteOk) {
        const publicSlug = res.publishedSlug ?? updated.slug;
        // 🆕 Revalidation on-demand de la page publique (cache ISR) → la mise à
        // jour est visible immédiatement, sans attendre les 60s.
        void fetch("/api/revalidate-tunnel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: publicSlug }),
        }).catch(() => {});
        toast.show({
          title: "Tunnel publié",
          description: `Disponible sur /tunnel/${publicSlug}`,
          variant: "success",
        });
        // 🆕 Micro-victoire : 1re publication = grand jalon (confettis) ; ensuite
        // simple étape à chaque republication.
        celebrate({
          level: "l",
          once: "first_publish",
          emoji: "🚀",
          title: "Ton tunnel est en ligne !",
          message:
            "Il est désormais accessible à tes prospects. Partage le lien et regarde les premiers leads arriver.",
          cta: { label: "Voir mon tunnel en ligne", href: `/tunnel/${publicSlug}` },
        });
      } else {
        // ⚠️ La page publique se sert UNIQUEMENT du snapshot Supabase : si le
        // distant a échoué, on le dit clairement (fini le faux « publié ✓ »).
        toast.show({
          title: "Publication non enregistrée en ligne",
          description:
            res.error ??
            "Le tunnel n'a pas pu être enregistré sur le serveur. Réessayez.",
          variant: "error",
        });
      }
    } catch (e) {
      toast.show({
        title: "Erreur de publication",
        description: e instanceof Error ? e.message : undefined,
        variant: "error",
      });
    }
  }, [funnel, stored, toast]);

  const handleCopyLink = useCallback(() => {
    if (!stored) return;
    const url = `${window.location.origin}/tunnel/${stored.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [stored]);

  const handlePageSelect = useCallback(
    (pageId: string) => {
      if (!funnel || pageId === selectedPageId) return;
      const targetPage = funnel.pages?.find((p) => p.id === pageId);
      if (!targetPage) return;
      setSelectedPageId(pageId);
      setSelectedSectionId(targetPage.sections[0]?.id ?? null);
      setDrawerOpen(false);
      setMobileTab("preview");
    },
    [funnel, selectedPageId]
  );

  // 🆕 Ajouter une page vierge (from scratch).
  const handleAddPage = useCallback(() => {
    if (!funnel) return;
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `page_${Date.now()}`;
    const n = (funnel.pages?.length ?? 0) + 1;
    const newPage: FunnelPage = {
      id,
      slug: `page-${n}`,
      name: `Nouvelle page ${n}`,
      role: "custom" as unknown as FunnelPage["role"],
      isHome: false,
      visible: true,
      sections: [
        { id: `hero-${id}`, type: "hero", headline: "Nouvelle section", visible: true },
      ],
    };
    pushHistory({ ...funnel, pages: [...(funnel.pages ?? []), newPage] });
    setSelectedPageId(id);
    setSelectedSectionId(newPage.sections[0].id);
  }, [funnel, pushHistory]);

  // 🆕 Réordonner les pages (glisser-déposer) : on garde la page d'accueil en
  // tête (point d'entrée du tunnel) puis on RECHAÎNE la navigation linéaire
  // (nextPageId) → une inscription redirige automatiquement vers la page qui la
  // suit (ex. la confirmation qu'on vient de déplacer en 2ᵉ position).
  const handleReorderPages = useCallback(
    (orderedIds: string[]) => {
      if (!funnel?.pages) return;
      const byId = new Map(funnel.pages.map((p) => [p.id, p]));
      let reordered = orderedIds
        .map((id) => byId.get(id))
        .filter((p): p is FunnelPage => Boolean(p));
      // Pages non incluses (sécurité) → à la fin.
      const missing = funnel.pages.filter((p) => !orderedIds.includes(p.id));
      reordered = [...reordered, ...missing];
      // La page d'accueil reste TOUJOURS en première position.
      reordered = [
        ...reordered.filter((p) => p.isHome),
        ...reordered.filter((p) => !p.isHome),
      ];
      // Rechaînage linéaire : chaque page pointe vers la suivante.
      const linked = reordered.map((p, i) => ({
        ...p,
        nextPageId: reordered[i + 1]?.id,
      }));
      pushHistory({ ...funnel, pages: linked });
    },
    [funnel, pushHistory],
  );

  // 🆕 Applique une régénération de PAGE (toutes les sections) issue de l'IA.
  const handleRegeneratePageApply = useCallback(
    (sections: FunnelSection[]) => {
      if (!funnel || !activePage) return;
      pushHistory(updatePageSections(funnel, activePage.id, sections));
      setSelectedSectionId(sections[0]?.id ?? null);
    },
    [funnel, activePage, pushHistory],
  );

  // 🆕 Supprimer une page (jamais l'accueil).
  const handleDeletePage = useCallback(
    (pageId: string) => {
      if (!funnel) return;
      const page = funnel.pages?.find((p) => p.id === pageId);
      if (!page || page.isHome) return;
      if (
        !window.confirm(
          `Supprimer la page « ${page.name} » ? Cette action est irréversible.`,
        )
      )
        return;
      const remaining = (funnel.pages ?? []).filter((p) => p.id !== pageId);
      pushHistory({ ...funnel, pages: remaining });
      if (selectedPageId === pageId) {
        const home = remaining.find((p) => p.isHome) ?? remaining[0];
        setSelectedPageId(home?.id ?? null);
        setSelectedSectionId(home?.sections[0]?.id ?? null);
      }
    },
    [funnel, pushHistory, selectedPageId],
  );

  // ───────────────────────────────────────────────────────────────────────
  // 🆕 Click-to-edit : un clic sur N'IMPORTE QUEL élément de la preview
  // (titre, texte, bouton, timer, carte…) sélectionne sa section et ouvre le
  // panneau d'édition. Les liens/boutons du tunnel ne naviguent PAS en mode
  // édition. La sélection de texte (toolbar couleur) reste prioritaire.
  // ───────────────────────────────────────────────────────────────────────
  const handlePreviewClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const sectionEl = target.closest<HTMLElement>("[data-ff-section-id]");
      if (!sectionEl) return; // clic hors section (toolbar preview, etc.)
      const sectionId = sectionEl.getAttribute("data-ff-section-id");
      if (!sectionId || !activeSections.some((s) => s.id === sectionId)) return;

      // Sélection de texte en cours → laisser la toolbar couleur opérer.
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;

      // Les sections raw-html (iframe) gèrent déjà leur propre click-to-edit.
      if (sectionEl.getAttribute("data-ff-section") === "raw-html") return;

      // En édition, un lien/bouton du tunnel ouvre l'éditeur au lieu d'agir.
      if (target.closest("a,button")) {
        e.preventDefault();
        e.stopPropagation();
      }

      setSelectedSectionId(sectionId);
      setDrawerOpen(true);
    },
    [activeSections],
  );

  const scrollToSection = useCallback((sectionId: string) => {
    setSelectedSectionId(sectionId);
    setDrawerOpen(true);
    setMobileTab("preview");

    requestAnimationFrame(() => {
      const wrapper = previewWrapperRef.current;
      if (!wrapper) return;

      const target =
        wrapper.querySelector<HTMLElement>(`#${CSS.escape(sectionId)}`) ??
        wrapper.querySelector<HTMLElement>(
          `[data-ff-section][id="${CSS.escape(sectionId)}"]`
        );
      if (!target) return;

      let scrollContainer: HTMLElement | null = target.parentElement;
      while (scrollContainer && scrollContainer !== wrapper) {
        const style = window.getComputedStyle(scrollContainer);
        if (
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          scrollContainer.scrollHeight > scrollContainer.clientHeight
        ) {
          break;
        }
        scrollContainer = scrollContainer.parentElement;
      }

      if (scrollContainer && scrollContainer !== wrapper) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const currentScroll = scrollContainer.scrollTop;
        const offset = 24;
        const newScroll =
          currentScroll + (targetRect.top - containerRect.top) - offset;

        scrollContainer.scrollTo({
          top: Math.max(0, newScroll),
          behavior: "smooth",
        });
      } else {
        const offset = 80;
        const rect = target.getBoundingClientRect();
        const targetTop = rect.top + window.scrollY - offset;
        window.scrollTo({ top: targetTop, behavior: "smooth" });
      }

      target.setAttribute("data-ff-active", "true");
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => {
        target.removeAttribute("data-ff-active");
      }, 1600);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  if (loading || !funnel || !stored || !previewFunnel) {
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
    activeSections.find((s) => s.id === selectedSectionId) ?? null;
  const isPublished = Boolean(stored.publishedAt);
  const brandName = extractBrandName(funnel.funnelName);
  const pages = funnel.pages ?? [];

  // 🆕 « Aperçu » montre TOUJOURS le brouillon en direct (/preview/{id}), même
  // si le tunnel est publié : sinon l'aperçu sert le snapshot PUBLIÉ figé
  // (published_content) et l'utilisateur revoit son ancienne version tant qu'il
  // n'a pas « Republié ». Le vrai lien public reste accessible via Republier.
  // 🆕 On passe ?page=slug pour prévisualiser la PAGE active (et plus toujours l'accueil).
  const previewHref =
    activePage && !activePage.isHome
      ? `/preview/${stored.id}?page=${encodeURIComponent(activePage.slug)}`
      : `/preview/${stored.id}`;

  return (
    <AppShell>
      <div className="sticky top-0 z-30 -mx-4 -mt-5 mb-5 border-b border-white/10 bg-zinc-950/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/80 sm:-mx-6 lg:-mx-8 lg:-mt-8 min-w-0">
        <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4 md:px-8 min-w-0">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3 flex-1">
            <Link
              href="/dashboard"
              title="Retour au dashboard"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div className="flex min-w-0 flex-col leading-tight">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="truncate text-sm font-semibold text-white">
                  {brandName || "Sans titre"}
                </h1>
                {isPublished ? (
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Publié
                  </span>
                ) : (
                  <span className="hidden sm:inline-flex items-center rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-400 ring-1 ring-zinc-700 shrink-0">
                    Brouillon
                  </span>
                )}
                <span
                  className={`sm:hidden inline-block h-2 w-2 rounded-full shrink-0 ${
                    isPublished ? "bg-emerald-400" : "bg-zinc-500"
                  }`}
                  aria-label={isPublished ? "Publié" : "Brouillon"}
                />
              </div>
              <div className="hidden md:flex items-center gap-1 text-[11px] text-zinc-500 min-w-0">
                <span className="shrink-0">/tunnel/</span>
                <input
                  type="text"
                  defaultValue={stored.slug}
                  onBlur={(e) => updateSlug(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  className="w-32 rounded border border-transparent bg-transparent px-1 py-0.5 font-mono text-zinc-300 outline-none hover:border-zinc-700 focus:border-indigo-500/50 focus:text-white"
                />
                <button
                  onClick={handleCopyLink}
                  title="Copier le lien"
                  className="ml-0.5 rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
          </div>

          <div className="ml-2 hidden lg:flex items-center justify-center shrink-0">
            <SaveIndicator state={saveState} lastSavedAt={lastSavedAt} syncError={syncError} />
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <div className="flex items-center rounded-md border border-zinc-800 bg-zinc-900">
              <button
                onClick={undo}
                disabled={history.past.length === 0}
                title="Annuler (Ctrl+Z)"
                className="flex h-8 w-7 sm:w-8 items-center justify-center rounded-l-md text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <div className="h-5 w-px bg-zinc-800" />
              <button
                onClick={redo}
                disabled={history.future.length === 0}
                title="Rétablir (Ctrl+Y)"
                className="flex h-8 w-7 sm:w-8 items-center justify-center rounded-r-md text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              onClick={handleManualSave}
              title="Enregistrer (Ctrl+S)"
              className="hidden lg:flex h-8 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition"
            >
              <Save className="h-3.5 w-3.5" />
              Enregistrer
            </button>

            <SystemeIoExportMenu funnel={funnel} activePage={activePage} />
            <Link
              href={previewHref}
              target="_blank"
              rel="noopener noreferrer"
              title={
                activePage && !activePage.isHome
                  ? `Aperçu : ${activePage.slug}`
                  : "Aperçu : page d'accueil"
              }
              className="hidden lg:flex h-8 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Aperçu
            </Link>

            <button
              onClick={handlePublish}
              className="flex h-8 items-center gap-1 sm:gap-1.5 rounded-md bg-gradient-to-b from-indigo-500 to-indigo-600 px-2.5 sm:px-3.5 text-xs font-semibold text-white shadow-sm shadow-indigo-900/40 hover:from-indigo-400 hover:to-indigo-500 transition"
            >
              {isPublished ? <Globe className="h-3.5 w-3.5" /> : <Rocket className="h-3.5 w-3.5" />}
              <span className="hidden xs:inline sm:inline">
                {isPublished ? "Republier" : "Publier"}
              </span>
            </button>
          </div>
        </div>

        <div className="lg:hidden flex flex-col gap-2 pb-2 px-3 min-w-0">
          {/* 🆕 Slug éditable + copie du lien, visibles sur mobile (< md) où le
              slug de la barre principale est masqué. */}
          <div className="md:hidden flex items-center gap-1 text-[11px] text-zinc-500 min-w-0">
            <span className="shrink-0">/tunnel/</span>
            <input
              type="text"
              defaultValue={stored.slug}
              onBlur={(e) => updateSlug(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="min-w-0 flex-1 rounded border border-zinc-700 bg-transparent px-1.5 py-1 font-mono text-zinc-300 outline-none focus:border-indigo-500/50 focus:text-white"
            />
            <button
              onClick={handleCopyLink}
              title="Copier le lien"
              className="shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="flex items-center justify-center">
            <SaveIndicator state={saveState} lastSavedAt={lastSavedAt} syncError={syncError} />
          </div>
        </div>
      </div>

      <div className="lg:hidden mb-4 min-w-0">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-900/60 p-1 ring-1 ring-white/5">
          <button
            type="button"
            onClick={() => setMobileTab("sections")}
            className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition ${
              mobileTab === "sections"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Sections
            <span className="ml-1 rounded-full bg-zinc-700/80 px-1.5 text-[10px] font-bold text-zinc-300">
              {activeSections.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("preview")}
            className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition ${
              mobileTab === "preview"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Aperçu
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(380px,38fr)_minmax(0,62fr)] min-w-0">
        <div
          className={`flex flex-col gap-4 min-w-0 ${
            mobileTab === "preview" ? "hidden lg:flex" : ""
          }`}
        >
          <PageSelector
            pages={pages}
            selectedPageId={selectedPageId}
            onSelect={handlePageSelect}
            onAddPage={handleAddPage}
            onDeletePage={handleDeletePage}
            onReorder={handleReorderPages}
          />

          {activePage && (
            <PageRegenPanel
              funnel={funnel}
              page={activePage}
              onApply={handleRegeneratePageApply}
            />
          )}

          {/* 🆕 Partager ce tunnel dans la Galerie communautaire */}
          <div className="flex justify-end">
            <ShareTemplateButton
              funnelId={funnelId}
              defaultName={funnel.funnelName}
              defaultOwner={funnel.header?.brandName}
            />
          </div>

          <EditorSidebar
            sections={activeSections}
            selectedId={selectedSectionId}
            onSelect={scrollToSection}
            onReorder={reorderSections}
            onToggleVisibility={toggleVisibility}
            onDuplicate={duplicateSection}
            onDelete={deleteSection}
            onAdd={addSection}
            onOpenGlobalStyle={() => setShowGlobalStyle(true)}
            onOpenHeader={() => setHeaderOpen(true)}
            onOpenSioLinking={() => setSioLinkingOpen(true)}
            onOpenTracking={() => setTrackingOpen(true)}
            onOpenCustomCode={() => setCustomCodeOpen(true)}
          />
        </div>

        <div
          className="lg:sticky lg:top-20 rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden min-w-0 relative"
          ref={previewWrapperRef}
          onClickCapture={handlePreviewClick}
        >
          <FunnelPreview
            key={activePage?.id ?? "default"}
            funnel={previewFunnel}
            activePage={activePage ?? undefined}
            defaultMode="desktop"
            showToolbar={true}
            viewportHeight="calc(100vh - 7rem)"
            pageRole={activePage?.role}
            editMode={true}
          />

          <InlineColorToolbar
            previewRootRef={previewWrapperRef}
            funnel={previewFunnel}
            updateSection={updateSection}
            debug={true}
          />
        </div>
      </div>

      <SectionEditorDrawer
        open={drawerOpen && !!selectedSection}
        onClose={() => setDrawerOpen(false)}
        title={selectedSection?.headline || selectedSection?.type || "Modifier la section"}
      >
        {selectedSection && (
          <SectionEditor
            key={selectedSection.id}
            section={selectedSection}
            language={funnel.language}
            funnel={funnel}
            onChange={(patch: Partial<FunnelSection>) =>
              updateSection(selectedSection.id, patch)
            }
            onFunnelChange={updateFunnelMeta}
          />
        )}
      </SectionEditorDrawer>

      {showGlobalStyle && (
        <GlobalStylePanel
          funnel={funnel}
          onChange={updateFunnelMeta}
          onClose={() => setShowGlobalStyle(false)}
        />
      )}

      {sioLinkingOpen && (
        <SioLinkingTab
          funnel={funnel}
          onChange={updateFunnelMeta}
          onClose={() => setSioLinkingOpen(false)}
        />
      )}


      {trackingOpen && (
        <TrackingPixelsTab
          funnel={funnel}
          onChange={updateFunnelMeta}
          onClose={() => setTrackingOpen(false)}
        />
      )}

      {customCodeOpen && (
        <CustomCodeTab
          funnel={funnel}
          onChange={updateFunnelMeta}
          onClose={() => setCustomCodeOpen(false)}
        />
      )}

      {headerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setHeaderOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-4 sm:p-5 max-h-[90vh] overflow-y-auto min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Header</h2>
              <button
                type="button"
                onClick={() => setHeaderOpen(false)}
                className="text-white/60 hover:text-white text-xl leading-none"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
            <HeaderTab funnel={funnel} onChange={updateFunnelMeta} />
          </div>
        </div>
      )}
    </AppShell>
  );
}

function SaveIndicator({
  state,
  lastSavedAt,
  syncError,
}: {
  state: "idle" | "saving" | "saved";
  lastSavedAt: number | null;
  syncError?: boolean;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  // 🆕 Priorité : échec de synchro serveur (enregistré en local mais pas poussé).
  if (syncError) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-400 ring-1 ring-amber-500/30"
        title="Enregistré localement mais pas sur le serveur — recharge la page ou reconnecte-toi"
      >
        ⚠ Non synchronisé
      </span>
    );
  }

  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800/60 px-2.5 py-1 text-[11px] font-medium text-zinc-300 ring-1 ring-zinc-700">
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
          ? `Il y a ${Math.floor(diff / 1000)} s`
          : diff < 3_600_000
            ? `Il y a ${Math.floor(diff / 60_000)} min`
            : "Il y a > 1 h";
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400 ring-1 ring-emerald-500/20"
        data-tick={tick}
      >
        <Check className="h-3 w-3" />
        Enregistré · {label}
      </span>
    );
  }
  return null;
}
