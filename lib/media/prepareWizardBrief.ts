"use client";

import type { FunnelBrief, MediaItem } from "@/lib/funnels/types";

const INLINE_MEDIA_PREFIX = "data:";
const WIZARD_UPLOAD_CONTEXT = "wizard-draft";

type UploadResponse = {
  url?: string;
};

export class WizardMediaUploadError extends Error {
  constructor() {
    super("wizard-media-upload-failed");
    this.name = "WizardMediaUploadError";
  }
}

function isInlineMedia(value: string | undefined): value is string {
  return typeof value === "string" && value.startsWith(INLINE_MEDIA_PREFIX);
}

function extensionForMime(mime: string): string {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "image/avif": "avif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  return extensions[mime] ?? "bin";
}

function fileFromDataUrl(dataUrl: string, requestedName?: string): File {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) throw new WizardMediaUploadError();

  const metadata = dataUrl.slice(5, commaIndex);
  const encoded = dataUrl.slice(commaIndex + 1);
  const mime = metadata.split(";")[0] || "application/octet-stream";
  const isBase64 = metadata.split(";").includes("base64");

  try {
    const bytes = isBase64
      ? Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))
      : new TextEncoder().encode(decodeURIComponent(encoded));
    const filename = requestedName?.trim() || `media.${extensionForMime(mime)}`;
    return new File([bytes], filename, { type: mime });
  } catch {
    throw new WizardMediaUploadError();
  }
}

async function uploadInlineMedia(
  dataUrl: string,
  spotId: string,
  filename?: string,
): Promise<string> {
  const form = new FormData();
  form.append("file", fileFromDataUrl(dataUrl, filename));
  form.append("funnelId", WIZARD_UPLOAD_CONTEXT);
  form.append("spotId", spotId);

  try {
    const response = await fetch("/api/media/upload", {
      method: "POST",
      body: form,
    });
    const payload = (await response.json().catch(() => ({}))) as UploadResponse;
    if (!response.ok || typeof payload.url !== "string" || !payload.url) {
      throw new WizardMediaUploadError();
    }
    return payload.url;
  } catch (error) {
    if (error instanceof WizardMediaUploadError) throw error;
    throw new WizardMediaUploadError();
  }
}

async function prepareMediaItem(media: MediaItem): Promise<MediaItem> {
  if (!isInlineMedia(media.url)) return media;
  const url = await uploadInlineMedia(
    media.url,
    `brief-media-${media.id}`,
    media.fileName,
  );
  return { ...media, url };
}

/**
 * Remplace les data-URL du wizard par des URL durables avant l'appel IA.
 *
 * Les fichiers sont envoyés un par un : le brief JSON et la réponse du tunnel
 * restent ainsi largement sous la limite de taille des fonctions Vercel.
 */
export async function prepareWizardBriefForGeneration(
  brief: FunnelBrief,
): Promise<FunnelBrief> {
  const inlineLogo = isInlineMedia(brief.logoUrl) ? brief.logoUrl : undefined;
  const hasInlineLogo = inlineLogo !== undefined;
  const hasInlineMedias = brief.medias?.some((media) => isInlineMedia(media.url)) === true;
  if (!hasInlineLogo && !hasInlineMedias) return brief;

  const [logoUrl, medias] = await Promise.all([
    inlineLogo
      ? uploadInlineMedia(inlineLogo, "brief-logo")
      : Promise.resolve(brief.logoUrl),
    Promise.all((brief.medias ?? []).map(prepareMediaItem)),
  ]);

  return {
    ...brief,
    logoUrl,
    medias,
  };
}
