// lib/chatbot/config.ts
//
// 🆕 CHATBOT IA — Configuration centralisée (constantes ajustables).
//
// ⚠️ COÛT ZÉRO : ce module N'UTILISE QUE des modèles GRATUITS OpenRouter
// (suffixe `:free`). N'ajoute JAMAIS de modèle sans `:free` dans FREE_MODELS.
// La clé utilisée est OPENROUTER_CHATBOT_API_KEY (voir la route /api/chat),
// JAMAIS OPENROUTER_API_KEY.

/** Endpoint OpenRouter, compatible API OpenAI. */
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Modèles GRATUITS en ordre de préférence. Le 1er est essayé d'abord ; en cas
 * d'erreur/indisponibilité, on bascule sur le suivant. TOUS doivent finir par
 * `:free`.
 *
 * ➜ Slugs vérifiés contre l'API OpenRouter (liste des modèles gratuits). Les
 *   slugs `:free` ÉVOLUENT souvent : vérifie régulièrement sur
 *   https://openrouter.ai/models?max_price=0 et ajuste soit ici, soit — SANS
 *   redéployer — via la variable d'env `OPENROUTER_CHATBOT_MODELS`
 *   (liste séparée par des virgules ; voir resolveFreeModels()).
 */
export const FREE_MODELS = [
  "google/gemma-4-26b-a4b-it:free", // principal
  "openai/gpt-oss-20b:free", // secours 1
  "cohere/north-mini-code:free", // secours 2
] as const;

/** Garde-fou : ne garde que les modèles réellement `:free`. */
export const SAFE_FREE_MODELS = FREE_MODELS.filter((m) => m.endsWith(":free"));

/**
 * Liste EFFECTIVE des modèles gratuits à utiliser (serveur uniquement).
 * Priorité à la variable d'env `OPENROUTER_CHATBOT_MODELS` (permet de changer
 * de modèles depuis Vercel sans redéployer le code), sinon la constante
 * ci-dessus. Dans tous les cas, on ne garde QUE les slugs `:free`.
 */
export function resolveFreeModels(): string[] {
  const raw = process.env.OPENROUTER_CHATBOT_MODELS;
  const fromEnv = raw
    ? raw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const list = fromEnv.length > 0 ? fromEnv : [...FREE_MODELS];
  return list.filter((m) => m.endsWith(":free"));
}

/** Timeout d'un appel modèle (ms). Au-delà, on tente le modèle suivant. */
export const REQUEST_TIMEOUT_MS = 25_000;

/** Bornes de génération (réponses courtes de support, économes en quota). */
export const GENERATION = {
  temperature: 0.3,
  maxTokens: 800,
} as const;

/** En-têtes d'attribution OpenRouter (facultatifs mais recommandés). */
export const OPENROUTER_HEADERS = {
  "HTTP-Referer": "https://autofunnelai.cloud",
  "X-Title": "AutoFunnel AI",
} as const;

/**
 * Rate limit par IP pour protéger le quota OpenRouter (50 req/jour sans crédits,
 * 1000/jour avec). Fenêtre glissante en mémoire. À AJUSTER selon le trafic.
 */
export const RATE_LIMIT = {
  windowMs: 60_000, // 1 minute
  maxRequests: 8, // requêtes autorisées par IP et par fenêtre
} as const;

/** Limites d'entrée (anti-abus / anti-gaspillage de tokens). */
export const INPUT_LIMITS = {
  /** Longueur max d'un message utilisateur (caractères). */
  maxMessageLength: 2_000,
  /** Nombre max de messages d'historique renvoyés au modèle (les plus récents). */
  maxHistoryMessages: 10,
} as const;

/**
 * Coordonnées de contact HUMAIN, proposées par le bot quand il ne peut pas aider
 * (hors documentation, question personnelle/compte, demande explicite d'un
 * humain). Centralisées ici et injectées dans le system prompt.
 *  - email : celui de l'onglet « Nous contacter ».
 */
export const CONTACT = {
  email: "jwdemanou@gmail.com",
  whatsapp: ["+39 327 295 2682", "+229 69 76 55 56"],
} as const;

/**
 * Message de repli affiché à l'utilisateur quand le bot ne peut pas répondre
 * (aucune info dans la doc, erreur technique, quota épuisé…). Donne les
 * coordonnées de contact directes (email + WhatsApp).
 */
export const FALLBACK_USER_MESSAGE =
  "Je n'ai pas la réponse à cette question pour le moment 🙏 Pour une aide directe, " +
  `écris-nous à ${CONTACT.email} ou sur WhatsApp au ${CONTACT.whatsapp[0]} / ${CONTACT.whatsapp[1]} — ` +
  "l'équipe se fera un plaisir de t'aider.";
