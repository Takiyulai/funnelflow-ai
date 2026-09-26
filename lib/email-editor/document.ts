import {
  EMAIL_DOCUMENT_VERSION,
  type EmailBlock,
  type EmailBlockType,
  type EmailDocument,
} from "./types";

export function createEmailBlockId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `block_${crypto.randomUUID()}`;
  }
  return `block_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyEmailDocument(): EmailDocument {
  return {
    version: EMAIL_DOCUMENT_VERSION,
    settings: {
      width: 600,
      background: "#eef0f3",
      contentBackground: "#ffffff",
      fontFamily: "Arial, Helvetica, sans-serif",
    },
    blocks: [],
  };
}

export function createEmailBlock(type: EmailBlockType): EmailBlock {
  const id = createEmailBlockId();
  switch (type) {
    case "heading":
      return {
        id,
        type,
        content: { text: "Votre titre" },
        style: { color: "#080e1a", fontSize: 30, lineHeight: 1.2, align: "left", padding: 24 },
      };
    case "richText":
      return {
        id,
        type,
        content: { html: "<p>Écrivez votre message ici…</p>" },
        style: { color: "#26303f", fontSize: 16, lineHeight: 1.65, align: "left", padding: 24 },
      };
    case "image":
      return {
        id,
        type,
        content: { src: "", alt: "" },
        style: { width: 100, align: "center", borderRadius: 8, padding: 24 },
      };
    case "button":
      return {
        id,
        type,
        content: { text: "Passer à l’action", url: "https://" },
        style: {
          background: "#c7a436",
          color: "#080e1a",
          align: "center",
          borderRadius: 10,
          fontSize: 15,
          padding: 24,
        },
      };
    case "divider":
      return {
        id,
        type,
        content: {},
        style: { color: "#d8dde6", thickness: 1, width: 100, padding: 20 },
      };
    case "spacer":
      return { id, type, content: {}, style: { height: 32 } };
  }
}

function bodyFragment(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match?.[1]?.trim() || html;
}

export function legacyHtmlToDocument(content: string): EmailDocument {
  const doc = createEmptyEmailDocument();
  if (!content.trim()) return doc;
  const textBlock = createEmailBlock("richText");
  if (textBlock.type !== "richText") return doc;
  doc.blocks = [
    {
      ...textBlock,
      content: { html: bodyFragment(content) },
    },
  ];
  doc.legacy = { originalHtml: content, pristine: true };
  return doc;
}

export function normalizeEmailDocument(value: unknown, fallbackHtml = ""): EmailDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return legacyHtmlToDocument(fallbackHtml);
  }
  const candidate = value as Partial<EmailDocument>;
  if (candidate.version !== EMAIL_DOCUMENT_VERSION || !Array.isArray(candidate.blocks)) {
    return legacyHtmlToDocument(fallbackHtml);
  }
  const defaults = createEmptyEmailDocument();
  return {
    ...defaults,
    ...candidate,
    version: EMAIL_DOCUMENT_VERSION,
    settings: { ...defaults.settings, ...(candidate.settings ?? {}) },
    blocks: candidate.blocks.filter(
      (block): block is EmailBlock =>
        Boolean(block && typeof block === "object" && "id" in block && "type" in block),
    ),
  };
}

export function markEmailDocumentEdited(document: EmailDocument): EmailDocument {
  if (!document.legacy?.pristine) return document;
  return { ...document, legacy: { ...document.legacy, pristine: false } };
}
