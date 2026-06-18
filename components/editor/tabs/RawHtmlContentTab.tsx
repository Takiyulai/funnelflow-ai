// components/editor/tabs/RawHtmlContentTab.tsx
"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import {
  Type,
  RotateCcw,
  Search,
  Heading1,
  Heading2,
  MousePointerClick,
  AlignLeft,
  Link as LinkIcon,
  ExternalLink,
  Palette,
  MousePointer2,
  List,
  X,
  Image as ImageIcon,
  Film,
  Code2,
  Upload,
  Camera,
} from "lucide-react";

import type {
  FunnelSection,
  RawHtmlPatch,
  RawHtmlBackgroundPatch,
} from "@/lib/funnels/types";
import { RAW_HTML_BODY_MARKER } from "@/lib/clone/section-mapper";
import {
  buildRawHtmlInventory,
  detectRawHtmlBackground,
  type EditableTextSpot,
  type EditableLinkSpot,
  type EditableImageSpot,
  type DetectedBackground,
} from "@/lib/clone/raw-html-editable";
import { walkerDebug } from "@/lib/clone/raw-html-walker";
walkerDebug.enabled = true;

// 🆕 Phase 1B : le walker + l'inventaire portent désormais `mediaType`.
// Fallback "image" par sécurité pour d'anciens patches/clones sans le champ.
function getMediaType(spot: EditableImageSpot): "image" | "video" | "embed" {
  return spot.mediaType ?? "image";
}

type Props = {
  section: FunnelSection;
  onChange: (patch: Partial<FunnelSection>) => void;
};

const KIND_META: Record<
  EditableTextSpot["kind"],
  { label: string; Icon: typeof Type; color: string }
> = {
  title: { label: "Titre", Icon: Heading1, color: "text-amber-300" },
  subtitle: { label: "Sous-titre", Icon: Heading2, color: "text-sky-300" },
  paragraph: { label: "Paragraphe", Icon: AlignLeft, color: "text-white/60" },
  short: { label: "Texte", Icon: Type, color: "text-white/60" },
};

// Spot actuellement actif (cliqué dans l'iframe ou sélectionné dans la liste)
// 🆕 Pour les textes, on peut aussi attacher un answerId quand le clic
//    concerne une question FAQ (la réponse devient alors éditable en plus).
type ActiveSpot =
  | { kind: "text"; id: string; answerId?: string }
  | { kind: "link"; id: string }
  | { kind: "image"; id: string; mediaType?: "image" | "video" | "embed" }
  | null;

export function RawHtmlContentTab({ section, onChange }: Props) {
  const [search, setSearch] = useState("");
  const [activeSpot, setActiveSpot] = useState<ActiveSpot>(null);
  const [showList, setShowList] = useState(false);

  // 🆕 Ref + flag pour mettre en évidence l'éditeur de fond quand on clique
  // sur une zone neutre dans la preview de cette section.
  const backgroundEditorRef = useRef<HTMLDivElement | null>(null);
  const [highlightBackground, setHighlightBackground] = useState(false);

  const rawHtml = useMemo(() => extractRawHtml(section.body), [section.body]);

  const inventory = useMemo(
    () => buildRawHtmlInventory(rawHtml ?? ""),
    [rawHtml],
  );

  const patches: RawHtmlPatch = section.rawHtmlPatches ?? {};
  const textPatches = patches.texts ?? {};
  const linkPatches = patches.links ?? {};
  const imagePatches = patches.images ?? {};
  const backgroundPatch = patches.background;

  // ───────── Écoute des messages venant de l'iframe (click-to-edit) ─────────
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = ev?.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== "ff-edit-click") return;

      // 🆕 Ne traiter que les messages destinés à CETTE section
      if (data.sectionId && data.sectionId !== section.id) return;

      const spotKind = data.spotKind as
        | "text"
        | "link"
        | "image"
        | undefined;
      const spotId = data.spotId as string | undefined;
      if (!spotKind || !spotId) return;

      console.log(
        `[FF click-from-iframe] kind=${spotKind} | id=${spotId} | section=${data.sectionId}`,
        data,
      );

      if (spotKind === "image") {
        const mediaType =
          (data.mediaType as "image" | "video" | "embed" | undefined) ||
          "image";
        setActiveSpot({ kind: "image", id: spotId, mediaType });
      } else if (spotKind === "text") {
        const answerId =
          typeof data.answerSpotId === "string" && data.answerSpotId
            ? data.answerSpotId
            : undefined;
        setActiveSpot({ kind: "text", id: spotId, answerId });
      } else {
        setActiveSpot({ kind: spotKind, id: spotId });
      }
      setShowList(false);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [section.id]);

  // 🆕 Écoute du CustomEvent relayé par EditorPage quand on a dû changer
  // de section avant d'ouvrir l'éditeur. Ce listener prend le relais du
  // listener "message" original (qui aurait été manqué pendant le remount).
  useEffect(() => {
    function onRelayedClick(ev: Event) {
      const detail = (ev as CustomEvent).detail;
      if (!detail || typeof detail !== "object") return;
      if (detail.sectionId !== section.id) return;
      if (detail.type !== "ff-edit-click") return;

      const spotKind = detail.spotKind as
        | "text"
        | "link"
        | "image"
        | undefined;
      const spotId = detail.spotId as string | undefined;
      if (!spotKind || !spotId) return;

      console.log(
        `[FF relayed-click] kind=${spotKind} | id=${spotId} | section=${detail.sectionId}`,
      );

      if (spotKind === "image") {
        const mediaType =
          (detail.mediaType as "image" | "video" | "embed" | undefined) ||
          "image";
        setActiveSpot({ kind: "image", id: spotId, mediaType });
      } else if (spotKind === "text") {
        const answerId =
          typeof detail.answerSpotId === "string" && detail.answerSpotId
            ? detail.answerSpotId
            : undefined;
        setActiveSpot({ kind: "text", id: spotId, answerId });
      } else {
        setActiveSpot({ kind: spotKind, id: spotId });
      }
      setShowList(false);
    }

    window.addEventListener("ff-relay-edit-click", onRelayedClick);
    return () =>
      window.removeEventListener("ff-relay-edit-click", onRelayedClick);
  }, [section.id]);

  // 🆕 Écoute du signal "ouvrir le BackgroundEditor" relayé par EditorPage
  // quand l'utilisateur clique sur une zone neutre d'une section raw-html.
  useEffect(() => {
    function onOpenBg(ev: Event) {
      const detail = (ev as CustomEvent).detail as
        | { sectionId?: string }
        | undefined;
      if (!detail || detail.sectionId !== section.id) return;

      setActiveSpot(null);
      setHighlightBackground(true);

      // Petit délai pour laisser le drawer/onglet se rendre
      setTimeout(() => {
        backgroundEditorRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);

      // Retire le highlight après 2.5s
      setTimeout(() => setHighlightBackground(false), 2500);
    }

    window.addEventListener("ff-open-background-editor", onOpenBg);
    return () =>
      window.removeEventListener("ff-open-background-editor", onOpenBg);
  }, [section.id]);

  const getPreviewIframe = (): HTMLIFrameElement | null => {
    const ifr = document.querySelector<HTMLIFrameElement>(
      ".raw-html-section iframe",
    );
    return ifr || null;
  };

  const highlightSpotInIframe = (
    spotId: string,
    attrName: "data-ff-spot-id" | "data-ff-link-id" | "data-ff-image-id",
  ) => {
    const ifr = getPreviewIframe();
    if (!ifr || !ifr.contentWindow) return;
    try {
      ifr.contentWindow.postMessage(
        { type: "ff-highlight-spot", spotId, attr: attrName },
        "*",
      );
    } catch {
      // ignore
    }
  };

  const filteredTexts = useMemo(() => {
    if (!search.trim()) return inventory.texts;
    const q = search.toLowerCase();
    return inventory.texts.filter((t) => {
      const current = textPatches[t.id] ?? t.original;
      return (
        t.original.toLowerCase().includes(q) ||
        current.toLowerCase().includes(q)
      );
    });
  }, [inventory.texts, search, textPatches]);

  const filteredLinks = useMemo(() => {
    if (!search.trim()) return inventory.links;
    const q = search.toLowerCase();
    return inventory.links.filter((l) => {
      const patch = linkPatches[l.id];
      const currentLabel = patch?.label ?? l.label;
      const currentHref = patch?.href ?? l.href;
      return (
        l.label.toLowerCase().includes(q) ||
        l.href.toLowerCase().includes(q) ||
        currentLabel.toLowerCase().includes(q) ||
        currentHref.toLowerCase().includes(q)
      );
    });
  }, [inventory.links, search, linkPatches]);

  const filteredImages = useMemo(() => {
    if (!search.trim()) return inventory.images;
    const q = search.toLowerCase();
    return inventory.images.filter((m) => {
      const patch = imagePatches[m.id];
      const currentSrc = patch?.src ?? m.src;
      const currentAlt = patch?.alt ?? m.alt ?? "";
      return (
        (m.src ?? "").toLowerCase().includes(q) ||
        (m.alt ?? "").toLowerCase().includes(q) ||
        currentSrc.toLowerCase().includes(q) ||
        currentAlt.toLowerCase().includes(q)
      );
    });
  }, [inventory.images, search, imagePatches]);

  const updateText = (id: string, value: string) => {
    const original =
      inventory.texts.find((t) => t.id === id)?.original ?? "";
    const next: Record<string, string> = { ...textPatches };
    if (value === original) {
      delete next[id];
    } else {
      next[id] = value;
    }
    onChange({
      rawHtmlPatches: {
        ...patches,
        texts: Object.keys(next).length > 0 ? next : undefined,
      },
    });
  };

  const updateLink = (id: string, field: "href" | "label", value: string) => {
    const spot = inventory.links.find((l) => l.id === id);
    if (!spot) return;
    const original = field === "href" ? spot.href : spot.label;
    const prev = linkPatches[id] ?? {};
    const next: { href?: string; label?: string } = { ...prev };

    if (value === original) {
      delete next[field];
    } else {
      next[field] = value;
    }

    const nextLinks = { ...linkPatches };
    if (!next.href && !next.label) {
      delete nextLinks[id];
    } else {
      nextLinks[id] = next;
    }

    onChange({
      rawHtmlPatches: {
        ...patches,
        links: Object.keys(nextLinks).length > 0 ? nextLinks : undefined,
      },
    });
  };

  const resetLink = (id: string) => {
    const nextLinks = { ...linkPatches };
    delete nextLinks[id];
    onChange({
      rawHtmlPatches: {
        ...patches,
        links: Object.keys(nextLinks).length > 0 ? nextLinks : undefined,
      },
    });
  };

  const updateImage = (id: string, field: "src" | "alt", value: string) => {
    const spot = inventory.images.find((m) => m.id === id);
    if (!spot) return;
    const original = field === "src" ? spot.src : spot.alt ?? "";
    const prev = imagePatches[id] ?? {};
    const next: { src?: string; alt?: string; mediaType?: "image" | "video" | "embed" } = {
      ...prev,
    };

    if (value === original) {
      delete next[field];
    } else {
      next[field] = value;
    }

    const nextImages = { ...imagePatches };
    if (
      next.src === undefined &&
      next.alt === undefined &&
      next.mediaType === undefined
    ) {
      delete nextImages[id];
    } else {
      nextImages[id] = next;
    }

    onChange({
      rawHtmlPatches: {
        ...patches,
        images: Object.keys(nextImages).length > 0 ? nextImages : undefined,
      },
    });
  };

  // 🆕 Phase 1B : convertir un média (image ↔ vidéo ↔ embed).
  const updateImageMediaType = (
    id: string,
    mediaType: "image" | "video" | "embed",
  ) => {
    const spot = inventory.images.find((m) => m.id === id);
    const sourceType = spot?.mediaType ?? "image";
    const prev = imagePatches[id] ?? {};
    const next: { src?: string; alt?: string; mediaType?: "image" | "video" | "embed" } = {
      ...prev,
    };

    // Si on revient au type d'origine, on retire l'override.
    if (mediaType === sourceType) {
      delete next.mediaType;
    } else {
      next.mediaType = mediaType;
    }

    const nextImages = { ...imagePatches };
    if (
      next.src === undefined &&
      next.alt === undefined &&
      next.mediaType === undefined
    ) {
      delete nextImages[id];
    } else {
      nextImages[id] = next;
    }

    onChange({
      rawHtmlPatches: {
        ...patches,
        images: Object.keys(nextImages).length > 0 ? nextImages : undefined,
      },
    });
  };

  const resetImage = (id: string) => {
    const nextImages = { ...imagePatches };
    delete nextImages[id];
    onChange({
      rawHtmlPatches: {
        ...patches,
        images: Object.keys(nextImages).length > 0 ? nextImages : undefined,
      },
    });
  };

  const updateBackground = (next: RawHtmlBackgroundPatch | undefined) => {
    const nextPatches: RawHtmlPatch = { ...patches };
    if (next === undefined || next.mode === "original") {
      delete nextPatches.background;
    } else {
      nextPatches.background = next;
    }
    onChange({ rawHtmlPatches: nextPatches });
  };

  const resetAll = () => {
    if (!confirm("Réinitialiser toutes les modifications ?")) return;
    onChange({
      rawHtmlPatches: {
        ...patches,
        texts: undefined,
        links: undefined,
        images: undefined,
        background: undefined,
      },
    });
  };

  const modifiedTexts = Object.keys(textPatches).length;
  const modifiedLinks = Object.keys(linkPatches).length;
  const modifiedImages = Object.keys(imagePatches).length;
  const modifiedBackground = backgroundPatch ? 1 : 0;
  const modifiedCount =
    modifiedTexts + modifiedLinks + modifiedImages + modifiedBackground;
  const totalSpots =
    inventory.texts.length +
    inventory.links.length +
    inventory.images.length;

  const activeTextSpot =
    activeSpot?.kind === "text"
      ? inventory.texts.find((t) => t.id === activeSpot.id)
      : undefined;

  // 🆕 Spot "réponse" quand on a cliqué sur une question FAQ
  const activeAnswerSpot =
    activeSpot?.kind === "text" && activeSpot.answerId
      ? inventory.texts.find((t) => t.id === activeSpot.answerId)
      : undefined;

  const activeLinkSpot =
    activeSpot?.kind === "link"
      ? inventory.links.find((l) => l.id === activeSpot.id)
      : undefined;
  const activeImageSpot =
    activeSpot?.kind === "image"
      ? inventory.images.find((m) => m.id === activeSpot.id)
      : undefined;

  if (!rawHtml) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/30 p-4 text-xs text-white/60">
        Cette section n&apos;est pas un contenu cloné éditable.
      </div>
    );
  }

  if (
    inventory.texts.length === 0 &&
    inventory.links.length === 0 &&
    inventory.images.length === 0
  ) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/30 p-4 text-xs text-white/60">
        Aucun élément éditable détecté dans cette section.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header global */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Type className="h-4 w-4 text-white/60" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/70">
            Contenu éditable
          </h3>
          {modifiedCount > 0 && (
            <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
              {modifiedCount} modifié{modifiedCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {modifiedCount > 0 && (
          <button
            type="button"
            onClick={resetAll}
            className="flex items-center gap-1 text-[11px] text-white/50 hover:text-rose-300 transition-colors"
            title="Réinitialiser toutes les modifications"
          >
            <RotateCcw className="h-3 w-3" />
            Tout réinitialiser
          </button>
        )}
      </div>

      {/* ────── ÉDITEUR DE FOND DE SECTION ────── */}
      <BackgroundEditor
        ref={backgroundEditorRef}
        html={rawHtml}
        value={backgroundPatch}
        onChange={updateBackground}
        highlight={highlightBackground}
        autoExpand={highlightBackground}
      />

      <div className="rounded-md bg-amber-300/[0.08] border border-amber-300/20 px-2.5 py-2 text-[11px] text-amber-100/90 leading-relaxed flex items-start gap-2">
        <MousePointer2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-300" />
        <div>
          <strong className="text-amber-200">Cliquez directement</strong> sur un
          texte, un bouton ou un média dans l&apos;aperçu pour l&apos;éditer ici.
          Cliquez sur une zone neutre pour modifier le fond.
        </div>
      </div>

      {/* ────── ÉDITEUR DU SPOT ACTIF ────── */}
      {activeTextSpot && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-amber-200/90">
              {activeAnswerSpot
                ? "Question & Réponse FAQ"
                : "Élément sélectionné"}
            </h4>
            <button
              type="button"
              onClick={() => setActiveSpot(null)}
              className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/80 transition-colors"
              title="Désélectionner"
            >
              <X className="h-3 w-3" />
              Fermer
            </button>
          </div>

          {/* Question */}
          <div className="space-y-1">
            {activeAnswerSpot && (
              <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/70 px-1">
                Question
              </div>
            )}
            <TextSpotEditor
              spot={activeTextSpot}
              value={textPatches[activeTextSpot.id] ?? activeTextSpot.original}
              isModified={activeTextSpot.id in textPatches}
              isFocused
              onChange={(v) => updateText(activeTextSpot.id, v)}
              onReset={() =>
                updateText(activeTextSpot.id, activeTextSpot.original)
              }
              onFocus={() =>
                highlightSpotInIframe(activeTextSpot.id, "data-ff-spot-id")
              }
              onBlur={() => {
                /* on garde activeSpot pour permettre re-focus */
              }}
              autoFocus
            />
          </div>

          {/* Réponse (uniquement si FAQ détectée) */}
          {activeAnswerSpot && (
            <div className="space-y-1 pt-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/70 px-1">
                Réponse
              </div>
              <TextSpotEditor
                spot={activeAnswerSpot}
                value={
                  textPatches[activeAnswerSpot.id] ?? activeAnswerSpot.original
                }
                isModified={activeAnswerSpot.id in textPatches}
                isFocused={false}
                onChange={(v) => updateText(activeAnswerSpot.id, v)}
                onReset={() =>
                  updateText(activeAnswerSpot.id, activeAnswerSpot.original)
                }
                onFocus={() =>
                  highlightSpotInIframe(
                    activeAnswerSpot.id,
                    "data-ff-spot-id",
                  )
                }
                onBlur={() => {
                  /* idem */
                }}
                autoFocus={false}
              />
            </div>
          )}
        </div>
      )}

      {activeLinkSpot && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200/90">
              Bouton / lien sélectionné
            </h4>
            <button
              type="button"
              onClick={() => setActiveSpot(null)}
              className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/80 transition-colors"
              title="Désélectionner"
            >
              <X className="h-3 w-3" />
              Fermer
            </button>
          </div>
          <LinkSpotEditor
            spot={activeLinkSpot}
            patch={linkPatches[activeLinkSpot.id]}
            isFocused
            onChangeField={(field, v) =>
              updateLink(activeLinkSpot.id, field, v)
            }
            onReset={() => resetLink(activeLinkSpot.id)}
            onFocus={() =>
              highlightSpotInIframe(activeLinkSpot.id, "data-ff-link-id")
            }
            onBlur={() => {
              /* idem */
            }}
            autoFocus
          />
        </div>
      )}

      {activeImageSpot && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-sky-200/90">
              Média sélectionné
            </h4>
            <button
              type="button"
              onClick={() => setActiveSpot(null)}
              className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/80 transition-colors"
              title="Désélectionner"
            >
              <X className="h-3 w-3" />
              Fermer
            </button>
          </div>
          <MediaSpotEditor
            spot={activeImageSpot}
            patch={imagePatches[activeImageSpot.id]}
            isFocused
            onChangeField={(field, v) =>
              updateImage(activeImageSpot.id, field, v)
            }
            onChangeMediaType={(t) =>
              updateImageMediaType(activeImageSpot.id, t)
            }
            onReset={() => resetImage(activeImageSpot.id)}
            onFocus={() =>
              highlightSpotInIframe(activeImageSpot.id, "data-ff-image-id")
            }
            onBlur={() => {
              /* idem */
            }}
            autoFocus
          />
        </div>
      )}

      {!activeSpot && !showList && (
        <div className="rounded-lg border border-dashed border-white/15 bg-black/20 p-4 text-center text-[11px] text-white/50">
          <MousePointer2 className="mx-auto h-6 w-6 text-white/30 mb-2" />
          Aucun élément sélectionné.
          <br />
          Cliquez sur un texte, un bouton ou un média dans l&apos;aperçu, ou
          ouvrez la liste complète ci-dessous.
        </div>
      )}

      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowList((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/60 hover:bg-white/[0.06] hover:text-white/90 transition-colors"
        >
          <List className="h-3.5 w-3.5" />
          {showList
            ? "Masquer la liste complète"
            : `Voir tous les éléments (${totalSpots})`}
        </button>
      </div>

      {showList && (
        <div className="space-y-3 pt-2 border-t border-white/5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-8 pr-3 text-xs text-white outline-none focus:border-amber-300/40 placeholder:text-white/30"
            />
          </div>

          {inventory.texts.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-1">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  Textes ({inventory.texts.length})
                </h4>
                {modifiedTexts > 0 && (
                  <span className="rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-200">
                    {modifiedTexts}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {filteredTexts.map((spot) => (
                  <SpotListRow
                    key={spot.id}
                    label={spot.original}
                    kind={KIND_META[spot.kind].label}
                    Icon={KIND_META[spot.kind].Icon}
                    color={KIND_META[spot.kind].color}
                    isModified={spot.id in textPatches}
                    isActive={
                      activeSpot?.kind === "text" && activeSpot.id === spot.id
                    }
                    onClick={() => {
                      setActiveSpot({ kind: "text", id: spot.id });
                      highlightSpotInIframe(spot.id, "data-ff-spot-id");
                    }}
                  />
                ))}
              </div>

              {filteredTexts.length === 0 && search.trim() && (
                <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-center text-[11px] text-white/50">
                  Aucun texte ne correspond à « {search} »
                </div>
              )}
            </>
          )}

          {inventory.links.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                <MousePointerClick className="h-3.5 w-3.5 text-emerald-300/80" />
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  Boutons & liens ({inventory.links.length})
                </h4>
                {modifiedLinks > 0 && (
                  <span className="rounded-full bg-emerald-300/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-200">
                    {modifiedLinks}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {filteredLinks.map((spot) => {
                  const Icon = spot.isCta
                    ? MousePointerClick
                    : spot.isExternal
                      ? ExternalLink
                      : LinkIcon;
                  const color = spot.isCta
                    ? "text-emerald-300"
                    : spot.isExternal
                      ? "text-sky-300"
                      : "text-white/60";
                  return (
                    <SpotListRow
                      key={spot.id}
                      label={spot.label || spot.href || "(lien)"}
                      kind={
                        spot.isCta
                          ? "CTA"
                          : spot.isExternal
                            ? "Lien externe"
                            : "Lien"
                      }
                      Icon={Icon}
                      color={color}
                      isModified={spot.id in linkPatches}
                      isActive={
                        activeSpot?.kind === "link" &&
                        activeSpot.id === spot.id
                      }
                      onClick={() => {
                        setActiveSpot({ kind: "link", id: spot.id });
                        highlightSpotInIframe(spot.id, "data-ff-link-id");
                      }}
                    />
                  );
                })}
              </div>

              {filteredLinks.length === 0 && search.trim() && (
                <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-center text-[11px] text-white/50">
                  Aucun lien ne correspond à « {search} »
                </div>
              )}
            </>
          )}

          {inventory.images.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                <ImageIcon className="h-3.5 w-3.5 text-sky-300/80" />
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  Médias ({inventory.images.length})
                </h4>
                {modifiedImages > 0 && (
                  <span className="rounded-full bg-sky-300/15 px-1.5 py-0.5 text-[9px] font-medium text-sky-200">
                    {modifiedImages}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {filteredImages.map((spot) => {
                  const mediaType = getMediaType(spot);
                  const Icon =
                    mediaType === "video"
                      ? Film
                      : mediaType === "embed"
                        ? Code2
                        : ImageIcon;
                  const color =
                    mediaType === "video"
                      ? "text-rose-300"
                      : mediaType === "embed"
                        ? "text-violet-300"
                        : "text-sky-300";
                  const kindLabel =
                    mediaType === "video"
                      ? "Vidéo"
                      : mediaType === "embed"
                        ? "Embed"
                        : "Image";
                  const previewLabel =
                    spot.alt ||
                    (spot.src ? shortenSrc(spot.src) : "(média)");
                  return (
                    <SpotListRow
                      key={spot.id}
                      label={previewLabel}
                      kind={kindLabel}
                      Icon={Icon}
                      color={color}
                      isModified={spot.id in imagePatches}
                      isActive={
                        activeSpot?.kind === "image" &&
                        activeSpot.id === spot.id
                      }
                      onClick={() => {
                        setActiveSpot({
                          kind: "image",
                          id: spot.id,
                          mediaType,
                        });
                        highlightSpotInIframe(spot.id, "data-ff-image-id");
                      }}
                    />
                  );
                })}
              </div>

              {filteredImages.length === 0 && search.trim() && (
                <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-center text-[11px] text-white/50">
                  Aucun média ne correspond à « {search} »
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BackgroundEditor — couleur / image / aucun (forwardRef pour scroll-to)
// ─────────────────────────────────────────────────────────────────────────────

const BackgroundEditor = forwardRef<
  HTMLDivElement,
  {
    html: string;
    value: RawHtmlBackgroundPatch | undefined;
    onChange: (next: RawHtmlBackgroundPatch | undefined) => void;
    highlight?: boolean;
    autoExpand?: boolean;
  }
>(function BackgroundEditor(
  { html, value, onChange, highlight, autoExpand },
  ref,
) {
  const detected = useMemo<DetectedBackground>(
    () => detectRawHtmlBackground(html),
    [html],
  );
  const current: RawHtmlBackgroundPatch = value || { mode: "original" };
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [expanded, setExpanded] = useState(false);

  // 🆕 Auto-expand quand on est sollicité depuis l'iframe
  useEffect(() => {
    if (autoExpand) setExpanded(true);
  }, [autoExpand]);

  const update = (patch: Partial<RawHtmlBackgroundPatch>) => {
    onChange({ ...current, ...patch });
  };

  const reset = () => onChange(undefined);

  const isModified = value !== undefined && value.mode !== "original";

  // Image actuellement affichée (priorité au patch, sinon fallback sur le détecté)
  const displayedImage: string | undefined =
    current.mode === "image" && current.imageUrl
      ? current.imageUrl
      : current.mode === "original" && detected.kind === "image"
        ? detected.imageUrl
        : undefined;

  const displayedColor: string | undefined =
    current.mode === "color" && current.color
      ? current.color
      : current.mode === "original" && detected.kind === "color"
        ? detected.color
        : undefined;

  const switchToImageMode = () => {
    if (current.mode === "image") return;
    if (detected.kind === "image" && detected.imageUrl) {
      onChange({ mode: "image", imageUrl: detected.imageUrl });
    } else {
      onChange({ mode: "image" });
    }
  };

  const switchToColorMode = () => {
    if (current.mode === "color") return;
    if (detected.kind === "color" && detected.color) {
      onChange({ mode: "color", color: detected.color });
    } else {
      onChange({ mode: "color", color: "#000000" });
    }
  };

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("spotId", "section-background");

      const m =
        typeof window !== "undefined"
          ? window.location.pathname.match(/\/editor\/([^/?#]+)/)
          : null;
      if (m) fd.append("funnelId", m[1]);

      const url: string = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/media/upload");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const json = JSON.parse(xhr.responseText);
              if (json.url) resolve(json.url);
              else reject(new Error(json.error || "Réponse invalide"));
            } catch {
              reject(new Error("Réponse JSON invalide"));
            }
          } else if (xhr.status === 404) {
            reject(
              new Error(
                "Endpoint /api/media/upload introuvable (404). La route n'est pas créée sur le serveur.",
              ),
            );
          } else {
            try {
              const json = JSON.parse(xhr.responseText);
              reject(new Error(json.error || `HTTP ${xhr.status}`));
            } catch {
              reject(new Error(`HTTP ${xhr.status}`));
            }
          }
        };
        xhr.onerror = () => reject(new Error("Erreur réseau"));
        xhr.send(fd);
      });

      update({ mode: "image", imageUrl: url });
    } catch (e) {
      setUploadError((e as Error).message || "Erreur d'upload");
    } finally {
      setUploading(false);
    }
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void handleFile(f);
  }

  return (
    <div
      ref={ref}
      className={[
        "rounded-lg border transition-all duration-300",
        highlight
          ? "border-amber-300 bg-amber-300/[0.08] shadow-[0_0_0_3px_rgba(252,211,77,0.35)] ring-2 ring-amber-300/40"
          : isModified
            ? "border-amber-300/40 bg-amber-300/[0.04]"
            : "border-white/10 bg-black/30",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-2.5 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Palette className="h-3.5 w-3.5 text-white/60" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
            Fond de section
          </span>
          {isModified && (
            <span className="rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-200">
              modifié
            </span>
          )}
        </div>
        <span className="text-[10px] text-white/40">
          {expanded ? "−" : "+"}
        </span>
      </button>

      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2">
          {/* Aperçu visuel du fond actuel */}
          {(displayedImage || displayedColor) && (
            <div className="rounded-md border border-white/10 overflow-hidden">
              <div
                className="w-full h-20 bg-cover bg-center bg-no-repeat"
                style={{
                  ...(displayedImage
                    ? { backgroundImage: `url("${displayedImage}")` }
                    : {}),
                  ...(displayedColor && !displayedImage
                    ? { backgroundColor: displayedColor }
                    : {}),
                }}
              />
              <div className="px-2 py-1 text-[9px] text-white/50 bg-black/40">
                {current.mode === "original" ? (
                  <>Fond actuel (cloné)</>
                ) : (
                  <>Aperçu du fond modifié</>
                )}
              </div>
            </div>
          )}

          {/* Sélecteur de mode */}
          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                { id: "original", label: "Original" },
                { id: "color", label: "Couleur" },
                { id: "image", label: "Image" },
                { id: "none", label: "Aucun" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  if (m.id === "original") reset();
                  else if (m.id === "color") switchToColorMode();
                  else if (m.id === "image") switchToImageMode();
                  else update({ mode: m.id });
                }}
                className={[
                  "px-1.5 py-1.5 text-[10px] rounded border transition-colors",
                  current.mode === m.id
                    ? "border-amber-300/50 bg-amber-300/[0.1] text-amber-200"
                    : "border-white/10 bg-black/30 text-white/60 hover:bg-white/[0.05]",
                ].join(" ")}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Mode COULEUR */}
          {current.mode === "color" && (
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={normalizeHex(current.color) || "#000000"}
                onChange={(e) => update({ color: e.target.value })}
                className="w-10 h-9 rounded cursor-pointer bg-transparent border border-white/10"
              />
              <input
                type="text"
                value={current.color || ""}
                onChange={(e) => update({ color: e.target.value })}
                placeholder="#0a0a0a ou rgb(…)"
                className="flex-1 rounded border border-white/10 bg-black/50 px-2 py-1.5 text-[11px] font-mono text-white outline-none focus:border-amber-300/40"
              />
            </div>
          )}

          {/* Mode IMAGE */}
          {current.mode === "image" && (
            <div className="space-y-2">
              {detected.kind === "image" &&
                current.imageUrl === detected.imageUrl && (
                  <p className="text-[10px] text-white/50 italic">
                    Image de fond d&apos;origine. Modifiez l&apos;URL ou
                    remplacez-la par un fichier.
                  </p>
                )}

              <div>
                <label className="block text-[9px] uppercase tracking-wide text-white/40 mb-0.5">
                  URL de l&apos;image
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={current.imageUrl || ""}
                    onChange={(e) => update({ imageUrl: e.target.value })}
                    placeholder="https://… (ou remplacez via Upload)"
                    className="flex-1 rounded border border-white/10 bg-black/50 px-2 py-1.5 text-[11px] font-mono text-white outline-none focus:border-amber-300/40"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1 rounded border border-amber-300/40 bg-amber-300/[0.12] px-2.5 py-1.5 text-[10px] font-medium text-amber-100 hover:bg-amber-300/[0.2] transition-colors disabled:opacity-50 shrink-0"
                    title={
                      current.imageUrl
                        ? "Remplacer l'image"
                        : "Uploader une image"
                    }
                  >
                    <Upload className="h-3 w-3" />
                    {uploading
                      ? "…"
                      : current.imageUrl
                        ? "Remplacer"
                        : "Upload"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFilePick}
                  />
                </div>
              </div>

              {uploading && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-amber-200/80">
                    <span>Envoi…</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-amber-300/80 transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="rounded border border-rose-400/40 bg-rose-400/10 px-2 py-1.5 text-[10px] text-rose-200 space-y-0.5">
                  <div className="font-semibold">Erreur :</div>
                  <div>{uploadError}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] text-white/50 space-y-1">
                  <span>Position</span>
                  <select
                    value={current.position || "center"}
                    onChange={(e) =>
                      update({
                        position: e.target
                          .value as RawHtmlBackgroundPatch["position"],
                      })
                    }
                    className="w-full rounded border border-white/10 bg-black/50 px-2 py-1 text-[11px] text-white outline-none focus:border-amber-300/40"
                  >
                    <option value="center">Centre</option>
                    <option value="top">Haut</option>
                    <option value="bottom">Bas</option>
                    <option value="left">Gauche</option>
                    <option value="right">Droite</option>
                  </select>
                </label>
                <label className="text-[10px] text-white/50 space-y-1">
                  <span>Ajustement</span>
                  <select
                    value={current.size || "cover"}
                    onChange={(e) =>
                      update({
                        size: e.target
                          .value as RawHtmlBackgroundPatch["size"],
                      })
                    }
                    className="w-full rounded border border-white/10 bg-black/50 px-2 py-1 text-[11px] text-white outline-none focus:border-amber-300/40"
                  >
                    <option value="cover">Couvrir</option>
                    <option value="contain">Contenir</option>
                    <option value="auto">Auto</option>
                  </select>
                </label>
              </div>

              {/* Overlay */}
              <div className="pt-2 border-t border-white/5">
                <p className="text-[10px] text-white/50 mb-1.5">
                  Voile par-dessus l&apos;image
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={normalizeHex(current.overlayColor) || "#000000"}
                    onChange={(e) => update({ overlayColor: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border border-white/10"
                  />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={current.overlayOpacity ?? 0}
                    onChange={(e) =>
                      update({ overlayOpacity: Number(e.target.value) })
                    }
                    className="flex-1 accent-amber-300"
                  />
                  <span className="text-[10px] text-white/50 w-9 text-right tabular-nums">
                    {current.overlayOpacity ?? 0}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Mode NONE */}
          {current.mode === "none" && (
            <p className="text-[10px] text-white/50 italic">
              La section sera affichée sans aucun fond (transparent).
            </p>
          )}

          {isModified && (
            <button
              type="button"
              onClick={reset}
              className="w-full flex items-center justify-center gap-1 rounded border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[10px] text-white/60 hover:text-amber-200 hover:bg-white/[0.06] transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Restaurer le fond original
            </button>
          )}
        </div>
      )}
    </div>
  );
});

function normalizeHex(c?: string): string | undefined {
  if (!c) return undefined;
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  const m = c.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (m) {
    const h = (n: number) => n.toString(16).padStart(2, "0");
    return `#${h(+m[1])}${h(+m[2])}${h(+m[3])}`;
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// SpotListRow
// ─────────────────────────────────────────────────────────────────────────────

function SpotListRow({
  label,
  kind,
  Icon,
  color,
  isModified,
  isActive,
  onClick,
}: {
  label: string;
  kind: string;
  Icon: typeof Type;
  color: string;
  isModified: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors",
        isActive
          ? "border-amber-300/50 bg-amber-300/[0.08]"
          : "border-white/10 bg-black/30 hover:bg-white/[0.05]",
      ].join(" ")}
    >
      <Icon className={`h-3 w-3 shrink-0 ${color}`} />
      <span className={`text-[10px] font-medium shrink-0 ${color}`}>
        {kind}
      </span>
      <span className="truncate text-[11px] text-white/70 flex-1">{label}</span>
      {isModified && (
        <span className="rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-200 shrink-0">
          modifié
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TextSpotEditor
// ─────────────────────────────────────────────────────────────────────────────

function TextSpotEditor({
  spot,
  value,
  isModified,
  isFocused,
  onChange,
  onReset,
  onFocus,
  onBlur,
  autoFocus,
}: {
  spot: EditableTextSpot;
  value: string;
  isModified: boolean;
  isFocused: boolean;
  onChange: (v: string) => void;
  onReset: () => void;
  onFocus: () => void;
  onBlur: () => void;
  autoFocus?: boolean;
}) {
  const meta = KIND_META[spot.kind];
  const Icon = meta.Icon;
  const isLong = spot.original.length > 80 || spot.kind === "paragraph";

  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => {
      const el = isLong ? textareaRef.current : inputRef.current;
      if (!el) return;
      el.focus();
      try {
        el.select();
      } catch {
        /* ignore */
      }
    }, 50);
    return () => clearTimeout(t);
  }, [autoFocus, spot.id, isLong]);

  return (
    <div
      className={[
        "rounded-lg border transition-all duration-150",
        isFocused
          ? "border-amber-300/60 bg-amber-300/[0.06] shadow-[0_0_0_2px_rgba(252,211,77,0.15)]"
          : isModified
            ? "border-amber-300/30 bg-amber-300/[0.03]"
            : "border-white/10 bg-black/30",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2 px-2 pt-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={`h-3 w-3 shrink-0 ${meta.color}`} />
          <span className={`text-[10px] font-medium ${meta.color}`}>
            {meta.label}
          </span>
          {isModified && (
            <span className="rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-200">
              modifié
            </span>
          )}
          {spot.hasInlineStyles && (
            <span
              title={`Ce texte contient des styles inline (ex : ${spot.styledFragments?.join(", ")}). Si vous modifiez ces mots-clés, leur couleur sera perdue.`}
              className="inline-flex items-center gap-0.5 rounded-full bg-violet-300/15 px-1.5 py-0.5 text-[9px] font-medium text-violet-200"
            >
              <Palette className="h-2.5 w-2.5" />
              stylé
            </span>
          )}
        </div>
        {isModified && (
          <button
            type="button"
            onClick={onReset}
            onMouseDown={(e) => e.preventDefault()}
            className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/80 transition-colors"
            title="Restaurer le texte original"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            Restaurer
          </button>
        )}
      </div>

      <div className="px-2 pb-2 pt-1">
        {isLong ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            rows={Math.min(5, Math.max(2, Math.ceil(value.length / 60)))}
            className="w-full resize-y rounded border border-white/10 bg-black/50 px-2 py-1.5 text-xs text-white outline-none focus:border-amber-300/40"
          />
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            className="w-full rounded border border-white/10 bg-black/50 px-2 py-1.5 text-xs text-white outline-none focus:border-amber-300/40"
          />
        )}
        {spot.hasInlineStyles && spot.styledFragments && isFocused && (
          <div className="mt-1 text-[9px] text-violet-200/70">
            💡 Mots colorés à conserver :{" "}
            {spot.styledFragments.map((f) => `« ${f} »`).join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LinkSpotEditor
// ─────────────────────────────────────────────────────────────────────────────

function LinkSpotEditor({
  spot,
  patch,
  isFocused,
  onChangeField,
  onReset,
  onFocus,
  onBlur,
  autoFocus,
}: {
  spot: EditableLinkSpot;
  patch: { href?: string; label?: string } | undefined;
  isFocused: boolean;
  onChangeField: (field: "href" | "label", v: string) => void;
  onReset: () => void;
  onFocus: () => void;
  onBlur: () => void;
  autoFocus?: boolean;
}) {
  const isModified = patch !== undefined;
  const currentLabel = patch?.label ?? spot.label;
  const currentHref = patch?.href ?? spot.href;

  const labelRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => {
      labelRef.current?.focus();
      try {
        labelRef.current?.select();
      } catch {
        /* ignore */
      }
    }, 50);
    return () => clearTimeout(t);
  }, [autoFocus, spot.id]);

  const Icon = spot.isCta
    ? MousePointerClick
    : spot.isExternal
      ? ExternalLink
      : LinkIcon;
  const badgeLabel = spot.isCta
    ? "CTA"
    : spot.isExternal
      ? "Lien externe"
      : "Lien";
  const badgeColor = spot.isCta
    ? "text-emerald-300"
    : spot.isExternal
      ? "text-sky-300"
      : "text-white/60";

  return (
    <div
      className={[
        "rounded-lg border transition-all duration-150",
        isFocused
          ? "border-emerald-300/60 bg-emerald-300/[0.06] shadow-[0_0_0_2px_rgba(110,231,183,0.15)]"
          : isModified
            ? "border-emerald-300/30 bg-emerald-300/[0.03]"
            : "border-white/10 bg-black/30",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2 px-2 pt-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={`h-3 w-3 shrink-0 ${badgeColor}`} />
          <span className={`text-[10px] font-medium ${badgeColor}`}>
            {badgeLabel}
          </span>
          {isModified && (
            <span className="rounded-full bg-emerald-300/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-200">
              modifié
            </span>
          )}
        </div>
        {isModified && (
          <button
            type="button"
            onClick={onReset}
            onMouseDown={(e) => e.preventDefault()}
            className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/80 transition-colors"
            title="Restaurer le lien original"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            Restaurer
          </button>
        )}
      </div>

      <div className="px-2 pb-2 pt-1 space-y-1.5">
        <div>
          <label className="block text-[9px] uppercase tracking-wide text-white/40 mb-0.5">
            Texte du bouton
          </label>
          <input
            ref={labelRef}
            type="text"
            value={currentLabel}
            onChange={(e) => onChangeField("label", e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            className="w-full rounded border border-white/10 bg-black/50 px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-300/40"
          />
        </div>

        {spot.href !== "" && (
          <div>
            <label className="block text-[9px] uppercase tracking-wide text-white/40 mb-0.5">
              URL de destination
            </label>
            <input
              type="text"
              value={currentHref}
              onChange={(e) => onChangeField("href", e.target.value)}
              onFocus={onFocus}
              onBlur={onBlur}
              placeholder="https://…"
              className="w-full rounded border border-white/10 bg-black/50 px-2 py-1.5 text-[11px] font-mono text-white outline-none focus:border-emerald-300/40"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MediaSpotEditor (image / vidéo / embed) — avec upload local
// ─────────────────────────────────────────────────────────────────────────────

function MediaSpotEditor({
  spot,
  patch,
  isFocused,
  onChangeField,
  onChangeMediaType,
  onReset,
  onFocus,
  onBlur,
  autoFocus,
}: {
  spot: EditableImageSpot;
  patch:
    | { src?: string; alt?: string; mediaType?: "image" | "video" | "embed" }
    | undefined;
  isFocused: boolean;
  onChangeField: (field: "src" | "alt", v: string) => void;
  onChangeMediaType: (mediaType: "image" | "video" | "embed") => void;
  onReset: () => void;
  onFocus: () => void;
  onBlur: () => void;
  autoFocus?: boolean;
}) {
  const isModified = patch !== undefined;
  const currentSrc = patch?.src ?? spot.src;
  const currentAlt = patch?.alt ?? spot.alt ?? "";
  // 🆕 Phase 1B : type effectif = override du patch, sinon type d'origine.
  const mediaType = patch?.mediaType ?? getMediaType(spot);

  const srcRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [uploadState, setUploadState] = useState<{
    status: "idle" | "uploading" | "error";
    progress?: number;
    error?: string;
  }>({ status: "idle" });

  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => {
      srcRef.current?.focus();
      try {
        srcRef.current?.select();
      } catch {
        /* ignore */
      }
    }, 50);
    return () => clearTimeout(t);
  }, [autoFocus, spot.id]);

  async function uploadFile(file: File) {
    setUploadState({ status: "uploading", progress: 0 });
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("spotId", spot.id);

      const m =
        typeof window !== "undefined"
          ? window.location.pathname.match(/\/editor\/([^/?#]+)/)
          : null;
      if (m) fd.append("funnelId", m[1]);

      const url: string = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/media/upload");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadState({
              status: "uploading",
              progress: Math.round((e.loaded / e.total) * 100),
            });
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const json = JSON.parse(xhr.responseText);
              if (json.url) resolve(json.url);
              else reject(new Error(json.error || "Réponse invalide"));
            } catch {
              reject(new Error("Réponse JSON invalide"));
            }
          } else {
            try {
              const json = JSON.parse(xhr.responseText);
              reject(new Error(json.error || `HTTP ${xhr.status}`));
            } catch {
              reject(new Error(`HTTP ${xhr.status}`));
            }
          }
        };
        xhr.onerror = () => reject(new Error("Erreur réseau"));
        xhr.send(fd);
      });

      onChangeField("src", url);
      if (!currentAlt && file.name) {
        const base = file.name.replace(/\.[^.]+$/, "");
        onChangeField("alt", base.replace(/[-_]+/g, " "));
      }
      setUploadState({ status: "idle" });
    } catch (err) {
      console.error("[MediaSpotEditor] upload error:", err);
      setUploadState({
        status: "error",
        error: (err as Error).message || "Échec de l’envoi",
      });
    }
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void uploadFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  const Icon =
    mediaType === "video" ? Film : mediaType === "embed" ? Code2 : ImageIcon;
  const badgeLabel =
    mediaType === "video"
      ? "Vidéo"
      : mediaType === "embed"
        ? "Embed"
        : "Image";
  const badgeColor =
    mediaType === "video"
      ? "text-rose-300"
      : mediaType === "embed"
        ? "text-violet-300"
        : "text-sky-300";

  const isPreviewable =
    mediaType === "image" &&
    currentSrc &&
    /^(https?:|data:image\/|\/)/.test(currentSrc);

  const acceptAttr =
    mediaType === "video"
      ? "video/*"
      : mediaType === "image"
        ? "image/*"
        : "image/*,video/*";

  const isUploading = uploadState.status === "uploading";

  return (
    <div
      className={[
        "rounded-lg border transition-all duration-150",
        isFocused
          ? "border-sky-300/60 bg-sky-300/[0.06] shadow-[0_0_0_2px_rgba(125,211,252,0.15)]"
          : isModified
            ? "border-sky-300/30 bg-sky-300/[0.03]"
            : "border-white/10 bg-black/30",
      ].join(" ")}
      onDragOver={(e) => {
        if (mediaType !== "embed") e.preventDefault();
      }}
      onDrop={(e) => {
        if (mediaType !== "embed") handleDrop(e);
      }}
    >
      <div className="flex items-center justify-between gap-2 px-2 pt-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={`h-3 w-3 shrink-0 ${badgeColor}`} />
          <span className={`text-[10px] font-medium ${badgeColor}`}>
            {badgeLabel}
          </span>
          {isModified && (
            <span className="rounded-full bg-sky-300/15 px-1.5 py-0.5 text-[9px] font-medium text-sky-200">
              modifié
            </span>
          )}
        </div>
        {isModified && (
          <button
            type="button"
            onClick={onReset}
            onMouseDown={(e) => e.preventDefault()}
            className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/80 transition-colors"
            title="Restaurer le média original"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            Restaurer
          </button>
        )}
      </div>

      <div className="px-2 pb-2 pt-1 space-y-1.5">
        {/* 🆕 Phase 1B : type de média — convertit le média (image / vidéo / embed) */}
        <div>
          <label className="block text-[9px] uppercase tracking-wide text-white/40 mb-0.5">
            Type de média
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: "image", label: "Image", Icon: ImageIcon },
                { id: "video", label: "Vidéo", Icon: Film },
                { id: "embed", label: "Embed", Icon: Code2 },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onChangeMediaType(m.id)}
                className={[
                  "flex items-center justify-center gap-1 rounded border px-1.5 py-1.5 text-[10px] transition-colors",
                  mediaType === m.id
                    ? "border-sky-300/50 bg-sky-300/[0.12] text-sky-100"
                    : "border-white/10 bg-black/30 text-white/55 hover:bg-white/[0.05]",
                ].join(" ")}
              >
                <m.Icon className="h-3 w-3" />
                {m.label}
              </button>
            ))}
          </div>
          {mediaType !== getMediaType(spot) && (
            <div className="mt-1 text-[9px] text-amber-200/70">
              Converti depuis «{" "}
              {getMediaType(spot) === "video"
                ? "Vidéo"
                : getMediaType(spot) === "embed"
                  ? "Embed"
                  : "Image"}{" "}
              ». La balise sera remplacée au rendu.
            </div>
          )}
        </div>

        {isPreviewable && (
          <div className="rounded-md border border-white/10 bg-black/40 p-1.5 flex items-center justify-center max-h-32 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentSrc}
              alt={currentAlt}
              className="max-h-28 max-w-full object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}

        {mediaType !== "embed" && (
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 rounded border border-sky-300/30 bg-sky-300/[0.08] px-2 py-1.5 text-[11px] font-medium text-sky-100 hover:bg-sky-300/[0.15] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Importer depuis l’ordinateur ou le téléphone"
              >
                <Upload className="h-3 w-3" />
                Depuis l’appareil
              </button>
              <button
                type="button"
                disabled={isUploading}
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 rounded border border-sky-300/30 bg-sky-300/[0.08] px-2 py-1.5 text-[11px] font-medium text-sky-100 hover:bg-sky-300/[0.15] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Prendre une photo / vidéo (mobile)"
              >
                <Camera className="h-3 w-3" />
                Caméra
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={acceptAttr}
              className="hidden"
              onChange={handleFilePick}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept={acceptAttr}
              capture="environment"
              className="hidden"
              onChange={handleFilePick}
            />

            {isUploading && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-sky-200/80">
                  <span>Envoi en cours…</span>
                  <span>{uploadState.progress ?? 0}%</span>
                </div>
                <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-sky-300/80 transition-all"
                    style={{ width: `${uploadState.progress ?? 0}%` }}
                  />
                </div>
              </div>
            )}

            {uploadState.status === "error" && (
              <div className="rounded border border-rose-400/40 bg-rose-400/10 px-2 py-1 text-[10px] text-rose-200">
                {uploadState.error}
              </div>
            )}

            <div className="text-[9px] text-white/40 text-center">
              ou glissez-déposez un fichier ici
            </div>
          </div>
        )}

        <div>
          <label className="block text-[9px] uppercase tracking-wide text-white/40 mb-0.5">
            {mediaType === "image"
              ? "URL de l’image"
              : mediaType === "video"
                ? "URL de la vidéo"
                : "URL de l’embed"}
          </label>
          <input
            ref={srcRef}
            type="text"
            value={currentSrc}
            onChange={(e) => onChangeField("src", e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder="https://… ou importez un fichier ci-dessus"
            className="w-full rounded border border-white/10 bg-black/50 px-2 py-1.5 text-[11px] font-mono text-white outline-none focus:border-sky-300/40"
          />
        </div>

        {mediaType === "image" && (
          <div>
            <label className="block text-[9px] uppercase tracking-wide text-white/40 mb-0.5">
              Texte alternatif (alt)
            </label>
            <input
              type="text"
              value={currentAlt}
              onChange={(e) => onChangeField("alt", e.target.value)}
              onFocus={onFocus}
              onBlur={onBlur}
              placeholder="Description de l’image…"
              className="w-full rounded border border-white/10 bg-black/50 px-2 py-1.5 text-xs text-white outline-none focus:border-sky-300/40"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────────────────────

function extractRawHtml(body: string | undefined): string | null {
  if (!body) return null;
  if (!body.startsWith(RAW_HTML_BODY_MARKER)) return null;
  return body.slice(RAW_HTML_BODY_MARKER.length);
}

function shortenSrc(src: string): string {
  if (!src) return "";
  if (src.length <= 50) return src;
  try {
    const u = new URL(src, "https://x.x");
    const path = u.pathname.split("/").pop() || src;
    return path.length > 40 ? path.slice(0, 40) + "…" : path;
  } catch {
    return src.slice(0, 40) + "…";
  }
}
