import { NextResponse } from "next/server";
import { z } from "zod";

const leadSchema = z.object({
  funnelId: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional()
});

export async function POST(request: Request) {
  const lead = leadSchema.parse(await request.json());
  return NextResponse.json({
    lead: {
      id: crypto.randomUUID(),
      ...lead,
      status: "nouveau",
      created_at: new Date().toISOString()
    }
  }, { status: 201 });
}
