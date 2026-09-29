"use client";

import { useRef, useState } from "react";
import { Braces, ImagePlus, Loader2 } from "lucide-react";
import { EmailRichEditor } from "@/components/crm/EmailRichEditor";
import type { EmailBlock, EmailDocumentSettings, EmailTextAlign } from "@/lib/email-editor/types";
import type { EmailPersonalizationField } from "@/lib/email-editor/personalization";

const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-[color:var(--ff-accent)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}

function Alignment({ value, onChange }: { value: EmailTextAlign; onChange: (value: EmailTextAlign) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-canvas p-1 sm:grid-cols-4">
      {(["left", "center", "right", "justify"] as const).map((option) => (
        <button key={option} type="button" onClick={() => onChange(option)} className={`rounded-md px-2 py-1.5 text-xs font-semibold ${value === option ? "bg-surface text-ink shadow-sm" : "text-muted"}`}>
          {option === "left"
            ? "Gauche"
            : option === "center"
              ? "Centre"
              : option === "right"
                ? "Droite"
                : "Justifié"}
        </button>
      ))}
    </div>
  );
}

function PersonalizationInsert({
  fields,
  onInsert,
}: {
  fields: EmailPersonalizationField[];
  onInsert: (token: string) => void;
}) {
  return (
    <details className="rounded-lg border border-line bg-canvas">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-bold text-ink">
        <Braces size={15} className="text-[color:var(--ff-accent)]" />
        Variables de substitution
      </summary>
      <div className="grid max-h-52 gap-1 overflow-y-auto border-t border-line p-2">
        {fields.map((field) => (
          <button
            key={`${field.source}-${field.key}`}
            type="button"
            onClick={() => onInsert(field.token)}
            className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-xs text-ink hover:bg-surface"
          >
            <span>{field.label}</span>
            <code className="shrink-0 text-[10px] text-muted">{field.token}</code>
          </button>
        ))}
      </div>
    </details>
  );
}

function appendToken(value: string, token: string): string {
  if (!value) return token;
  return `${value}${/\s$/.test(value) ? "" : " "}${token}`;
}

export function EmailPropertiesPanel({
  block,
  settings,
  onBlockChange,
  onSettingsChange,
  personalizationFields,
}: {
  block: EmailBlock | null;
  settings: EmailDocumentSettings;
  onBlockChange: (block: EmailBlock) => void;
  onSettingsChange: (settings: EmailDocumentSettings) => void;
  personalizationFields: EmailPersonalizationField[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function uploadImage(file: File | null) {
    if (!file || !block || block.type !== "image") return;
    if (!file.type.startsWith("image/")) {
      alert("Merci de choisir une image.");
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("spotId", "email-editor-block");
      body.append("funnelId", "crm-email");
      const response = await fetch("/api/media/upload", { method: "POST", body });
      const json = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!response.ok || !json.url) throw new Error(json.error || "Upload impossible");
      onBlockChange({ ...block, content: { ...block.content, src: json.url } });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Upload impossible");
    } finally {
      setUploading(false);
    }
  }

  if (!block) {
    return (
      <div className="grid gap-4 p-4">
        <div>
          <h2 className="text-sm font-black text-ink">Style global</h2>
          <p className="mt-1 text-xs text-muted">Clique sur un bloc pour modifier ses propriétés.</p>
        </div>
        <Field label="Largeur de l’email">
          <input type="number" min={320} max={760} className={inputClass} value={settings.width} onChange={(event) => onSettingsChange({ ...settings, width: Number(event.target.value) || 600 })} />
        </Field>
        <Field label="Arrière-plan extérieur">
          <input type="color" className={`${inputClass} h-10 p-1`} value={settings.background} onChange={(event) => onSettingsChange({ ...settings, background: event.target.value })} />
        </Field>
        <Field label="Fond du contenu">
          <input type="color" className={`${inputClass} h-10 p-1`} value={settings.contentBackground} onChange={(event) => onSettingsChange({ ...settings, contentBackground: event.target.value })} />
        </Field>
        <Field label="Typographie">
          <select className={inputClass} value={settings.fontFamily} onChange={(event) => onSettingsChange({ ...settings, fontFamily: event.target.value })}>
            <option value="Arial, Helvetica, sans-serif">Arial</option>
            <option value="Georgia, Times, serif">Georgia</option>
            <option value="Verdana, Geneva, sans-serif">Verdana</option>
            <option value="Tahoma, Geneva, sans-serif">Tahoma</option>
          </select>
        </Field>
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-4">
      <div>
        <h2 className="text-sm font-black capitalize text-ink">Bloc {block.type === "richText" ? "texte" : block.type}</h2>
        <p className="mt-1 text-xs text-muted">Les changements sont visibles immédiatement dans le canvas.</p>
      </div>

      {block.type === "richText" && (
        <>
          <EmailRichEditor
            value={block.content.html}
            onChange={(html) => onBlockChange({ ...block, content: { html } })}
            placeholder="Contenu du texte…"
            personalizationFields={personalizationFields}
          />
          <Field label="Taille"><input type="number" min={10} max={36} className={inputClass} value={block.style.fontSize} onChange={(event) => onBlockChange({ ...block, style: { ...block.style, fontSize: Number(event.target.value) || 16 } })} /></Field>
          <Field label="Couleur"><input type="color" className={`${inputClass} h-10 p-1`} value={block.style.color} onChange={(event) => onBlockChange({ ...block, style: { ...block.style, color: event.target.value } })} /></Field>
          <Alignment value={block.style.align} onChange={(value) => onBlockChange({ ...block, style: { ...block.style, align: value } })} />
        </>
      )}

      {block.type === "heading" && (
        <>
          <Field label="Titre"><textarea className={`${inputClass} min-h-24 resize-y`} value={block.content.text} onChange={(event) => onBlockChange({ ...block, content: { text: event.target.value } })} /></Field>
          <PersonalizationInsert fields={personalizationFields} onInsert={(token) => onBlockChange({ ...block, content: { text: appendToken(block.content.text, token) } })} />
          <Field label="Taille"><input type="number" min={14} max={64} className={inputClass} value={block.style.fontSize} onChange={(event) => onBlockChange({ ...block, style: { ...block.style, fontSize: Number(event.target.value) || 30 } })} /></Field>
          <Field label="Couleur"><input type="color" className={`${inputClass} h-10 p-1`} value={block.style.color} onChange={(event) => onBlockChange({ ...block, style: { ...block.style, color: event.target.value } })} /></Field>
          <Alignment value={block.style.align} onChange={(value) => onBlockChange({ ...block, style: { ...block.style, align: value } })} />
        </>
      )}

      {block.type === "image" && (
        <>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => void uploadImage(event.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink hover:border-[color:var(--ff-accent)]">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
            {uploading ? "Import…" : "Importer une image"}
          </button>
          <Field label="URL de l’image"><input className={inputClass} value={block.content.src} onChange={(event) => onBlockChange({ ...block, content: { ...block.content, src: event.target.value } })} /></Field>
          <Field label="Texte alternatif"><input className={inputClass} value={block.content.alt} onChange={(event) => onBlockChange({ ...block, content: { ...block.content, alt: event.target.value } })} /></Field>
          <Field label="Lien (optionnel)"><input className={inputClass} value={block.content.href ?? ""} onChange={(event) => onBlockChange({ ...block, content: { ...block.content, href: event.target.value } })} /></Field>
          <Field label={`Largeur · ${block.style.width} %`}><input type="range" min={10} max={100} value={block.style.width} onChange={(event) => onBlockChange({ ...block, style: { ...block.style, width: Number(event.target.value) } })} /></Field>
          <Field label="Arrondi"><input type="number" min={0} max={80} className={inputClass} value={block.style.borderRadius} onChange={(event) => onBlockChange({ ...block, style: { ...block.style, borderRadius: Number(event.target.value) || 0 } })} /></Field>
          <Alignment value={block.style.align} onChange={(value) => onBlockChange({ ...block, style: { ...block.style, align: value } })} />
        </>
      )}

      {block.type === "button" && (
        <>
          <Field label="Texte"><input className={inputClass} value={block.content.text} onChange={(event) => onBlockChange({ ...block, content: { ...block.content, text: event.target.value } })} /></Field>
          <PersonalizationInsert fields={personalizationFields} onInsert={(token) => onBlockChange({ ...block, content: { ...block.content, text: appendToken(block.content.text, token) } })} />
          <Field label="Lien"><input className={inputClass} value={block.content.url} onChange={(event) => onBlockChange({ ...block, content: { ...block.content, url: event.target.value } })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fond"><input type="color" className={`${inputClass} h-10 p-1`} value={block.style.background} onChange={(event) => onBlockChange({ ...block, style: { ...block.style, background: event.target.value } })} /></Field>
            <Field label="Texte"><input type="color" className={`${inputClass} h-10 p-1`} value={block.style.color} onChange={(event) => onBlockChange({ ...block, style: { ...block.style, color: event.target.value } })} /></Field>
          </div>
          <Field label="Arrondi"><input type="number" min={0} max={40} className={inputClass} value={block.style.borderRadius} onChange={(event) => onBlockChange({ ...block, style: { ...block.style, borderRadius: Number(event.target.value) || 0 } })} /></Field>
          <Alignment value={block.style.align} onChange={(value) => onBlockChange({ ...block, style: { ...block.style, align: value } })} />
        </>
      )}

      {block.type === "divider" && (
        <>
          <Field label="Couleur"><input type="color" className={`${inputClass} h-10 p-1`} value={block.style.color} onChange={(event) => onBlockChange({ ...block, style: { ...block.style, color: event.target.value } })} /></Field>
          <Field label="Épaisseur"><input type="number" min={1} max={8} className={inputClass} value={block.style.thickness} onChange={(event) => onBlockChange({ ...block, style: { ...block.style, thickness: Number(event.target.value) || 1 } })} /></Field>
          <Field label={`Largeur · ${block.style.width} %`}><input type="range" min={10} max={100} value={block.style.width} onChange={(event) => onBlockChange({ ...block, style: { ...block.style, width: Number(event.target.value) } })} /></Field>
        </>
      )}

      {block.type === "spacer" && (
        <Field label={`Hauteur · ${block.style.height} px`}><input type="range" min={4} max={160} value={block.style.height} onChange={(event) => onBlockChange({ ...block, style: { height: Number(event.target.value) } })} /></Field>
      )}
    </div>
  );
}
