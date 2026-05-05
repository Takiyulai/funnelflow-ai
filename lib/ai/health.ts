// lib/ai/health.ts

export type AiHealthReason =
  | "ok"
  | "missing-key"
  | "invalid-key"
  | "header-error"
  | "network-error"
  | "rate-limit"
  | "insufficient-quota"
  | "unknown";

export type AiHealth = {
  ok: boolean;
  reason: AiHealthReason;
  message: string;
};

// Vérifie la présence et la validité de la clé OpenAI sans consommer de tokens
// Appelé côté serveur uniquement
export async function checkAiHealth(): Promise<AiHealth> {
  const key = process.env.OPENAI_API_KEY;

  // Cas 1 : clé absente ou trop courte
  if (!key || key.trim().length < 10) {
    return {
      ok: false,
      reason: "missing-key",
      message:
        "Aucune clé OpenAI détectée. Ajoutez OPENAI_API_KEY dans .env.local puis redémarrez le serveur",
    };
  }

  // Cas 2 : clé contient des caractères non-ASCII qui casseraient le header Authorization
  // (cela arrive si l'utilisateur a collé une clé avec des accents, guillemets typographiques, etc.)
  if (!/^[\x20-\x7E]+$/.test(key)) {
    return {
      ok: false,
      reason: "header-error",
      message:
        "La clé OpenAI contient des caractères invalides (accents, guillemets typographiques ou espaces). Recopiez-la proprement depuis platform.openai.com",
    };
  }

  // Cas 3 : appel léger pour vérifier la validité auprès d'OpenAI
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${key.trim()}` },
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        reason: "invalid-key",
        message:
          "Clé OpenAI refusée par l'API. Vérifiez qu'elle est active sur platform.openai.com",
      };
    }

    if (res.status === 429) {
      // Différencie quota épuisé vs rate-limit ponctuel
      let bodyText = "";
      try {
        bodyText = await res.text();
      } catch {
        // ignore
      }
      const insufficient = /insufficient_quota|exceeded your current quota/i.test(bodyText);
      return {
        ok: false,
        reason: insufficient ? "insufficient-quota" : "rate-limit",
        message: insufficient
          ? "Quota OpenAI épuisé. Ajoutez du crédit sur platform.openai.com pour générer des tunnels"
          : "Trop de requêtes vers OpenAI en peu de temps. Réessayez dans une minute",
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        reason: "unknown",
        message: `Réponse inattendue d'OpenAI (${res.status}). Réessayez dans quelques instants`,
      };
    }

    return {
      ok: true,
      reason: "ok",
      message: "Clé OpenAI valide, prête pour la génération",
    };
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");

    return {
      ok: false,
      reason: "network-error",
      message: isTimeout
        ? "OpenAI met trop de temps à répondre. Vérifiez votre connexion ou un éventuel pare-feu"
        : "Impossible de joindre OpenAI. Vérifiez votre connexion internet, antivirus ou pare-feu",
    };
  }
}
