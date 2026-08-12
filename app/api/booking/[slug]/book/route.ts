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
  resolveConfirmationUrl,
  sessionHasRoom,
  upsertLeadForBooking,
} from "@/lib/booking/repository";
import { usesFixedSessions } from "@/lib/booking/types";
import { isSlotBookable } from "@/lib/booking/slots";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "@/lib/booking/timezones";
import { sendBookingEmails } from "@/lib/booking/emails";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  ensureEmailField,
  resolveBookingFields,
  validateBookingAnswers,
  type BookingFormValues,
} from "@/lib/booking/formFields";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  startsAt: z.string().min(10),
  timezone: z.string().optional(),
  // 🆕 Mode `event` : le visiteur s'inscrit à une SÉANCE publiée, pas à un
  // créneau calculé. C'est l'identifiant de séance qui fait foi — `startsAt`
  // est alors redondant, mais conservé pour un contrat de requête unique.
  sessionId: z.string().uuid().optional(),

  // 🆕 Formulaire piloté par la configuration de l'hôte : on reçoit un sac de
  // valeurs indexées par nom de champ, dont on ne connaît pas la forme à
  // l'avance. La répartition (nom/email/téléphone/note vs réponses libres) et
  // le contrôle des champs obligatoires se font ensuite, à partir de la
  // définition ENREGISTRÉE — jamais à partir de ce que le client envoie.
  values: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),

  // Anciens champs, conservés pour compatibilité : un onglet ouvert avant le
  // déploiement, ou une intégration tierce, continue de fonctionner.
  name: z.string().max(120).optional(),
  email: z.string().email().max(200).optional(),
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

  // 🆕 Validation du formulaire à partir de la définition ENREGISTRÉE du type
  // de rendez-vous. C'est la seule barrière qui compte : la validation du
  // widget est un confort, un POST direct l'ignore.
  //
  // Les anciens champs à plat sont repliés dans `values` quand `values` est
  // absent, pour qu'un onglet ouvert avant le déploiement continue de marcher.
  const submittedValues: BookingFormValues =
    body.values ?? {
      name: body.name ?? "",
      email: body.email ?? "",
      phone: body.phone ?? "",
      note: body.note ?? "",
    };

  const fields = ensureEmailField(resolveBookingFields(eventType));
  const form = validateBookingAnswers(fields, submittedValues);
  if (!form.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_input",
        message:
          form.missing.length === 1
            ? `Le champ « ${form.missing[0]} » est obligatoire.`
            : `Champs obligatoires manquants : ${form.missing.join(", ")}.`,
      },
      { status: 400 },
    );
  }

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

  // 🆕 MODE `event` — la validation ne porte pas sur les disponibilités mais
  // sur les PLACES RESTANTES de la séance choisie.
  //
  // Le moteur de créneaux serait inopérant ici : il n'existe aucune règle
  // hebdomadaire, et un atelier accepte plusieurs personnes sur la même heure.
  // C'est aussi pourquoi l'index anti-double-réservation exclut désormais les
  // inscriptions rattachées à une séance (migration 04).
  if (usesFixedSessions(eventType.mode)) {
    if (!body.sessionId) {
      return NextResponse.json(
        {
          ok: false,
          error: "session_required",
          message: "Choisis une séance avant de valider ton inscription.",
        },
        { status: 400 },
      );
    }
    const room = await sessionHasRoom(body.sessionId, eventType.capacity);
    if (!room.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "session_full",
          message:
            "Cette séance vient d'afficher complet. Choisis une autre date.",
        },
        { status: 409 },
      );
    }
  } else {
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
  }

  // Le lead est créé AVANT la réservation pour pouvoir l'y rattacher, mais son
  // échec ne bloque rien : un RDV pris vaut mieux qu'un CRM parfait.
  const leadId = await upsertLeadForBooking({
    userId: eventType.userId,
    funnelId: eventType.funnelId,
    email: form.visitorEmail,
    name: form.visitorName,
    phone: form.visitorPhone ?? undefined,
    language: eventType.language,
    // 🆕 Les réponses aux champs personnalisés remontent dans le CRM. Un RDV
    // pris est un prospect qualifié : laisser « budget : 15 000 € » enfermé
    // dans le module Rendez-vous obligerait à ressaisir l'information pour
    // segmenter ou relancer.
    answers: form.answers,
  });

  // ── Barrière 3 : l'écriture, arbitrée par l'index unique ─────────────────
  const created = await createBooking({
    eventType,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    visitorTimezone,
    visitorName: form.visitorName.trim(),
    visitorEmail: form.visitorEmail.toLowerCase().trim(),
    visitorPhone: form.visitorPhone,
    note: form.note,
    answers: form.answers,
    // 🆕 Rattache l'inscription à sa séance. C'est aussi ce qui la fait sortir
    // de l'index anti-double-réservation : sans `session_id`, la deuxième
    // inscription au même atelier serait rejetée comme un doublon.
    sessionId: usesFixedSessions(eventType.mode) ? body.sessionId ?? null : null,
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
      // ⚠️ Les valeurs VALIDÉES, pas le corps brut : `body.name` est désormais
      // optionnel et vaut `undefined` dès que le formulaire est personnalisé —
      // `.trim()` dessus lèverait une exception, et l'e-mail ne partirait pas.
      visitorName: form.visitorName.trim(),
      visitorEmail: form.visitorEmail.toLowerCase().trim(),
      hostName,
      hostEmail,
      locationLabel: locationLabel(eventType.locationKind, eventType.locationValue),
      note: form.note,
      answers: form.answers,
      manageUrl,
      language: eventType.language,
    },
    hostName,
  ).catch(() => null);

  // 🆕 Boucle du tunnel refermée : si ce calendrier est rattaché à un tunnel,
  // le prospect atterrit sur SA page de confirmation (avec son copywriting, ses
  // prochaines étapes, ses canaux) plutôt que sur la carte de succès générique.
  //
  // Résolu APRÈS l'écriture et l'envoi des e-mails : une redirection ne doit
  // jamais court-circuiter ce qui garantit l'existence du rendez-vous.
  const redirectUrl = await resolveConfirmationUrl(eventType, appOrigin(req)).catch(() => null);

  return NextResponse.json({
    ok: true,
    bookingId: created.id,
    manageUrl,
    // Absent = le calendrier est utilisé seul : le widget garde sa confirmation
    // intégrée. Il ne doit surtout pas rediriger vers une page inexistante.
    redirectUrl,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    visitorTimezone,
    hostTimezone: eventType.timezone,
  });
}
