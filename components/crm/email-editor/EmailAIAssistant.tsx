"use client";

import { useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import type { EmailBlock } from "@/lib/email-editor/types";
import { sanitizeEmailRichHtml } from "@/lib/email-editor/compiler";

export type AISuggestion = { subject: string; html: string; blockId: string | null };

function selectedText(block: EmailBlock | null): string {
  if (!block) return "";
  if (block.type === "richText") return block.content.html;
  if (block.type === "heading" || block.type === "button") return block.content.text;
  return "";
}

export function EmailAIAssistant({
  selectedBlock,
  funnelId,
  suggestion,
  onSuggestion,
  onApply,
  onClose,
}: {
  selectedBlock: EmailBlock | null;
  funnelId?: string | null;
  suggestion: AISuggestion | null;
  onSuggestion: (suggestion: AISuggestion | null) => void;
  onApply: (suggestion: AISuggestion) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const canRewrite = selectedBlock?.type === "richText" || selectedBlock?.type === "heading" || selectedBlock?.type === "button";

  async function generate(scope: "email" | "block") {
    if (loading) return;
    if (scope === "block" && !canRewrite) return;
    setLoading(true);
    try {
      const instruction = scope === "block"
        ? `Réécris uniquement le bloc suivant selon cette demande : ${prompt || "rends-le plus clair et convaincant"}. Bloc actuel : ${selectedText(selectedBlock)}`
        : prompt || "Génère un email marketing clair, concis et orienté conversion.";
      const response = await fetch("/api/crm/workflow-email/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: instruction, language: "fr", ...(funnelId ? { funnelId } : {}) }),
      });
      const json = (await response.json().catch(() => ({}))) as { ok?: boolean; subject?: string; content?: string; message?: string };
      if (!response.ok || !json.ok || !json.content) throw new Error(json.message || "Génération impossible");
      onSuggestion({ subject: json.subject ?? "", html: json.content, blockId: scope === "block" ? selectedBlock?.id ?? null : null });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Génération impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black text-ink"><Sparkles size={16} className="text-[color:var(--ff-accent)]" /> Assistant IA</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">L’IA propose. Tu décides toujours d’appliquer ou d’annuler.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg border border-line p-1.5 text-muted"><X size={15} /></button>
      </div>
      <textarea className="min-h-28 w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-[color:var(--ff-accent)]" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ex. ton plus direct, email court, CTA vers mon offre…" />
      <div className="grid gap-2">
        <button type="button" onClick={() => void generate("email")} disabled={loading} className="flex items-center justify-center gap-2 rounded-lg bg-[color:var(--ff-accent)] px-3 py-2 text-sm font-bold text-[#080e1a] disabled:opacity-50">{loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Générer un email</button>
        <button type="button" onClick={() => void generate("block")} disabled={loading || !canRewrite} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink disabled:opacity-40">Réécrire le bloc sélectionné</button>
      </div>
      {suggestion && (
        <div className="rounded-xl border border-[color:var(--ff-accent)] bg-[color:var(--ff-accent-soft)] p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Suggestion à vérifier</div>
          {suggestion.subject && <div className="mt-2 text-sm font-bold text-ink">Objet : {suggestion.subject}</div>}
          <div className="mt-2 max-h-56 overflow-auto rounded-lg bg-surface p-3 text-xs text-ink" dangerouslySetInnerHTML={{ __html: sanitizeEmailRichHtml(suggestion.html) }} />
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => onApply(suggestion)} className="rounded-lg bg-[#31845c] px-3 py-2 text-xs font-bold text-white">Appliquer</button>
            <button type="button" onClick={() => onSuggestion(null)} className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-bold text-ink">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
