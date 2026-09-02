// components/funnel/wizard/FunnelKindStep.tsx
"use client";

import { CheckCircle2, FileStack, CalendarClock, Info } from "lucide-react";
import { FUNNEL_KINDS } from "@/lib/funnels/kinds";
import type { FunnelKind, Language } from "@/lib/funnels/types";
import { tWizard } from "@/lib/i18n/wizard";
import { Field, Input } from "@/components/ui/Field";
// 🆕 B3 — Module PUR (aucun import serveur), sûr côté client.
import { isAbsoluteHttpUrl, resolveBookingMode } from "@/lib/booking/mode";
// 🆕 Bornes/défaut de durée du challenge — source unique, partagée avec le
// schéma zod de la route API et le générateur (module PUR, cf. son en-tête).
import {
  DEFAULT_CHALLENGE_DAYS,
  MAX_CHALLENGE_DAYS,
  MIN_CHALLENGE_DAYS,
  resolveChallengeDays,
} from "@/lib/funnels/challenge";

/** 🆕 LOT 4/5 — Patch complet des champs webinaire (date, urgence, lien
 *  externe, durée d'expiration du replay, mode Live/Evergreen). */
export type WebinarDetailsPatch = {
  webinarDate?: string;
  webinarUrgency?: string;
  webinarExternalLink?: string;
  replayExpiryHours?: number;
  /** 🆕 LOT 5 */
  webinarMode?: "live" | "evergreen";
  evergreenVideoUrl?: string;
  evergreenOfferHours?: number;
};

/** 🆕 B3/B4 — Patch des réglages de prise de RDV. */
export type BookingDetailsPatch = {
  /** Mode explicite (remplace la déduction fragile par présence d'URL). */
  bookingMode?: "native" | "external";
  /** URL du calendrier tiers (mode externe uniquement). */
  calendarEmbedUrl?: string;
  /** Générer la page de confirmation du tunnel (défaut true). */
  bookingConfirmationPage?: boolean;
};

/** 🆕 LOT 9 — Patch du nombre de jours du challenge + titres par jour (N3-a). */
export type ChallengeDetailsPatch = {
  challengeDays?: number;
  challengeDayTitles?: string[];
};

/** Ré-export conservé : la borne était définie ici avant d'être centralisée
 *  dans `lib/funnels/challenge.ts` (partagée avec la route API et le
 *  générateur). Les imports existants qui pointent sur ce module continuent
 *  de fonctionner. */
export { MAX_CHALLENGE_DAYS };

/** Durées courantes, proposées en raccourci. La saisie libre reste possible
 *  dans la limite ci-dessus. */
const CHALLENGE_DAY_PRESETS = [3, 5, 7, 14];

type Props = {
  language: Language;
  value?: FunnelKind;
  onSelect: (kind: FunnelKind) => void;
  /** 🆕 Webinaire : date+heure, urgence, lien externe, expiration replay
   *  (affichés si kind=webinar) */
  webinarDate?: string;
  webinarUrgency?: string;
  webinarExternalLink?: string;
  replayExpiryHours?: number;
  /** 🆕 LOT 5 */
  webinarMode?: "live" | "evergreen";
  evergreenVideoUrl?: string;
  evergreenOfferHours?: number;
  onWebinarChange?: (patch: WebinarDetailsPatch) => void;
  /** 🆕 Prise de RDV : mode natif/externe + confirmation (affichés si kind=booking) */
  calendarEmbedUrl?: string;
  bookingMode?: "native" | "external";
  bookingConfirmationPage?: boolean;
  /** Erreur bloquante remontée par le wizard (URL externe manquante). */
  bookingError?: string;
  onBookingChange?: (patch: BookingDetailsPatch) => void;
  /** 🆕 Challenge : nombre de jours + titres par jour (affichés si kind=challenge) */
  challengeDays?: number;
  challengeDayTitles?: string[];
  onChallengeChange?: (patch: ChallengeDetailsPatch) => void;
};

/** 🆕 Détails webinaire : date/heure de la session, urgence, lien externe
 *  (Zoom/YouTube/Meet) et durée d'accès au replay. Alimente le compte à
 *  rebours (section urgency), le lien affiché en salle d'attente/live, le
 *  timer d'expiration du replay, et le copywriting généré. */
export function WebinarDetailsFields({
  language,
  webinarDate,
  webinarUrgency,
  webinarExternalLink,
  replayExpiryHours,
  webinarMode,
  evergreenVideoUrl,
  evergreenOfferHours,
  onChange,
}: {
  language: Language;
  webinarDate?: string;
  webinarUrgency?: string;
  webinarExternalLink?: string;
  replayExpiryHours?: number;
  webinarMode?: "live" | "evergreen";
  evergreenVideoUrl?: string;
  evergreenOfferHours?: number;
  onChange: (patch: WebinarDetailsPatch) => void;
}) {
  const mode = webinarMode ?? "live";
  const L = {
    title:
      language === "en"
        ? "Your webinar"
        : language === "es"
          ? "Tu webinar"
          : "Comment souhaitez-vous organiser votre webinaire ?",
    modeLabel:
      language === "en"
        ? "Which format would you like to use?"
        : language === "es"
          ? "¿Qué formato quieres utilizar?"
          : "Quel format souhaitez-vous utiliser ?",
    modeLive:
      language === "en"
        ? "Live (fixed date)"
        : language === "es"
          ? "En vivo (fecha fija)"
          : "Live (date fixe)",
    modeEvergreen:
      language === "en"
        ? "Evergreen (automated)"
        : language === "es"
          ? "Evergreen (automatizado)"
          : "Evergreen (automatisé)",
    evergreenHint:
      language === "en"
        ? "Each prospect picks their own time slot and gets a pre-recorded video, with an offer countdown based on THEIR OWN registration time."
        : language === "es"
          ? "Cada prospecto elige su propio horario y ve un vídeo pregrabado, con una oferta cuya cuenta atrás se basa en SU propia inscripción."
          : "Chaque prospect choisit son propre créneau et voit une vidéo pré-enregistrée, avec un compte à rebours d'offre basé sur SA propre inscription.",
    videoUrl:
      language === "en"
        ? "Pre-recorded video URL (YouTube / Vimeo / mp4)"
        : language === "es"
          ? "URL del vídeo pregrabado (YouTube / Vimeo / mp4)"
          : "Quel est le lien de votre vidéo pré-enregistrée ? (YouTube / Vimeo / mp4)",
    videoUrlPh: "https://youtube.com/watch?v=...",
    offerHours:
      language === "en"
        ? "Offer duration after registration (hours)"
        : language === "es"
          ? "Duración de la oferta tras la inscripción (horas)"
          : "Combien d’heures votre offre reste-t-elle disponible après l’inscription ?",
    offerHoursHint:
      language === "en"
        ? "Countdown computed individually for each prospect from THEIR registration time, not a fixed date. Default: 24h."
        : language === "es"
          ? "Cuenta atrás calculada individualmente para cada prospecto desde SU inscripción, no una fecha fija. Por defecto: 24h."
          : "Compte à rebours calculé individuellement pour chaque prospect depuis SON inscription, pas une date fixe. Défaut : 24h.",
    date:
      language === "en"
        ? "Date & time of the session"
        : language === "es"
          ? "Fecha y hora de la sesión"
          : "Quand aura lieu votre webinaire ?",
    dateHint:
      language === "en"
        ? "Feeds the countdown on the registration page."
        : language === "es"
          ? "Alimenta la cuenta atrás de la página de inscripción."
          : "Alimente le compte à rebours de la page d'inscription.",
    urgency:
      language === "en"
        ? "Urgency / scarcity (optional)"
        : language === "es"
          ? "Urgencia / escasez (opcional)"
          : "Pourquoi s’inscrire dès maintenant ? (optionnel)",
    urgencyPh:
      language === "en"
        ? "e.g. Limited to 200 seats"
        : language === "es"
          ? "ej. Limitado a 200 plazas"
          : "Ex : Places limitées à 200 participants",
    link:
      language === "en"
        ? "Webinar link (Zoom / YouTube / Meet)"
        : language === "es"
          ? "Enlace del webinar (Zoom / YouTube / Meet)"
          : "Quel est le lien pour rejoindre votre webinaire ? (Zoom / YouTube / Meet)",
    linkHint:
      language === "en"
        ? "Shown in the waiting room on the day, and used in reminder emails."
        : language === "es"
          ? "Se muestra en la sala de espera el día D, y se usa en los recordatorios."
          : "Affiché dans la salle d'attente le jour J, et repris dans les emails de rappel.",
    linkPh:
      language === "en"
        ? "https://zoom.us/j/..."
        : "https://zoom.us/j/...",
    expiry:
      language === "en"
        ? "Replay available for (hours)"
        : language === "es"
          ? "Replay disponible durante (horas)"
          : "Pendant combien d’heures le replay sera-t-il accessible ?",
    expiryHint:
      language === "en"
        ? "After that, the replay page shows an expiration message. Default: 72h."
        : language === "es"
          ? "Después, la página de replay muestra un mensaje de expiración. Por defecto: 72h."
          : "Passé ce délai, la page de replay affiche un message d'expiration. Défaut : 72h.",
  };
  return (
    <div className="rounded-lg border border-[#31845C]/30 bg-[#31845C]/5 p-3.5 grid gap-3">
      <div className="flex items-center gap-2 text-sm font-bold text-ink">
        <CalendarClock size={15} className="text-[#31845C]" />
        {L.title}
      </div>

      {/* 🆕 LOT 5 — Toggle Live / Evergreen */}
      <Field label={L.modeLabel}>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ webinarMode: "live" })}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              mode === "live"
                ? "border-[#31845C] bg-[#31845C]/15 text-ink"
                : "border-line bg-white text-muted hover:border-[#31845C]/40"
            }`}
          >
            {L.modeLive}
          </button>
          <button
            type="button"
            onClick={() => onChange({ webinarMode: "evergreen" })}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              mode === "evergreen"
                ? "border-[#31845C] bg-[#31845C]/15 text-ink"
                : "border-line bg-white text-muted hover:border-[#31845C]/40"
            }`}
          >
            {L.modeEvergreen}
          </button>
        </div>
      </Field>

      {mode === "evergreen" ? (
        <>
          <p className="text-xs leading-relaxed text-muted">{L.evergreenHint}</p>
          <Field label={L.videoUrl}>
            <Input
              type="url"
              value={evergreenVideoUrl ?? ""}
              placeholder={L.videoUrlPh}
              onChange={(e) => onChange({ evergreenVideoUrl: e.target.value || undefined })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={L.urgency}>
              <Input
                type="text"
                value={webinarUrgency ?? ""}
                placeholder={L.urgencyPh}
                onChange={(e) => onChange({ webinarUrgency: e.target.value || undefined })}
              />
            </Field>
            <Field label={L.offerHours} hint={L.offerHoursHint}>
              <Input
                type="number"
                min={1}
                max={720}
                value={evergreenOfferHours ?? 24}
                onChange={(e) =>
                  onChange({ evergreenOfferHours: Math.max(1, Math.min(720, Number(e.target.value) || 24)) })
                }
              />
            </Field>
          </div>
        </>
      ) : (
        <>
          <Field label={L.date} hint={L.dateHint}>
            {/* 🆕 lang = langue du tunnel → le sélecteur natif date/heure
                s'affiche dans la bonne langue (français par défaut) au lieu de
                l'anglais du navigateur. */}
            <Input
              type="datetime-local"
              lang={language}
              value={webinarDate ?? ""}
              onChange={(e) => onChange({ webinarDate: e.target.value || undefined })}
            />
          </Field>
          <Field label={L.link} hint={L.linkHint}>
            <Input
              type="url"
              value={webinarExternalLink ?? ""}
              placeholder={L.linkPh}
              onChange={(e) => onChange({ webinarExternalLink: e.target.value || undefined })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={L.urgency}>
              <Input
                type="text"
                value={webinarUrgency ?? ""}
                placeholder={L.urgencyPh}
                onChange={(e) => onChange({ webinarUrgency: e.target.value || undefined })}
              />
            </Field>
            <Field label={L.expiry} hint={L.expiryHint}>
              <Input
                type="number"
                min={1}
                max={720}
                value={replayExpiryHours ?? 72}
                onChange={(e) =>
                  onChange({ replayExpiryHours: Math.max(1, Math.min(720, Number(e.target.value) || 72)) })
                }
              />
            </Field>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Calendrier de prise de RDV. Affiché uniquement si kind="booking".
 *
 * 🆕 Le champ ne demande plus un lien Calendly par défaut : AutoFunnel possède
 * désormais son PROPRE moteur de réservation (créneaux, fuseaux, anti-double-
 * réservation, e-mails, .ics). Proposer d'emblée un outil tiers revenait à
 * ignorer la fonctionnalité maison et à sortir le prospect de la plateforme.
 *
 * Le calendrier natif est donc le défaut, provisionné automatiquement à la
 * génération. Le champ externe reste accessible pour qui tient à son outil
 * habituel — et pour la rétrocompatibilité des tunnels déjà créés avec lui.
 */
export function BookingDetailsFields({
  language,
  calendarEmbedUrl,
  bookingMode,
  bookingConfirmationPage,
  error,
  onChange,
}: {
  language: Language;
  calendarEmbedUrl?: string;
  bookingMode?: "native" | "external";
  bookingConfirmationPage?: boolean;
  /** Message d'erreur bloquant, levé par le wizard au clic sur « Suivant ». */
  error?: string;
  onChange: (patch: BookingDetailsPatch) => void;
}) {
  // 🆕 B3 — Le mode est désormais EXPLICITE. L'ancienne déduction (présence
  // d'une URL, avec une chaîne blanche comme sentinelle) était indevinable à
  // la relecture et cassait dès qu'un `.trim()` intervenait en amont.
  // `resolveBookingMode` garde le repli historique pour les briefs déjà
  // enregistrés sans `bookingMode`.
  const useExternal = resolveBookingMode({ bookingMode, calendarEmbedUrl }) === "external";
  // Confirmation cochée par défaut (champ absent = true).
  const wantsConfirmation = bookingConfirmationPage !== false;
  const L = {
    title:
      language === "en"
        ? "Your booking calendar"
        : language === "es"
          ? "Tu calendario de reservas"
          : "Quel calendrier souhaitez-vous utiliser ?",
    native:
      language === "en"
        ? "Built-in calendar (recommended)"
        : language === "es"
          ? "Calendario integrado (recomendado)"
          : "Calendrier intégré (recommandé)",
    nativeHint:
      language === "en"
        ? "Created automatically with your funnel. Slots, time zones, confirmation emails and calendar files are handled for you — set your availability afterwards in Appointments."
        : language === "es"
          ? "Se crea automáticamente con tu embudo. Franjas, zonas horarias, correos de confirmación y archivos de calendario incluidos — ajusta tu disponibilidad luego en Citas."
          : "Créé automatiquement avec ton tunnel. Créneaux, fuseaux horaires, e-mails de confirmation et fichiers agenda sont gérés — tu règles tes disponibilités ensuite dans « Rendez-vous ».",
    external:
      language === "en"
        ? "Use an external calendar instead"
        : language === "es"
          ? "Usar un calendario externo"
          : "Utiliser plutôt un calendrier externe",
    label:
      language === "en"
        ? "Calendar link (Calendly / Cal.com)"
        : language === "es"
          ? "Enlace del calendario (Calendly / Cal.com)"
          : "Quel est le lien de votre calendrier ? (Calendly / Cal.com)",
    hint:
      language === "en"
        ? "Embedded on the booking page. Your prospects leave AutoFunnel to book."
        : language === "es"
          ? "Se incrusta en la página de reserva. Tus prospectos salen de AutoFunnel para reservar."
          : "Intégré sur la page de RDV. Tes prospects quittent AutoFunnel pour réserver.",
    ph: "https://calendly.com/...",
    confirmLabel:
      language === "en"
        ? "Generate a confirmation page"
        : language === "es"
          ? "Generar una página de confirmación"
          : "Générer une page de confirmation",
    confirmHint:
      language === "en"
        ? "Prospects land on your own page after booking (next steps, preparation, extra offer). Unchecked, they stay on the calendar's confirmation screen."
        : language === "es"
          ? "Tras reservar, aterrizan en tu propia página (próximos pasos, preparación, oferta adicional). Sin marcar, se quedan en la pantalla de confirmación del calendario."
          : "Après réservation, le prospect atterrit sur ta page (prochaines étapes, préparation, offre complémentaire). Décoché, il reste sur l'écran de confirmation du calendrier.",
    schemeWarning:
      language === "en"
        ? "Add https:// at the start — without it the link is treated as an internal path and leads to a 404."
        : language === "es"
          ? "Añade https:// al principio — sin él, el enlace se interpreta como una ruta interna y lleva a un 404."
          : "Ajoute https:// au début — sans schéma, le lien est traité comme un chemin interne et mène à une page 404.",
    externalConfirm:
      language === "en"
        ? "A confirmation page is always generated in this mode — paste its URL into your calendar tool as the post-booking redirect."
        : language === "es"
          ? "En este modo siempre se genera una página de confirmación — pega su URL en tu herramienta de calendario como redirección posterior a la reserva."
          : "Une page de confirmation est toujours générée dans ce mode : colle son URL dans ton outil de calendrier comme redirection après réservation.",
  };

  return (
    <div className="rounded-lg border border-[#31845C]/30 bg-[#31845C]/5 p-3.5 grid gap-3">
      <div className="flex items-center gap-2 text-sm font-bold text-ink">
        <CalendarClock size={15} className="text-[#31845C]" />
        {L.title}
      </div>

      {!useExternal ? (
        <>
          <div className="rounded-md border border-[#31845C]/25 bg-white/60 p-3">
            <p className="text-sm font-semibold text-ink">{L.native}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink/60">{L.nativeHint}</p>
          </div>

          {/* 🆕 B4 — Page de confirmation, cochée par défaut. Décochée, le
              prospect reste sur l'écran de confirmation du calendrier natif. */}
          <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-ink/70">
            <input
              type="checkbox"
              checked={wantsConfirmation}
              onChange={(e) => onChange({ bookingConfirmationPage: e.target.checked })}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#31845C]"
            />
            <span>
              <strong className="text-ink">{L.confirmLabel}</strong>
              <br />
              {L.confirmHint}
            </span>
          </label>

          <button
            type="button"
            // Bascule EXPLICITE : on pose le mode, on ne se repose plus sur la
            // présence d'une chaîne blanche dans le champ URL.
            onClick={() => onChange({ bookingMode: "external" })}
            className="justify-self-start text-xs font-medium text-ink/50 underline underline-offset-2 hover:text-ink/80"
          >
            {L.external}
          </button>
        </>
      ) : (
        <>
          <Field label={`${L.label} *`} hint={L.hint}>
            <Input
              type="url"
              value={calendarEmbedUrl ?? ""}
              placeholder={L.ph}
              autoFocus
              aria-invalid={error ? true : undefined}
              className={error ? "border-red-400/60" : undefined}
              onChange={(e) =>
                onChange({ bookingMode: "external", calendarEmbedUrl: e.target.value })
              }
            />
          </Field>

          {/* Erreur BLOQUANTE — même motif visuel que l'étape « Ton offre ». */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600">
              <span aria-hidden>⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* AVERTISSEMENT non bloquant : une URL sans schéma devient un lien
              RELATIF (« calendly.com/moi » → « /tunnel/xxx/calendly.com/moi »),
              donc un 404 silencieux. On alerte sans refuser la saisie : la
              validation de forme d'URL rejette trop de cas légitimes. */}
          {!error && calendarEmbedUrl?.trim() && !isAbsoluteHttpUrl(calendarEmbedUrl) && (
            <div className="flex items-start gap-2 rounded-lg border border-[#C7A436]/40 bg-[#C7A436]/10 px-3 py-2 text-xs text-ink/80">
              <span aria-hidden>ⓘ</span>
              <span>{L.schemeWarning}</span>
            </div>
          )}
          {/* En mode externe, la page de confirmation reste TOUJOURS générée :
              c'est la cible de redirection que l'utilisateur collera dans
              Calendly. Pas de case à cocher, mais une explication. */}
          <p className="rounded-md border border-[#31845C]/20 bg-white/50 p-2.5 text-[11px] leading-relaxed text-ink/60">
            {L.externalConfirm}
          </p>
          <button
            type="button"
            onClick={() => onChange({ bookingMode: "native", calendarEmbedUrl: undefined })}
            className="justify-self-start text-xs font-medium text-ink/50 underline underline-offset-2 hover:text-ink/80"
          >
            {L.native}
          </button>
        </>
      )}
    </div>
  );
}

/** 🆕 LOT 9 — Champ nombre de jours du challenge. Affiché uniquement si
 *  kind="challenge". Détermine combien de pages "jour" sont générées. */
export function ChallengeDetailsFields({
  language,
  challengeDays,
  challengeDayTitles,
  onChange,
}: {
  language: Language;
  challengeDays?: number;
  challengeDayTitles?: string[];
  onChange: (patch: ChallengeDetailsPatch) => void;
}) {
  // Même normalisation que le générateur et le prompt : un seul défaut, une
  // seule borne. Voir `lib/funnels/challenge.ts`.
  const days = resolveChallengeDays(challengeDays);
  const titles = challengeDayTitles ?? [];

  const L = {
    title:
      language === "en" ? "Your challenge" : language === "es" ? "Tu reto" : "Comment souhaitez-vous organiser votre challenge ?",
    label:
      language === "en"
        ? "Number of days"
        : language === "es"
          ? "Número de días"
          : "Combien de jours durera votre challenge ?",
    hint:
      language === "en"
        ? `One page per day (Day 1 to Day N), plus a final pitch page. Up to ${MAX_CHALLENGE_DAYS} days.`
        : language === "es"
          ? `Una página por día (Día 1 a Día N), más una página de pitch final. Hasta ${MAX_CHALLENGE_DAYS} días.`
          : `Une page par jour (Jour 1 à Jour N), plus une page de pitch final. ${MAX_CHALLENGE_DAYS} jours maximum.`,
    titlesLabel:
      language === "en"
        ? "Title of each day"
        : language === "es"
          ? "Título de cada día"
          : "Quel sera le thème de chaque jour ?",
    titlesHint:
      language === "en"
        ? "Left empty, every day would carry the same headline. One subject per day makes the challenge feel real."
        : language === "es"
          ? "Si se dejan vacíos, todos los días llevarían el mismo titular. Un tema por día hace que el reto sea real."
          : "Laissés vides, tous les jours porteraient le même titre. Un sujet par jour rend le challenge crédible.",
    dayWord: language === "en" ? "Day" : language === "es" ? "Día" : "Jour",
    placeholder:
      language === "en"
        ? "e.g. Lay the foundations"
        : language === "es"
          ? "ej. Sienta las bases"
          : "ex. Poser les fondations",
    noticeTitle:
      language === "en"
        ? "How participants access each day"
        : language === "es"
          ? "Cómo acceden los participantes a cada día"
          : "Comment les participants accèdent à chaque jour",
    noticeBody:
      language === "en"
        ? "These pages are not listed publicly, but stay reachable by anyone who knows the URL. Send them day after day by email — there is no member area or login."
        : language === "es"
          ? "Estas páginas no se listan públicamente, pero siguen siendo accesibles para quien conozca la URL. Envíalas día tras día por email — no hay área de miembros ni inicio de sesión."
          : "Ces pages ne sont pas listées publiquement, mais restent accessibles à qui connaît l'URL. Envoie-les jour après jour par email — il n'y a ni espace membre ni connexion.",
  };

  const setTitle = (index: number, value: string) => {
    const next = [...titles];
    while (next.length < days) next.push("");
    next[index] = value;
    onChange({ challengeDayTitles: next.slice(0, days) });
  };

  return (
    <div className="rounded-lg border border-[#31845C]/30 bg-[#31845C]/5 p-3.5 grid gap-3">
      <div className="flex items-center gap-2 text-sm font-bold text-ink">
        <CalendarClock size={15} className="text-[#31845C]" />
        {L.title}
      </div>

      <Field label={L.label} hint={L.hint}>
        <div className="grid gap-2">
          {/* Raccourcis vers les durées courantes : la saisie libre reste
              possible juste en dessous. */}
          <div className="flex flex-wrap gap-1.5">
            {CHALLENGE_DAY_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onChange({ challengeDays: preset })}
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition ${
                  days === preset
                    ? "border-[#31845C] bg-[#31845C]/15 text-ink"
                    : "border-line text-muted hover:border-[#31845C]/50 hover:text-ink"
                }`}
              >
                {preset} {L.dayWord.toLowerCase()}s
              </button>
            ))}
          </div>
          <Input
            type="number"
            min={MIN_CHALLENGE_DAYS}
            max={MAX_CHALLENGE_DAYS}
            value={days}
            onChange={(e) => {
              // Champ vidé → on retombe sur le défaut PARTAGÉ (et non sur la
              // borne basse), pour que l'affichage corresponde à ce que le
              // générateur produirait si l'utilisateur s'arrêtait là.
              const raw = e.target.value.trim();
              onChange({
                challengeDays:
                  raw === ""
                    ? DEFAULT_CHALLENGE_DAYS
                    : resolveChallengeDays(Number(raw)),
              });
            }}
          />
        </div>
      </Field>

      {/* 🆕 N3-a — Un titre par jour. Sans eux, les jours 2..N sont des copies
          conformes du Jour 1 : le seul mécanisme de différenciation réécrit
          littéralement « Jour 1 » → « Jour N ». */}
      <Field label={L.titlesLabel} hint={L.titlesHint}>
        <div className="grid gap-1.5">
          {Array.from({ length: days }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-wider text-muted">
                {L.dayWord} {i + 1}
              </span>
              <Input
                value={titles[i] ?? ""}
                onChange={(e) => setTitle(i, e.target.value)}
                placeholder={L.placeholder}
              />
            </div>
          ))}
        </div>
      </Field>

      {/* 🆕 R2 — Nature réelle des URL « Jour N ». Ne pas le dire laisserait
          croire à un accès protégé qui n'existe pas. */}
      <div className="flex items-start gap-2 rounded-md border border-line bg-white/60 p-2.5 text-[11px] leading-relaxed text-muted">
        <Info size={13} className="mt-0.5 shrink-0 text-[#31845C]" />
        <span>
          <strong className="text-ink">{L.noticeTitle} :</strong> {L.noticeBody}
        </span>
      </div>
    </div>
  );
}

export function FunnelKindStep({
  language,
  value,
  onSelect,
  webinarDate,
  webinarUrgency,
  webinarExternalLink,
  replayExpiryHours,
  webinarMode,
  evergreenVideoUrl,
  evergreenOfferHours,
  onWebinarChange,
  calendarEmbedUrl,
  bookingMode,
  bookingConfirmationPage,
  bookingError,
  onBookingChange,
  challengeDays,
  challengeDayTitles,
  onChallengeChange,
}: Props) {
  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-xl font-black text-ink">{tWizard(language, "kind.title")}</h2>
        <p className="mt-1 text-xs text-muted">{tWizard(language, "kind.help")}</p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {FUNNEL_KINDS.map((kind) => {
          const active = value === kind.id;
          return (
            <button
              key={kind.id}
              type="button"
              onClick={() => onSelect(kind.id)}
              className={`group flex min-h-[88px] flex-col items-start gap-1 rounded-lg border p-3.5 text-left transition-all duration-200 ${
                active
                  ? "border-[#31845C] bg-[#31845C]/10 shadow-sm"
                  : "border-line bg-white hover:-translate-y-0.5 hover:border-[#080E1A]/30 hover:shadow-sm"
              }`}
            >
              <span className="flex w-full items-center justify-between gap-2 text-sm font-bold text-ink">
                {kind.label[language]}
                {active && <CheckCircle2 size={14} className="text-[#31845C]" />}
              </span>
              <span className="text-xs leading-relaxed text-muted">
                {kind.hint[language]}
              </span>
              {/* 🆕 Nombre de pages EXPLICITE dans le sélecteur de type */}
              <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#31845C]">
                <FileStack size={12} />
                {kind.pages[language]}
              </span>
              {kind.needsVideo && (
                <span className="mt-1 inline-flex rounded-full bg-softBlue px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-navy">
                  Vidéo
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 🆕 Webinaire : date + heure + urgence (alimente le countdown) */}
      {value === "webinar" && onWebinarChange && (
        <WebinarDetailsFields
          language={language}
          webinarDate={webinarDate}
          webinarUrgency={webinarUrgency}
          webinarExternalLink={webinarExternalLink}
          replayExpiryHours={replayExpiryHours}
          webinarMode={webinarMode}
          evergreenVideoUrl={evergreenVideoUrl}
          evergreenOfferHours={evergreenOfferHours}
          onChange={onWebinarChange}
        />
      )}

      {/* 🆕 B3/B4 — Prise de RDV : mode natif/externe + page de confirmation */}
      {value === "booking" && onBookingChange && (
        <BookingDetailsFields
          language={language}
          calendarEmbedUrl={calendarEmbedUrl}
          bookingMode={bookingMode}
          bookingConfirmationPage={bookingConfirmationPage}
          error={bookingError}
          onChange={onBookingChange}
        />
      )}

      {/* 🆕 LOT 9 — Challenge : nombre de jours */}
      {value === "challenge" && onChallengeChange && (
        <ChallengeDetailsFields
          language={language}
          challengeDays={challengeDays}
          challengeDayTitles={challengeDayTitles}
          onChange={onChallengeChange}
        />
      )}
    </div>
  );
}
