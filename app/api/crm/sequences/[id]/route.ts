// app/api/crm/sequences/[id]/route.ts
// GET    → séquence + emails
// PATCH  → met à jour la séquence (en-tête + emails)
// DELETE → supprime la séquence
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getSequenceWithEmails,
  updateSequence,
  deleteSequence,
} from "@/lib/crm/sequences";

export const dynamic = "force-dynamic";

const emailSchema = z.object({
  position: z.coerce.number().int().min(0).default(0),
  delay_days: z.coerce.number().int().min(0).max(365).default(0),
  // 🆕 Voir app/api/crm/sequences/route.ts — même piège de schéma qui retire
  // silencieusement tout champ non listé ici avant l'enregistrement.
  delay_hours: z.coerce.number().int().min(0).max(23).default(0),
  // 🆕 Date/heure absolue d'envoi (ISO) — voir route.ts (même piège de schéma).
  // offset:true accepte le format Postgres « …+00:00 » (sinon la re-sauvegarde
  // d'une séquence rechargée échouait en « invalid_input »).
  send_at: z.string().datetime({ offset: true }).nullish(),
  subject: z.string().default(""),
  content: z.string().default(""),
});

const sequenceTypeEnum = z.enum([
  "bienvenue", "nurturing", "relance", "offre", "temoignage", "lancement", "reengagement", "autre",
]);
const roleSchema = z.object({
  id: sequenceTypeEnum,
  label: z.string().max(80).optional(),
});

const inputSchema = z.object({
  // 🆕 Nom TRONQUÉ (jamais rejeté) — voir POST /api/crm/sequences : évite un
  // « invalid_input » quand le nom auto « Bienvenue — <nom du tunnel> » dépasse
  // 160 caractères (noms de tunnels IA très longs).
  name: z.string().min(1).max(2000).transform((s) => s.trim().slice(0, 160)),
  type: sequenceTypeEnum,
  roles: z.array(roleSchema).min(1).max(10).optional(),
  context: z.string().max(4000).nullish(),
  language: z.enum(["fr", "en", "es"]),
  funnel_id: z.string().uuid().nullish(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  emails: z.array(emailSchema).min(1).max(20),
});

async function auth() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return { sb, user };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { sb, user } = await auth();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const sequence = await getSequenceWithEmails(sb, user.id, id);
    if (!sequence) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, sequence });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "get_failed" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { sb, user } = await auth();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const json = await request.json().catch(() => null);
  const parsed = inputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const sequence = await updateSequence(sb, user.id, id, parsed.data);
    return NextResponse.json({ ok: true, sequence });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "update_failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { sb, user } = await auth();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await deleteSequence(sb, user.id, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "delete_failed" },
      { status: 500 },
    );
  }
}
