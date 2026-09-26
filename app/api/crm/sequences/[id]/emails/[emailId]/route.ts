import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emailDocumentSchema } from "@/lib/email-editor/schema";
import { compileEmailDocument } from "@/lib/email-editor/compiler";
import { getFunnelBrandName } from "@/lib/crm/emailRender";
import { getSequenceEmail, updateSequenceEmail } from "@/lib/crm/sequences";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  subject: z.string().max(500),
  preheader: z.string().max(500).optional().default(""),
  editor_document: emailDocumentSchema,
  editor_version: z.coerce.number().int().min(1),
  content: z.string().max(500_000).optional(),
});

async function auth() {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  return { sb, user };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; emailId: string }> },
) {
  const { sb, user } = await auth();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id, emailId } = await params;
  const email = await getSequenceEmail(sb, user.id, id, emailId);
  if (!email) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, email });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; emailId: string }> },
) {
  const { sb, user } = await auth();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id, emailId } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }
  try {
    const existing = await getSequenceEmail(sb, user.id, id, emailId);
    if (!existing) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const { data: sequence } = await sb
      .from("crm_sequences")
      .select("funnel_id")
      .eq("user_id", user.id)
      .eq("id", id)
      .maybeSingle();
    const brandName = await getFunnelBrandName(sb, sequence?.funnel_id as string | null);
    const content = compileEmailDocument(parsed.data.editor_document, {
      preheader: parsed.data.preheader,
      brandName,
    });
    const email = await updateSequenceEmail(sb, user.id, id, emailId, {
      subject: parsed.data.subject,
      preheader: parsed.data.preheader,
      editor_document: parsed.data.editor_document,
      editor_version: parsed.data.editor_document.version,
      content,
    });
    return NextResponse.json({ ok: true, email });
  } catch (error) {
    console.error("[sequence-email] update failed", error);
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }
}
