import { z } from "zod";
import { EMAIL_DOCUMENT_VERSION } from "./types";

const color = z.string().min(1).max(40);
const align = z.enum(["left", "center", "right"]);
const id = z.string().min(1).max(120);

const richText = z.object({
  id,
  type: z.literal("richText"),
  content: z.object({ html: z.string().max(200_000) }),
  style: z.object({
    color,
    fontSize: z.number(),
    lineHeight: z.number(),
    align,
    padding: z.number(),
  }),
});

const heading = z.object({
  id,
  type: z.literal("heading"),
  content: z.object({ text: z.string().max(2_000) }),
  style: z.object({
    color,
    fontSize: z.number(),
    lineHeight: z.number(),
    align,
    padding: z.number(),
  }),
});

const image = z.object({
  id,
  type: z.literal("image"),
  content: z.object({
    src: z.string().max(10_000),
    alt: z.string().max(1_000),
    href: z.string().max(10_000).optional(),
  }),
  style: z.object({ width: z.number(), align, borderRadius: z.number(), padding: z.number() }),
});

const button = z.object({
  id,
  type: z.literal("button"),
  content: z.object({ text: z.string().max(1_000), url: z.string().max(10_000) }),
  style: z.object({
    background: color,
    color,
    align,
    borderRadius: z.number(),
    fontSize: z.number(),
    padding: z.number(),
  }),
});

const divider = z.object({
  id,
  type: z.literal("divider"),
  content: z.object({}),
  style: z.object({ color, thickness: z.number(), width: z.number(), padding: z.number() }),
});

const spacer = z.object({
  id,
  type: z.literal("spacer"),
  content: z.object({}),
  style: z.object({ height: z.number() }),
});

export const emailDocumentSchema = z.object({
  version: z.literal(EMAIL_DOCUMENT_VERSION),
  settings: z.object({
    width: z.number(),
    background: color,
    contentBackground: color,
    fontFamily: z.string().min(1).max(120),
  }),
  blocks: z.array(z.discriminatedUnion("type", [richText, heading, image, button, divider, spacer])).max(100),
  legacy: z
    .object({ originalHtml: z.string().max(500_000), pristine: z.boolean() })
    .optional(),
});
