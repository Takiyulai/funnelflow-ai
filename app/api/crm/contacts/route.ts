// app/api/crm/contacts/route.ts
// GET  /api/crm/contacts        → liste (q, tagId, status, funnelId, limit, offset)
// POST /api/crm/contacts        → création manuelle
//
// Routes fines : auth + délégation aux services lib/crm/contacts. Un futur
// webhook n8n pourra appeler exactement les mêmes services (client admin + userId).

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listContacts, createContact } from "@/lib/crm/contacts";
import type { LeadStatus } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const res = await listContacts(sb, user.id, {
    search: url.searchParams.get("q") || undefined,
    tagId: url.searchParams.get("tagId") || undefined,
    status: (url.searchParams.get("status") as LeadStatus | null) || undefined,
    funnelId: url.searchParams.get("funnelId") || undefined,
    limit: Number(url.searchParams.get("limit")) || 50,
    offset: Number(url.searchParams.get("offset")) || 0,
  });

  return NextResponse.json({ ok: true, ...res });
}

export async function POST(request: Request) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.email !== "string" || !body.email.trim()) {
    return NextResponse.json({ ok: false, error: "email_required" }, { status: 400 });
  }

  try {
    const contact = await createContact(sb, user.id, body);
    return NextResponse.json({ ok: true, contact }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "create_failed" },
      { status: 500 },
    );
  }
}
