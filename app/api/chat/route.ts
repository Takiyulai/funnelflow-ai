// app/api/chat/route.ts
//
// 🆕 CHATBOT IA — Route serveur du widget de support.
//
// Reçoit { message, history }, injecte la base de connaissances dans un system
// prompt, appelle OpenRouter EN MODÈLES GRATUITS UNIQUEMENT via la clé DÉDIÉE
// `OPENROUTER_CHATBOT_API_KEY`, avec fallback entre plusieurs modèles `:free`.
//
// ⚠️ ISOLATION STRICTE : ce module NE lit ni n'utilise JAMAIS `OPENROUTER_API_KEY`
// (réservée à la génération payante ailleurs). Coût zéro garanti côté modèles.

import { NextResponse } from "next/server";
import { loadKnowledgeBase } from "@/lib/chatbot/knowledge";
import { buildSystemPrompt } from "@/lib/chatbot/prompt";
import { checkRateLimit, getClientIp } from "@/lib/chatbot/rateLimit";
import {
  OPENROUTER_BASE_URL,
  OPENROUTER_HEADERS,
  resolveFreeModels,
  REQUEST_TIMEOUT_MS,
  GENERATION,
  INPUT_LIMITS,
  FALLBACK_USER_MESSAGE,
} from "@/lib/chatbot/config";

// fs (loadKnowledgeBase) → runtime Node obligatoire. Jamais mis en cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatRole = "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };

/** Nettoie l'historique reçu du client (types, rôles, longueur, quantité). */
function sanitizeHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const trimmed = content.trim().slice(0, INPUT_LIMITS.maxMessageLength);
    if (trimmed) out.push({ role, content: trimmed });
  }
  // On ne garde que les N derniers échanges (les plus récents).
  return out.slice(-INPUT_LIMITS.maxHistoryMessages);
}

// Client OpenAI-compatible (SDK `openai`) pointé sur OpenRouter. Type minimal
// pour éviter d'importer les types du SDK (chargé dynamiquement).
type ChatClient = {
  chat: {
    completions: {
      create: (args: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        temperature?: number;
        max_tokens?: number;
        stream?: boolean;
      }) => Promise<{ choices?: Array<{ message?: { content?: string } }> }>;
    };
  };
};

/**
 * Un seul appel modèle via le SDK OpenAI (base URL OpenRouter). Réponse
 * NON-STREAMÉE, PAS de mode reasoning (réponses directes pour du support FAQ).
 * Renvoie le texte de réponse, ou `null` si l'appel échoue (402/429/5xx/timeout)
 * → l'appelant tente alors le modèle GRATUIT suivant.
 */
async function callModel(
  client: ChatClient,
  model: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string | null> {
  try {
    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature: GENERATION.temperature,
      max_tokens: GENERATION.maxTokens,
      stream: false,
    });
    const reply = completion?.choices?.[0]?.message?.content?.trim();
    if (reply) return reply;
    console.warn(`[api/chat] réponse vide du modèle ${model}`);
    return null;
  } catch (e) {
    // Le SDK expose le code HTTP via `.status`. 402 (crédit) / 429 (rate limit)
    // / 5xx / timeout → on passe au modèle GRATUIT suivant (jamais de payant).
    const status = (e as { status?: number })?.status;
    const reason = e instanceof Error ? e.name : "unknown";
    console.warn(`[api/chat] appel ${model} échoué (status=${status ?? "?"}, ${reason})`);
    return null;
  }
}

export async function POST(request: Request) {
  // 1) Rate limit par IP (protège le quota OpenRouter).
  const ip = getClientIp(request.headers);
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", reply: FALLBACK_USER_MESSAGE },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  // 2) Validation de l'entrée.
  const body = (await request.json().catch(() => null)) as
    | { message?: unknown; history?: unknown }
    | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ ok: false, error: "empty_message" }, { status: 400 });
  }
  if (message.length > INPUT_LIMITS.maxMessageLength) {
    return NextResponse.json({ ok: false, error: "message_too_long" }, { status: 400 });
  }
  const history = sanitizeHistory(body?.history);

  // 3) Clé DÉDIÉE. Absente → repli propre (jamais d'erreur brute au client).
  const apiKey = process.env.OPENROUTER_CHATBOT_API_KEY;
  if (!apiKey) {
    console.error(
      "[api/chat] OPENROUTER_CHATBOT_API_KEY manquante — configure la clé dédiée du chatbot.",
    );
    return NextResponse.json({ ok: true, reply: FALLBACK_USER_MESSAGE, degraded: true });
  }

  // 4) System prompt = consignes + base de connaissances.
  const knowledge = await loadKnowledgeBase();
  const systemPrompt = buildSystemPrompt(knowledge);
  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: message },
  ];

  // 5) Appel avec FALLBACK entre modèles GRATUITS (ordre de préférence).
  const models = resolveFreeModels();
  if (models.length === 0) {
    console.error("[api/chat] aucun modèle :free configuré.");
    return NextResponse.json({ ok: true, reply: FALLBACK_USER_MESSAGE, degraded: true });
  }

  // SDK OpenAI pointé sur OpenRouter (clé DÉDIÉE + en-têtes d'attribution).
  // maxRetries: 0 → on gère nous-mêmes le fallback ; timeout borné par appel.
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 0,
    defaultHeaders: { ...OPENROUTER_HEADERS },
  }) as unknown as ChatClient;

  for (const model of models) {
    const reply = await callModel(client, model, messages);
    if (reply) {
      return NextResponse.json({ ok: true, reply, model });
    }
    // Échec (402/429/5xx/timeout/vide) → on tente le modèle gratuit suivant.
  }

  // 6) Tous les modèles gratuits ont échoué → repli utilisateur poli.
  return NextResponse.json({ ok: true, reply: FALLBACK_USER_MESSAGE, degraded: true });
}
