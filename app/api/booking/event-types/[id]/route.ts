// app/api/booking/event-types/[id]/route.ts
//
// Mise à jour / suppression d'un type de RDV, et remplacement en bloc de ses
// disponibilités et exceptions. Route AUTHENTIFIÉE.
//
// Les disponibilités sont remplacées ENTIÈREMENT (delete puis insert) plutôt
// que réconciliées ligne à ligne : une grille hebdomadaire est éditée comme un
// tout dans l'interface, et une réconciliation partielle laisserait des plages
// fantômes en cas d'échec au milieu.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isValidTimeZone } from "@/lib/booking/timezones";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireOwner(eventTypeId: string): Promise<string | null> {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const { data } = await getSupabaseAdmin()
    .from("booking_event_types")
    .select("user_id")
    .eq("id", eventTypeId)
    // Type explicite : sans base typée générée, l'inférence de supabase-js
    // peut retomber sur GenericStringError et bloquer l'accès aux colonnes.
    .maybeSingle<{ user_id: string }>();
  if (!data || data.user_id !== user.id) return null;
  return user.id;
}

const ruleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMin: z.number().int().min(0).max(1440),
  endMin: z.number().int().min(0).max(1440),
});

const exceptionSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(["closed", "window"]),
  startMin: z.number().int().min(0).max(1440).nullable().optional(),
  endMin: z.number().int().min(0).max(1440).nullable().optional(),
  note: z.string().max(200).nullable().optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  durationMin: z.number().int().min(5).max(480).optional(),
  bufferMin: z.number().int().min(0).max(240).optional(),
  minNoticeMin: z.number().int().min(0).max(43200).optional(),
  horizonDays: z.number().int().min(1).max(365).optional(),
  slotStepMin: z.number().int().min(5).max(120).optional(),
  timezone: z.string().optional(),
  locationKind: z.enum(["visio", "phone", "in_person", "custom"]).optional(),
  locationValue: z.string().max(300).nullable().optional(),
  active: z.boolean().optional(),
  availability: z.array(ruleSchema).max(60).optional(),
  exceptions: z.array(exceptionSchema).max(200).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await requireOwner(id);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const b = parsed.data;

  if (b.timezone !== undefined && !isValidTimeZone(b.timezone)) {
    return NextResponse.json(
      { ok: false, error: "invalid_timezone", message: "Fuseau horaire inconnu." },
      { status: 400 },
    );
  }

  // Une plage vide ou inversée passerait la validation Zod champ par champ.
  for (const r of b.availability ?? []) {
    if (r.endMin <= r.startMin) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_range",
          message: "Une plage horaire doit se terminer après son début.",
        },
        { status: 400 },
      );
    }
  }
  for (const e of b.exceptions ?? []) {
    if (e.kind === "window" && (e.startMin == null || e.endMin == null || e.endMin <= e.startMin)) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_range",
          message: "Une ouverture exceptionnelle doit avoir un début et une fin cohérents.",
        },
        { status: 400 },
      );
    }
  }

  const admin = getSupabaseAdmin();

  const patch: Record<string, unknown> = {};
  if (b.name !== undefined) patch.name = b.name.trim();
  if (b.description !== undefined) patch.description = b.description?.trim() || null;
  if (b.durationMin !== undefined) patch.duration_min = b.durationMin;
  if (b.bufferMin !== undefined) patch.buffer_min = b.bufferMin;
  if (b.minNoticeMin !== undefined) patch.min_notice_min = b.minNoticeMin;
  if (b.horizonDays !== undefined) patch.horizon_days = b.horizonDays;
  if (b.slotStepMin !== undefined) patch.slot_step_min = b.slotStepMin;
  if (b.timezone !== undefined) patch.timezone = b.timezone;
  if (b.locationKind !== undefined) patch.location_kind = b.locationKind;
  if (b.locationValue !== undefined) patch.location_value = b.locationValue?.trim() || null;
  if (b.active !== undefined) patch.active = b.active;

  if (Object.keys(patch).length > 0) {
    const { error } = await admin.from("booking_event_types").update(patch).eq("id", id);
    if (error) {
      return NextResponse.json(
        { ok: false, error: "update_failed", message: error.message },
        { status: 500 },
      );
    }
  }

  if (b.availability) {
    await admin.from("booking_availability").delete().eq("event_type_id", id);
    if (b.availability.length > 0) {
      const { error } = await admin.from("booking_availability").insert(
        b.availability.map((r) => ({
          event_type_id: id,
          weekday: r.weekday,
          start_min: r.startMin,
          end_min: r.endMin,
        })),
      );
      if (error) {
        return NextResponse.json(
          { ok: false, error: "availability_failed", message: error.message },
          { status: 500 },
        );
      }
    }
  }

  if (b.exceptions) {
    await admin.from("booking_exceptions").delete().eq("event_type_id", id);
    if (b.exceptions.length > 0) {
      const { error } = await admin.from("booking_exceptions").insert(
        b.exceptions.map((e) => ({
          event_type_id: id,
          day: e.day,
          kind: e.kind,
          start_min: e.kind === "window" ? e.startMin : null,
          end_min: e.kind === "window" ? e.endMin : null,
          note: e.note ?? null,
        })),
      );
      if (error) {
        return NextResponse.json(
          { ok: false, error: "exceptions_failed", message: error.message },
          { status: 500 },
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await requireOwner(id);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // Supprimer un type de RDV supprime en cascade ses réservations : on refuse
  // tant qu'il reste des rendez-vous confirmés à venir, sinon des gens se
  // présenteraient à un rendez-vous que plus personne n'a en base.
  const admin = getSupabaseAdmin();
  const { count } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("event_type_id", id)
    .eq("status", "confirmed")
    .gte("starts_at", new Date().toISOString());

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "has_upcoming_bookings",
        message:
          `Ce type de RDV a encore ${count} rendez-vous à venir. Désactive-le pour ` +
          `fermer les réservations sans effacer l'existant.`,
      },
      { status: 409 },
    );
  }

  const { error } = await admin.from("booking_event_types").delete().eq("id", id);
  if (error) {
    return NextResponse.json(
      { ok: false, error: "delete_failed", message: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
