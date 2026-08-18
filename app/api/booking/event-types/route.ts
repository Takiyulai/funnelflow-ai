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
  // 🆕 Couleur choisie dans le wizard. Sans cette entrée, zod la retirerait en
  // silence et tous les rendez-vous naîtraient violets.
  color: z.string().max(9).optional(),
  // 🆕 Semaine type saisie à l'étape 3. Absente → plages par défaut.
  availability: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        startMin: z.number().int().min(0).max(1439),
        endMin: z.number().int().min(1).max(1440),
      }),
    )
    .max(60)
    .optional(),
  // 🆕 Fiche de l'animateur, rattachée au RENDEZ-VOUS et non au compte.
  hostName: z.string().max(80).optional(),
  hostTitle: z.string().max(120).optional(),
  hostBio: z.string().max(600).optional(),
  hostAvatarUrl: z
    .string()
    .max(2048)
    .refine((v) => !v || /^https?:\/\//i.test(v), "L'URL de l'avatar doit être absolue")
    .optional(),
  // 🆕 Champs du formulaire, transmis par le préréglage choisi à la création.
  // ⚠️ Sans cette entrée, zod les retirerait en silence et tous les
  // préréglages naîtraient avec le formulaire par défaut — c'est-à-dire sans
  // la seule chose qui les distingue vraiment les uns des autres.
  formFields: z
    .array(
      z.object({
        name: z.string().min(1).max(40),
        label: z.string().max(120).optional(),
        placeholder: z.string().max(160).optional(),
        type: z.enum(["text", "email", "tel", "number", "textarea", "select", "checkbox"]),
        required: z.boolean().optional(),
        width: z.enum(["full", "half"]).optional(),
        options: z.array(z.string().max(120)).max(30).optional(),
      }),
    )
    .max(20)
    .optional(),
  // 🆕 Migration 04 — mode structurel + capacité + séances datées.
  mode: z.enum(["consultation", "event", "classroom", "recurring"]).optional(),
  capacity: z.number().int().min(1).max(10000).optional(),
  // 🆕 Migration 05 — paiement Chariow. `priceAmount` est en CENTIMES.
  paymentRequired: z.boolean().optional(),
  priceAmount: z.number().int().min(0).max(100_000_000).optional(),
  currency: z.string().max(8).optional(),
  paymentUrl: z
    .string()
    .max(2048)
    .refine((v) => !v || /^https?:\/\//i.test(v), "Le lien doit commencer par http(s)://")
    .optional(),
  sessions: z
    .array(
      z.object({
        startsAt: z.string().min(10),
        endsAt: z.string().min(10),
        capacity: z.number().int().min(1).max(10000).nullable().optional(),
      }),
    )
    .max(200)
    .optional(),
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

  const baseRow = {
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
    // `color` existe depuis l'origine : pas de repli de migration à prévoir.
    color: b.color?.trim().toLowerCase() || null,
    // 🆕 Fiche animateur. Une chaîne vidée devient null : c'est `host_name` qui
    // décide de l'affichage du bloc public, et "" passerait le test de vérité
    // côté widget sans rien afficher d'utile.
    host_name: b.hostName?.trim() || null,
    host_title: b.hostTitle?.trim() || null,
    host_bio: b.hostBio?.trim() || null,
    host_avatar_url: b.hostAvatarUrl?.trim() || null,
    active: true,
  };

  const insert = (row: Record<string, unknown>) =>
    admin
      .from("booking_event_types")
      .insert(row)
      // Type explicite : sans base typée générée, l'inférence de supabase-js
      // peut retomber sur GenericStringError et bloquer l'accès aux colonnes.
      .select("id, slug")
      .maybeSingle<{ id: string; slug: string }>();

  // 🆕 `form_fields` vient de la migration 03. Tant qu'elle n'est pas
  // appliquée, l'insert échouerait ENTIÈREMENT : impossible de créer le
  // moindre type de RDV. On retombe sur la création sans les champs
  // personnalisés — le préréglage perd sa qualification, mais l'utilisateur
  // n'est pas bloqué.
  // Colonnes ajoutées par les migrations 03 et 04. Regroupées ici : si l'une
  // manque, le repli les retire toutes d'un coup plutôt que d'essayer chaque
  // combinaison.
  const extraCols: Record<string, unknown> = {};
  if (b.formFields && b.formFields.length > 0) extraCols.form_fields = b.formFields;
  if (b.mode) extraCols.mode = b.mode;
  if (b.capacity) extraCols.capacity = b.capacity;
  // 🆕 Migration 05. Le paiement n'est activé QUE si un lien produit est
  // fourni : `payment_required` seul produirait un bouton « Payer » sans
  // destination, donc une page de réservation inutilisable.
  if (b.paymentRequired && b.paymentUrl) {
    extraCols.payment_required = true;
    extraCols.payment_url = b.paymentUrl.trim();
    extraCols.payment_provider = "chariow";
    if (typeof b.priceAmount === "number") extraCols.price_amount = b.priceAmount;
    if (b.currency) extraCols.currency = b.currency.toUpperCase();
  }

  let { data, error } =
    Object.keys(extraCols).length > 0
      ? await insert({ ...baseRow, ...extraCols })
      : await insert(baseRow);

  const missingColumn =
    error &&
    (error.code === "42703" ||
      /column .* does not exist/i.test(error.message ?? "") ||
      /could not find the '.*' column/i.test(error.message ?? ""));

  let degraded = false;
  if (missingColumn) {
    console.warn(
      "[booking] Colonnes form_fields/mode/capacity absentes — migrations 03 " +
        "et/ou 04 non appliquées. Type créé en mode consultation simple.",
    );
    degraded = true;
    ({ data, error } = await insert(baseRow));
  }

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: "create_failed", message: error?.message ?? "Création impossible." },
      { status: 500 },
    );
  }

  const isEventMode = b.mode === "event" && !degraded;

  if (isEventMode) {
    // 🆕 MODE `event` — des SÉANCES datées, pas des disponibilités.
    // Publier aussi des plages hebdomadaires produirait deux sources de vérité
    // pour un même calendrier : le widget afficherait des créneaux qui
    // n'existent pas.
    if (b.sessions && b.sessions.length > 0) {
      const { error: sessionError } = await admin.from("booking_sessions").insert(
        b.sessions.map((s) => ({
          event_type_id: data.id,
          starts_at: s.startsAt,
          ends_at: s.endsAt,
          capacity: s.capacity ?? null,
        })),
      );
      if (sessionError) {
        console.warn("[booking] séances non créées :", sessionError.message);
      }
    }
  } else {
    // 🆕 Disponibilités : celles SAISIES DANS LE WIZARD si elles existent,
    // sinon le repli historique (lundi→vendredi 9h-12h et 14h-17h). Un type de
    // RDV créé sans aucune plage n'afficherait AUCUN créneau — l'hôte croirait
    // le module cassé alors qu'il n'a simplement rien configuré.
    const rows =
      b.availability && b.availability.length > 0
        ? b.availability.map((r) => ({
            event_type_id: data.id,
            weekday: r.weekday,
            start_min: r.startMin,
            end_min: r.endMin,
          }))
        : [1, 2, 3, 4, 5].flatMap((weekday) => [
            { event_type_id: data.id, weekday, start_min: 9 * 60, end_min: 12 * 60 },
            { event_type_id: data.id, weekday, start_min: 14 * 60, end_min: 17 * 60 },
          ]);
    await admin.from("booking_availability").insert(rows);
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    slug: data.slug,
    ...(degraded
      ? {
          warning: "migrations_pending",
          message:
            "Type créé, mais les modes et champs personnalisés nécessitent les " +
            "migrations 03 et 04, non appliquées sur cette base.",
        }
      : {}),
  });
}
