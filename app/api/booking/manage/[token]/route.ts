// app/api/booking/manage/[token]/route.ts
//
// Consultation / annulation d'un rendez-vous par son JETON DE GESTION.
//
// Le jeton (24 octets aléatoires) sert d'authentification : le visiteur n'a pas
// de compte. C'est le même principe qu'un lien de désinscription. Deux
// conséquences assumées :
//   - on ne renvoie QUE ce rendez-vous, jamais l'agenda de l'hôte ;
//   - le jeton n'est pas devinable et n'apparaît que dans l'e-mail du visiteur.

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  cancelBooking,
  getBookingByToken,
  getEventTypeById,
  type BookingRow,
} from "@/lib/booking/repository";
import { sendCancellationEmails } from "@/lib/booking/emails";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { formatDateInZone, formatTimeInZone, shortZoneLabel } from "@/lib/booking/timezones";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function publicView(b: BookingRow, eventName: string) {
  const starts = new Date(b.starts_at);
  const ends = new Date(b.ends_at);
  return {
    eventName,
    status: b.status,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    visitorName: b.visitor_name,
    visitorTimezone: b.visitor_timezone,
    hostTimezone: b.host_timezone,
    // Pré-formaté côté serveur pour que la page affiche la même chose partout,
    // quel que soit le fuseau de la machine qui rend le HTML.
    whenVisitor: `${formatDateInZone(starts, b.visitor_timezone)} · ${formatTimeInZone(
      starts,
      b.visitor_timezone,
    )} – ${formatTimeInZone(ends, b.visitor_timezone)} (${shortZoneLabel(b.visitor_timezone)})`,
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const booking = await getBookingByToken(token);
  if (!booking) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "Ce lien de gestion n'est plus valide." },
      { status: 404 },
    );
  }
  const eventType = await getEventTypeById(booking.event_type_id);
  return NextResponse.json({
    ok: true,
    booking: publicView(booking, eventType?.name ?? "Rendez-vous"),
  });
}

const cancelSchema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const rl = await rateLimit(`booking-cancel:${clientIp(req)}`, 20, 3600);
  if (!rl.ok) return tooManyRequests(600);

  const booking = await getBookingByToken(token);
  if (!booking) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "Ce lien de gestion n'est plus valide." },
      { status: 404 },
    );
  }
  if (booking.status === "cancelled") {
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }

  const parsed = cancelSchema.safeParse(await req.json().catch(() => ({})));
  const reason = parsed.success ? parsed.data.reason : undefined;

  const done = await cancelBooking(token, "visitor", reason);
  if (!done) {
    return NextResponse.json(
      { ok: false, error: "cancel_failed", message: "Annulation impossible. Réessaie." },
      { status: 500 },
    );
  }

  const eventType = await getEventTypeById(booking.event_type_id);

  let hostEmail: string | null = null;
  let hostName = eventType?.name ?? "L'organisateur";
  try {
    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from("profiles")
      .select("marketing_sender_name, custom_email_from")
      .eq("user_id", booking.user_id)
      // Type explicite : sans base typée générée, l'inférence de supabase-js
      // peut retomber sur GenericStringError et bloquer l'accès aux colonnes.
      .maybeSingle<{ marketing_sender_name: string | null; custom_email_from: string | null }>();
    hostName = (profile?.marketing_sender_name as string) || hostName;
    hostEmail = (profile?.custom_email_from as string) || null;
    if (!hostEmail) {
      const { data: authUser } = await admin.auth.admin.getUserById(booking.user_id);
      hostEmail = authUser?.user?.email ?? null;
    }
  } catch {
    /* best-effort */
  }

  await sendCancellationEmails(
    {
      bookingId: booking.id,
      eventName: eventType?.name ?? "Rendez-vous",
      startsAt: new Date(booking.starts_at),
      endsAt: new Date(booking.ends_at),
      hostTimezone: booking.host_timezone,
      visitorTimezone: booking.visitor_timezone,
      visitorName: booking.visitor_name,
      visitorEmail: booking.visitor_email,
      hostName,
      hostEmail,
      manageUrl: "",
      language: eventType?.language ?? "fr",
    },
    "visitor",
  ).catch(() => null);

  return NextResponse.json({ ok: true });
}
