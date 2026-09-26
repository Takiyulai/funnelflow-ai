// app/api/crm/campaigns/route.ts
// GET  → liste des campagnes ; POST → création (brouillon).

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listCampaigns, createCampaign } from "@/lib/crm/campaigns";
import { z } from "zod";
import { createEmptyEmailDocument } from "@/lib/email-editor/document";
import { compileEmailDocument } from "@/lib/email-editor/compiler";
import { EMAIL_DOCUMENT_VERSION } from "@/lib/email-editor/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const campaigns = await listCampaigns(sb, user.id);
  return NextResponse.json({ ok: true, campaigns });
}

export async function POST(request: Request) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const parsed = z
    .object({ name: z.string().trim().min(1).max(160) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
  }
  try {
    const document = createEmptyEmailDocument();
    const campaign = await createCampaign(sb, user.id, {
      name: parsed.data.name,
      content: compileEmailDocument(document),
      editor_document: document,
      editor_version: EMAIL_DOCUMENT_VERSION,
      preheader: "",
    });
    return NextResponse.json({ ok: true, campaign }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "create_failed" },
      { status: 500 },
    );
  }
}
