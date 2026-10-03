"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Eye,
  Loader2,
  Menu,
  PanelRight,
  Redo2,
  Save,
  Send,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { compileEmailDocument, sanitizeEmailRichHtml } from "@/lib/email-editor/compiler";
import {
  createEmailBlock,
  createEmailBlockId,
  createEmptyEmailDocument,
  markEmailDocumentEdited,
  normalizeEmailDocument,
} from "@/lib/email-editor/document";
import type {
  EmailBlock,
  EmailBlockType,
  EmailDocument,
  EmailEditorRecord,
} from "@/lib/email-editor/types";
import {
  customFieldsToPersonalization,
  DEFAULT_EMAIL_PERSONALIZATION_FIELDS,
  type EmailPersonalizationField,
} from "@/lib/email-editor/personalization";
import { EmailAIAssistant, type AISuggestion } from "./EmailAIAssistant";
import { EmailBlockSidebar } from "./EmailBlockSidebar";
import { EmailCanvas } from "./EmailCanvas";
import { EmailPreview } from "./EmailPreview";
import { EmailPropertiesPanel } from "./EmailPropertiesPanel";

type SaveState = "saved" | "saving" | "unsaved" | "error";
type MobilePanel = "blocks" | "properties" | "ai" | null;

type Props = {
  kind: "campaign" | "sequence";
  record: EmailEditorRecord;
  saveEndpoint: string;
  testEndpoint: string;
  backHref: string;
  doneHref: string;
  label?: string;
  funnelId?: string | null;
  brandName?: string | null;
  startWithAI?: boolean;
};

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function EmailEditorShell({
  kind,
  record,
  saveEndpoint,
  testEndpoint,
  backHref,
  doneHref,
  label,
  funnelId,
  brandName,
  startWithAI = false,
}: Props) {
  const router = useRouter();
  const initialDocument = useMemo(
    () => normalizeEmailDocument(record.editor_document, record.content),
    [record.editor_document, record.content],
  );
  // L'index et les entrées doivent évoluer dans UNE SEULE mise à jour.
  // Un execCommand peut déclencher `input` de façon synchrone puis notre
  // callback explicite : avec deux useState séparés, l'index avançait deux
  // fois alors qu'une seule entrée était conservée, ce qui rendait le
  // document courant `undefined` et faisait tomber toute la page.
  const [timeline, setTimeline] = useState(() => ({
    entries: [initialDocument],
    index: 0,
  }));
  const history = timeline.entries;
  const historyIndex = timeline.index;
  const document = history[historyIndex] ?? history[history.length - 1] ?? initialDocument;
  const [selectedId, setSelectedId] = useState<string | null>(document.blocks[0]?.id ?? null);
  const [name, setName] = useState(record.name);
  const [subject, setSubject] = useState(record.subject ?? "");
  const [preheader, setPreheader] = useState(record.preheader ?? "");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [preview, setPreview] = useState(false);
  const [aiOpen, setAiOpen] = useState(startWithAI);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [personalizationFields, setPersonalizationFields] = useState<EmailPersonalizationField[]>(
    DEFAULT_EMAIL_PERSONALIZATION_FIELDS,
  );
  const saveInFlight = useRef(false);
  const pendingSave = useRef(false);

  const selectedBlock = document.blocks.find((block) => block.id === selectedId) ?? null;
  const compiledHtml = useMemo(
    () => compileEmailDocument(document, { preheader, brandName }),
    [document, preheader, brandName],
  );

  const markDirty = useCallback(() => setSaveState("unsaved"), []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/crm/custom-fields", { signal: controller.signal })
      .then(async (response) => {
        const json = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          fields?: Array<{ field_key: string; label: string }>;
        };
        if (!response.ok || !json.ok || !Array.isArray(json.fields)) return;
        setPersonalizationFields([
          ...DEFAULT_EMAIL_PERSONALIZATION_FIELDS,
          ...customFieldsToPersonalization(json.fields),
        ]);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.warn("[email-editor] custom fields unavailable", error);
      });
    return () => controller.abort();
  }, []);

  const commitDocument = useCallback(
    (nextDocument: EmailDocument) => {
      const edited = markEmailDocumentEdited(nextDocument);
      setTimeline((current) => {
        const safeIndex = Math.min(
          Math.max(current.index, 0),
          Math.max(current.entries.length - 1, 0),
        );
        const entries = [
          ...current.entries.slice(0, safeIndex + 1),
          edited,
        ].slice(-60);
        return { entries, index: entries.length - 1 };
      });
      markDirty();
    },
    [markDirty],
  );

  const save = useCallback(async () => {
    if (saveInFlight.current) {
      pendingSave.current = true;
      return false;
    }
    saveInFlight.current = true;
    setSaveState("saving");
    try {
      const response = await fetch(saveEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(kind === "campaign" ? { name } : {}),
          subject,
          preheader,
          editor_document: document,
          editor_version: document.version,
          content: compiledHtml,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !json.ok) throw new Error(json.error || "Enregistrement impossible");
      setSaveState("saved");
      return true;
    } catch (error) {
      console.error("[email-editor] save failed", error);
      setSaveState("error");
      return false;
    } finally {
      saveInFlight.current = false;
      if (pendingSave.current) {
        pendingSave.current = false;
        void save();
      }
    }
  }, [compiledHtml, document, kind, name, preheader, saveEndpoint, subject]);

  useEffect(() => {
    if (saveState !== "unsaved") return;
    const timeout = window.setTimeout(() => void save(), 1400);
    return () => window.clearTimeout(timeout);
  }, [saveState, save]);

  function addBlock(type: EmailBlockType) {
    const block = createEmailBlock(type);
    const blocks = [...document.blocks];
    const selectedIndex = selectedId
      ? blocks.findIndex((candidate) => candidate.id === selectedId)
      : -1;
    blocks.splice(selectedIndex >= 0 ? selectedIndex + 1 : blocks.length, 0, block);
    commitDocument({ ...document, blocks });
    setSelectedId(block.id);
    setMobilePanel(type === "spacer" || type === "divider" ? null : "properties");
  }

  function replaceBlock(next: EmailBlock) {
    commitDocument({
      ...document,
      blocks: document.blocks.map((block) => (block.id === next.id ? next : block)),
    });
  }

  function moveBlock(id: string, direction: -1 | 1) {
    const index = document.blocks.findIndex((block) => block.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= document.blocks.length) return;
    const blocks = [...document.blocks];
    [blocks[index], blocks[nextIndex]] = [blocks[nextIndex], blocks[index]];
    commitDocument({ ...document, blocks });
  }

  function duplicateBlock(id: string) {
    const index = document.blocks.findIndex((block) => block.id === id);
    if (index < 0) return;
    const copy = structuredClone(document.blocks[index]) as EmailBlock;
    copy.id = createEmailBlockId();
    const blocks = [...document.blocks];
    blocks.splice(index + 1, 0, copy);
    commitDocument({ ...document, blocks });
    setSelectedId(copy.id);
  }

  function deleteBlock(id: string) {
    const blocks = document.blocks.filter((block) => block.id !== id);
    commitDocument({ ...document, blocks });
    setSelectedId(blocks[0]?.id ?? null);
  }

  function undo() {
    if (historyIndex <= 0) return;
    setTimeline((current) => ({
      ...current,
      index: Math.max(0, current.index - 1),
    }));
    markDirty();
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    setTimeline((current) => ({
      ...current,
      index: Math.min(current.entries.length - 1, current.index + 1),
    }));
    markDirty();
  }

  function applyAISuggestion(suggestion: AISuggestion) {
    if (!suggestion.blockId) {
      const next = createEmptyEmailDocument();
      const html = sanitizeEmailRichHtml(suggestion.html);
      const textBlock = createEmailBlock("richText");
      if (textBlock.type !== "richText") return;
      next.blocks = [
        {
          ...textBlock,
          content: { html },
        },
      ];
      if (suggestion.subject) setSubject(suggestion.subject);
      commitDocument(next);
      setSelectedId(next.blocks[0].id);
    } else {
      const block = document.blocks.find((item) => item.id === suggestion.blockId);
      if (!block) return;
      const html = sanitizeEmailRichHtml(suggestion.html);
      if (block.type === "richText") replaceBlock({ ...block, content: { html } });
      if (block.type === "heading") replaceBlock({ ...block, content: { text: stripHtml(html) } });
      if (block.type === "button") replaceBlock({ ...block, content: { ...block.content, text: stripHtml(html) } });
    }
    setAiSuggestion(null);
  }

  async function sendTest() {
    if (saveState !== "saved") await save();
    const to = window.prompt("Adresse email qui recevra le test :");
    if (!to) return;
    try {
      const response = await fetch(testEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const json = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !json.ok) throw new Error(json.error || "Envoi test impossible");
      alert("Email test envoyé.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Envoi test impossible");
    }
  }

  async function finishEditing() {
    // Si l'auto-save est déjà parti, attendre sa fin évite qu'un clic sur
    // « Terminer » quitte l'écran avant l'écriture ou semble ne rien faire.
    while (saveInFlight.current) {
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    const ok = await save();
    if (ok) router.push(doneHref);
  }

  const status = {
    saved: { label: "Enregistré", icon: Check, className: "text-emerald-600" },
    saving: { label: "Enregistrement…", icon: Loader2, className: "text-amber-600" },
    unsaved: { label: "Modifications non enregistrées", icon: Save, className: "text-amber-600" },
    error: { label: "Échec de sauvegarde", icon: X, className: "text-red-500" },
  }[saveState];
  const StatusIcon = status.icon;

  const rightPanel = aiOpen ? (
    <EmailAIAssistant selectedBlock={selectedBlock} funnelId={funnelId} suggestion={aiSuggestion} onSuggestion={setAiSuggestion} onApply={applyAISuggestion} onClose={() => setAiOpen(false)} />
  ) : (
    <EmailPropertiesPanel
      block={selectedBlock}
      settings={document.settings}
      onBlockChange={replaceBlock}
      onSettingsChange={(settings) => commitDocument({ ...document, settings })}
      personalizationFields={personalizationFields}
    />
  );

  return (
    <div className="fixed inset-0 z-50 flex min-w-0 max-w-[100vw] flex-col overflow-hidden bg-canvas text-ink">
      <header className="flex min-h-16 flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2 sm:px-4">
        <Link href={backHref} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-muted hover:text-ink" aria-label="Retour"><ArrowLeft size={18} /></Link>
        <div className="min-w-0 flex-1 sm:max-w-md">
          {kind === "campaign" ? (
            <input value={name} onChange={(event) => { setName(event.target.value); markDirty(); }} className="w-full border-0 bg-transparent text-sm font-black text-ink outline-none sm:text-base" aria-label="Nom de la campagne" />
          ) : (
            <div className="truncate text-sm font-black text-ink sm:text-base">{label || record.name}</div>
          )}
          <div className={`mt-0.5 flex items-center gap-1 text-[11px] font-semibold ${status.className}`}><StatusIcon size={12} className={saveState === "saving" ? "animate-spin" : ""} /> {status.label}</div>
        </div>
        <div className="order-3 flex w-full items-center gap-1 overflow-x-auto sm:order-none sm:w-auto sm:overflow-visible">
          <button type="button" onClick={undo} disabled={historyIndex <= 0} className="rounded-lg border border-line p-2 text-muted hover:text-ink disabled:opacity-30" aria-label="Annuler"><Undo2 size={16} /></button>
          <button type="button" onClick={redo} disabled={historyIndex >= history.length - 1} className="rounded-lg border border-line p-2 text-muted hover:text-ink disabled:opacity-30" aria-label="Rétablir"><Redo2 size={16} /></button>
          <button type="button" onClick={() => { setAiOpen(true); setMobilePanel("ai"); }} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink hover:border-[color:var(--ff-accent)]"><Sparkles size={15} /> IA</button>
          <button type="button" onClick={() => setPreview(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink"><Eye size={15} /> Aperçu</button>
          <button type="button" onClick={() => void sendTest()} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink"><Send size={15} /> Test</button>
          <Button size="sm" onClick={() => void save()} disabled={saveState === "saving"}><Save size={15} /> Enregistrer</Button>
          <button type="button" onClick={() => void finishEditing()} className="flex shrink-0 items-center gap-1 rounded-lg bg-[color:var(--ff-accent)] px-3 py-2 text-xs font-black text-[#080e1a]">Terminer <ChevronRight size={15} /></button>
        </div>
      </header>

      <div className="grid gap-2 border-b border-line bg-surface px-3 py-2 sm:grid-cols-2 sm:px-4">
        <label className="flex min-w-0 items-center gap-2"><span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-muted">Objet</span><input value={subject} onChange={(event) => { setSubject(event.target.value); markDirty(); }} className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-[color:var(--ff-accent)]" placeholder="Objet de l’email" /></label>
        <label className="flex min-w-0 items-center gap-2"><span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-muted">Préheader</span><input value={preheader} onChange={(event) => { setPreheader(event.target.value); markDirty(); }} className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-[color:var(--ff-accent)]" placeholder="Aperçu dans la boîte de réception" /></label>
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[220px_minmax(0,1fr)_310px]">
        <aside className="hidden min-h-0 overflow-y-auto border-r border-line bg-surface lg:block"><EmailBlockSidebar onAdd={addBlock} /></aside>
        <main className="h-full min-h-0 min-w-0 overflow-hidden"><EmailCanvas document={document} selectedId={selectedId} onSelect={setSelectedId} onMove={moveBlock} onDuplicate={duplicateBlock} onDelete={deleteBlock} /></main>
        <aside className="hidden min-h-0 overflow-y-auto border-l border-line bg-surface lg:block">{rightPanel}</aside>
      </div>

      <div className="fixed inset-x-3 bottom-3 z-30 flex justify-center gap-2 lg:hidden">
        <button type="button" onClick={() => setMobilePanel("blocks")} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-bold text-ink shadow-xl"><Menu size={16} /> Blocs</button>
        <button type="button" onClick={() => setMobilePanel("properties")} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-bold text-ink shadow-xl"><PanelRight size={16} /> Propriétés</button>
        <button type="button" onClick={() => { setAiOpen(true); setMobilePanel("ai"); }} className="grid h-12 w-12 place-items-center rounded-xl bg-[color:var(--ff-accent)] text-[#080e1a] shadow-xl" aria-label="Assistant IA"><Sparkles size={17} /></button>
      </div>

      {mobilePanel && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/45 lg:hidden" onClick={() => setMobilePanel(null)}>
          <div className="max-h-[82dvh] min-w-0 w-full overflow-x-hidden overflow-y-auto rounded-t-2xl bg-surface pb-20" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex justify-end border-b border-line bg-surface p-2"><button type="button" onClick={() => setMobilePanel(null)} className="rounded-lg border border-line p-2 text-muted"><X size={16} /></button></div>
            {mobilePanel === "blocks" ? <EmailBlockSidebar onAdd={addBlock} /> : rightPanel}
          </div>
        </div>
      )}

      {preview && <EmailPreview html={compiledHtml} onClose={() => setPreview(false)} />}
    </div>
  );
}
