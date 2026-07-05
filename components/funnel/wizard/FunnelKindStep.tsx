// components/funnel/wizard/FunnelKindStep.tsx
"use client";

import { CheckCircle2, FileStack, CalendarClock } from "lucide-react";
import { FUNNEL_KINDS } from "@/lib/funnels/kinds";
import type { FunnelKind, Language } from "@/lib/funnels/types";
import { tWizard } from "@/lib/i18n/wizard";
import { Field, Input } from "@/components/ui/Field";

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

/** 🆕 LOT 7 — Patch du champ embed calendrier (Calendly/Cal.com). */
export type BookingDetailsPatch = {
  calendarEmbedUrl?: string;
};

/** 🆕 LOT 9 — Patch du nombre de jours du challenge. */
export type ChallengeDetailsPatch = {
  challengeDays?: number;
};

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
  /** 🆕 Prise de RDV : embed calendrier natif (affiché si kind=booking) */
  calendarEmbedUrl?: string;
  onBookingChange?: (patch: BookingDetailsPatch) => void;
  /** 🆕 Challenge : nombre de jours (affiché si kind=challenge) */
  challengeDays?: number;
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
          : "Ton webinaire",
    modeLabel:
      language === "en"
        ? "Format"
        : language === "es"
          ? "Formato"
          : "Format",
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
          : "URL de la vidéo pré-enregistrée (YouTube / Vimeo / mp4)",
    videoUrlPh: "https://youtube.com/watch?v=...",
    offerHours:
      language === "en"
        ? "Offer duration after registration (hours)"
        : language === "es"
          ? "Duración de la oferta tras la inscripción (horas)"
          : "Durée de l'offre après inscription (heures)",
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
          : "Date et heure du webinaire",
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
          : "Urgence / rareté (optionnel)",
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
          : "Lien du webinaire (Zoom / YouTube / Meet)",
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
          : "Replay accessible pendant (heures)",
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
            <Input
              type="datetime-local"
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

/** 🆕 LOT 7 — Champ embed calendrier natif (Calendly/Cal.com) pour la prise
 *  de RDV. Affiché uniquement si kind="booking". Vide → repli sur le
 *  formulaire de contact classique. */
export function BookingDetailsFields({
  language,
  calendarEmbedUrl,
  onChange,
}: {
  language: Language;
  calendarEmbedUrl?: string;
  onChange: (patch: BookingDetailsPatch) => void;
}) {
  const L = {
    title:
      language === "en"
        ? "Your booking calendar"
        : language === "es"
          ? "Tu calendario de reservas"
          : "Ton calendrier de RDV",
    label:
      language === "en"
        ? "Calendar link (Calendly / Cal.com)"
        : language === "es"
          ? "Enlace del calendario (Calendly / Cal.com)"
          : "Lien du calendrier (Calendly / Cal.com)",
    hint:
      language === "en"
        ? "Embedded directly on the booking page. Leave empty to keep the classic contact form."
        : language === "es"
          ? "Se incrusta directamente en la página de reserva. Déjalo vacío para conservar el formulario de contacto clásico."
          : "Intégré directement sur la page de RDV. Laisse vide pour garder le formulaire de contact classique.",
    ph:
      language === "en"
        ? "https://calendly.com/..."
        : "https://calendly.com/...",
  };
  return (
    <div className="rounded-lg border border-[#31845C]/30 bg-[#31845C]/5 p-3.5 grid gap-3">
      <div className="flex items-center gap-2 text-sm font-bold text-ink">
        <CalendarClock size={15} className="text-[#31845C]" />
        {L.title}
      </div>
      <Field label={L.label} hint={L.hint}>
        <Input
          type="url"
          value={calendarEmbedUrl ?? ""}
          placeholder={L.ph}
          onChange={(e) => onChange({ calendarEmbedUrl: e.target.value || undefined })}
        />
      </Field>
    </div>
  );
}

/** 🆕 LOT 9 — Champ nombre de jours du challenge. Affiché uniquement si
 *  kind="challenge". Détermine combien de pages "jour" sont générées. */
export function ChallengeDetailsFields({
  language,
  challengeDays,
  onChange,
}: {
  language: Language;
  challengeDays?: number;
  onChange: (patch: ChallengeDetailsPatch) => void;
}) {
  const L = {
    title:
      language === "en"
        ? "Your challenge"
        : language === "es"
          ? "Tu reto"
          : "Ton challenge",
    label:
      language === "en"
        ? "Number of days"
        : language === "es"
          ? "Número de días"
          : "Nombre de jours",
    hint:
      language === "en"
        ? "Generates one page per day (Day 1 to Day N), plus a final pitch page."
        : language === "es"
          ? "Genera una página por día (Día 1 a Día N), más una página de pitch final."
          : "Génère une page par jour (Jour 1 à Jour N), plus une page de pitch final.",
  };
  return (
    <div className="rounded-lg border border-[#31845C]/30 bg-[#31845C]/5 p-3.5 grid gap-3">
      <div className="flex items-center gap-2 text-sm font-bold text-ink">
        <CalendarClock size={15} className="text-[#31845C]" />
        {L.title}
      </div>
      <Field label={L.label} hint={L.hint}>
        <Input
          type="number"
          min={1}
          max={30}
          value={challengeDays ?? 5}
          onChange={(e) =>
            onChange({ challengeDays: Math.max(1, Math.min(30, Number(e.target.value) || 5)) })
          }
        />
      </Field>
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
  onBookingChange,
  challengeDays,
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

      {/* 🆕 LOT 7 — Prise de RDV : embed calendrier natif */}
      {value === "booking" && onBookingChange && (
        <BookingDetailsFields
          language={language}
          calendarEmbedUrl={calendarEmbedUrl}
          onChange={onBookingChange}
        />
      )}

      {/* 🆕 LOT 9 — Challenge : nombre de jours */}
      {value === "challenge" && onChallengeChange && (
        <ChallengeDetailsFields
          language={language}
          challengeDays={challengeDays}
          onChange={onChallengeChange}
        />
      )}
    </div>
  );
}
