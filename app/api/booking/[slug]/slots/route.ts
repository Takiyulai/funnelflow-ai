// app/api/booking/[slug]/slots/route.ts
//
// Grille de créneaux disponibles — route PUBLIQUE (aucune authentification).
//
// Elle n'expose QUE des créneaux libres : jamais l'identité des personnes déjà
// inscrites, ni les intervalles occupés bruts. Un agenda est une donnée
// personnelle — « Jean est occupé mardi 14h » n'a pas à sortir de l'application.

import { NextResponse } from "next/server";
import {
  getEventTypeBySlug,
  loadSchedulingContext,
} from "@/lib/booking/repository";
import { generateSlots } from "@/lib/booking/slots";
import {
  DEFAULT_TIMEZONE,
  daylightSavingNotice,
  isValidTimeZone,
  shortZoneLabel,
} from "@/lib/booking/timezones";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const url = new URL(req.url);

  const eventType = await getEventTypeBySlug(slug);
  if (!eventType || !eventType.active) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "Ce lien de réservation n'existe pas ou a été désactivé." },
      { status: 404 },
    );
  }

  // Fuseau du visiteur : proposé par le client, validé ici. Une valeur
  // fantaisiste ne doit pas faire tomber la page — on retombe sur le défaut.
  const rawTz = url.searchParams.get("tz");
  const visitorTimezone = isValidTimeZone(rawTz) ? rawTz : DEFAULT_TIMEZONE;

  const rawDays = parseInt(url.searchParams.get("days") ?? "", 10);
  const days = Number.isFinite(rawDays)
    ? Math.min(Math.max(rawDays, 1), eventType.horizonDays)
    : Math.min(14, eventType.horizonDays);

  const fromDay = url.searchParams.get("from") ?? undefined;

  const now = new Date();
  const to = new Date(now.getTime() + eventType.horizonDays * 24 * 60 * 60_000);
  const { rules, exceptions, busy } = await loadSchedulingContext(eventType, now, to);

  const daySlots = generateSlots({
    hostTimezone: eventType.timezone,
    visitorTimezone,
    durationMin: eventType.durationMin,
    bufferMin: eventType.bufferMin,
    minNoticeMin: eventType.minNoticeMin,
    horizonDays: eventType.horizonDays,
    slotStepMin: eventType.slotStepMin,
    rules,
    exceptions,
    busy,
    now,
    fromDay: fromDay && /^\d{4}-\d{2}-\d{2}$/.test(fromDay) ? fromDay : undefined,
    days,
  });

  return NextResponse.json({
    ok: true,
    eventType: {
      slug: eventType.slug,
      name: eventType.name,
      description: eventType.description,
      durationMin: eventType.durationMin,
      locationKind: eventType.locationKind,
      locationValue: eventType.locationValue,
      language: eventType.language,
      timezone: eventType.timezone,
      timezoneLabel: shortZoneLabel(eventType.timezone),
      horizonDays: eventType.horizonDays,
    },
    visitorTimezone,
    visitorTimezoneLabel: shortZoneLabel(visitorTimezone),
    // Affiché à l'hôte comme au visiteur quand l'un des deux fuseaux bouge :
    // c'est ce qui explique qu'un créneau « change d'heure » deux fois par an.
    daylightNotice: daylightSavingNotice(eventType.timezone, eventType.language),
    days: daySlots,
  });
}
