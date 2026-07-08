// app/api/ai/regenerate-page/route.ts
//
// 🆕 Régénération IA d'une PAGE ENTIÈRE (toutes ses sections), sans toucher au
// reste du tunnel. Complète la régénération par section : l'utilisateur qui
// n'aime QUE le copy d'une page (ex. la page d'inscription) la reprend d'un
// clic, avec une instruction libre optionnelle, tout en gardant le reste.

import { NextResponse } from "next/server";
import { z } from "zod";
import type { FunnelBrief, FunnelKind, PageRole } from "@/lib/funnels/types";
import { regeneratePageSections } from "@/lib/ai/generate";
import {
  guardApiAccess,
  featureBlockedResponse,
  quotaExceededResponse,
} from "@/lib/billing/apiGuard";
import { consumeQuota } from "@/lib/billing/usage";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const briefSchema = z.object({
  brandName: z.string().optional(),
  offerName: z.string().optional(),
  price: z.string().optional(),
  targetAudience: z.string().optional(),
  mainPain: z.string().optional(),
  promise: z.string().optional(),
  tone: z.string().optional(),
  funnelType: z.string().optional(),
  designStyle: z.string().optional(),
  language: z.enum(["fr", "en", "es"]).optional(),
  videoUrl: z.string().optional(),
  primaryCta: z
    .object({
      label: z.string().min(1),
      mode: z.enum(["redirect", "anchor", "popup"]),
      url: z.string().optional(),
      target: z.enum(["_self", "_blank"]).optional(),
      anchorId: z.string().optional(),
    })
    .optional(),
});

const inputSchema = z.object({
  brief: briefSchema.partial().optional(),
  kind: z.string().min(1),
  role: z.string().min(1),
  slug: z.string().optional(),
  name: z.string().optional(),
  instruction: z.string().max(800).optional(),
  language: z.enum(["fr", "en", "es"]).optional(),
  homeContext: z
    .object({
      headline: z.string().optional(),
      primaryCtaLabel: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  // Même garde que la régénération de section : abonnement + fonctionnalité
  // « régénération IA » (Pro/Agency), anti-burst, puis quota mensuel.
  const guard = await guardApiAccess();
  if (!guard.ok) return guard.response;
  if (!guard.access.limits.sectionRegeneration) {
    return featureBlockedResponse("sectionRegeneration");
  }
  const rl = await rateLimit(`pageregen:${guard.userId}`, 8, 60);
  if (!rl.ok) return tooManyRequests();
  const quota = await consumeQuota(
    guard.userId,
    "ai_copy_regen",
    guard.access.limits.aiCopyRegensPerMonth,
  );
  if (!quota.ok) {
    return quotaExceededResponse(
      "Quota mensuel de régénérations IA atteint pour ton plan.",
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { brief: briefIn, kind, role, slug, name, instruction, language: langIn, homeContext } =
    parsed.data;

  const lang = (briefIn?.language ?? langIn ?? "fr") as FunnelBrief["language"];
  const brief: FunnelBrief = {
    brandName: briefIn?.brandName || "",
    offerName: briefIn?.offerName || "",
    price: briefIn?.price || "",
    targetAudience: briefIn?.targetAudience || "",
    mainPain: briefIn?.mainPain || "",
    promise: briefIn?.promise || "",
    tone: briefIn?.tone || "",
    funnelType: briefIn?.funnelType || "",
    designStyle: briefIn?.designStyle || "",
    language: lang,
    funnelKind: kind as FunnelKind,
    videoUrl: briefIn?.videoUrl,
    primaryCta: briefIn?.primaryCta,
  };

  const { sections, fallback } = await regeneratePageSections({
    brief,
    kind: kind as FunnelKind,
    role: role as PageRole,
    slug,
    name,
    instruction,
    homeContext,
  });

  return NextResponse.json({ sections, fallback });
}
