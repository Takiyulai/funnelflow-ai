// app/api/ai/import-inspiration/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Funnel, FunnelBrief } from "@/lib/funnels/types";
import { importInspirationPrompt } from "@/lib/ai/prompts";
import { createDemoFunnel } from "@/lib/ai/generate";

// ─────────────────────────────────────────────────────────────────────────────
// Schémas
// ─────────────────────────────────────────────────────────────────────────────
const ctaConfigSchema = z.object({
  label: z.string().min(1),
  mode: z.enum(["redirect", "anchor", "popup"]),
  url: z.string().optional(),
  target: z.enum(["_self", "_blank"]).optional(),
  anchorId: z.string().optional(),
  popupId: z.string().optional(),
});

const briefSchema = z.object({
  brandName: z.string().min(1),
  offerName: z.string().min(1),
  price: z.string().min(1),
  targetAudience: z.string().min(1),
  mainPain: z.string().min(1),
  promise: z.string().min(1),
  tone: z.string().min(1),
  funnelType: z.string().min(1),
  designStyle: z.string().min(1),
  language: z.enum(["fr", "en", "es"]),
  primaryCta: ctaConfigSchema.optional(),
  defaultImageMode: z.enum(["none", "upload", "ai-suggested"]).optional(),
});

const inputSchema = z.object({
  url: z.string().url(),
  brief: briefSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de sécurité
// ─────────────────────────────────────────────────────────────────────────────
const MAX_FETCH_BYTES = 1_500_000; // 1.5 MB suffit pour analyser une page
const FETCH_TIMEOUT_MS = 8_000;
const MAX_EXTRACT_CHARS = 12_000; // limite envoyée à l'IA

// Plages d'IP privées / locales que l'on refuse pour éviter le SSRF
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^0\.0\.0\.0$/,
];

function isPublicHttpUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (PRIVATE_HOST_PATTERNS.some((re) => re.test(u.hostname))) return false;
    // 172.16.0.0 - 172.31.255.255
    const m = u.hostname.match(/^172\.(\d+)\./);
    if (m) {
      const second = Number(m[1]);
      if (second >= 16 && second <= 31) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch sécurisé avec timeout et limite de taille
// ─────────────────────────────────────────────────────────────────────────────
async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "FunnelFlowAI/1.0 (+inspiration-bot)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      throw new Error(`Upstream responded ${res.status}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new Error("Unsupported content type");
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    let received = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_FETCH_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }

    const buffer = new Uint8Array(received);
    let offset = 0;
    for (const c of chunks) {
      buffer.set(c, offset);
      offset += c.byteLength;
    }
    return new TextDecoder("utf-8").decode(buffer);
  } finally {
    clearTimeout(timeout);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction structurelle légère, sans dépendance externe
// On capte uniquement la structure et l'intention, pas le contenu de marque
// ─────────────────────────────────────────────────────────────────────────────
type StructuralAnalysis = {
  title: string;
  description: string;
  headings: string[];
  ctas: string[];
  detectedSections: string[];
};

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractMatches(html: string, regex: RegExp, max: number): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null && out.length < max) {
    const text = stripTags(m[1] ?? "");
    if (text && text.length > 2 && text.length < 220) out.push(text);
  }
  return out;
}

function detectSectionsFromHeadings(headings: string[]): string[] {
  const joined = headings.join(" ").toLowerCase();
  const detected: string[] = ["hero"];
  const rules: { keys: string[]; section: string }[] = [
    { keys: ["problem", "problème", "problema", "pain", "douleur", "challenge"], section: "problem" },
    { keys: ["solution", "method", "méthode", "approach", "comment ça marche", "how it works", "cómo funciona"], section: "solution" },
    { keys: ["benefit", "avantage", "beneficio", "value", "valeur"], section: "benefits" },
    { keys: ["testimonial", "témoignage", "testimonio", "review", "avis"], section: "proof" },
    { keys: ["bonus", "extra"], section: "bonus" },
    { keys: ["guarantee", "garantie", "garantía", "refund", "remboursement"], section: "guarantee" },
    { keys: ["price", "prix", "precio", "pricing", "tarif"], section: "pricing" },
    { keys: ["faq", "question"], section: "faq" },
    { keys: ["form", "formulaire", "sign up", "inscription", "register"], section: "form" },
  ];
  for (const r of rules) {
    if (r.keys.some((k) => joined.includes(k))) detected.push(r.section);
  }
  detected.push("cta");
  return Array.from(new Set(detected));
}

function analyzeHtml(html: string): StructuralAnalysis {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch = html.match(
    /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i
  );

  const headings = [
    ...extractMatches(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi, 3),
    ...extractMatches(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi, 12),
    ...extractMatches(html, /<h3[^>]*>([\s\S]*?)<\/h3>/gi, 12),
  ];

  const buttons = extractMatches(html, /<button[^>]*>([\s\S]*?)<\/button>/gi, 8);
  const links = extractMatches(html, /<a[^>]*class=["'][^"']*(btn|button|cta)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi, 8);

  return {
    title: titleMatch ? stripTags(titleMatch[1]).slice(0, 200) : "",
    description: descMatch ? stripTags(descMatch[1]).slice(0, 300) : "",
    headings,
    ctas: [...buttons, ...links].slice(0, 8),
    detectedSections: detectSectionsFromHeadings(headings),
  };
}

function buildExtractedContent(analysis: StructuralAnalysis): string {
  // Contenu envoyé à l'IA : structure + intentions, pas de marque
  const parts: string[] = [];
  if (analysis.title) parts.push(`Page title: ${analysis.title}`);
  if (analysis.description) parts.push(`Meta description: ${analysis.description}`);
  if (analysis.headings.length) {
    parts.push(`Headings detected:\n- ${analysis.headings.join("\n- ")}`);
  }
  if (analysis.ctas.length) {
    parts.push(`CTAs detected:\n- ${analysis.ctas.join("\n- ")}`);
  }
  if (analysis.detectedSections.length) {
    parts.push(`Section pattern detected: ${analysis.detectedSections.join(" -> ")}`);
  }
  return parts.join("\n\n").slice(0, MAX_EXTRACT_CHARS);
}

// ─────────────────────────────────────────────────────────────────────────────
// Génération via OpenAI avec fallback démo
// ─────────────────────────────────────────────────────────────────────────────
async function generateInspiredFunnel(args: {
  brief: FunnelBrief;
  extractedContent: string;
}): Promise<{ funnel: Funnel; fallback: boolean }> {
  if (!process.env.OPENAI_API_KEY) {
    return { funnel: createDemoFunnel(args.brief), fallback: true };
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: importInspirationPrompt(args),
      text: { format: { type: "text" } },
    });

    // Parsing tolérant : on réutilise le parser principal
    const { parseFunnelJson } = await import("@/lib/ai/generate");
    const funnel = parseFunnelJson(response.output_text, args.brief);
    return { funnel, fallback: false };
  } catch (error) {
    console.error("import-inspiration: AI generation failed, using demo fallback", error);
    return { funnel: createDemoFunnel(args.brief), fallback: true };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route POST
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid input",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { url, brief } = parsed.data;

  if (!isPublicHttpUrl(url)) {
    return NextResponse.json(
      { error: "URL not allowed" },
      { status: 400 }
    );
  }

  let html: string;
  try {
    html = await fetchHtml(url);
  } catch (error) {
    console.warn("import-inspiration: fetch failed", error);
    return NextResponse.json(
      { error: "Unable to fetch the source page" },
      { status: 422 }
    );
  }

  const analysis = analyzeHtml(html);
  const extractedContent = buildExtractedContent(analysis);

  const { funnel, fallback } = await generateInspiredFunnel({
    brief,
    extractedContent,
  });

  return NextResponse.json({
    url,
    analysis: {
      detectedSections: analysis.detectedSections,
      headingsCount: analysis.headings.length,
      ctasCount: analysis.ctas.length,
      notice:
        "Analyse structurelle uniquement, aucun texte, image ou élément de marque tiers n'est copié",
    },
    funnel,
    fallback,
  });
}
