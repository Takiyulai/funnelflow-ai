// app/api/crm/campaigns/[id]/route.ts
// GET → détail campagne ; PATCH → édition (nom, objet, contenu).

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCampaign, updateCampaign } from "@/lib/crm/campaigns";
import { z } from "zod";
import { emailDocumentSchema } from "@/lib/email-editor/schema";
import { compileEmailDocument } from "@/lib/email-editor/compiler";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const campaign = await getCampaign(sb, user.id, id);
  if (!campaign) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, campaign });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(160).optional(),
      subject: z.string().max(500).optional(),
      preheader: z.string().max(500).optional(),
      content: z.string().max(500_000).optional(),
      editor_document: emailDocumentSchema.nullish(),
      editor_version: z.coerce.number().int().min(1).nullish(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  try {
    const patch = { ...parsed.data };
    if (patch.editor_document) {
      patch.content = compileEmailDocument(patch.editor_document, {
        preheader: patch.preheader ?? "",
      });
      patch.editor_version = patch.editor_document.version;
    }
    const campaign = await updateCampaign(sb, user.id, id, patch);
    return NextResponse.json({ ok: true, campaign });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "update_failed" },
      { status: 500 },
    );
  }
}
