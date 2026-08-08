// lib/booking/repository.ts
//
// Accès données du module RDV — CÔTÉ SERVEUR UNIQUEMENT (client admin).
//
// La lecture publique (grille de créneaux) et l'écriture publique (réservation)
// passent par la clé de service, jamais par le client navigateur : aucune
// policy RLS n'autorise un anonyme à écrire dans `bookings`, sinon n'importe
// qui pourrait forger un rendez-vous au nom d'autrui ou lire l'agenda complet
// d'un hôte.

import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "./timezones";
import type {
  AvailabilityException,
  AvailabilityRule,
  BookingEventType,
  BusyInterval,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const EVENT_TYPE_COLS =
  "id, user_id, slug, name, description, duration_min, buffer_min, min_notice_min, " +
  "horizon_days, slot_step_min, timezone, location_kind, location_value, color, " +
  "host_name, host_title, host_avatar_url, host_bio, " +
  "language, active, funnel_id";

function rowToEventType(r: any): BookingEventType {
  return {
    id: r.id,
    userId: r.user_id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    durationMin: r.duration_min,
    bufferMin: r.buffer_min,
    minNoticeMin: r.min_notice_min,
    horizonDays: r.horizon_days,
    slotStepMin: r.slot_step_min,
    // Un fuseau invalide en base (migration, saisie manuelle) ne doit jamais
    // faire planter la page publique : on retombe sur le défaut.
    timezone: isValidTimeZone(r.timezone) ? r.timezone : DEFAULT_TIMEZONE,
    locationKind: r.location_kind,
    locationValue: r.location_value,
    color: r.color,
    // 🆕 Fiche hôte (optionnelle). `?? null` plutôt que la valeur brute : une
    // colonne absente renvoie `undefined`, ce qui traverserait `JSON.stringify`
    // en disparaissant de la réponse. On normalise pour que le widget ait
    // toujours une valeur explicite à tester.
    hostName: r.host_name ?? null,
    hostTitle: r.host_title ?? null,
    hostAvatarUrl: r.host_avatar_url ?? null,
    hostBio: r.host_bio ?? null,
    language: r.language ?? "fr",
    active: r.active,
    funnelId: r.funnel_id,
  };
}

export async function getEventTypeBySlug(slug: string): Promise<BookingEventType | null> {
  const { data } = await getSupabaseAdmin()
    .from("booking_event_types")
    .select(EVENT_TYPE_COLS)
    .ilike("slug", slug)
    .maybeSingle();
  return data ? rowToEventType(data) : null;
}

export async function getEventTypeById(id: string): Promise<BookingEventType | null> {
  const { data } = await getSupabaseAdmin()
    .from("booking_event_types")
    .select(EVENT_TYPE_COLS)
    .eq("id", id)
    .maybeSingle();
  return data ? rowToEventType(data) : null;
}

export async function listEventTypes(userId: string): Promise<BookingEventType[]> {
  const { data } = await getSupabaseAdmin()
    .from("booking_event_types")
    .select(EVENT_TYPE_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return (data ?? []).map(rowToEventType);
}

export async function getAvailability(eventTypeId: string): Promise<AvailabilityRule[]> {
  const { data } = await getSupabaseAdmin()
    .from("booking_availability")
    .select("id, weekday, start_min, end_min")
    .eq("event_type_id", eventTypeId)
    .order("weekday", { ascending: true })
    .order("start_min", { ascending: true });
  return (data ?? []).map((r: any) => ({
    id: r.id,
    weekday: r.weekday,
    startMin: r.start_min,
    endMin: r.end_min,
  }));
}

export async function getExceptions(eventTypeId: string): Promise<AvailabilityException[]> {
  const { data } = await getSupabaseAdmin()
    .from("booking_exceptions")
    .select("id, day, kind, start_min, end_min, note")
    .eq("event_type_id", eventTypeId);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    day: String(r.day).slice(0, 10),
    kind: r.kind,
    startMin: r.start_min,
    endMin: r.end_min,
    note: r.note,
  }));
}

/**
 * Réservations actives d'un type de RDV sur une fenêtre.
 *
 * On filtre sur `starts_at` uniquement : un rendez-vous dure au plus 8 h
 * (contrainte `duration_min <= 480`), donc élargir la borne basse d'une
 * journée suffit à capter tout RDV qui déborderait sur la fenêtre.
 */
export async function getBusyIntervals(
  eventTypeId: string,
  from: Date,
  to: Date,
): Promise<BusyInterval[]> {
  const lower = new Date(from.getTime() - 24 * 60 * 60_000);
  const { data } = await getSupabaseAdmin()
    .from("bookings")
    .select("starts_at, ends_at")
    .eq("event_type_id", eventTypeId)
    .neq("status", "cancelled")
    .gte("starts_at", lower.toISOString())
    .lte("starts_at", to.toISOString());
  return (data ?? []).map((r: any) => ({ startsAt: r.starts_at, endsAt: r.ends_at }));
}

/** Charge en une passe tout ce dont le moteur de créneaux a besoin. */
export async function loadSchedulingContext(
  eventType: BookingEventType,
  from: Date,
  to: Date,
): Promise<{ rules: AvailabilityRule[]; exceptions: AvailabilityException[]; busy: BusyInterval[] }> {
  const [rules, exceptions, busy] = await Promise.all([
    getAvailability(eventType.id),
    getExceptions(eventType.id),
    getBusyIntervals(eventType.id, from, to),
  ]);
  return { rules, exceptions, busy };
}

/**
 * URL de la page de CONFIRMATION du tunnel rattaché à ce type de RDV.
 *
 * ── POURQUOI DEUX CHEMINS DE RÉSOLUTION ────────────────────────────────────
 * 1. `booking_event_types.funnel_id`, quand il est renseigné (rattachement
 *    explicite depuis l'éditeur).
 * 2. À défaut, on cherche le tunnel PUBLIÉ de l'utilisateur dont
 *    `json_content.meta.bookingSlug` désigne ce type de RDV. C'est le cas des
 *    tunnels générés automatiquement : au moment de la génération, le tunnel
 *    n'existe pas encore en base (il est enregistré côté client ensuite), donc
 *    `funnel_id` ne PEUT PAS être posé à ce moment-là.
 *
 * Résoudre paresseusement, au moment de la réservation, évite d'ajouter une
 * écriture supplémentaire dans le chemin d'enregistrement du tunnel.
 *
 * Retourne null si aucun tunnel ne correspond : le calendrier reste alors
 * parfaitement utilisable seul, avec sa confirmation intégrée.
 */
export async function resolveConfirmationUrl(
  eventType: BookingEventType,
  origin: string,
): Promise<string | null> {
  const admin = getSupabaseAdmin();

  type FunnelRow = { slug: string; published_slug: string | null; json_content: any };

  const buildUrl = (row: FunnelRow): string | null => {
    const pages = row.json_content?.pages;
    if (!Array.isArray(pages)) return null;
    const confirmation = pages.find(
      (p: { role?: string }) => p?.role === "confirmation" || p?.role === "thankyou",
    );
    if (!confirmation?.slug) return null;
    const funnelSlug = row.published_slug || row.slug;
    if (!funnelSlug) return null;
    return `${origin}/tunnel/${funnelSlug}/${String(confirmation.slug).replace(/^\/+/, "")}`;
  };

  try {
    if (eventType.funnelId) {
      const { data } = await admin
        .from("funnels")
        .select("slug, published_slug, json_content")
        .eq("id", eventType.funnelId)
        .maybeSingle<FunnelRow>();
      if (data) {
        const url = buildUrl(data);
        if (url) return url;
      }
    }

    const { data } = await admin
      .from("funnels")
      .select("slug, published_slug, json_content")
      .eq("user_id", eventType.userId)
      .eq("status", "published")
      .eq("json_content->meta->>bookingSlug", eventType.slug)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<FunnelRow>();

    return data ? buildUrl(data) : null;
  } catch (e) {
    console.warn("[booking] résolution de la page de confirmation impossible :", e);
    return null;
  }
}

export type CreateBookingInput = {
  eventType: BookingEventType;
  startsAt: string;
  endsAt: string;
  visitorTimezone: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone?: string | null;
  note?: string | null;
  leadId?: string | null;
};

export type CreateBookingResult =
  | { ok: true; id: string; manageToken: string }
  | { ok: false; reason: "slot_taken" | "db_error"; message: string };

/**
 * Insère la réservation.
 *
 * Le code 23505 (violation d'unicité) signifie que l'index partiel
 * `bookings_no_double_booking_uidx` a fait son travail : un autre visiteur a
 * pris le créneau entre notre vérification et notre écriture. C'est le SEUL
 * point où cette course peut être tranchée — d'où la traduction explicite en
 * message utilisable plutôt qu'une erreur base brute.
 */
export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const { data, error } = await getSupabaseAdmin()
    .from("bookings")
    .insert({
      event_type_id: input.eventType.id,
      user_id: input.eventType.userId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      visitor_timezone: input.visitorTimezone,
      host_timezone: input.eventType.timezone,
      visitor_name: input.visitorName,
      visitor_email: input.visitorEmail,
      visitor_phone: input.visitorPhone ?? null,
      note: input.note ?? null,
      status: "confirmed",
      lead_id: input.leadId ?? null,
      funnel_id: input.eventType.funnelId ?? null,
    })
    .select("id, manage_token")
    .maybeSingle<{ id: string; manage_token: string }>();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        reason: "slot_taken",
        message: "Ce créneau vient d'être réservé par quelqu'un d'autre. Choisis-en un autre.",
      };
    }
    return { ok: false, reason: "db_error", message: error.message };
  }
  if (!data) {
    return { ok: false, reason: "db_error", message: "Réservation non confirmée." };
  }
  return { ok: true, id: data.id, manageToken: data.manage_token };
}

/**
 * Ligne brute de `bookings`, telle que la renvoie le client Supabase.
 *
 * ⚠️ Le type est déclaré À LA MAIN et le résultat casté. Sans base typée
 * générée, l'inférence de `supabase-js` sur une chaîne `select` un peu longue
 * abandonne et retombe sur `GenericStringError` — le compilateur refuse alors
 * tout accès aux colonnes, y compris valides. Le cast est donc la contrepartie
 * assumée : c'est CE type qui fait foi côté application.
 */
export type BookingRow = {
  id: string;
  event_type_id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  visitor_timezone: string;
  host_timezone: string;
  visitor_name: string;
  visitor_email: string;
  visitor_phone: string | null;
  note: string | null;
  status: string;
  manage_token: string;
};

export async function getBookingByToken(token: string): Promise<BookingRow | null> {
  const { data } = await getSupabaseAdmin()
    .from("bookings")
    .select(
      "id, event_type_id, user_id, starts_at, ends_at, visitor_timezone, host_timezone, " +
        "visitor_name, visitor_email, visitor_phone, note, status, manage_token",
    )
    .eq("manage_token", token)
    .maybeSingle();
  return (data as BookingRow | null) ?? null;
}

export async function cancelBooking(
  token: string,
  by: "visitor" | "host",
  reason?: string,
): Promise<boolean> {
  const { error } = await getSupabaseAdmin()
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: by,
      cancel_reason: reason?.slice(0, 500) ?? null,
    })
    .eq("manage_token", token)
    .neq("status", "cancelled");
  return !error;
}

/**
 * Rattache le visiteur au CRM. Le RDV est une conversion : ne pas créer le
 * lead reviendrait à perdre le contact le plus qualifié du tunnel.
 * Ne bloque jamais la réservation en cas d'échec.
 */
export async function upsertLeadForBooking(args: {
  userId: string;
  funnelId?: string | null;
  email: string;
  name?: string | null;
  phone?: string | null;
  language?: string;
}): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const email = args.email.toLowerCase().trim();
  try {
    const { data: existing } = await admin
      .from("leads")
      .select("id")
      .eq("user_id", args.userId)
      .eq("email", email)
      .maybeSingle<{ id: string }>();

    if (existing?.id) {
      await admin
        .from("leads")
        .update({ name: args.name || undefined, phone: args.phone || undefined })
        .eq("id", existing.id);
      return existing.id as string;
    }

    const { data } = await admin
      .from("leads")
      .insert({
        user_id: args.userId,
        funnel_id: args.funnelId ?? null,
        email,
        name: args.name?.trim() || null,
        phone: args.phone?.trim() || null,
        status: "nouveau",
        source: "booking",
        consent: true,
        language: args.language ?? "fr",
        metadata: {},
      })
      .select("id")
      .maybeSingle<{ id: string }>();
    return data?.id ?? null;
  } catch (e) {
    console.warn("[booking] création du lead impossible :", e);
    return null;
  }
}
