import { afterEach, describe, expect, it } from "vitest";
import { resolvePublicAppUrl } from "@/lib/platform/publicAppUrl";

const KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "APP_URL",
  "NEXT_PUBLIC_SITE_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
] as const;

const original = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("resolvePublicAppUrl", () => {
  it("utilise automatiquement le domaine de production Vercel", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "autofunnelai.cloud";
    expect(resolvePublicAppUrl()).toBe("https://autofunnelai.cloud");
  });

  it("utilise le domaine personnalisé de la requête en dernier repli", () => {
    for (const key of KEYS) delete process.env[key];
    expect(resolvePublicAppUrl("https://autofunnelai.cloud/api/messaging/telegram/connect"))
      .toBe("https://autofunnelai.cloud");
  });

  it("refuse localhost comme webhook public", () => {
    for (const key of KEYS) delete process.env[key];
    expect(resolvePublicAppUrl("http://localhost:3000/api/test")).toBeNull();
  });
});
