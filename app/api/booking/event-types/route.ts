// app/api/booking/event-types/route.ts
//
// Types de RDV de l'hôte — liste et création. Route AUTHENTIFIÉE.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { listEventTypes, getAvailability, getExceptions } from "@/lib/booking/repository";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "@/lib/booking/timezones";
import { slugifyBooking } from "@/lib/booking/slug";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireUser() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user?.id ?? null;
}

export async function GET() {
  const userId = await requireUser();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const types = await listEventTypes(userId);
  const detailed = await Promise.all(
    types.map(async (t) => ({
      ...t,
      availability: await getAvailability(t.id),
      exceptions: await getExceptions(t.id),
    })),
  );
  return NextResponse.json({ ok: true, eventTypes: detailed });
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().max(60).optional(),
  description: z.string().max(1000).optional(),
  durationMin: z.number().int().min(5).max(480).default(30),
  bufferMin: z.number().int().min(0).max(240).default(0),
  minNoticeMin: z.number().int().min(0).max(43200).default(240),
  horizonDays: z.number().int().min(1).max(365).default(30),
  slotStepMin: z.number().int().min(5).max(120).default(15),
  timezone: z.string().default(DEFAULT_TIMEZONE),
  locationKind: z.enum(["visio", "phone", "in_person", "custom"]).default("visio"),
  locationValue: z.string().max(300).optional(),
  language: z.string().max(5).default("fr"),
  funnelId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const userId = await requireUser();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const b = parsed.data;

  // Un fuseau invalide fausserait TOUS les créneaux du type de RDV, en silence.
  // On refuse plutôt que de retomber sur un défaut que l'hôte n'a pas choisi.
  if (!isValidTimeZone(b.timezone)) {
    return NextResponse.json(
      { ok: false, error: "invalid_timezone", message: "Fuseau horaire inconnu." },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const base = slugifyBooking(b.slug || b.name) || "rdv";

  // Le slug est unique GLOBALEMENT (il porte l'URL publique) : on suffixe
  // jusqu'à trouver libre, plutôt que de renvoyer une erreur à l'hôte.
  let slug = base;
  for (let i = 2; i < 40; i++) {
    const { data: taken } = await admin
      .from("booking_event_types")
      .select("id")
      .ilike("slug", slug)
      .maybeSingle();
    if (!taken) break;
    slug = `${base}-${i}`;
  }

  const { data, error } = await admin
    .from("booking_event_types")
    .insert({
      user_id: userId,
      slug,
      name: b.name.trim(),
      description: b.description?.trim() || null,
      duration_min: b.durationMin,
      buffer_min: b.bufferMin,
      min_notice_min: b.minNoticeMin,
      horizon_days: b.horizonDays,
      slot_step_min: b.slotStepMin,
      timezone: b.timezone,
      location_kind: b.locationKind,
      location_value: b.locationValue?.trim() || null,
      language: b.language,
      funnel_id: b.funnelId ?? null,
      active: true,
    })
    // Type explicite : sans base typée générée, l'inférence de supabase-js
    // peut retomber sur GenericStringError et bloquer l'accès aux colonnes.
    .select("id, slug")
    .maybeSingle<{ id: string; slug: string }>();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: "create_failed", message: error?.message ?? "Création impossible." },
      { status: 500 },
    );
  }

  // Disponibilité de départ : lundi→vendredi 9h-12h et 14h-17h. Un type de RDV
  // créé sans aucune plage n'afficherait AUCUN créneau — l'hôte croirait le
  // module cassé alors qu'il n'a simplement rien configuré.
  const rows = [1, 2, 3, 4, 5].flatMap((weekday) => [
    { event_type_id: data.id, weekday, start_min: 9 * 60, end_min: 12 * 60 },
    { event_type_id: data.id, weekday, start_min: 14 * 60, end_min: 17 * 60 },
  ]);
  await admin.from("booking_availability").insert(rows);

  return NextResponse.json({ ok: true, id: data.id, slug: data.slug });
}
