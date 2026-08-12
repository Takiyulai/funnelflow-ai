"use client";

// components/booking/BookingWidget.tsx
//
// Page publique de réservation. Utilisée À LA FOIS par /rdv/[slug] et par la
// section `booking` d'un tunnel : un seul comportement à maintenir.
//
// ── POURQUOI UN FLUX DATE → CRÉNEAUX ───────────────────────────────────────
// La première version empilait tous les créneaux de tous les jours : plus de
// 200 boutons d'affilée. Face à ce mur, le prospect ne compare pas, il renonce.
// Le flux en deux temps (choisir un jour, puis une heure) ramène la décision à
// deux choix de quelques options chacun.
//
// ⚠️ CE COMPOSANT NE CALCULE AUCUN CRÉNEAU. Toute la logique (fuseaux, pas de
// grille, débordement, jours fermés, délai minimum) reste dans
// lib/booking/slots.ts, côté serveur. On ne fait que REGROUPER et AFFICHER ce
// que l'API renvoie.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// Le namespace `React` n'est pas importé dans ce fichier (seuls les hooks le
// sont) : écrire `React.CSSProperties` échouerait à la compilation. On importe
// donc le type nommé, nécessaire pour typer la variable CSS `--ff-accent`,
// qu'un objet CSSProperties n'accepte pas telle quelle.
import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Info, Clock, Video, Loader2 } from "lucide-react";
import {
  DEFAULT_TIMEZONE,
  TIMEZONE_OPTIONS,
  daylightSavingShortNotice,
  detectVisitorTimeZone,
  formatDateInZone,
  formatTimeInZone,
  sameWallClock,
  shortZoneLabel,
} from "@/lib/booking/timezones";
import { readableTextOn, resolveBookingColor, withAlpha } from "@/lib/booking/colors";
import {
  validateBookingAnswers,
  type BookingFormValues,
} from "@/lib/booking/formFields";
import { DEFAULT_BOOKING_FIELDS } from "@/lib/booking/types";
import type { FormFieldItem } from "@/lib/funnels/types";

type Slot = { startsAt: string; endsAt: string };
type DaySlots = { day: string; slots: Slot[] };

type EventTypeView = {
  slug: string;
  name: string;
  description?: string | null;
  durationMin: number;
  locationKind: string;
  locationValue?: string | null;
  language: string;
  timezone: string;
  /** Couleur d'accent, déjà repliée côté serveur — jamais vide. */
  color?: string;

  // 🆕 Fiche hôte. Tous optionnels : `hostName` est le déclencheur, les autres
  // ne sont rendus que s'ils sont présents. Une page sans hôte renseigné doit
  // rester rigoureusement identique à ce qu'elle était.
  hostName?: string | null;
  hostTitle?: string | null;
  hostAvatarUrl?: string | null;
  hostBio?: string | null;

  /**
   * 🆕 Champs du formulaire, déjà RÉSOLUS par le serveur (repli sur les champs
   * par défaut + garantie d'un champ email inclus). Le widget n'a donc aucune
   * règle métier à connaître : il rend ce qu'il reçoit.
   *
   * Optionnel pour rester compatible avec une réponse d'API antérieure au
   * déploiement de cette fonctionnalité — un onglet resté ouvert, un cache.
   */
  formFields?: FormFieldItem[];
  /** 🆕 Mode. Absent → "consultation" (grille de créneaux classique). */
  mode?: string;
};

/**
 * 🆕 Séance publiée par l'hôte (mode `event`).
 *
 * `remaining` et `full` sont calculés côté SERVEUR : le widget ne doit pas
 * déduire la disponibilité d'un compte d'inscrits qu'il aurait reçu, sinon
 * deux onglets ouverts afficheraient des chiffres différents.
 */
type SessionView = {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  remaining: number;
  full: boolean;
};

type SlotsResponse = {
  ok: boolean;
  eventType?: EventTypeView;
  days?: DaySlots[];
  /** Renseigné uniquement en mode `event`. */
  sessions?: SessionView[];
  message?: string;
};

/**
 * Libellé de lieu PUBLIC.
 *
 * ⚠️ On ne rend JAMAIS `locationValue` tel quel. Ce champ contient l'URL de
 * visio ou l'adresse du rendez-vous :
 *   - l'afficher étale une URL technique sous le titre, ce qui fait amateur ;
 *   - surtout, publier un lien de visioconférence sur une page ouverte permet
 *     à n'importe qui de rejoindre la réunion.
 * Le lien réel part dans l'e-mail de confirmation et le .ics, c'est-à-dire à la
 * personne qui a effectivement réservé.
 */
function publicLocationLabel(kind: string): string {
  if (kind === "phone") return "Par téléphone";
  if (kind === "in_person") return "En personne";
  if (kind === "visio") return "Visioconférence";
  return "Détails envoyés par e-mail";
}

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTH_FORMATTER = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

/** "YYYY-MM-DD" → composants numériques, sans passer par Date (pas de fuseau). */
function parseDayKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m, d };
}

function dayKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Grille du mois, semaines commençant le LUNDI (convention francophone).
 * `null` = case vide avant le 1er / après le dernier jour.
 */
function monthGrid(year: number, month: number): Array<string | null> {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // getUTCDay : 0 = dimanche. On décale pour que lundi vaille 0.
  const leading = (first.getUTCDay() + 6) % 7;

  const cells: Array<string | null> = Array(leading).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(dayKey(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function BookingWidget({ slug }: { slug: string }) {
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE);
  const [data, setData] = useState<SlotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [month, setMonth] = useState<{ y: number; m: number } | null>(null);
  const [tzDetailOpen, setTzDetailOpen] = useState(false);

  /**
   * 🆕 Valeurs saisies, indexées par `name` de champ.
   *
   * Remplace les quatre états figés (name/email/phone/note) : le formulaire
   * est désormais défini par l'hôte, et le nombre de champs n'est plus connu
   * à l'écriture du composant.
   */
  /** 🆕 Séance choisie (mode `event`). C'est elle qui fait foi côté serveur. */
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [values, setValues] = useState<BookingFormValues>({});
  const setValue = (fieldName: string, v: string | boolean) =>
    setValues((prev) => ({ ...prev, [fieldName]: v }));
  const [submitting, setSubmitting] = useState(false);
  /** Navigation vers la page de confirmation du tunnel en cours. */
  const [redirecting, setRedirecting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<{ manageUrl: string; startsAt: string } | null>(null);

  const formRef = useRef<HTMLDivElement>(null);

  // La détection ne peut avoir lieu qu'après montage : le rendu serveur ignore
  // le fuseau du visiteur, et le deviner produirait une hydratation incohérente.
  useEffect(() => {
    setTimezone(detectVisitorTimeZone());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // On demande l'horizon complet (le serveur le plafonne) : le calendrier
      // doit pouvoir griser les jours fermés de TOUT le mois, pas seulement des
      // deux prochaines semaines.
      const res = await fetch(
        `/api/booking/${encodeURIComponent(slug)}/slots?tz=${encodeURIComponent(timezone)}&days=62`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as SlotsResponse;
      if (!res.ok || !json.ok) {
        setError(json.message ?? "Impossible de charger les créneaux.");
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError("Connexion impossible. Réessaie.");
    } finally {
      setLoading(false);
    }
  }, [slug, timezone]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Jours ayant au moins un créneau — la seule source de « cliquable ». */
  const availableDays = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const d of data?.days ?? []) {
      if (d.slots.length > 0) map.set(d.day, d.slots);
    }
    return map;
  }, [data]);

  const firstAvailable = useMemo(
    () => Array.from(availableDays.keys()).sort()[0] ?? null,
    [availableDays],
  );

  // Sélection initiale : le premier jour disponible. Ouvrir sur un mois vide
  // obligerait le prospect à chercher lui-même où sont les disponibilités.
  useEffect(() => {
    if (!firstAvailable) return;
    setSelectedDay((prev) => (prev && availableDays.has(prev) ? prev : firstAvailable));
    setMonth((prev) => {
      if (prev) return prev;
      const p = parseDayKey(firstAvailable);
      return { y: p.y, m: p.m };
    });
  }, [firstAvailable, availableDays]);

  const hostTz = data?.eventType?.timezone ?? DEFAULT_TIMEZONE;

  // 🆕 Couleur d'accent du calendrier. Avant, la page était figée en violet :
  // le prospect quittait l'univers visuel du tunnel en cliquant le CTA.
  // `resolveBookingColor` garantit une valeur exploitable même quand la colonne
  // `color` est nulle — cas de TOUS les types créés avant cette fonctionnalité.
  const accent = resolveBookingColor(data?.eventType?.color);
  const onAccent = readableTextOn(accent);
  const daySlots = selectedDay ? (availableDays.get(selectedDay) ?? []) : [];
  const tzNotice = data?.eventType ? daylightSavingShortNotice(hostTz, timezone) : null;

  const grid = month ? monthGrid(month.y, month.m) : [];
  const monthLabel = month
    ? MONTH_FORMATTER.format(new Date(Date.UTC(month.y, month.m - 1, 1)))
    : "";

  function shiftMonth(delta: number) {
    setMonth((prev) => {
      if (!prev) return prev;
      const d = new Date(Date.UTC(prev.y, prev.m - 1 + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
    });
  }

  function pickSlot(s: Slot) {
    setSelectedSlot(s);
    setFormError(null);
    // Sur mobile, le formulaire apparaît sous la grille : sans ce défilement,
    // le prospect clique un créneau et croit qu'il ne s'est rien passé.
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function submit() {
    if (!selectedSlot || submitting) return;

    // 🆕 Validation pilotée par la CONFIGURATION, plus par une liste de champs
    // écrite en dur. Même fonction que le serveur (lib/booking/formFields) :
    // ce qui est refusé ici est refusé là-bas, et réciproquement.
    const check = validateBookingAnswers(formFields, values);
    if (!check.ok) {
      setFormError(
        check.missing.length === 1
          ? `Renseigne « ${check.missing[0]} ».`
          : `Champs obligatoires manquants : ${check.missing.join(", ")}.`,
      );
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/booking/${encodeURIComponent(slug)}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: selectedSlot.startsAt,
          // 🆕 En mode `event`, c'est l'identifiant de séance qui détermine la
          // place, pas l'heure : deux séances peuvent commencer au même moment.
          ...(selectedSessionId ? { sessionId: selectedSessionId } : {}),
          timezone,
          // ⚠️ On envoie les VALEURS BRUTES, pas la répartition calculée ici :
          // le serveur refait la validation et la répartition à partir de la
          // définition enregistrée. Sinon il suffirait de retirer `required`
          // dans la requête pour contourner une obligation.
          values,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setFormError(json.message ?? "Réservation impossible.");
        if (res.status === 409) {
          // Créneau pris entre-temps : on recharge pour montrer ce qui reste.
          setSelectedSlot(null);
          void load();
        }
        return;
      }
      // 🆕 Tunnel rattaché : on renvoie le prospect sur SA page de confirmation.
      // `redirecting` garde le bouton désactivé pendant la navigation — le
      // `finally` ci-dessous relâche `submitting`, et sans ce second verrou le
      // bouton redeviendrait cliquable, invitant à un second envoi.
      if (json.redirectUrl) {
        setRedirecting(true);
        window.location.assign(json.redirectUrl as string);
        return;
      }
      setDone({ manageUrl: json.manageUrl, startsAt: json.startsAt });
    } catch {
      setFormError("Connexion impossible. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Confirmation ─────────────────────────────────────────────────────────
  if (done) {
    const d = new Date(done.startsAt);
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.07] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/15 text-2xl text-emerald-300">
          ✓
        </div>
        <h2 className="text-xl font-bold text-white">C&apos;est confirmé !</h2>
        <p className="mt-2 text-sm capitalize text-white/70">
          {formatDateInZone(d, timezone)} · {formatTimeInZone(d, timezone)}
        </p>
        <p className="mt-1 text-xs text-white/40">{shortZoneLabel(timezone)}</p>
        <p className="mt-5 text-sm leading-relaxed text-white/60">
          Un e-mail de confirmation vient de partir, avec le fichier à ajouter à ton agenda.
        </p>
        <a
          href={done.manageUrl}
          className="mt-5 inline-block text-sm font-semibold text-white/80 underline underline-offset-4 hover:text-white"
        >
          Gérer ou annuler ce rendez-vous
        </a>
      </div>
    );
  }

  const ev = data?.eventType;

  /**
   * 🆕 Champs à rendre. Le serveur les résout déjà (repli sur les champs par
   * défaut + garantie d'un champ email) ; le repli local ne couvre que les
   * réponses d'API antérieures à cette fonctionnalité — onglet resté ouvert,
   * cache — pour ne jamais afficher un formulaire sans aucun champ.
   *
   * Déclaré ICI et pas plus haut : `ev` dépend de `data`, qui n'existe qu'à ce
   * point du composant.
   */
  const formFields: FormFieldItem[] =
    ev?.formFields && ev.formFields.length > 0
      ? ev.formFields
      : DEFAULT_BOOKING_FIELDS;

  /**
   * 🆕 Mode `event` : l'hôte a publié des séances datées. On n'affiche pas une
   * grille de jours mais une liste de dates, avec les places restantes — c'est
   * cette information qui décide de l'inscription.
   */
  const sessions = data?.sessions ?? [];
  const isEventMode = ev?.mode === "event";

  return (
    // 🆕 La couleur d'accent devient une VARIABLE CSS portée par la racine.
    // Auparavant elle n'était appliquée qu'aux quelques endroits où un
    // `style={{ backgroundColor: accent }}` avait été écrit à la main : jour
    // sélectionné, bordures de créneaux, bouton d'envoi. Tout le reste — et
    // notamment le focus des champs — restait figé en violet (`focus:border-
    // violet-400/60` codé en dur), si bien qu'une couleur personnalisée
    // paraissait ignorée. Passer par une variable permet aux classes Tailwind
    // en valeur arbitraire de suivre la couleur choisie, partout.
    <div className="mx-auto max-w-4xl" style={{ "--ff-accent": accent } as CSSProperties}>
      {/* ── En-tête : nom + durée + lieu. JAMAIS d'URL technique. ────────── */}
      {ev && (
        <header className="mb-6 border-l-4 pl-4" style={{ borderColor: accent }}>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{ev.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/55">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} /> {ev.durationMin} min
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Video size={14} /> {publicLocationLabel(ev.locationKind)}
            </span>
          </div>
          {ev.description && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">{ev.description}</p>
          )}
        </header>
      )}

      {/* ── Fiche hôte ───────────────────────────────────────────────────
          Réserver un créneau, c'est engager son temps avec quelqu'un. Une page
          qui n'affiche qu'un calendrier ne dit pas À QUI l'on parle — c'est le
          principal frein à la conversion sur une page de réservation, et la
          raison pour laquelle Calendly place l'avatar et le nom de l'hôte
          au-dessus du calendrier.

          Bloc entièrement conditionnel : sans `hostName`, rien n'est rendu.
          Un avatar seul ne doit pas produire une fiche anonyme, d'où le test
          sur le nom et non sur la présence de l'un quelconque des champs. */}
      {ev?.hostName && (
        <section className="mb-6 flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          {ev.hostAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ev.hostAvatarUrl}
              alt={ev.hostName}
              width={56}
              height={56}
              loading="lazy"
              className="h-14 w-14 shrink-0 rounded-full object-cover"
              style={{ boxShadow: `0 0 0 2px ${withAlpha(accent, 0.55)}` }}
            />
          ) : (
            // Repli sur l'initiale : un avatar manquant ne doit pas laisser un
            // trou dans la mise en page ni afficher une image cassée.
            <span
              aria-hidden
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold"
              style={{ backgroundColor: withAlpha(accent, 0.2), color: accent }}
            >
              {ev.hostName.trim().charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-white/35">Avec</p>
            <p className="text-base font-semibold text-white">{ev.hostName}</p>
            {ev.hostTitle && <p className="text-sm text-white/55">{ev.hostTitle}</p>}
            {ev.hostBio && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">{ev.hostBio}</p>
            )}
          </div>
        </section>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] py-20 text-sm text-white/50">
          <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
          Chargement des disponibilités…
        </div>
      )}

      {error && (
        <p className="rounded-2xl border border-red-400/25 bg-red-400/[0.07] p-6 text-center text-sm text-red-200">
          {error}
        </p>
      )}

      {!loading && !error && availableDays.size === 0 && (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-white/50">
          Aucune disponibilité pour le moment. Reviens un peu plus tard.
        </p>
      )}

      {/* ── 🆕 MODE `event` — liste de séances, pas de calendrier ──────────
          L'hôte a fixé les dates : un calendrier mensuel où seuls trois jours
          sont cliquables ferait chercher l'information au lieu de la donner.
          On liste donc les séances, avec les places restantes — c'est ce qui
          décide de l'inscription, et ce qui crée l'urgence. */}
      {!loading && !error && isEventMode && (
        <div className="grid gap-2">
          {sessions.length === 0 && (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center text-sm text-white/60">
              Aucune séance programmée pour le moment.
            </p>
          )}

          {sessions.map((s) => {
            const start = new Date(s.startsAt);
            const selected = selectedSlot?.startsAt === s.startsAt;
            return (
              <button
                key={s.id}
                type="button"
                disabled={s.full}
                onClick={() => {
                  setSelectedSessionId(s.id);
                  pickSlot({ startsAt: s.startsAt, endsAt: s.endsAt });
                }}
                aria-pressed={selected}
                style={
                  selected ? { borderColor: accent, backgroundColor: withAlpha(accent, 0.12) } : undefined
                }
                className={
                  "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-left transition motion-reduce:transition-none " +
                  (s.full
                    ? "cursor-not-allowed border-white/10 bg-white/[0.02] opacity-50"
                    : selected
                      ? "border-transparent"
                      : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]")
                }
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold capitalize text-white">
                    {formatDateInZone(start, timezone)}
                  </span>
                  <span className="mt-0.5 block text-xs text-white/55">
                    {formatTimeInZone(start, timezone)} –{" "}
                    {formatTimeInZone(new Date(s.endsAt), timezone)} (
                    {shortZoneLabel(timezone)})
                  </span>
                </span>
                <span
                  className={
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold " +
                    (s.full
                      ? "bg-white/10 text-white/50"
                      : s.remaining <= 3
                        ? "bg-red-500/20 text-red-200"
                        : "bg-white/10 text-white/70")
                  }
                >
                  {s.full
                    ? "Complet"
                    : `${s.remaining} place${s.remaining > 1 ? "s" : ""}`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!loading && !error && !isEventMode && availableDays.size > 0 && (
        <>
          {/* ── Deux colonnes desktop, étapes empilées mobile ───────────── */}
          <div className="grid gap-5 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            {/* Calendrier */}
            {/* Les deux cartes reçoivent une bordure teintée par la couleur du
                type de RDV : sans cela, seuls trois éléments isolés portaient
                l'accent et la personnalisation passait inaperçue. */}
            <section
              style={{ borderColor: withAlpha(accent, 0.22) }}
              className="rounded-2xl border bg-white/[0.04] p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white motion-reduce:transition-none"
                  aria-label="Mois précédent"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-semibold capitalize text-white">{monthLabel}</span>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white motion-reduce:transition-none"
                  aria-label="Mois suivant"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAY_LABELS.map((w, i) => (
                  <span key={i} className="py-1 text-[11px] font-medium text-white/35">
                    {w}
                  </span>
                ))}
                {grid.map((key, i) => {
                  if (!key) return <span key={`empty-${i}`} />;
                  const isAvailable = availableDays.has(key);
                  const isSelected = key === selectedDay;
                  const num = parseDayKey(key).d;
                  return (
                    <button
                      key={key}
                      type="button"
                      // Un jour sans créneau n'est pas cliquable : laisser
                      // cliquer pour n'afficher « rien » serait une impasse.
                      disabled={!isAvailable}
                      onClick={() => {
                        setSelectedDay(key);
                        setSelectedSlot(null);
                      }}
                      aria-pressed={isSelected}
                      style={
                        isSelected ? { backgroundColor: accent, color: onAccent } : undefined
                      }
                      className={
                        "aspect-square rounded-lg text-sm transition motion-reduce:transition-none " +
                        (isSelected
                          ? "font-bold"
                          : isAvailable
                            ? "bg-white/[0.07] font-medium text-white hover:bg-white/15"
                            : "text-white/20")
                      }
                    >
                      {num}
                    </button>
                  );
                })}
              </div>

              {/* Fuseau : une ligne, détail repliable. */}
              <div className="mt-4 border-t border-white/10 pt-3">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-white/50">
                  <span>Heures affichées pour</span>
                  <select
                    value={timezone}
                    onChange={(e) => {
                      setSelectedSlot(null);
                      setTimezone(e.target.value);
                    }}
                    // ⚠️ LISIBILITÉ DE LA LISTE DÉROULANTE.
                    //
                    // Le fond était `bg-black/40`, c'est-à-dire SEMI-TRANSPARENT.
                    // Sur le contrôle fermé, cela passe. Mais la liste native
                    // ouverte par le navigateur hérite de cette couleur : elle
                    // s'affichait délavée, laissant transparaître la page, avec
                    // du texte blanc par-dessus — d'où l'impression de flou et
                    // l'illisibilité signalées.
                    //
                    // Un menu natif doit être OPAQUE. On force donc une couleur
                    // pleine sur le select ET sur chaque option : les <option>
                    // ne sont pas mises en forme de façon fiable par les classes
                    // du parent (chaque navigateur les rend à sa manière), il
                    // faut leur poser les couleurs explicitement.
                    style={{ backgroundColor: "#18181b", color: "#ffffff" }}
                    className="max-w-[170px] truncate rounded-md border border-white/20 px-1.5 py-1 text-xs font-medium"
                  >
                    {!TIMEZONE_OPTIONS.some((t) => t.id === timezone) && (
                      <option value={timezone} style={{ backgroundColor: "#18181b", color: "#ffffff" }}>
                        {shortZoneLabel(timezone)}
                      </option>
                    )}
                    {TIMEZONE_OPTIONS.map((t) => (
                      <option
                        key={t.id}
                        value={t.id}
                        style={{ backgroundColor: "#18181b", color: "#ffffff" }}
                      >
                        {t.label}
                      </option>
                    ))}
                  </select>
                  {tzNotice && (
                    <button
                      type="button"
                      onClick={() => setTzDetailOpen((v) => !v)}
                      aria-expanded={tzDetailOpen}
                      className="rounded-full p-0.5 text-white/40 transition hover:text-white/80 motion-reduce:transition-none"
                      aria-label="À propos des fuseaux horaires"
                    >
                      <Info size={13} />
                    </button>
                  )}
                </div>
                {tzNotice && tzDetailOpen && (
                  <p className="mt-2 rounded-lg bg-white/[0.05] p-2.5 text-[11px] leading-relaxed text-white/60">
                    {tzNotice}
                  </p>
                )}
              </div>
            </section>

            {/* Créneaux du jour choisi */}
            <section
              style={{ borderColor: withAlpha(accent, 0.22) }}
              className="rounded-2xl border bg-white/[0.04] p-4"
            >
              {selectedDay ? (
                <>
                  <h2
                    style={{ borderColor: accent }}
                    className="mb-3 border-l-2 pl-2 text-sm font-semibold capitalize text-white"
                  >
                    {formatDateInZone(new Date(daySlots[0]?.startsAt ?? Date.now()), timezone)}
                  </h2>
                  <div className="grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                    {daySlots.map((s) => {
                      const utc = new Date(s.startsAt);
                      const isSel = selectedSlot?.startsAt === s.startsAt;
                      const differs = !sameWallClock(utc, timezone, hostTz);
                      return (
                        <button
                          key={s.startsAt}
                          type="button"
                          onClick={() => pickSlot(s)}
                          title={
                            differs
                              ? `${formatTimeInZone(utc, timezone)} chez toi · ${formatTimeInZone(utc, hostTz)} chez l'organisateur (${shortZoneLabel(hostTz)})`
                              : undefined
                          }
                          style={
                            isSel
                              ? { backgroundColor: accent, borderColor: accent, color: onAccent }
                              : { borderColor: withAlpha(accent, 0.25) }
                          }
                          className={
                            "rounded-lg border py-2.5 text-sm font-medium transition motion-reduce:transition-none " +
                            (isSel ? "" : "bg-white/[0.06] text-white hover:bg-white/[0.12]")
                          }
                        >
                          {formatTimeInZone(utc, timezone)}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="py-16 text-center text-sm text-white/40">
                  Choisis une date dans le calendrier.
                </p>
              )}
            </section>
          </div>

          {/* ── Formulaire contextuel ──────────────────────────────────── */}
          {selectedSlot && (
            <div
              ref={formRef}
              style={{ borderColor: withAlpha(accent, 0.3) }}
              className="mt-5 rounded-2xl border bg-white/[0.05] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <p className="text-sm font-bold capitalize text-white">
                    {formatDateInZone(new Date(selectedSlot.startsAt), timezone)} ·{" "}
                    {formatTimeInZone(new Date(selectedSlot.startsAt), timezone)}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {ev?.name} · {ev?.durationMin} min · {shortZoneLabel(timezone)}
                  </p>
                  {!sameWallClock(new Date(selectedSlot.startsAt), timezone, hostTz) && (
                    <p className="mt-1 text-xs text-white/40">
                      Soit {formatTimeInZone(new Date(selectedSlot.startsAt), hostTz)} chez
                      l&apos;organisateur ({shortZoneLabel(hostTz)}).
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSlot(null)}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white motion-reduce:transition-none"
                >
                  Changer
                </button>
              </div>

              {/* 🆕 FORMULAIRE PILOTÉ PAR LA CONFIGURATION.
                  Les quatre champs étaient écrits en dur : un hôte qui avait
                  besoin du budget, du niveau ou d'un lien devait le demander
                  après coup par email — et en perdait la moitié. La liste vient
                  maintenant du type de RDV (repli sur les champs par défaut si
                  l'hôte n'a rien personnalisé). */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {formFields.map((field) => {
                  const raw = values[field.name];
                  // `half` occupe une colonne, tout le reste s'étend sur deux :
                  // un texte long ou une liste dans une demi-largeur est
                  // pénible à remplir sur mobile comme sur desktop.
                  const span =
                    field.width === "half" && field.type !== "textarea"
                      ? ""
                      : "sm:col-span-2";
                  const label = field.label || field.name;
                  const inputClass =
                    "w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-[color:var(--ff-accent)] motion-reduce:transition-none";

                  if (field.type === "checkbox") {
                    return (
                      <label
                        key={field.name}
                        className={`flex items-start gap-2 text-sm text-white/80 ${span}`}
                      >
                        <input
                          type="checkbox"
                          checked={raw === true}
                          onChange={(e) => setValue(field.name, e.target.checked)}
                          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
                        />
                        <span>
                          {label}
                          {field.required && <span className="text-red-400"> *</span>}
                        </span>
                      </label>
                    );
                  }

                  if (field.type === "textarea") {
                    return (
                      <textarea
                        key={field.name}
                        value={typeof raw === "string" ? raw : ""}
                        onChange={(e) => setValue(field.name, e.target.value)}
                        placeholder={`${field.placeholder || label}${field.required ? " *" : ""}`}
                        rows={3}
                        maxLength={1000}
                        className={`resize-y ${inputClass} ${span}`}
                      />
                    );
                  }

                  if (field.type === "select") {
                    return (
                      <select
                        key={field.name}
                        value={typeof raw === "string" ? raw : ""}
                        onChange={(e) => setValue(field.name, e.target.value)}
                        className={`${inputClass} ${span}`}
                      >
                        <option value="">
                          {field.placeholder || label}
                          {field.required ? " *" : ""}
                        </option>
                        {(field.options ?? []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    );
                  }

                  return (
                    <input
                      key={field.name}
                      type={field.type}
                      value={typeof raw === "string" ? raw : ""}
                      onChange={(e) => setValue(field.name, e.target.value)}
                      placeholder={`${field.placeholder || label}${field.required ? " *" : ""}`}
                      maxLength={200}
                      className={`${inputClass} ${span}`}
                    />
                  );
                })}
              </div>

              {formError && <p className="mt-3 text-xs text-red-300">{formError}</p>}

              <button
                type="button"
                onClick={submit}
                disabled={submitting || redirecting}
                style={{ backgroundColor: accent, color: onAccent }}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition hover:opacity-90 disabled:opacity-50 motion-reduce:transition-none"
              >
                {(submitting || redirecting) && (
                  <Loader2 size={15} className="animate-spin motion-reduce:animate-none" />
                )}
                {redirecting ? "Redirection…" : submitting ? "Réservation…" : "Confirmer le rendez-vous"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default BookingWidget;
