"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, Tag as TagIcon } from "lucide-react";
import type { Tag } from "@/lib/crm/types";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
};

/**
 * 🆕 Saisie de tags CRM réutilisable (chips + autocomplétion).
 *
 * - Travaille par NOM de tag (le pipeline de capture crée le tag à la volée).
 * - Propose les tags CRM existants (GET /api/crm/tags).
 * - Crée immédiatement le tag côté CRM quand on en saisit un nouveau
 *   (POST /api/crm/tags) pour qu'il soit dispo dans les segments/campagnes.
 *   En cas d'échec (hors-ligne/non connecté), on garde quand même le nom :
 *   il sera créé à la première soumission de lead.
 */
export function TagsInput({ value, onChange, placeholder }: Props) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/crm/tags")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.ok && Array.isArray(data.tags)) {
          setAllTags(data.tags as Tag[]);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const addTag = async (raw: string) => {
    const name = raw.trim();
    if (!name) return;
    setDraft("");
    const already = value.some((t) => t.toLowerCase() === name.toLowerCase());
    if (already) return;

    // Ajout optimiste du nom dans la sélection.
    onChange([...value, name]);

    // Si le tag n'existe pas encore côté CRM, on le crée (best-effort).
    const known = allTags.some((t) => t.name.toLowerCase() === name.toLowerCase());
    if (!known) {
      try {
        const res = await fetch("/api/crm/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json?.ok && json.tag) {
          setAllTags((cur) =>
            cur.some((t) => t.id === json.tag.id) ? cur : [...cur, json.tag as Tag],
          );
        }
      } catch {
        /* silencieux : le tag sera créé à la soumission du lead */
      }
    }
  };

  const removeTag = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const suggestions = useMemo(() => {
    const selected = new Set(value.map((t) => t.toLowerCase()));
    const q = draft.trim().toLowerCase();
    return allTags
      .filter((t) => !selected.has(t.name.toLowerCase()))
      .filter((t) => (q ? t.name.toLowerCase().includes(q) : true))
      .slice(0, 6);
  }, [allTags, value, draft]);

  const exactExists =
    draft.trim() !== "" &&
    allTags.some((t) => t.name.toLowerCase() === draft.trim().toLowerCase());
  const showDropdown = focused && (suggestions.length > 0 || (draft.trim() !== "" && !exactExists));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      void addTag(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      removeTag(value.length - 1);
    }
  };

  const handleBlur = () => {
    blurTimer.current = setTimeout(() => {
      setFocused(false);
      void addTag(draft);
    }, 120);
  };
  const cancelBlur = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-white/15 bg-zinc-900 px-2 py-2">
        {value.map((tag, idx) => (
          <span
            key={`${tag}-${idx}`}
            className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-200"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(idx)}
              className="text-amber-200/60 hover:text-amber-100"
              aria-label={`Retirer le tag ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          placeholder={
            value.length === 0 ? placeholder ?? "Ex. Lead aimant, Webinaire…" : "Ajouter…"
          }
          className="min-w-[120px] flex-1 bg-transparent px-1 py-0.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
        />

        {draft.trim() !== "" && (
          <button
            type="button"
            onMouseDown={cancelBlur}
            onClick={() => void addTag(draft)}
            className="flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300 hover:bg-amber-500/30"
          >
            <Plus className="h-3 w-3" />
            Ajouter
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-white/15 bg-zinc-900 shadow-xl">
          {suggestions.length > 0 && (
            <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-white/40">
              Tags existants
            </div>
          )}
          {suggestions.map((t) => (
            <button
              key={t.id}
              type="button"
              onMouseDown={cancelBlur}
              onClick={() => {
                void addTag(t.name);
                setFocused(true);
              }}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm text-white/90 hover:bg-white/[0.06]"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: t.color || "#fbbf24" }}
              />
              {t.name}
            </button>
          ))}
          {draft.trim() !== "" && !exactExists && (
            <button
              type="button"
              onMouseDown={cancelBlur}
              onClick={() => {
                void addTag(draft);
                setFocused(true);
              }}
              className="flex w-full items-center gap-2 border-t border-white/10 px-2.5 py-1.5 text-left text-sm text-amber-300 hover:bg-white/[0.06]"
            >
              <Plus className="h-3.5 w-3.5" />
              Créer « {draft.trim()} »
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Petit en-tête réutilisable au-dessus d'un TagsInput. */
export function TagsInputLabel() {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-white/70">
      <TagIcon className="h-3.5 w-3.5 text-amber-300" />
      Tags appliqués
      <span className="ml-1 text-[10px] text-white/40">(CRM, à la soumission)</span>
    </label>
  );
}
