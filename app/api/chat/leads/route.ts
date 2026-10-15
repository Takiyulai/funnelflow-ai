import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/chatbot/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const leadSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(320),
  consent: z.literal(true),
  // Honeypot invisible : un navigateur humain le laisse vide.
  website: z.string().max(0).optional().default(""),
});

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const rateLimit = checkRateLimit(`chat-lead:${ip}`);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } },
    );
  }

  const input = leadSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_contact" },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const email = input.data.email.toLowerCase();
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("chatbot_leads").upsert(
    {
      first_name: input.data.firstName,
      email,
      source: "landing_chatbot",
      consent_at: now,
      last_seen_at: now,
      updated_at: now,
      metadata: {
        language: request.headers.get("accept-language")?.slice(0, 80) ?? null,
      },
    },
    { onConflict: "email" },
  );

  if (error) {
    console.error("[chat/leads] capture failed", error.message);
    return NextResponse.json(
      { ok: false, error: "capture_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
