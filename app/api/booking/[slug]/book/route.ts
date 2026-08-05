// app/api/booking/[slug]/book/route.ts
//
// Création d'une réservation — route PUBLIQUE.
//
// ── TROIS BARRIÈRES, DANS CET ORDRE ────────────────────────────────────────
// 1. Limite de débit par IP : une route publique qui écrit en base et envoie
//    des e-mails est une cible évidente.
// 2. REVALIDATION SERVEUR du créneau. On ne fait jamais confiance au client :
//    entre l'affichage de la grille et le clic, le créneau a pu être pris, ou
//    passer sous le délai minimum. Un appel forgé pourrait aussi viser 3 h du
//    matin un dimanche.
// 3. Index unique en base. Deux visiteurs qui cliquent à la même seconde
//    passent TOUS LES DEUX l'étape 2 : seule la contrainte d'unicité tranche.
//    C'est pourquoi le code 23505 est traité comme un cas fonctionnel normal.

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createBooking,
  getEventTypeBySlug,
  loadSchedulingContext,
  upsertLeadForBooking,
} from "@/lib/booking/repository";
import { isSlotBookable } from "@/lib/booking/slots";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "@/lib/booking/timezones";
import { sendBookingEmails } from "@/lib/booking/emails";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  startsAt: z.string().min(10),
  timezone: z.string().optional(),
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  phone: z.string().max(40).optional(),
  note: z.string().max(1000).optional(),
});

/** Libellé du lieu, tel qu'il apparaîtra dans l'e-mail et le .ics. */
function locationLabel(kind: string, value?: string | null): string | null {
  if (kind === "visio") return value || "Visioconférence (lien envoyé par e-mail)";
  if (kind === "phone") return value ? `Appel téléphonique — ${value}` : "Appel téléphonique";
  if (kind === "in_person") return value || "En personne";
  return value || null;
}

function appOrigin(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  try {
    return new URL(req.url).origin;
  } catch {
    return "";
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const rl = await rateLimit(`booking:${clientIp(req)}`, 12, 3600);
  if (!rl.ok) return tooManyRequests(600);

  const eventType = await getEventTypeBySlug(slug);
  if (!eventType || !eventType.active) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "Ce lien de réservation n'est plus actif." },
      { status: 404 },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_input", message: "Vérifie ton nom et ton adresse e-mail." },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const startMs = Date.parse(body.startsAt);
  if (!Number.isFinite(startMs)) {
    return NextResponse.json(
      { ok: false, error: "invalid_slot", message: "Créneau invalide." },
      { status: 400 },
    );
  }
  const startsAt = new Date(startMs);
  const endsAt = new Date(startMs + eventType.durationMin * 60_000);

  const visitorTimezone = isValidTimeZone(body.timezone) ? body.timezone : DEFAULT_TIMEZONE;

  // ── Barrière 2 : revalidation complète côté serveur ──────────────────────
  const now = new Date();
  const to = new Date(now.getTime() + eventType.horizonDays * 24 * 60 * 60_000);
  const { rules, exceptions, busy } = await loadSchedulingContext(eventType, now, to);

  const check = isSlotBookable(startsAt.toISOString(), {
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
  });
  if (!check.ok) {
    return NextResponse.json(
      { ok: false, error: "slot_unavailable", message: check.reason },
      { status: 409 },
    );
  }

  // Le lead est créé AVANT la réservation pour pouvoir l'y rattacher, mais son
  // échec ne bloque rien : un RDV pris vaut mieux qu'un CRM parfait.
  const leadId = await upsertLeadForBooking({
    userId: eventType.userId,
    funnelId: eventType.funnelId,
    email: body.email,
    name: body.name,
    phone: body.phone,
    language: eventType.language,
  });

  // ── Barrière 3 : l'écriture, arbitrée par l'index unique ─────────────────
  const created = await createBooking({
    eventType,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    visitorTimezone,
    visitorName: body.name.trim(),
    visitorEmail: body.email.toLowerCase().trim(),
    visitorPhone: body.phone,
    note: body.note,
    leadId,
  });

  if (!created.ok) {
    return NextResponse.json(
      { ok: false, error: created.reason, message: created.message },
      { status: created.reason === "slot_taken" ? 409 : 500 },
    );
  }

  // Coordonnées de l'hôte, pour l'e-mail et le champ ORGANIZER du .ics.
  let hostEmail: string | null = null;
  let hostName = eventType.name;
  try {
    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from("profiles")
      .select("marketing_sender_name, custom_email_from")
      // Type explicite : sans base typée générée, l'inférence de supabase-js
      // peut retomber sur GenericStringError et bloquer l'accès aux colonnes.
      .eq("user_id", eventType.userId)
      .maybeSingle<{ marketing_sender_name: string | null; custom_email_from: string | null }>();
    hostName = (profile?.marketing_sender_name as string) || hostName;
    hostEmail = (profile?.custom_email_from as string) || null;
    if (!hostEmail) {
      const { data: authUser } = await admin.auth.admin.getUserById(eventType.userId);
      hostEmail = authUser?.user?.email ?? null;
    }
  } catch {
    /* best-effort */
  }

  const manageUrl = `${appOrigin(req)}/rdv/gerer/${created.manageToken}`;

  // Envoi best-effort : la réservation est DÉJÀ écrite. Répondre en erreur
  // parce qu'un e-mail n'est pas parti pousserait le visiteur à réserver deux
  // fois — et le second essai échouerait sur son propre créneau.
  await sendBookingEmails(
    {
      bookingId: created.id,
      eventName: eventType.name,
      startsAt,
      endsAt,
      hostTimezone: eventType.timezone,
      visitorTimezone,
      visitorName: body.name.trim(),
      visitorEmail: body.email.toLowerCase().trim(),
      hostName,
      hostEmail,
      locationLabel: locationLabel(eventType.locationKind, eventType.locationValue),
      note: body.note,
      manageUrl,
      language: eventType.language,
    },
    hostName,
  ).catch(() => null);

  return NextResponse.json({
    ok: true,
    bookingId: created.id,
    manageUrl,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    visitorTimezone,
    hostTimezone: eventType.timezone,
  });
}
