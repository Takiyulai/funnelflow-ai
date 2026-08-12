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
  BookingSession,
  BusyInterval,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Colonnes présentes depuis toujours. Une requête bâtie sur cette liste
 * fonctionne quel que soit l'état des migrations.
 */
const EVENT_TYPE_COLS_BASE =
  "id, user_id, slug, name, description, duration_min, buffer_min, min_notice_min, " +
  "horizon_days, slot_step_min, timezone, location_kind, location_value, color, " +
  "host_name, host_title, host_avatar_url, host_bio, " +
  "language, active, funnel_id";

/**
 * 🆕 Avec les champs de formulaire personnalisés (migration 03).
 *
 * ⚠️ POURQUOI DEUX LISTES, ET UN REPLI.
 *
 * PostgREST rejette la requête ENTIÈRE si une seule colonne demandée n'existe
 * pas. Ajouter `form_fields` au select sans que la migration soit appliquée ne
 * dégrade donc pas la fonctionnalité : elle vide l'écran « Rendez-vous » en
 * entier — plus aucun type, plus aucune réservation.
 *
 * Le code ne peut pas présumer de l'ordre de déploiement : sur Vercel, le code
 * part avant que la migration soit jouée à la main. On tente donc la liste
 * complète, et on retombe sur la liste de base si la colonne manque. Le seul
 * effet est que les champs personnalisés restent invisibles jusqu'à la
 * migration — au lieu de tout casser.
 */
const EVENT_TYPE_COLS = `${EVENT_TYPE_COLS_BASE}, form_fields, mode, capacity`;

/** Code PostgREST « colonne inconnue » (undefined_column côté PostgreSQL). */
function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    /column .* does not exist/i.test(error.message ?? "") ||
    /could not find the '.*' column/i.test(error.message ?? "")
  );
}

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
    // 🆕 Tableau de champs, ou null → le widget applique les champs par défaut.
    // On vérifie le type : un jsonb mal formé (édition manuelle en base,
    // import) ne doit pas faire planter le rendu du formulaire public.
    formFields: Array.isArray(r.form_fields) ? r.form_fields : null,
    // 🆕 Migration 04. Repli sur "consultation" : c'est le comportement
    // historique, et le seul que le moteur de créneaux savait produire avant.
    mode: r.mode ?? "consultation",
    capacity: typeof r.capacity === "number" ? r.capacity : null,
    language: r.language ?? "fr",
    active: r.active,
    funnelId: r.funnel_id,
  };
}

export async function getEventTypeBySlug(slug: string): Promise<BookingEventType | null> {
  const admin = getSupabaseAdmin();
  const run = (cols: string) =>
    admin.from("booking_event_types").select(cols).ilike("slug", slug).maybeSingle();

  let { data, error } = await run(EVENT_TYPE_COLS);
  if (isMissingColumnError(error)) ({ data } = await run(EVENT_TYPE_COLS_BASE));
  return data ? rowToEventType(data) : null;
}

export async function getEventTypeById(id: string): Promise<BookingEventType | null> {
  const admin = getSupabaseAdmin();
  const run = (cols: string) =>
    admin.from("booking_event_types").select(cols).eq("id", id).maybeSingle();

  let { data, error } = await run(EVENT_TYPE_COLS);
  if (isMissingColumnError(error)) ({ data } = await run(EVENT_TYPE_COLS_BASE));
  return data ? rowToEventType(data) : null;
}

export async function listEventTypes(userId: string): Promise<BookingEventType[]> {
  const admin = getSupabaseAdmin();
  const run = (cols: string) =>
    admin
      .from("booking_event_types")
      .select(cols)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

  let { data, error } = await run(EVENT_TYPE_COLS);
  if (isMissingColumnError(error)) {
    console.warn(
      "[booking] Colonne form_fields absente — migration 03 non appliquée. " +
        "Les champs de formulaire personnalisés sont ignorés jusque-là.",
    );
    ({ data } = await run(EVENT_TYPE_COLS_BASE));
  }
  return (data ?? []).map(rowToEventType);
}

// ───────────────────────────────────────────────────────────────────────────
// 🆕 SÉANCES DATÉES (mode `event`)
//
// Un atelier n'a pas de disponibilités hebdomadaires : il a des dates, fixées
// par l'hôte. Chacune porte sa propre limite d'inscrits, qui peut différer de
// celle du type — une session d'ouverture à 100 places, les suivantes à 30.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Séances d'un type de RDV, avec le NOMBRE D'INSCRITS de chacune.
 *
 * Le comptage est fait ici, en une seule requête, plutôt que côté appelant :
 * c'est lui qui décide si une séance est complète, et le laisser à la charge
 * de chaque écran garantirait des divergences.
 *
 * ⚠️ Seules les réservations `confirmed` comptent. Une annulation doit libérer
 * la place immédiatement, sinon un atelier se remplit de fantômes.
 */
export async function getSessions(
  eventTypeId: string,
  opts: { fromNow?: boolean } = {},
): Promise<BookingSession[]> {
  const admin = getSupabaseAdmin();

  let q = admin
    .from("booking_sessions")
    .select("id, event_type_id, starts_at, ends_at, capacity")
    .eq("event_type_id", eventTypeId)
    .order("starts_at", { ascending: true });

  // Le public ne doit voir que les séances à venir ; l'hôte veut tout son
  // historique pour dupliquer une date passée.
  if (opts.fromNow) q = q.gte("starts_at", new Date().toISOString());

  const { data, error } = await q;
  if (error || !data) return [];

  const sessions = data as any[];
  if (sessions.length === 0) return [];

  const { data: counts } = await admin
    .from("bookings")
    .select("session_id")
    .in("session_id", sessions.map((s) => s.id))
    .eq("status", "confirmed");

  const bookedBySession = new Map<string, number>();
  for (const row of (counts ?? []) as { session_id: string | null }[]) {
    if (!row.session_id) continue;
    bookedBySession.set(row.session_id, (bookedBySession.get(row.session_id) ?? 0) + 1);
  }

  return sessions.map((s) => ({
    id: s.id,
    eventTypeId: s.event_type_id,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    capacity: typeof s.capacity === "number" ? s.capacity : null,
    bookedCount: bookedBySession.get(s.id) ?? 0,
  }));
}

/**
 * Remplace TOUTES les séances d'un type de RDV.
 *
 * Remplacement et non fusion : l'éditeur envoie la liste complète, et
 * raisonner en delta demanderait des identifiants stables côté client pour un
 * gain nul à cette échelle.
 *
 * ⚠️ Les séances déjà RÉSERVÉES sont préservées : les supprimer effacerait en
 * cascade les inscriptions (`on delete set null` sur bookings.session_id), et
 * des participants se présenteraient à un atelier que plus personne n'a en
 * base. Une séance qu'on tente de retirer alors qu'elle a des inscrits est
 * donc conservée.
 */
export async function replaceSessions(
  eventTypeId: string,
  sessions: { id?: string; startsAt: string; endsAt: string; capacity?: number | null }[],
): Promise<void> {
  const admin = getSupabaseAdmin();

  const existing = await getSessions(eventTypeId);
  const keptIds = new Set(sessions.map((s) => s.id).filter(Boolean) as string[]);

  const protectedIds = existing
    .filter((s) => (s.bookedCount ?? 0) > 0)
    .map((s) => s.id);

  const toDelete = existing
    .filter((s) => !keptIds.has(s.id) && (s.bookedCount ?? 0) === 0)
    .map((s) => s.id);

  if (toDelete.length > 0) {
    await admin.from("booking_sessions").delete().in("id", toDelete);
  }

  for (const s of sessions) {
    if (s.id) {
      await admin
        .from("booking_sessions")
        .update({
          starts_at: s.startsAt,
          ends_at: s.endsAt,
          capacity: s.capacity ?? null,
        })
        .eq("id", s.id);
    } else {
      await admin.from("booking_sessions").insert({
        event_type_id: eventTypeId,
        starts_at: s.startsAt,
        ends_at: s.endsAt,
        capacity: s.capacity ?? null,
      });
    }
  }

  if (protectedIds.length > 0) {
    console.log(
      `[booking] ${protectedIds.length} séance(s) conservée(s) : des inscrits y sont rattachés.`,
    );
  }
}

/**
 * Une place reste-t-elle sur cette séance ?
 *
 * Vérifié au moment de la réservation, par COMPTAGE — un index unique ne sait
 * pas exprimer « au plus N ». Deux inscriptions simultanées sur la dernière
 * place peuvent donc théoriquement passer toutes les deux. C'est un compromis
 * assumé : sur un atelier, une place en trop est un désagrément ; sur un
 * rendez-vous individuel, ce serait une collision, et c'est justement pour ça
 * que ce cas-là reste protégé par l'index unique.
 */
export async function sessionHasRoom(
  sessionId: string,
  fallbackCapacity: number | null | undefined,
): Promise<{ ok: boolean; remaining: number }> {
  const admin = getSupabaseAdmin();

  const { data: session } = await admin
    .from("booking_sessions")
    .select("capacity")
    .eq("id", sessionId)
    .maybeSingle<{ capacity: number | null }>();

  const capacity = session?.capacity ?? fallbackCapacity ?? 1;

  const { count } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("status", "confirmed");

  const remaining = Math.max(0, capacity - (count ?? 0));
  return { ok: remaining > 0, remaining };
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
  /** 🆕 Réponses aux champs personnalisés, indexées par `name` de champ. */
  answers?: Record<string, string | boolean> | null;
  /** 🆕 Séance rattachée (mode `event`). Null pour un rendez-vous individuel. */
  sessionId?: string | null;
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
  const admin = getSupabaseAdmin();

  const baseRow = {
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
    // 🆕 Décide de quelle règle d'unicité s'applique : null → index
    // anti-double-réservation (1 personne), renseigné → plafond par comptage.
    session_id: input.sessionId ?? null,
  };

  // 🆕 Objet vide normalisé en null : `{}` en base laisserait croire à des
  // réponses, et compliquerait les filtres jsonb.
  const answers =
    input.answers && Object.keys(input.answers).length > 0 ? input.answers : null;

  const insert = (row: Record<string, unknown>) =>
    admin
      .from("bookings")
      .insert(row)
      .select("id, manage_token")
      .maybeSingle<{ id: string; manage_token: string }>();

  // ⚠️ La colonne `answers` vient de la migration 03. Si elle n'est pas encore
  // appliquée, l'insert échouerait — et le visiteur perdrait sa réservation
  // pour une raison qui ne le concerne pas. On réessaie sans, en perdant les
  // réponses plutôt que le rendez-vous.
  let { data, error } = await insert({ ...baseRow, answers });
  if (isMissingColumnError(error)) {
    console.warn(
      "[booking] Colonne answers absente — migration 03 non appliquée. " +
        "Réservation enregistrée SANS les réponses personnalisées.",
    );
    ({ data, error } = await insert(baseRow));
  }

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
  /**
   * 🆕 Réponses aux champs personnalisés du formulaire de réservation.
   * Rangées dans `metadata` : ce sont des données ouvertes, propres à chaque
   * type de RDV, qui n'ont pas de colonne dédiée dans `leads`.
   */
  answers?: Record<string, string | boolean> | null;
}): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const email = args.email.toLowerCase().trim();
  const hasAnswers = !!args.answers && Object.keys(args.answers).length > 0;
  try {
    const { data: existing } = await admin
      .from("leads")
      .select("id, metadata")
      .eq("user_id", args.userId)
      .eq("email", email)
      .maybeSingle<{ id: string; metadata: Record<string, unknown> | null }>();

    if (existing?.id) {
      // 🆕 Fusion, jamais remplacement : un contact qui reprend rendez-vous ne
      // doit pas perdre les réponses de la première fois. Les nouvelles
      // valeurs gagnent sur les anciennes pour une même clé.
      const mergedMetadata = hasAnswers
        ? { ...(existing.metadata ?? {}), ...args.answers }
        : undefined;
      await admin
        .from("leads")
        .update({
          name: args.name || undefined,
          phone: args.phone || undefined,
          metadata: mergedMetadata,
        })
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
        metadata: hasAnswers ? args.answers : {},
      })
      .select("id")
      .maybeSingle<{ id: string }>();
    return data?.id ?? null;
  } catch (e) {
    console.warn("[booking] création du lead impossible :", e);
    return null;
  }
}
