"use client";

import { useRef } from "react";
import * as LucideIcons from "lucide-react";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type {
  Language,
  MediaItem,
  MediaKind,
  FunnelSectionType,
} from "@/lib/funnels/types";
import { makeEmptyMediaItem } from "@/lib/funnels/types";

// Aliases locaux — évite tout conflit avec le barrel optimizer de Next.js
const ImageIcon = LucideIcons.Image;
const Video = LucideIcons.Video;
const X = LucideIcons.X;
const Plus = LucideIcons.Plus;
const Upload = LucideIcons.Upload;
const LinkIcon = LucideIcons.Link;
const CheckCircle2 = LucideIcons.CheckCircle2;
const Info = LucideIcons.Info;

const MAX_MEDIAS = 5;
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

// ─────────────────────────────────────────────────────────────────────────────
// LABELS multilingues
// ─────────────────────────────────────────────────────────────────────────────

type Lang = Language;

const LABELS: Record<
  Lang,
  {
    title: string;
    intro: string;
    counter: (n: number) => string;
    addImage: string;
    addVideo: string;
    full: string;
    auto: string;
    upload: string;
    pasteUrl: string;
    description: string;
    descriptionPlaceholder: string;
    alt: string;
    altPlaceholder: string;
    sectionHintLabel: string;
    sectionHintHelper: string;
    placementGuaranteed: string;
    placementAuto: string;
    remove: string;
    tooBig: string;
    tipTitle: string;
    tipBody: string;
  }
> = {
  fr: {
    title: "Médias",
    intro:
      "Ajoutez jusqu'à 5 médias (images, vidéos). L'IA les placera dans les bonnes sections.",
    counter: (n) => `${n} / ${MAX_MEDIAS} médias`,
    addImage: "Ajouter une image",
    addVideo: "Ajouter une vidéo",
    full: "Vous avez atteint la limite de 5 médias.",
    auto: "Placement automatique",
    upload: "Téléverser",
    pasteUrl: "Coller une URL…",
    description: "Description",
    descriptionPlaceholder:
      "Ex. : Photo du coach Jean Dupont, capture d'écran du témoignage de Marie...",
    alt: "Texte alternatif (SEO/accessibilité)",
    altPlaceholder: "Décrivez l'image en quelques mots",
    sectionHintLabel: "À placer dans la section (recommandé)",
    sectionHintHelper:
      "Indiquez où ce média doit apparaître. Sans cette info, l'IA déduit depuis la description — mais le placement n'est pas garanti.",
    placementGuaranteed: "Placement garanti",
    placementAuto: "Placement automatique (basé sur la description)",
    remove: "Supprimer",
    tooBig: "Fichier trop volumineux (max 2 Mo).",
    tipTitle: "Astuce — pour un placement garanti",
    tipBody:
      "Choisissez la section cible pour chaque média. Sinon, l'IA déduit depuis la description — le résultat peut varier.",
  },
  en: {
    title: "Media",
    intro:
      "Add up to 5 medias (images, videos). The AI will place them in the right sections.",
    counter: (n) => `${n} / ${MAX_MEDIAS} medias`,
    addImage: "Add an image",
    addVideo: "Add a video",
    full: "You reached the limit of 5 medias.",
    auto: "Auto placement",
    upload: "Upload",
    pasteUrl: "Paste a URL…",
    description: "Description",
    descriptionPlaceholder:
      "E.g.: Coach John Doe's photo, screenshot of Marie's testimonial...",
    alt: "Alt text (SEO/accessibility)",
    altPlaceholder: "Describe the image in a few words",
    sectionHintLabel: "Place in section (recommended)",
    sectionHintHelper:
      "Tell us where this media should appear. Without this, the AI guesses from the description — placement not guaranteed.",
    placementGuaranteed: "Placement guaranteed",
    placementAuto: "Auto placement (based on description)",
    remove: "Remove",
    tooBig: "File too large (max 2 MB).",
    tipTitle: "Tip — for guaranteed placement",
    tipBody:
      "Choose the target section for each media. Otherwise, the AI will guess from the description — results may vary.",
  },
  es: {
    title: "Medios",
    intro:
      "Añade hasta 5 medios (imágenes, vídeos). La IA los colocará en las secciones correctas.",
    counter: (n) => `${n} / ${MAX_MEDIAS} medios`,
    addImage: "Añadir imagen",
    addVideo: "Añadir vídeo",
    full: "Has alcanzado el límite de 5 medios.",
    auto: "Colocación automática",
    upload: "Subir",
    pasteUrl: "Pegar una URL…",
    description: "Descripción",
    descriptionPlaceholder:
      "Ej.: Foto del coach, captura del testimonio de María...",
    alt: "Texto alternativo (SEO/accesibilidad)",
    altPlaceholder: "Describe la imagen en pocas palabras",
    sectionHintLabel: "Colocar en la sección (recomendado)",
    sectionHintHelper:
      "Indique dónde debe aparecer este media. Sin esta información, la IA adivina desde la descripción.",
    placementGuaranteed: "Colocación garantizada",
    placementAuto: "Colocación automática (basada en descripción)",
    remove: "Eliminar",
    tooBig: "Archivo demasiado grande (máx 2 MB).",
    tipTitle: "Consejo — para una colocación garantizada",
    tipBody:
      "Elija la sección destino para cada media. De lo contrario, la IA adivinará desde la descripción.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Options du sélecteur de section
// ─────────────────────────────────────────────────────────────────────────────

type SectionHintOption = {
  value: "" | FunnelSectionType;
  label: Record<Lang, string>;
  hint?: Record<Lang, string>;
};

const SECTION_HINT_OPTIONS: SectionHintOption[] = [
  {
    value: "",
    label: {
      fr: "Laisser l'IA décider (auto-détection)",
      en: "Let AI decide (auto-detect)",
      es: "Dejar que la IA decida (auto-detección)",
    },
    hint: {
      fr: "Le système détectera la section depuis votre description.",
      en: "The system will detect the section from your description.",
      es: "El sistema detectará la sección desde su descripción.",
    },
  },
  {
    value: "hero",
    label: {
      fr: "Hero (en-tête de page)",
      en: "Hero (page header)",
      es: "Hero (encabezado)",
    },
    hint: {
      fr: "⚠️ Un seul média autorisé dans le hero.",
      en: "⚠️ Only one media allowed in the hero.",
      es: "⚠️ Solo un media permitido en el hero.",
    },
  },
  {
    value: "about",
    label: {
      fr: "À propos / Coach / Fondateur",
      en: "About / Coach / Founder",
      es: "Sobre mí / Coach / Fundador",
    },
    hint: {
      fr: "Idéal pour une photo de vous, votre équipe.",
      en: "Ideal for your photo, your team.",
      es: "Ideal para su foto, su equipo.",
    },
  },
  {
    value: "testimonials",
    label: {
      fr: "Témoignages / Avis clients",
      en: "Testimonials / Reviews",
      es: "Testimonios / Reseñas",
    },
    hint: {
      fr: "Capture d'écran d'avis, photo de client.",
      en: "Review screenshot, customer photo.",
      es: "Captura de reseña, foto de cliente.",
    },
  },
  {
    value: "video",
    label: {
      fr: "Vidéo de présentation / Démo",
      en: "Presentation video / Demo",
      es: "Vídeo de presentación / Demo",
    },
    hint: {
      fr: "VSL, démo produit, extrait de webinaire.",
      en: "VSL, product demo, webinar excerpt.",
      es: "VSL, demo de producto, extracto de webinar.",
    },
  },
  {
    value: "pricing",
    label: {
      fr: "Produit / Offre (mockup, couverture)",
      en: "Product / Offer (mockup, cover)",
      es: "Producto / Oferta (mockup, portada)",
    },
  },
  {
    value: "bonus",
    label: {
      fr: "Bonus inclus",
      en: "Included bonus",
      es: "Bonus incluido",
    },
  },
  {
    value: "proof",
    label: {
      fr: "Preuves / Résultats chiffrés",
      en: "Proof / Numbered results",
      es: "Prueba / Resultados numéricos",
    },
    hint: {
      fr: "Screenshots de résultats, graphiques, dashboards.",
      en: "Result screenshots, charts, dashboards.",
      es: "Capturas de resultados, gráficos.",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

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

      {/* Bandeau d'aide */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">{L.tipTitle}</p>
            <p className="text-blue-800">{L.tipBody}</p>
          </div>
        </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// Carte média individuelle
// ─────────────────────────────────────────────────────────────────────────────

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

  const selectedOption = SECTION_HINT_OPTIONS.find(
    (o) => o.value === (media.sectionHint ?? ""),
  );

  return (
    <div className="rounded-lg border border-line bg-white p-3.5 animate-[fadeIn_0.2s_ease-out]">
      {/* Header */}
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
        {/* Upload + URL */}
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
              onChange={(e) =>
                onUpdate({ url: e.target.value, fileName: undefined })
              }
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

        {/* Preview image */}
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

        {/* Description */}
        <Field label={L.description}>
          <Textarea
            value={media.description ?? ""}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder={L.descriptionPlaceholder}
            rows={2}
          />
        </Field>

        {/* Sélecteur de section cible */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {L.sectionHintLabel}
          </label>
          <select
            value={media.sectionHint ?? ""}
            onChange={(e) =>
              onUpdate({
                sectionHint:
                  (e.target.value || undefined) as
                    | FunnelSectionType
                    | undefined,
              })
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none bg-white"
          >
            {SECTION_HINT_OPTIONS.map((opt) => (
              <option key={opt.value || "auto"} value={opt.value}>
                {opt.label[language] ?? opt.label.fr}
              </option>
            ))}
          </select>

          {/* Helper contextuel */}
          {selectedOption?.hint ? (
            <p className="mt-1 text-xs text-gray-500 flex items-start gap-1">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                {selectedOption.hint[language] ?? selectedOption.hint.fr}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-xs text-gray-500">{L.sectionHintHelper}</p>
          )}

          {/* Badge de statut */}
          <div className="mt-2">
            {media.sectionHint ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {L.placementGuaranteed}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <Info className="w-3.5 h-3.5" />
                {L.placementAuto}
              </span>
            )}
          </div>
        </div>

        {/* Alt text */}
        <Field label={L.alt}>
          <Input
            value={media.alt ?? ""}
            onChange={(e) => onUpdate({ alt: e.target.value })}
            placeholder={L.altPlaceholder}
          />
        </Field>
      </div>
    </div>
  );
}
