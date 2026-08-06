// lib/booking/autoProvision.ts
//
// Création AUTOMATIQUE d'un type de RDV à la génération d'un tunnel « booking ».
//
// ── POURQUOI AUTOMATIQUE ───────────────────────────────────────────────────
// Un tunnel de prise de rendez-vous dont les CTA pointeraient dans le vide
// n'aurait aucun intérêt. Or le moteur natif ne peut pas deviner qu'un tunnel
// vient d'être créé. Sans provisionnement, il faudrait exiger de l'utilisateur
// qu'il crée son type de RDV AVANT de générer son tunnel — un ordre
// contre-intuitif, et une étape de plus à rater.
//
// On crée donc un type de RDV prêt à l'emploi (30 min, lundi→vendredi
// 9h-12h / 14h-17h) que l'utilisateur affine ensuite dans /rendez-vous.
//
// ⚠️ Best-effort STRICT : un échec ici ne doit JAMAIS faire échouer la
// génération du tunnel. Sans slug, `harmonizeCTAsByFunnelKind` retombe sur le
// comportement historique — le tunnel reste utilisable.

import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { slugifyBooking } from "./slug";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "./timezones";

/**
 * Retourne le slug d'un type de RDV utilisable pour ce tunnel, en le créant si
 * nécessaire. Retourne null si le provisionnement échoue (jamais d'exception).
 */
export async function ensureBookingEventType(args: {
  userId: string;
  /** Nom de l'offre — sert de base au nom et au slug. */
  offerName: string;
  language?: string;
  /** Fuseau de l'hôte, si connu. À défaut : UTC+0 sans heure d'été. */
  timezone?: string;
}): Promise<string | null> {
  try {
    const admin = getSupabaseAdmin();

    // Un utilisateur qui génère plusieurs tunnels Booking n'a pas besoin d'un
    // type de RDV par tunnel : on réutilise le premier actif s'il existe. Créer
    // un doublon à chaque génération encombrerait son écran /rendez-vous.
    const { data: existing } = await admin
      .from("booking_event_types")
      .select("slug")
      .eq("user_id", args.userId)
      .eq("active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ slug: string }>();

    if (existing?.slug) return existing.slug;

    const base = slugifyBooking(args.offerName) || "rendez-vous";
    let slug = base;
    for (let i = 2; i < 40; i++) {
      const { data: taken } = await admin
        .from("booking_event_types")
        .select("id")
        .ilike("slug", slug)
        .maybeSingle<{ id: string }>();
      if (!taken) break;
      slug = `${base}-${i}`;
    }

    const timezone = isValidTimeZone(args.timezone) ? args.timezone : DEFAULT_TIMEZONE;

    const { data, error } = await admin
      .from("booking_event_types")
      .insert({
        user_id: args.userId,
        slug,
        name: args.offerName.trim().slice(0, 120) || "Rendez-vous",
        duration_min: 30,
        timezone,
        location_kind: "visio",
        language: args.language ?? "fr",
        active: true,
      })
      .select("id, slug")
      .maybeSingle<{ id: string; slug: string }>();

    if (error || !data) {
      console.warn("[booking/autoProvision] création impossible :", error?.message);
      return null;
    }

    // Disponibilités de départ. Un type sans aucune plage n'afficherait AUCUN
    // créneau : l'utilisateur croirait le calendrier cassé alors qu'il n'a
    // simplement rien configuré.
    const rules = [1, 2, 3, 4, 5].flatMap((weekday) => [
      { event_type_id: data.id, weekday, start_min: 9 * 60, end_min: 12 * 60 },
      { event_type_id: data.id, weekday, start_min: 14 * 60, end_min: 17 * 60 },
    ]);
    await admin.from("booking_availability").insert(rules);

    console.log(`[booking/autoProvision] type de RDV créé : /rdv/${data.slug}`);
    return data.slug;
  } catch (e) {
    console.warn("[booking/autoProvision] échec best-effort :", e);
    return null;
  }
}
