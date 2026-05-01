import { NextResponse } from "next/server";
import { z } from "zod";
import { generateFunnelWithAI } from "@/lib/ai/generate";

const briefSchema = z.object({
  brandName: z.string().min(1),
  offerName: z.string().min(1),
  price: z.string().min(1),
  targetAudience: z.string().min(1),
  mainPain: z.string().min(1),
  promise: z.string().min(1),
  tone: z.string().min(1),
  funnelType: z.string().min(1),
  designStyle: z.string().min(1),
  language: z.enum(["fr", "en"])
});

export async function POST(request: Request) {
  const payload = briefSchema.parse(await request.json());
  const funnel = await generateFunnelWithAI(payload);
  return NextResponse.json({ funnel });
}
