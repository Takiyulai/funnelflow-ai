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

// 🆕 Résolution du fournisseur IA courant (même logique que lib/ai/generate.ts).
// Le health-check doit suivre l'abstraction : sinon il reste collé à OpenAI même
// quand AI_PROVIDER bascule sur Anthropic ou Z.AI/GLM.
type ProviderConfig = {
  label: string; // nom affiché dans les messages
  key: string | undefined; // clé API à utiliser
  modelsUrl: string; // endpoint léger de validation (GET)
  authHeaders: (key: string) => Record<string, string>;
};

function resolveProviderConfig(): ProviderConfig {
  const provider = (process.env.AI_PROVIDER ?? "openai").toLowerCase();
  const isAnthropic = provider === "anthropic" || provider === "claude";
  const isZai = provider === "zai" || provider === "z.ai" || provider === "glm";
  const isOpenRouter =
    provider === "openrouter" || provider === "open-router" || provider === "or";

  if (isAnthropic) {
    return {
      label: "Anthropic",
      key: process.env.ANTHROPIC_API_KEY,
      modelsUrl: "https://api.anthropic.com/v1/models",
      authHeaders: (k) => ({
        "x-api-key": k,
        "anthropic-version": "2023-06-01",
      }),
    };
  }

  // OpenAI (défaut) ET Z.AI partagent les mêmes variables (OPENAI_*) : seul le
  // base_url change. base_url normalisé sans slash final → on suffixe "/models".
  const rawBase =
    process.env.OPENAI_BASE_URL?.trim() ||
    (isZai
      ? "https://api.z.ai/api/paas/v4"
      : isOpenRouter
        ? "https://openrouter.ai/api/v1"
        : "https://api.openai.com/v1");
  const base = rawBase.replace(/\/+$/, "");

  return {
    label: isZai ? "Z.AI / GLM" : isOpenRouter ? "OpenRouter" : "OpenAI",
    key: process.env.OPENAI_API_KEY,
    modelsUrl: `${base}/models`,
    authHeaders: (k) => ({ Authorization: `Bearer ${k}` }),
  };
}

// Vérifie la présence et la validité de la clé du fournisseur courant sans
// consommer de tokens. Appelé côté serveur uniquement.
export async function checkAiHealth(): Promise<AiHealth> {
  const { label, key, modelsUrl, authHeaders } = resolveProviderConfig();

  // Cas 1 : clé absente ou trop courte
  if (!key || key.trim().length < 10) {
    return {
      ok: false,
      reason: "missing-key",
      message: `Aucune clé ${label} détectée. Ajoutez la clé correspondante dans .env.local puis redémarrez le serveur`,
    };
  }

  // Cas 2 : clé contient des caractères non-ASCII qui casseraient le header
  // (cela arrive si l'utilisateur a collé une clé avec des accents, guillemets typographiques, etc.)
  if (!/^[\x20-\x7E]+$/.test(key)) {
    return {
      ok: false,
      reason: "header-error",
      message: `La clé ${label} contient des caractères invalides (accents, guillemets typographiques ou espaces). Recopiez-la proprement.`,
    };
  }

  // Cas 3 : appel léger pour vérifier la validité auprès du fournisseur
  try {
    const res = await fetch(modelsUrl, {
      method: "GET",
      headers: authHeaders(key.trim()),
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        reason: "invalid-key",
        message: `Clé ${label} refusée par l'API. Vérifiez qu'elle est active.`,
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
          ? `Quota ${label} épuisé. Ajoutez du crédit pour générer des tunnels`
          : `Trop de requêtes vers ${label} en peu de temps. Réessayez dans une minute`,
      };
    }

    // 🆕 Certains fournisseurs OpenAI-compatibles n'exposent pas /models (404/405).
    // Dans ce cas la clé n'a PAS été rejetée (pas de 401/403) → on considère la
    // configuration comme valide plutôt que de produire un faux négatif.
    if (res.status === 404 || res.status === 405) {
      return {
        ok: true,
        reason: "ok",
        message: `Configuration ${label} acceptée (endpoint de validation non exposé, clé non rejetée).`,
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        reason: "unknown",
        message: `Réponse inattendue de ${label} (${res.status}). Réessayez dans quelques instants`,
      };
    }

    return {
      ok: true,
      reason: "ok",
      message: `Clé ${label} valide, prête pour la génération`,
    };
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");

    return {
      ok: false,
      reason: "network-error",
      message: isTimeout
        ? `${label} met trop de temps à répondre. Vérifiez votre connexion ou un éventuel pare-feu`
        : `Impossible de joindre ${label}. Vérifiez votre connexion internet, antivirus ou pare-feu`,
    };
  }
}
