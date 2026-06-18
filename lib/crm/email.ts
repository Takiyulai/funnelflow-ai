// lib/crm/email.ts
// Envoi d'emails via Resend (API REST, sans SDK → aucune dépendance ajoutée).
// La clé reste dans .env.local : RESEND_API_KEY. L'expéditeur dans RESEND_FROM
// (doit être un domaine/sender vérifié sur Resend ; fallback de test fourni).

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
};

export type SendEmailResult = { ok: boolean; id?: string; error?: string };

export function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "missing_resend_key" };

  const from =
    input.from ||
    process.env.RESEND_FROM ||
    "FunnelFlow AI <onboarding@resend.dev>";

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data?.message || data?.name || `http_${res.status}` };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network_error" };
  }
}
