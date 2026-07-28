// lib/messaging/telegram.ts
// 🆕 Adaptateur Telegram Bot API.
//
// POURQUOI TELEGRAM D'ABORD : gratuit, sans validation, sans vérification
// d'entreprise, sans gabarits à faire approuver, et — contrairement à WhatsApp —
// sans numéro dédié à sacrifier. L'utilisateur crée un bot en deux minutes et
// colle un jeton.
//
// ⚠️ LA LIMITE À CONNAÎTRE : un bot Telegram ne peut PAS écrire à quelqu'un qui
// ne lui a pas parlé en premier. Ce canal sert donc au RÉENGAGEMENT (le
// prospect démarre le bot depuis le tunnel, puis on échange), jamais à la
// prospection à froid. L'interface doit le dire clairement, sinon l'utilisateur
// cherchera un bouton « envoyer à ma liste » qui ne peut pas exister.

const API = "https://api.telegram.org";
const TIMEOUT_MS = 10_000;

export type TelegramBotInfo = {
  id: number;
  username: string;
  firstName: string;
};

export class TelegramError extends Error {
  constructor(
    message: string,
    readonly code: "invalid_token" | "network" | "api",
  ) {
    super(message);
    this.name = "TelegramError";
  }
}

async function call<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as
      | { ok?: boolean; result?: T; description?: string }
      | null;

    if (!json?.ok) {
      const description = json?.description ?? `HTTP ${res.status}`;
      // 401 = jeton invalide ou révoqué : message dédié, c'est LE cas
      // d'erreur que rencontrera l'utilisateur (copier-coller incomplet).
      if (res.status === 401) {
        throw new TelegramError(
          "Jeton refusé par Telegram. Vérifie que tu as bien copié la ligne entière donnée par @BotFather.",
          "invalid_token",
        );
      }
      throw new TelegramError(description, "api");
    }
    return json.result as T;
  } catch (e) {
    if (e instanceof TelegramError) throw e;
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new TelegramError(
      aborted ? "Telegram n'a pas répondu à temps." : "Impossible de joindre Telegram.",
      "network",
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Valide un jeton et récupère l'identité du bot. */
export async function getBotInfo(token: string): Promise<TelegramBotInfo> {
  const r = await call<{ id: number; username: string; first_name: string }>(
    token,
    "getMe",
  );
  return { id: r.id, username: r.username, firstName: r.first_name };
}

/**
 * Branche le webhook. `secretToken` est renvoyé par Telegram dans l'en-tête
 * `X-Telegram-Bot-Api-Secret-Token` à chaque appel : c'est ce qui nous permet
 * de vérifier qu'un message vient bien de Telegram et non d'un tiers qui aurait
 * deviné l'URL.
 */
export async function setWebhook(
  token: string,
  url: string,
  secretToken: string,
): Promise<void> {
  await call(token, "setWebhook", {
    url,
    secret_token: secretToken,
    // On ne veut que les messages : inutile de recevoir les mises à jour de
    // canaux, sondages, etc.
    allowed_updates: ["message"],
    // Repart d'une base propre si un ancien webhook traînait.
    drop_pending_updates: true,
  });
}

export async function deleteWebhook(token: string): Promise<void> {
  await call(token, "deleteWebhook", { drop_pending_updates: true });
}

export async function sendMessage(
  token: string,
  chatId: string,
  text: string,
): Promise<{ messageId: string }> {
  const r = await call<{ message_id: number }>(token, "sendMessage", {
    chat_id: chatId,
    text,
  });
  return { messageId: String(r.message_id) };
}

/** Forme minimale d'un update entrant (seuls les champs qu'on exploite). */
export type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    date?: number;
    text?: string;
    chat?: {
      id?: number | string;
      first_name?: string;
      last_name?: string;
      username?: string;
      type?: string;
    };
    from?: {
      first_name?: string;
      last_name?: string;
      username?: string;
    };
  };
};

/** Nom lisible d'un correspondant, à partir de ce que Telegram fournit. */
export function displayNameFromUpdate(u: TelegramUpdate): string {
  const from = u.message?.from ?? u.message?.chat;
  const parts = [from?.first_name, from?.last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  if (from?.username) return `@${from.username}`;
  return "Contact Telegram";
}
