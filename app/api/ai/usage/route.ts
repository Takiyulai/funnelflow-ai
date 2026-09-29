import { NextRequest, NextResponse } from "next/server";
import { guardApiAccess } from "@/lib/billing/apiGuard";
import { getUsage, type UsageMetric } from "@/lib/billing/usage";

export const dynamic = "force-dynamic";

const ALLOWED = new Set<UsageMetric>([
  "ai_funnel_gen",
  "ai_sequence_gen",
  "ai_copy_regen",
]);

export async function GET(request: NextRequest) {
  const guard = await guardApiAccess();
  if (!guard.ok) return guard.response;

  const metric = request.nextUrl.searchParams.get("metric") as UsageMetric | null;
  if (!metric || !ALLOWED.has(metric)) {
    return NextResponse.json({ ok: false, error: "invalid_metric" }, { status: 400 });
  }

  const limits = guard.access.limits;
  const limit =
    metric === "ai_funnel_gen"
      ? limits.aiFunnelGensPerMonth
      : metric === "ai_sequence_gen"
        ? limits.aiSequenceGensPerMonth
        : limits.aiCopyRegensPerMonth;
  const period = guard.access.quotaPeriod === "lifetime" ? "lifetime" : undefined;
  const used = await getUsage(guard.userId, metric, period);

  return NextResponse.json({
    ok: true,
    metric,
    used,
    limit: limit === Infinity ? null : limit,
    remaining: limit === Infinity ? null : Math.max(0, limit - used),
    period: guard.access.quotaPeriod,
  });
}
