// app/api/ai/health/route.ts
import { NextResponse } from "next/server";
import { checkAiHealth } from "@/lib/ai/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await checkAiHealth();
  return NextResponse.json(health, {
    status: health.ok ? 200 : 200, // toujours 200 : on retourne le diagnostic au client
    headers: { "Cache-Control": "no-store" },
  });
}
