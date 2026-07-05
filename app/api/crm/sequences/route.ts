// app/api/crm/sequences/route.ts
// GET  → liste des séquences de l'utilisateur
// POST → crée une séquence (en-tête + emails)
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listSequences, createSequence } from "@/lib/crm/sequences";

export const dynamic = "force-dynamic";

const emailSchema = z.object({
  position: z.coerce.number().int().min(0).default(0),
  delay_days: z.coerce.number().int().min(0).max(365).default(0),
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
  name: z.string().min(1).max(160),
  type: sequenceTypeEnum,
  // 🆕 LOT 1 : liste ordonnée des rôles (1 par mail). Optionnelle pour
  // rétrocompat avec d'anciens appels ; `type` reste la source de vérité si absent.
  roles: z.array(roleSchema).min(1).max(10).optional(),
  context: z.string().max(4000).nullish(),
  language: z.enum(["fr", "en", "es"]),
  funnel_id: z.string().uuid().nullish(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  emails: z.array(emailSchema).min(1).max(20),
});

export async function GET() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  try {
    const sequences = await listSequences(sb, user.id);
    return NextResponse.json({ ok: true, sequences });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "list_failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = inputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const sequence = await createSequence(sb, user.id, parsed.data);
    return NextResponse.json({ ok: true, sequence }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "create_failed" },
      { status: 500 },
    );
  }
}
