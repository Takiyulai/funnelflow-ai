// components/funnel/wizard/VideoStep.tsx
"use client";

import { Field, Input } from "@/components/ui/Field";
import { Play } from "lucide-react";
import type { Language } from "@/lib/funnels/types";
import { tWizard } from "@/lib/i18n/wizard";

type Props = {
  language: Language;
  videoUrl?: string;
  onChange: (videoUrl: string) => void;
};

// Détecte un identifiant YouTube/Vimeo pour générer un aperçu propre
function getEmbedSrc(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    // YouTube
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace("/", "");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    // Vimeo
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return null;
  } catch {
    return null;
  }
}

export function VideoStep({ language, videoUrl, onChange }: Props) {
  const embed = videoUrl ? getEmbedSrc(videoUrl) : null;

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2.5">
        <Play className="text-[#31845C]" size={18} />
        <div>
          <h2 className="text-xl font-black text-ink">
            {tWizard(language, "video.title")}
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {tWizard(language, "video.help")}
          </p>
        </div>
      </div>

      <Field label={tWizard(language, "video.url")}>
        <Input
          type="url"
          value={videoUrl ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
        />
      </Field>

      {embed && (
        <div className="overflow-hidden rounded-lg border border-line">
          <div className="relative aspect-video w-full bg-black">
            <iframe
              src={embed}
              title="Aperçu vidéo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </div>
      )}

      {videoUrl && !embed && (
        <p className="rounded-lg border border-line bg-canvas p-3 text-xs text-muted">
          L'URL n'est pas reconnue comme YouTube ou Vimeo. Le lien sera utilisé tel quel dans la section vidéo
        </p>
      )}
    </div>
  );
}
