// app/api/booking/bookings/route.ts
//
// Agenda de l'hôte : liste de SES rendez-vous, et annulation côté hôte.
//
// Sans cette route, le module était une boîte noire : l'hôte recevait un
// e-mail par réservation, mais n'avait nulle part où consulter son agenda ni
// annuler un rendez-vous. Un calendrier de RDV sans vue des RDV n'en est pas un.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cancelBooking, getEventTypeById } from "@/lib/booking/repository";
import { sendCancellationEmails } from "@/lib/booking/emails";
import { formatDateInZone, formatTimeInZone, shortZoneLabel } from "@/lib/booking/timezones";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HostBookingRow = {
  id: string;
  event_type_id: string;
  starts_at: string;
  ends_at: string;
  visitor_timezone: string;
  host_timezone: string;
  visitor_name: string;
  visitor_email: string;
  visitor_phone: string | null;
  note: string | null;
  answers: Record<string, string | boolean> | null;
  status: string;
  manage_token: string;
};

async function requireUser(): Promise<string | null> {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user?.id ?? null;
}

export async function GET(req: Request) {
  const userId = await requireUser();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  // Par défaut : les RDV à venir. `scope=past` pour l'historique.
  const scope = url.searchParams.get("scope") === "past" ? "past" : "upcoming";
  const nowIso = new Date().toISOString();

  const admin = getSupabaseAdmin();

  const BASE_COLS =
    "id, event_type_id, starts_at, ends_at, visitor_timezone, host_timezone, " +
    "visitor_name, visitor_email, visitor_phone, note, status, manage_token";
  // 🆕 `answers` (migration 03). ⚠️ PostgREST rejette la requête ENTIÈRE si une
  // seule colonne demandée n'existe pas : demander `answers` avant que la
  // migration soit jouée ne masquait pas les réponses, cela vidait la liste des
  // rendez-vous. Le code ne peut pas présumer de l'ordre de déploiement, d'où
  // le repli explicite ci-dessous.
  const FULL_COLS = `${BASE_COLS}, answers`;

  const build = (cols: string) => {
    const q = admin.from("bookings").select(cols).eq("user_id", userId).limit(200);
    return scope === "upcoming"
      ? q.gte("starts_at", nowIso).order("starts_at", { ascending: true })
      : q.lt("starts_at", nowIso).order("starts_at", { ascending: false });
  };

  let { data, error } = await build(FULL_COLS);
  if (
    error &&
    (error.code === "42703" ||
      /column .* does not exist/i.test(error.message ?? "") ||
      /could not find the '.*' column/i.test(error.message ?? ""))
  ) {
    console.warn(
      "[booking] Colonne answers absente — migration 03 non appliquée. " +
        "Les réponses personnalisées ne sont pas affichées.",
    );
    ({ data, error } = await build(BASE_COLS));
  }

  if (error) {
    return NextResponse.json(
      { ok: false, error: "db_error", message: error.message },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as unknown as HostBookingRow[];

  // Noms des types de RDV, en une passe plutôt qu'une requête par ligne.
  const names = new Map<string, string>();
  for (const id of new Set(rows.map((r) => r.event_type_id))) {
    const t = await getEventTypeById(id);
    if (t) names.set(id, t.name);
  }

  return NextResponse.json({
    ok: true,
    bookings: rows.map((r) => {
      const starts = new Date(r.starts_at);
      const ends = new Date(r.ends_at);
      return {
        id: r.id,
        eventName: names.get(r.event_type_id) ?? "Rendez-vous",
        status: r.status,
        startsAt: r.starts_at,
        visitorName: r.visitor_name,
        visitorEmail: r.visitor_email,
        visitorPhone: r.visitor_phone,
        note: r.note,
        // 🆕 Objet normalisé : un `null` obligerait chaque appelant à tester
        // avant d'itérer.
        answers: r.answers ?? {},
        manageToken: r.manage_token,
        // Formaté côté serveur dans le fuseau de l'HÔTE : c'est son agenda.
        // Le fuseau du visiteur est rappelé à part, pour qu'il sache à quelle
        // heure son interlocuteur croit avoir rendez-vous.
        whenHost: `${formatDateInZone(starts, r.host_timezone)} · ${formatTimeInZone(
          starts,
          r.host_timezone,
        )} – ${formatTimeInZone(ends, r.host_timezone)} (${shortZoneLabel(r.host_timezone)})`,
        visitorTimeLabel:
          r.visitor_timezone === r.host_timezone
            ? null
            : `${formatTimeInZone(starts, r.visitor_timezone)} chez ${r.visitor_name} (${shortZoneLabel(
                r.visitor_timezone,
              )})`,
      };
    }),
  });
}

const cancelSchema = z.object({
  manageToken: z.string().min(10),
  reason: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const userId = await requireUser();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const parsed = cancelSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, user_id, event_type_id, starts_at, ends_at, visitor_timezone, host_timezone, visitor_name, visitor_email")
    .eq("manage_token", parsed.data.manageToken)
    .maybeSingle<{
      id: string;
      user_id: string;
      event_type_id: string;
      starts_at: string;
      ends_at: string;
      visitor_timezone: string;
      host_timezone: string;
      visitor_name: string;
      visitor_email: string;
    }>();

  // Le jeton seul ne suffit pas ici : on vérifie AUSSI la propriété, sinon un
  // hôte connaissant un jeton pourrait annuler le RDV d'un autre.
  if (!booking || booking.user_id !== userId) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const done = await cancelBooking(parsed.data.manageToken, "host", parsed.data.reason);
  if (!done) {
    return NextResponse.json(
      { ok: false, error: "cancel_failed", message: "Annulation impossible." },
      { status: 500 },
    );
  }

  const eventType = await getEventTypeById(booking.event_type_id);
  let hostEmail: string | null = null;
  try {
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    hostEmail = authUser?.user?.email ?? null;
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
      hostName: eventType?.name ?? "L'organisateur",
      hostEmail,
      manageUrl: "",
      language: eventType?.language ?? "fr",
    },
    "host",
  ).catch(() => null);

  return NextResponse.json({ ok: true });
}
