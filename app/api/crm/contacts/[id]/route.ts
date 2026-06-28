// app/api/crm/contacts/[id]/route.ts
// GET    /api/crm/contacts/:id  → fiche contact (+ tags)
// PATCH  /api/crm/contacts/:id  → édition
// DELETE /api/crm/contacts/:id  → suppression

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getContact, updateContact, deleteContact } from "@/lib/crm/contacts";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { runWorkflowsForEvent } from "@/lib/workflows/engine";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/workflows/types";

export const dynamic = "force-dynamic";

// 🆕 Workflows déclenchés par "status.changed". Best-effort (erreur avalée).
// Branché AU NIVEAU ROUTE : l'action `set_status` du moteur écrit directement
// dans `leads` via le client admin, pas via cette route → pas de boucle.
async function fireStatusChangedWorkflows(
  userId: string,
  contact: { id: string; email: string; name?: string | null },
  status: LeadStatus,
): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    await runWorkflowsForEvent(admin, userId, {
      event: "status.changed",
      lead: { id: contact.id, email: contact.email, name: contact.name ?? null },
      status,
    });
  } catch (e) {
    console.warn("[workflows] hook status.changed échoué (non bloquant):", e);
  }
}

async function requireUser() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return { sb, user };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { sb, user } = await requireUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const contact = await getContact(sb, user.id, id);
  if (!contact) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, contact });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { sb, user } = await requireUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  try {
    const contact = await updateContact(sb, user.id, id, body);
    // 🆕 Déclencheur workflow "status.changed" si le PATCH a posé un statut valide.
    if (
      typeof body?.status === "string" &&
      (LEAD_STATUSES as readonly string[]).includes(body.status)
    ) {
      await fireStatusChangedWorkflows(user.id, contact, body.status as LeadStatus);
    }
    return NextResponse.json({ ok: true, contact });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "update_failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { sb, user } = await requireUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await deleteContact(sb, user.id, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "delete_failed" },
      { status: 500 },
    );
  }
}
