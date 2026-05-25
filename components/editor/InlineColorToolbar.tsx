"use client";

import { useEffect, useRef, useState } from "react";
import { Palette } from "lucide-react";
import type { Funnel, FunnelSection } from "@/lib/funnels/types";

type FieldKey =
  | "headline"
  | "eyebrow"
  | "subheadline"
  | "body"
  | `bullet-${number}`;

type Match = {
  sectionId: string;
  field: FieldKey;
  rawStart: number;
  rawEnd: number;
};

type Props = {
  previewRootRef: React.RefObject<HTMLElement | null>;
  funnel: Funnel;
  updateSection: (sectionId: string, patch: Partial<FunnelSection>) => void;
  defaultColor?: string;
  debug?: boolean;
};

const TEXT_FIELDS: FieldKey[] = ["headline", "eyebrow", "subheadline", "body"];

export function InlineColorToolbar({
  previewRootRef,
  funnel,
  updateSection,
  defaultColor = "#fbbf24",
  debug = false,
}: Props) {
  const [match, setMatch] = useState<Match | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const funnelRef = useRef(funnel);
  funnelRef.current = funnel;

  useEffect(() => {
    const handler = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setMatch(null);
        setPos(null);
        return;
      }
      const range = selection.getRangeAt(0);
      const root = previewRootRef.current;
      if (!root) {
        if (debug) console.log("[ColorToolbar] no root");
        return;
      }
      if (!root.contains(range.commonAncestorContainer)) {
        if (debug) console.log("[ColorToolbar] selection outside preview");
        setMatch(null);
        setPos(null);
        return;
      }

      const selectedText = selection.toString();
      if (!selectedText.trim()) {
        setMatch(null);
        setPos(null);
        return;
      }

      // Trouver la section parente
      let node: Node | null = range.commonAncestorContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
      let sectionEl: HTMLElement | null = null;

      while (node && node !== root) {
        if (node instanceof HTMLElement) {
          if (node.dataset.ffSectionId) {
            sectionEl = node;
            break;
          }
          if (node.id && findSectionById(funnelRef.current, node.id)) {
            sectionEl = node;
            break;
          }
          if (node.dataset.ffSection && node.id) {
            const s = findSectionById(funnelRef.current, node.id);
            if (s) {
              sectionEl = node;
              break;
            }
          }
        }
        node = node.parentNode;
      }

      if (!sectionEl) {
        if (debug) console.log("[ColorToolbar] no section element found");
        setMatch(null);
        setPos(null);
        return;
      }

      const sectionId = sectionEl.dataset.ffSectionId || sectionEl.id || "";
      const section = findSectionById(funnelRef.current, sectionId);
      if (!section) {
        if (debug) console.log("[ColorToolbar] section not found:", sectionId);
        setMatch(null);
        setPos(null);
        return;
      }

      const fieldMatch = findFieldMatch(section, selectedText.trim());
      if (!fieldMatch) {
        if (debug)
          console.log(
            "[ColorToolbar] field not found for:",
            JSON.stringify(selectedText),
            "in section",
            section.id
          );
        setMatch(null);
        setPos(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      setMatch({ sectionId: section.id, ...fieldMatch });
      setPos({
        top: rect.top - rootRect.top - 44,
        left: rect.left - rootRect.left + rect.width / 2 - 55,
      });
      if (debug) console.log("[ColorToolbar] OK", { sectionId, ...fieldMatch });
    };

    document.addEventListener("selectionchange", handler);
    document.addEventListener("mouseup", handler);
    document.addEventListener("keyup", handler);

    return () => {
      document.removeEventListener("selectionchange", handler);
      document.removeEventListener("mouseup", handler);
      document.removeEventListener("keyup", handler);
    };
  }, [previewRootRef, debug]);

  const openPicker = () => colorInputRef.current?.click();

  const applyColor = (color: string) => {
    if (!match) return;
    const section = findSectionById(funnelRef.current, match.sectionId);
    if (!section) return;

    if (match.field.startsWith("bullet-")) {
      const idx = parseInt(match.field.slice(7), 10);
      const bullets = [...(section.bullets || [])];
      const raw = bullets[idx] || "";
      bullets[idx] = wrapRange(raw, match.rawStart, match.rawEnd, color);
      updateSection(section.id, { bullets });
    } else {
      const raw = ((section as any)[match.field] as string) || "";
      const next = wrapRange(raw, match.rawStart, match.rawEnd, color);
      updateSection(section.id, {
        [match.field]: next,
      } as Partial<FunnelSection>);
    }
    setMatch(null);
    setPos(null);
    window.getSelection()?.removeAllRanges();
  };

  if (!match || !pos) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: Math.max(8, pos.top),
        left: Math.max(8, pos.left),
        zIndex: 9999,
      }}
      className="pointer-events-auto flex items-center gap-1 rounded-md border border-white/20 bg-zinc-900 px-2 py-1 shadow-lg"
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        type="button"
        onClick={openPicker}
        className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-500/30"
      >
        <Palette className="h-3 w-3" />
        Colorer
      </button>
      <input
        ref={colorInputRef}
        type="color"
        defaultValue={defaultColor}
        onChange={(e) => applyColor(e.target.value)}
        className="sr-only"
      />
    </div>
  );
}

/* ---------------------- Helpers ---------------------- */

function findSectionById(funnel: Funnel, id: string): FunnelSection | null {
  if (!id) return null;
  for (const page of funnel.pages || []) {
    const s = page.sections.find((sec) => sec.id === id);
    if (s) return s;
  }
  return funnel.sections?.find((s) => s.id === id) || null;
}

function findFieldMatch(
  section: FunnelSection,
  selectedText: string
): Omit<Match, "sectionId"> | null {
  for (const field of TEXT_FIELDS) {
    const raw = (section as any)[field] as string | undefined;
    if (!raw) continue;
    const offsets = locateInRaw(raw, selectedText);
    if (offsets) return { field, ...offsets };
  }
  if (section.bullets) {
    for (let i = 0; i < section.bullets.length; i++) {
      const raw = section.bullets[i];
      if (!raw) continue;
      const offsets = locateInRaw(raw, selectedText);
      if (offsets) return { field: `bullet-${i}` as FieldKey, ...offsets };
    }
  }
  return null;
}

function locateInRaw(
  raw: string,
  selectedText: string
): { rawStart: number; rawEnd: number } | null {
  const map: number[] = [];
  let displayed = "";
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === "[" && raw[i + 1] === "[") {
      const end = raw.indexOf("]]", i + 2);
      if (end !== -1) {
        const inner = raw.slice(i + 2, end);
        const pipeIdx = inner.lastIndexOf("|#");
        const text = pipeIdx >= 0 ? inner.slice(0, pipeIdx) : inner;
        const textStartInRaw = i + 2;
        for (let k = 0; k < text.length; k++) {
          displayed += text[k];
          map.push(textStartInRaw + k);
        }
        i = end + 2;
        continue;
      }
    }
    displayed += raw[i];
    map.push(i);
    i++;
  }

  // Recherche exacte d'abord
  const exactIdx = displayed.indexOf(selectedText);
  if (exactIdx !== -1) {
    return {
      rawStart: map[exactIdx],
      rawEnd: map[exactIdx + selectedText.length - 1] + 1,
    };
  }

  // Fallback : normalisation des espaces
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  const normalizedDisplayed = normalize(displayed);
  const normalizedSelected = normalize(selectedText);
  const idx = normalizedDisplayed.indexOf(normalizedSelected);
  if (idx === -1) return null;

  // Re-mapper l'index normalisé vers displayed
  let counter = -1;
  let displayedIdx = -1;
  for (let k = 0; k < displayed.length; k++) {
    if (/\s/.test(displayed[k]) && k > 0 && /\s/.test(displayed[k - 1])) {
      continue;
    }
    counter++;
    if (counter === idx) {
      displayedIdx = k;
      break;
    }
  }
  if (displayedIdx === -1) return null;

  return {
    rawStart: map[displayedIdx],
    rawEnd: map[displayedIdx + normalizedSelected.length - 1] + 1,
  };
}

function wrapRange(
  raw: string,
  start: number,
  end: number,
  color: string
): string {
  const before = raw.slice(0, start);
  const selected = raw.slice(start, end);
  const after = raw.slice(end);
  const stripped = selected.replace(
    /\[\[([^\]|]+?)(?:\|#[0-9a-fA-F]{3,8})?\]\]/g,
    "$1"
  );
  return `${before}[[${stripped}|${color}]]${after}`;
}
