import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      expect(table).toBe("chatbot_leads");
      return { upsert: mocks.upsert };
    },
  }),
}));

vi.mock("@/lib/chatbot/rateLimit", () => ({
  getClientIp: () => "203.0.113.10",
  checkRateLimit: mocks.checkRateLimit,
}));

import { POST } from "@/app/api/chat/leads/route";

function request(body: unknown) {
  return new Request("https://autofunnelai.cloud/api/chat/leads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": "fr-FR,fr;q=0.9",
    },
    body: JSON.stringify(body),
  });
}

describe("capture des prospects du chatbot", () => {
  beforeEach(() => {
    mocks.upsert.mockReset();
    mocks.checkRateLimit.mockReset();
    mocks.checkRateLimit.mockReturnValue({ ok: true, retryAfter: 0, remaining: 9 });
    mocks.upsert.mockResolvedValue({ error: null });
  });

  it("normalise l'email et conserve le consentement côté serveur", async () => {
    const response = await POST(
      request({
        firstName: " Awa ",
        email: "AWA@EXAMPLE.COM ",
        consent: true,
        website: "",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: "Awa",
        email: "awa@example.com",
        source: "landing_chatbot",
        metadata: { language: "fr-FR,fr;q=0.9" },
      }),
      { onConflict: "email" },
    );
  });

  it("refuse une soumission sans consentement ou remplie par un robot", async () => {
    const noConsent = await POST(
      request({ firstName: "Awa", email: "awa@example.com", consent: false, website: "" }),
    );
    const honeypot = await POST(
      request({ firstName: "Awa", email: "awa@example.com", consent: true, website: "spam" }),
    );

    expect(noConsent.status).toBe(400);
    expect(honeypot.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("bloque les rafales avant toute écriture", async () => {
    mocks.checkRateLimit.mockReturnValue({ ok: false, retryAfter: 30, remaining: 0 });
    const response = await POST(
      request({ firstName: "Awa", email: "awa@example.com", consent: true, website: "" }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
