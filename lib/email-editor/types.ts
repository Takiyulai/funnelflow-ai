export const EMAIL_DOCUMENT_VERSION = 1 as const;

export type EmailTextAlign = "left" | "center" | "right" | "justify";

export type EmailDocumentSettings = {
  width: number;
  background: string;
  contentBackground: string;
  fontFamily: string;
};

type BlockBase<T extends string, C, S> = {
  id: string;
  type: T;
  content: C;
  style: S;
};

export type RichTextBlock = BlockBase<
  "richText",
  { html: string },
  { color: string; fontSize: number; lineHeight: number; align: EmailTextAlign; padding: number }
>;

export type HeadingBlock = BlockBase<
  "heading",
  { text: string },
  {
    color: string;
    fontSize: number;
    lineHeight: number;
    align: EmailTextAlign;
    padding: number;
  }
>;

export type ImageBlock = BlockBase<
  "image",
  { src: string; alt: string; href?: string },
  { width: number; align: EmailTextAlign; borderRadius: number; padding: number }
>;

export type ButtonBlock = BlockBase<
  "button",
  { text: string; url: string },
  {
    background: string;
    color: string;
    align: EmailTextAlign;
    borderRadius: number;
    fontSize: number;
    padding: number;
  }
>;

export type DividerBlock = BlockBase<
  "divider",
  Record<string, never>,
  { color: string; thickness: number; width: number; padding: number }
>;

export type SpacerBlock = BlockBase<
  "spacer",
  Record<string, never>,
  { height: number }
>;

export type EmailBlock =
  | RichTextBlock
  | HeadingBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | SpacerBlock;

export type EmailDocument = {
  version: typeof EMAIL_DOCUMENT_VERSION;
  settings: EmailDocumentSettings;
  blocks: EmailBlock[];
  /**
   * Filet de sécurité des emails historiques. Tant que `pristine` vaut true,
   * le compilateur restitue strictement le HTML d'origine. La première vraie
   * modification de bloc fait basculer le document vers le rendu structuré.
   */
  legacy?: { originalHtml: string; pristine: boolean };
};

export type EmailEditorRecord = {
  id: string;
  name: string;
  subject: string;
  preheader?: string | null;
  content: string;
  editor_document?: EmailDocument | null;
  editor_version?: number | null;
};

export type EmailBlockType = EmailBlock["type"];
