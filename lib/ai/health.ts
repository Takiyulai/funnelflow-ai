// lib/ai/health.ts

export type AiHealth = {
  ok: boolean;
  reason: "ok" | "missing-key" | "invalid-key" | "network-error" | "unknown";
  message: string;
};

// Vérifie la présence et la validité de la clé OpenAI sans consommer de tokens
// Appelé côté serveur uniquement
export async function checkAiHealth(): Promise<AiHealth> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.trim().length < 10) {
    return {
      ok: false,
      reason: "missing-key",
      message: "Clé OpenAI absente. Le tunnel sera généré en mode démo local",
    };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
      // 5 secondes max pour ne pas bloquer le wizard
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        reason: "invalid-key",
        message: "La clé OpenAI a été refusée. Vérifiez votre clé dans les variables d'environnement",
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        reason: "network-error",
        message: `Réponse inattendue (${res.status}). La génération démo sera utilisée si l'erreur persiste`,
      };
    }

    return {
      ok: true,
      reason: "ok",
      message: "Clé OpenAI valide, prête pour la génération",
    };
  } catch (error) {
    return {
      ok: false,
      reason: "network-error",
      message: "Impossible de joindre l'API OpenAI. La génération démo sera utilisée si nécessaire",
    };
  }
}
