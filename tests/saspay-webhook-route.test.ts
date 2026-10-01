import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const processWebhook = vi.fn();

vi.mock("@/lib/payments/saspayBilling", () => ({
  processSasPayWebhook: processWebhook,
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { POST } from "@/app/api/webhooks/saspay/route";

function signedRequest(body: Record<string, unknown>, valid = true): Request {
  const rawBody = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = valid
    ? createHmac("sha256", "webhook-test-secret")
        .update(timestamp + "." + rawBody)
        .digest("hex")
    : "invalid";
  return new Request("https://autofunnel.example/api/webhooks/saspay", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Signature": signature,
      "X-Webhook-Timestamp": timestamp,
      "X-Webhook-Event": String(body.event ?? ""),
    },
    body: rawBody,
  });
}

describe("webhook SasPay", () => {
  beforeEach(() => {
    process.env.SASPAY_WEBHOOK_SECRET = "webhook-test-secret";
    processWebhook.mockReset();
  });

  it("rejette un webhook non signé correctement", async () => {
    const response = await POST(
      signedRequest(
        { event: "transaction.success", data: { id: "tx-1" } },
        false,
      ),
    );
    expect(response.status).toBe(401);
    expect(processWebhook).not.toHaveBeenCalled();
  });

  it("traite un webhook signé sur son corps brut", async () => {
    processWebhook.mockResolvedValue({ duplicate: false, processed: true });
    const response = await POST(
      signedRequest({
        event: "transaction.success",
        data: { id: "tx-1", status: "SUCCESS" },
      }),
    );
    expect(response.status).toBe(200);
    expect(processWebhook).toHaveBeenCalledTimes(1);
    expect(await response.json()).toMatchObject({
      ok: true,
      duplicate: false,
      processed: true,
    });
  });

  it("accepte sans réactivation un événement dupliqué", async () => {
    processWebhook.mockResolvedValue({ duplicate: true, processed: true });
    const response = await POST(
      signedRequest({
        event: "transaction.success",
        data: { id: "tx-1", status: "SUCCESS" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      duplicate: true,
    });
  });
});
