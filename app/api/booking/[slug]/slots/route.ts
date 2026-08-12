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
import { resolveBookingColor } from "@/lib/booking/colors";
import { ensureEmailField, resolveBookingFields } from "@/lib/booking/formFields";
import { getSessions } from "@/lib/booking/repository";
import { usesFixedSessions } from "@/lib/booking/types";

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

  // 🆕 MODE `event` — les créneaux ne sont pas CALCULÉS, ils sont PUBLIÉS.
  //
  // Un atelier n'a pas de disponibilités hebdomadaires : l'hôte fixe des dates.
  // On court-circuite donc entièrement le moteur de créneaux et on renvoie les
  // séances telles quelles, avec leurs places restantes — c'est cette
  // information qui décide de l'inscription, pas l'heure.
  if (usesFixedSessions(eventType.mode)) {
    const sessions = await getSessions(eventType.id, { fromNow: true });
    const defaultCapacity = eventType.capacity ?? 1;

    return NextResponse.json({
      ok: true,
      eventType: {
        slug: eventType.slug,
        name: eventType.name,
        description: eventType.description,
        durationMin: eventType.durationMin,
        locationKind: eventType.locationKind,
        color: resolveBookingColor(eventType.color),
        hostName: eventType.hostName ?? null,
        hostTitle: eventType.hostTitle ?? null,
        hostAvatarUrl: eventType.hostAvatarUrl ?? null,
        hostBio: eventType.hostBio ?? null,
        formFields: ensureEmailField(resolveBookingFields(eventType)),
        mode: eventType.mode ?? "consultation",
      },
      visitorTimezone,
      visitorTimezoneLabel: shortZoneLabel(visitorTimezone),
      daylightNotice: daylightSavingNotice(eventType.timezone, eventType.language),
      // Contrat distinct de `days` : le widget sait qu'en mode event il affiche
      // une LISTE DE SÉANCES, pas une grille de jours.
      sessions: sessions.map((s) => {
        const capacity = s.capacity ?? defaultCapacity;
        const booked = s.bookedCount ?? 0;
        return {
          id: s.id,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          capacity,
          remaining: Math.max(0, capacity - booked),
          full: booked >= capacity,
        };
      }),
      days: [],
    });
  }

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
      // 🔒 `locationValue` N'EST PLUS EXPOSÉ.
      //
      // Ce champ contient l'URL de visioconférence ou l'adresse physique du
      // rendez-vous. Le widget avait cessé de l'AFFICHER, mais il continuait
      // de transiter dans la réponse d'un endpoint public et sans
      // authentification : n'importe qui appelant /api/booking/<slug>/slots
      // pouvait lire le lien de réunion et s'y inviter.
      //
      // Le lieu réel part dans l'e-mail de confirmation et le .ics, donc à la
      // personne qui a effectivement réservé. La page publique n'a besoin que
      // de la NATURE du rendez-vous, portée par `locationKind`.
      language: eventType.language,
      timezone: eventType.timezone,
      timezoneLabel: shortZoneLabel(eventType.timezone),
      horizonDays: eventType.horizonDays,
      // 🆕 Couleur d'accent, déjà repliée sur la couleur de marque côté serveur :
      // le widget n'a aucun cas d'absence à gérer.
      color: resolveBookingColor(eventType.color),

      // 🆕 Fiche hôte. Ces champs sont destinés à être PUBLICS : ils ne sont
      // renseignés que pour être montrés au prospect. On les renvoie tels
      // quels, sans repli — c'est l'absence qui commande le non-affichage.
      hostName: eventType.hostName ?? null,
      hostTitle: eventType.hostTitle ?? null,
      hostAvatarUrl: eventType.hostAvatarUrl ?? null,
      hostBio: eventType.hostBio ?? null,

      // 🆕 Champs du formulaire, RÉSOLUS côté serveur : le widget n'a pas à
      // connaître la règle de repli, et un type de RDV sans personnalisation
      // reçoit la liste par défaut au lieu de `null` à interpréter.
      // `ensureEmailField` garantit qu'une adresse est toujours demandée —
      // sans elle, ni confirmation ni annulation ne sont possibles.
      formFields: ensureEmailField(resolveBookingFields(eventType)),
    },
    visitorTimezone,
    visitorTimezoneLabel: shortZoneLabel(visitorTimezone),
    // Affiché à l'hôte comme au visiteur quand l'un des deux fuseaux bouge :
    // c'est ce qui explique qu'un créneau « change d'heure » deux fois par an.
    daylightNotice: daylightSavingNotice(eventType.timezone, eventType.language),
    days: daySlots,
  });
}
