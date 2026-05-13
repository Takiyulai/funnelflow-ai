"use client";

import { useRef } from "react";
import { Image as ImageIcon, Video, X, Plus, Upload, Link as LinkIcon } from "lucide-react";
import { Field, Input, Textarea, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type {
  Language,
  MediaItem,
  MediaKind,
  FunnelSectionType,
} from "@/lib/funnels/types";
import { makeEmptyMediaItem } from "@/lib/funnels/types";

const MAX_MEDIAS = 5;
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const LABELS = {
  fr: {
    title: "Vos médias",
    intro:
      "Ajoutez jusqu'à 5 visuels ou vidéos. Décrivez chaque média : l'IA les placera automatiquement dans les bonnes sections. Étape optionnelle.",
    addImage: "Ajouter une image",
    addVideo: "Ajouter une vidéo",
    upload: "Téléverser un fichier",
    pasteUrl: "Coller une URL",
    description: "Description (où placer ce média, ce qu'il représente)",
    descriptionPlaceholder:
      "Ex. capture de l'interface du produit, à placer en hero",
    sectionHint: "Section suggérée (optionnel)",
    alt: "Texte alternatif (accessibilité)",
    altPlaceholder: "Ex. capture d'écran du tableau de bord",
    remove: "Retirer",
    counter: (n: number) => `${n} / ${MAX_MEDIAS} média${n > 1 ? "s" : ""}`,
    full: "Limite atteinte : retirez un média pour en ajouter un autre",
    tooBig: "Fichier trop volumineux (max 2 MB)",
    pickFile: "Choisir un fichier...",
    auto: "Placement automatique",
  },
  en: {
    title: "Your media",
    intro:
      "Add up to 5 images or videos. Describe each one: the AI will place them in the right sections. This step is optional.",
    addImage: "Add an image",
    addVideo: "Add a video",
    upload: "Upload a file",
    pasteUrl: "Paste a URL",
    description: "Description (where to use it, what it shows)",
    descriptionPlaceholder: "E.g. product UI screenshot, to use in hero",
    sectionHint: "Suggested section (optional)",
    alt: "Alt text (accessibility)",
    altPlaceholder: "E.g. dashboard screenshot",
    remove: "Remove",
    counter: (n: number) => `${n} / ${MAX_MEDIAS} media`,
    full: "Limit reached: remove one to add another",
    tooBig: "File too large (max 2 MB)",
    pickFile: "Pick a file...",
    auto: "Auto placement",
  },
  es: {
    title: "Tus medios",
    intro:
      "Añade hasta 5 imágenes o vídeos. Describe cada uno: la IA los colocará en las secciones adecuadas. Paso opcional.",
    addImage: "Añadir imagen",
    addVideo: "Añadir vídeo",
    upload: "Subir un archivo",
    pasteUrl: "Pegar una URL",
    description: "Descripción (dónde usarlo, qué muestra)",
    descriptionPlaceholder: "Ej. captura de la interfaz, para el hero",
    sectionHint: "Sección sugerida (opcional)",
    alt: "Texto alternativo (accesibilidad)",
    altPlaceholder: "Ej. captura del panel",
    remove: "Quitar",
    counter: (n: number) => `${n} / ${MAX_MEDIAS} medios`,
    full: "Límite alcanzado: retira uno para añadir otro",
    tooBig: "Archivo demasiado grande (máx 2 MB)",
    pickFile: "Elegir un archivo...",
    auto: "Colocación automática",
  },
} as const;

const SECTION_OPTIONS: { value: FunnelSectionType | ""; label: string }[] = [
  { value: "", label: "—" },
  { value: "hero", label: "Hero" },
  { value: "about", label: "À propos" },
  { value: "problem", label: "Problème" },
  { value: "solution", label: "Solution" },
  { value: "benefits", label: "Bénéfices" },
  { value: "proof", label: "Preuve" },
  { value: "testimonials", label: "Témoignages" },
  { value: "offer", label: "Offre" },
  { value: "bonus", label: "Bonus" },
  { value: "guarantee", label: "Garantie" },
  { value: "pricing", label: "Tarifs" },
  { value: "process", label: "Process" },
  { value: "program", label: "Programme" },
  { value: "video", label: "Vidéo" },
  { value: "faq", label: "FAQ" },
  { value: "cta", label: "CTA" },
];

export function MediasStep({
  language,
  medias,
  onChange,
}: {
  language: Language;
  medias?: MediaItem[];
  onChange: (next: MediaItem[]) => void;
}) {
  const L = LABELS[language] ?? LABELS.fr;
  const list = medias ?? [];
  const full = list.length >= MAX_MEDIAS;

  function addEmpty(kind: MediaKind) {
    if (full) return;
    onChange([...list, makeEmptyMediaItem(kind)]);
  }

  function updateAt(index: number, patch: Partial<MediaItem>) {
    const next = list.map((m, i) => (i === index ? { ...m, ...patch } : m));
    onChange(next);
  }

  function removeAt(index: number) {
    onChange(list.filter((_, i) => i !== index));
  }

  return (
    <div className="grid gap-4">
      <div>
        <div className="flex items-center gap-2.5">
          <ImageIcon className="text-[#31845C]" size={20} />
          <h2 className="text-xl font-black">{L.title}</h2>
        </div>
        <p className="mt-1 text-xs text-muted">{L.intro}</p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg bg-canvas p-2.5">
        <span className="text-xs font-bold text-muted">
          {L.counter(list.length)}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={full}
            onClick={() => addEmpty("image")}
          >
            <Plus size={14} /> {L.addImage}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={full}
            onClick={() => addEmpty("video")}
          >
            <Plus size={14} /> {L.addVideo}
          </Button>
        </div>
      </div>

      {full && (
        <p className="rounded-lg bg-red/5 border border-red/20 p-2.5 text-xs text-red">
          {L.full}
        </p>
      )}

      <div className="grid gap-3">
        {list.map((media, index) => (
          <MediaCard
            key={media.id}
            media={media}
            language={language}
            onUpdate={(patch) => updateAt(index, patch)}
            onRemove={() => removeAt(index)}
          />
        ))}
      </div>

      {list.length === 0 && (
        <div className="rounded-lg border border-dashed border-line bg-canvas p-6 text-center">
          <ImageIcon className="mx-auto text-muted" size={24} />
          <p className="mt-2 text-xs text-muted">
            {L.auto} — aucun média ajouté pour le moment
          </p>
        </div>
      )}
    </div>
  );
}

function MediaCard({
  media,
  language,
  onUpdate,
  onRemove,
}: {
  media: MediaItem;
  language: Language;
  onUpdate: (patch: Partial<MediaItem>) => void;
  onRemove: () => void;
}) {
  const L = LABELS[language] ?? LABELS.fr;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isVideo = media.kind === "video";

  function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      alert(L.tooBig);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      onUpdate({ url: dataUrl, fileName: file.name });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="rounded-lg border border-line bg-white p-3.5 animate-[fadeIn_0.2s_ease-out]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-canvas text-ink">
            {isVideo ? <Video size={14} /> : <ImageIcon size={14} />}
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-muted">
            {isVideo ? "Vidéo" : "Image"}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md p-1.5 text-muted transition hover:bg-red/10 hover:text-red"
          aria-label={L.remove}
        >
          <X size={14} />
        </button>
      </div>

      <div className="mt-3 grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 rounded-md border border-line bg-canvas px-3 py-2 text-xs font-bold text-ink transition hover:border-[#08498D]/40"
          >
            <Upload size={12} /> {L.upload}
          </button>
          <div className="flex items-center gap-1.5 rounded-md border border-line bg-canvas px-2.5 py-1.5">
            <LinkIcon size={12} className="shrink-0 text-muted" />
            <input
              type="url"
              value={media.url.startsWith("data:") ? "" : media.url}
              onChange={(e) => onUpdate({ url: e.target.value, fileName: undefined })}
              placeholder={L.pasteUrl}
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted"
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={isVideo ? "video/*" : "image/*"}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </div>

        {media.url && !isVideo && media.url.startsWith("data:") && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.url}
            alt={media.alt ?? ""}
            className="mt-1 max-h-32 w-auto rounded-md border border-line object-contain"
          />
        )}
        {media.url && !media.url.startsWith("data:") && (
          <p className="truncate text-[11px] text-muted">{media.url}</p>
        )}

        <Field label={L.description}>
          <Textarea
            value={media.description ?? ""}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder={L.descriptionPlaceholder}
            rows={2}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={L.sectionHint}>
            <Select
              value={media.sectionHint ?? ""}
              onChange={(e) =>
                onUpdate({
                  sectionHint: (e.target.value || undefined) as
                    | FunnelSectionType
                    | undefined,
                })
              }
            >
              {SECTION_OPTIONS.map((opt) => (
                <option key={opt.value || "auto"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={L.alt}>
            <Input
              value={media.alt ?? ""}
              onChange={(e) => onUpdate({ alt: e.target.value })}
              placeholder={L.altPlaceholder}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
