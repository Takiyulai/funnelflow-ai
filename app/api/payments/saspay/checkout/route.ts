import { NextResponse } from "next/server";
import { z } from "zod";
import { isPlanId } from "@/lib/billing/plans";
import { createSasPayCheckout } from "@/lib/payments/saspayBilling";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  planId: z.string().refine(isPlanId, "plan invalide"),
});

function applicationOrigin(request: Request): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (configured) return new URL(configured).origin;
  return new URL(request.url).origin;
}

function customerName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): string {
  const metadata = user.user_metadata ?? {};
  const fullName =
    typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
  if (fullName) return fullName;
  return user.email?.split("@", 1)[0]?.trim() || "Client AutoFunnel AI";
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_plan" }, { status: 400 });
  }
  if (!user.email) {
    return NextResponse.json({ ok: false, error: "email_required" }, { status: 422 });
  }

  try {
    const checkout = await createSasPayCheckout({
      userId: user.id,
      planId: parsed.planId,
      customerEmail: user.email,
      customerName: customerName(user),
      origin: applicationOrigin(request),
    });
    return NextResponse.json({
      ok: true,
      paymentId: checkout.paymentId,
      checkoutUrl: checkout.checkoutUrl,
      reused: checkout.reused,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message.split(":", 1)[0] : "unknown_error";
    const status =
      code === "saspay_not_configured"
        ? 503
        : code === "checkout_creation_in_progress"
          ? 409
          : 502;
    console.error("[saspay] checkout failed", { code, userId: user.id, planId: parsed.planId });
    return NextResponse.json({ ok: false, error: code }, { status });
  }
}
