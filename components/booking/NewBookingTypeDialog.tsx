"use client";

// components/booking/NewBookingTypeDialog.tsx
//
// 🆕 Création d'un type de rendez-vous — parcours en 3 étapes.
//
// ── POURQUOI UN WIZARD ICI, ET PAS AILLEURS ─────────────────────────────────
// Un parcours par étapes ne se justifie que si une étape DÉPEND de la
// précédente. C'est le cas : le mode choisi à l'étape 1 change la nature de
// l'étape 2.
//
//   • consultation / recurring → tu définis une DURÉE, le client choisit son
//     créneau dans tes disponibilités ;
//   • event                    → tu publies des DATES, avec un nombre de places.
//
// Ce ne sont pas les mêmes questions. Les poser toutes sur un écran unique
// obligerait à en masquer la moitié selon un choix fait plus haut — ce qui est
// un wizard, mais mal fait.
//
// En revanche on reste à 3 étapes, pas 6 : au-delà, on remplace une création
// instantanée par une corvée, et c'est là qu'on abandonne.

import { useRef, useState } from "react";
import {
  X,
  Loader2,
  Clock,
  MapPin,
  ListChecks,
  Users,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  CalendarDays,
  ExternalLink,
  Upload,
  UserRound,
  // 🆕 Une icône par préréglage — voir PRESET_ICONS plus bas.
  PhoneCall,
  Target,
  ClipboardCheck,
  Monitor,
  MessageSquare,
  Presentation,
  Repeat,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { BOOKING_PRESETS, type BookingPreset } from "@/lib/booking/presets";
import { usesFixedSessions, isGroupMode } from "@/lib/booking/types";
import { BOOKING_COLOR_PRESETS } from "@/lib/booking/colors";
import { TIMEZONE_OPTIONS, detectVisitorTimeZone } from "@/lib/booking/timezones";
import { PopupFieldsEditor } from "@/components/editor/tabs/items/PopupFieldsEditor";
import type { FormFieldItem } from "@/lib/funnels/types";

/** Séance saisie dans le wizard (mode `event`). */
export type DraftSession = { day: string; time: string; durationMin: number };

export interface NewTypePayload {
  preset: BookingPreset;
  name: string;
  durationMin: number;
  capacity?: number;
  sessions?: DraftSession[];
  /** 🆕 Paiement (migration 05). */
  paymentRequired?: boolean;
  priceAmount?: number;
  currency?: string;
  paymentUrl?: string;
  /** 🆕 Réglés dans le wizard, pour en sortir avec un RDV prêt à publier. */
  color?: string;
  formFields?: FormFieldItem[];
  /** 🆕 Disponibilités hebdomadaires + fuseau, réglés à l'étape 3. */
  timezone?: string;
  availability?: { weekday: number; startMin: number; endMin: number }[];
  /** 🆕 Fiche de l'animateur, affichée sur la page publique. */
  hostName?: string;
  hostTitle?: string;
  hostBio?: string;
  /** URL Cloudinary de la photo, téléversée depuis le wizard. */
  hostAvatarUrl?: string;
}

const STEPS = ["Format", "Planning", "Disponibilités", "Paiement", "Finalisation"] as const;

const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

/** Minutes depuis minuit → « 09:00 », et l'inverse. */
const toHHMM = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fromHHMM = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

type DayRule = { open: boolean; startMin: number; endMin: number };

/**
 * Semaine de départ : lundi-vendredi 9h-17h, week-end fermé.
 *
 * Pré-remplir plutôt que présenter sept lignes vides : l'utilisateur ajuste ce
 * qui ne lui convient pas, au lieu de tout saisir. C'est aussi ce qui garantit
 * qu'un rendez-vous sorti du wizard affiche immédiatement des créneaux.
 */
const DEFAULT_WEEK: DayRule[] = [
  { open: false, startMin: 540, endMin: 1020 }, // dimanche
  { open: true, startMin: 540, endMin: 1020 },
  { open: true, startMin: 540, endMin: 1020 },
  { open: true, startMin: 540, endMin: 1020 },
  { open: true, startMin: 540, endMin: 1020 },
  { open: true, startMin: 540, endMin: 1020 },
  { open: false, startMin: 540, endMin: 1020 }, // samedi
];

/** Devises proposées. Liste courte : ajouter tout ISO 4217 noierait le choix. */
const CURRENCIES = ["EUR", "USD", "XOF", "XAF", "CHF", "CAD", "MAD"] as const;

/**
 * 🆕 Vignette de format — grande icône lucide, comme la barre latérale.
 *
 * ── CE QUI N'ALLAIT PAS ─────────────────────────────────────────────────────
 * La version précédente dessinait un schéma SVG choisi d'après `mode`. L'idée
 * se défendait, l'exécution non : SIX des huit préréglages partagent le mode
 * `consultation`, si bien que six cartes sur huit affichaient exactement le
 * même petit dessin « point — point ». La colonne d'icônes ne distinguait donc
 * plus rien, et à 40 px de haut le trait était trop fin pour se lire.
 *
 * ── LE CHOIX ────────────────────────────────────────────────────────────────
 * L'icône est désormais indexée sur l'IDENTIFIANT du préréglage, pas sur son
 * mode : chaque format a la sienne. On reprend le vocabulaire lucide déjà
 * employé dans la barre latérale, en 28 px sur une pastille de 56 px — assez
 * grand pour être identifié d'un coup d'œil.
 *
 * Toujours pas d'emoji : leur rendu dépend de la police du système et change
 * d'aspect entre Windows, macOS et Android.
 */
const PRESET_ICONS: Record<string, LucideIcon> = {
  discovery: PhoneCall,
  coaching: Target,
  audit: ClipboardCheck,
  demo: Monitor,
  consultation: MessageSquare,
  workshop: Presentation,
  classroom: Repeat,
  custom: SlidersHorizontal,
};

function PresetGlyph({ id, accent }: { id: string; accent: string }) {
  // Repli sur l'icône « sur mesure » : un préréglage ajouté plus tard sans
  // entrée dans la table reste lisible au lieu d'afficher un trou.
  const Icon = PRESET_ICONS[id] ?? SlidersHorizontal;
  return (
    <span
      className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl"
      aria-hidden
    >
      {/* Teinte d'accent en calque séparé : `accent` peut arriver en hex, en
          rgb() ou en nom CSS, et concaténer un canal alpha ne marcherait que
          pour le premier cas. */}
      <span className="absolute inset-0" style={{ backgroundColor: accent, opacity: 0.14 }} />
      <Icon size={28} strokeWidth={1.75} className="relative" style={{ color: accent }} />
    </span>
  );
}

export function NewBookingTypeDialog({
  open,
  busy,
  onClose,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (payload: NewTypePayload) => void;
}) {
  const [step, setStep] = useState(0);
  const [presetId, setPresetId] = useState<string>(BOOKING_PRESETS[0].id);
  const [name, setName] = useState<string>(BOOKING_PRESETS[0].defaultName);
  const [duration, setDuration] = useState<number>(BOOKING_PRESETS[0].durationMin);
  const [capacity, setCapacity] = useState<number>(30);
  const [sessions, setSessions] = useState<DraftSession[]>([]);
  // 🆕 Paiement — désactivé par défaut : la majorité des appels de découverte
  // sont gratuits, et un formulaire de paiement affiché d'emblée ferait
  // hésiter sur un cas qui ne concerne pas la plupart des utilisateurs.
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState<string>("");
  const [currency, setCurrency] = useState<string>("EUR");
  const [paymentUrl, setPaymentUrl] = useState<string>("");
  /**
   * 🆕 Couleur et champs, réglés ICI plutôt que dans les onglets.
   *
   * L'objectif : sortir du wizard avec un rendez-vous PRÊT. Un parcours qui
   * se termine par « maintenant, va configurer trois onglets » n'a pas fait
   * gagner de temps, il a juste déplacé le travail.
   */
  const [color, setColor] = useState<string>(BOOKING_COLOR_PRESETS[0] ?? "#7C3AED");
  const [fields, setFields] = useState<FormFieldItem[] | undefined>(undefined);
  // 🆕 Étape 3 — fuseau et semaine type. Le fuseau est celui de l'HÔTE : c'est
  // la référence de toutes les plages saisies ici, et chaque visiteur verra
  // l'équivalent chez lui.
  const [timezone, setTimezone] = useState<string>(detectVisitorTimeZone());
  const [week, setWeek] = useState<DayRule[]>(DEFAULT_WEEK.map((d) => ({ ...d })));
  // 🆕 Étape 5 — fiche de l'animateur. `hostName` est le déclencheur : sans
  // lui, aucun bloc n'est rendu côté public (un avatar seul produirait une
  // fiche anonyme).
  const [hostName, setHostName] = useState("");
  const [hostTitle, setHostTitle] = useState("");
  const [hostBio, setHostBio] = useState("");
  const [hostAvatarUrl, setHostAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * 🆕 Téléversement de la photo de l'animateur.
   *
   * Passe par /api/media/upload → Cloudinary, comme les médias de tunnel.
   * ⚠️ PAS par Supabase Storage : c'est ce qui a fait exploser le quota en
   * juillet. `funnelId` sert de dossier côté Cloudinary et range les avatars
   * à part.
   */
  async function uploadAvatar(file: File) {
    setAvatarError(null);
    if (!file.type.startsWith("image/")) {
      setAvatarError("Choisis une image (jpg, png, webp…).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError(
        `Image trop lourde (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum 5 Mo.`,
      );
      return;
    }
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("funnelId", "booking-hosts");
      // Le rendez-vous n'existe pas encore : on horodate pour éviter qu'un
      // second téléversement écrase le premier.
      fd.append("spotId", `host-new-${Date.now()}`);
      const res = await fetch("/api/media/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) {
        setAvatarError(json.error ?? "Envoi impossible. Réessaie.");
        return;
      }
      setHostAvatarUrl(json.url as string);
    } catch {
      setAvatarError("Connexion impossible pendant l'envoi.");
    } finally {
      setUploadingAvatar(false);
      // Réinitialise le champ : sans cela, re-choisir LE MÊME fichier après
      // une suppression ne déclencherait aucun `change`.
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  if (!open) return null;

  const preset =
    BOOKING_PRESETS.find((p) => p.id === presetId) ?? BOOKING_PRESETS[0];
  const isEvent = usesFixedSessions(preset.mode);
  const isGroup = isGroupMode(preset.mode);
  /**
   * La couleur courante sort-elle des préréglages ? Sert à marquer la pastille.
   * Comparaison insensible à la casse : le sélecteur natif renvoie du
   * minuscule, une valeur collée depuis une charte est souvent en majuscules —
   * sans ça, « #7C3AED » passerait pour personnalisée alors qu'elle est dans
   * la liste.
   */
  const isCustomColor = !BOOKING_COLOR_PRESETS.some(
    (c) => c.toLowerCase() === color.toLowerCase(),
  );

  const selectPreset = (p: BookingPreset) => {
    setPresetId(p.id);
    setName(p.defaultName);
    setDuration(p.durationMin);
    if (p.capacity) setCapacity(p.capacity);
  };

  const addSession = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setSessions((prev) => [
      ...prev,
      { day: d.toISOString().slice(0, 10), time: "09:00", durationMin: duration },
    ]);
  };

  // Une séance sans date est inexploitable ; un atelier sans aucune séance
  // n'afficherait rien au public. On bloque plutôt que de créer un type mort.
  // Un lien de paiement absent alors que « payant » est coché produirait un
  // bouton « Payer » qui ne mène nulle part : on bloque plutôt que de laisser
  // publier une page de réservation cassée.
  const paymentReady = !paid || paymentUrl.trim().length > 0;

  // Une semaine entièrement fermée produirait un calendrier sans aucun
  // créneau : l'hôte croirait le module cassé alors qu'il n'a rien ouvert.
  const hasOpenDay = isEvent || week.some((d) => d.open && d.endMin > d.startMin);

  const canContinue =
    step === 0
      ? true
      : step === 1
        ? isEvent
          ? sessions.length > 0
          : duration >= 5
        : step === 2
          ? hasOpenDay
          : step === 3
            ? paymentReady
            : name.trim().length > 0;

  const reset = () => {
    setStep(0);
    setSessions([]);
  };

  const submit = () => {
    onCreate({
      preset,
      name: name.trim() || preset.defaultName,
      durationMin: duration,
      capacity: isGroup ? capacity : undefined,
      sessions: isEvent ? sessions : undefined,
      paymentRequired: paid,
      // Saisi en unité courante, stocké en CENTIMES : un entier évite les
      // erreurs d'arrondi des flottants sur de l'argent.
      priceAmount: paid ? Math.round((Number(price) || 0) * 100) : undefined,
      currency: paid ? currency : undefined,
      paymentUrl: paid ? paymentUrl.trim() : undefined,
      color,
      formFields: fields ?? preset.formFields,
      timezone,
      // Les jours fermés ne sont pas envoyés : l'absence de règle VAUT
      // fermeture. Envoyer une plage vide créerait une ligne inutile en base.
      availability: isEvent
        ? undefined
        : week
            .map((d, weekday) => ({ weekday, startMin: d.startMin, endMin: d.endMin, open: d.open }))
            .filter((d) => d.open && d.endMin > d.startMin)
            .map(({ weekday, startMin, endMin }) => ({ weekday, startMin, endMin })),
      hostName: hostName.trim() || undefined,
      // Titre et bio n'ont de sens qu'avec un nom : sans lui, rien n'est rendu.
      hostTitle: hostName.trim() ? hostTitle.trim() || undefined : undefined,
      hostBio: hostName.trim() ? hostBio.trim() || undefined : undefined,
      hostAvatarUrl: hostName.trim() ? hostAvatarUrl || undefined : undefined,
    });
  };

  return (
    // 🆕 CENTRAGE. `fixed inset-0` se cale sur le VIEWPORT, pas sur la zone de
    // contenu : avec la sidebar fixe de 288 px (lg:pl-72 sur AppShell), le
    // popup apparaissait décalé vers la gauche — centré sur l'écran, donc
    // décentré par rapport à ce que l'utilisateur regarde. On reprend le même
    // décalage que le contenu.
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4 lg:pl-72"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) {
          reset();
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-line bg-surface p-4 shadow-2xl sm:rounded-2xl sm:p-6"
      >
        {/* ── En-tête + progression ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* 🆕 « Type de rendez-vous » est le vocabulaire du MODÈLE, pas
                celui de l'utilisateur : il crée un rendez-vous à proposer, pas
                une catégorie. */}
            <h2 className="text-lg font-bold text-ink">Créer un rendez-vous</h2>
            <p className="mt-0.5 text-xs text-muted">
              Étape {step + 1} sur {STEPS.length} — {STEPS[step]}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={busy}
            aria-label="Fermer"
            className="shrink-0 rounded-lg border border-line p-1.5 text-muted transition hover:text-ink disabled:opacity-50"
          >
            <X size={15} />
          </button>
        </div>

        {/* Progression : segments pleins, pas un pourcentage inventé. */}
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-violet-500" : "bg-line"
              }`}
            />
          ))}
        </div>

        {/* ── ÉTAPE 1 — Format ── */}
        {step === 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {BOOKING_PRESETS.map((p) => {
              const selected = p.id === presetId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPreset(p)}
                  aria-pressed={selected}
                  className={
                    "rounded-xl border p-3 text-left transition " +
                    (selected
                      ? "border-violet-500/60 bg-violet-500/10 ring-1 ring-inset ring-violet-500/30"
                      : "border-line bg-canvas hover:border-violet-500/40")
                  }
                >
                  <span className="flex items-start gap-3">
                    <PresetGlyph id={p.id} accent={color} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{p.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                        {p.hint}
                      </span>
                    </span>
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} /> {p.durationMin} min
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ListChecks size={11} /> {p.formFields.length} champs
                    </span>
                    {p.capacity ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-violet-500">
                        <Users size={11} /> {p.capacity} places
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} /> Individuel
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── ÉTAPE 2 — Planning (dépend du mode) ── */}
        {step === 1 && (
          <div className="mt-4 grid gap-3">
            {isEvent ? (
              <>
                <p className="text-xs leading-relaxed text-muted">
                  Tu fixes les dates, les participants s&apos;inscrivent. Ajoute
                  au moins une séance — sans date, ta page publique n&apos;aurait
                  rien à proposer.
                </p>

                <div className="grid gap-2">
                  {sessions.map((s, i) => (
                    <div
                      key={i}
                      className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-canvas p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">
                          Date
                        </label>
                        <input
                          type="date"
                          value={s.day}
                          onChange={(e) =>
                            setSessions((prev) =>
                              prev.map((x, j) => (j === i ? { ...x, day: e.target.value } : x)),
                            )
                          }
                          style={{ colorScheme: "dark" }}
                          className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none"
                        />
                      </div>
                      <div className="w-24">
                        <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">
                          Heure
                        </label>
                        <input
                          type="time"
                          value={s.time}
                          onChange={(e) =>
                            setSessions((prev) =>
                              prev.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)),
                            )
                          }
                          style={{ colorScheme: "dark" }}
                          className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none"
                        />
                      </div>
                      <div className="w-20">
                        <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">
                          Durée
                        </label>
                        <input
                          type="number"
                          min={5}
                          step={5}
                          value={s.durationMin}
                          onChange={(e) =>
                            setSessions((prev) =>
                              prev.map((x, j) =>
                                j === i
                                  ? { ...x, durationMin: Math.max(5, Number(e.target.value) || 60) }
                                  : x,
                              ),
                            )
                          }
                          className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setSessions((prev) => prev.filter((_, j) => j !== i))}
                        aria-label="Retirer cette séance"
                        className="rounded-md p-1.5 text-muted transition hover:text-red-400"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}

                  {sessions.length === 0 && (
                    <p className="rounded-lg border border-dashed border-line p-4 text-center text-xs text-muted">
                      Aucune séance. Ajoute la première date de ton atelier.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={addSession}
                  className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-violet-500/50"
                >
                  <Plus size={13} /> Ajouter une séance
                </button>
              </>
            ) : (
              <>
                <p className="text-xs leading-relaxed text-muted">
                  Le client choisit son créneau dans tes disponibilités. Des
                  horaires par défaut sont créés (lundi à vendredi, 9h–12h et
                  14h–17h) : tu les ajusteras dans l&apos;onglet Disponibilités.
                </p>
                <div className="w-40">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Durée (min)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={480}
                    step={5}
                    value={duration}
                    onChange={(e) =>
                      setDuration(Math.max(5, Math.min(480, Number(e.target.value) || 30)))
                    }
                    className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-violet-500/50"
                  />
                </div>
              </>
            )}

            {isGroup && (
              <div className="w-40">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Places par séance
                </label>
                <input
                  type="number"
                  min={2}
                  max={10000}
                  value={capacity}
                  onChange={(e) =>
                    setCapacity(Math.max(2, Math.min(10000, Number(e.target.value) || 30)))
                  }
                  className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-violet-500/50"
                />
              </div>
            )}
          </div>
        )}

        {/* ── ÉTAPE 3 — Disponibilités ──
            Sautée en mode `event` : un atelier a des dates fixes, pas des
            plages hebdomadaires. Afficher les deux créerait deux sources de
            vérité pour le même calendrier. */}
        {step === 2 && (
          <div className="mt-4 grid gap-3">
            {isEvent ? (
              <p className="rounded-lg border border-line bg-canvas p-4 text-xs leading-relaxed text-muted">
                Ce format fonctionne avec les <strong>dates fixes</strong> que tu
                as saisies à l&apos;étape précédente. Il n&apos;y a pas de plages
                hebdomadaires à définir.
              </p>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Ton fuseau horaire
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    style={{ colorScheme: "dark" }}
                    className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-violet-500/50"
                  >
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz.id} value={tz.id}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted">
                    Les horaires ci-dessous sont TES heures locales. Chaque
                    visiteur verra automatiquement l&apos;équivalent chez lui.
                  </p>
                </div>

                <div className="grid gap-1.5">
                  {week.map((d, i) => (
                    <div
                      key={i}
                      className={
                        "flex flex-wrap items-center gap-2 rounded-lg border p-2 transition " +
                        (d.open ? "border-line bg-canvas" : "border-line bg-canvas opacity-55")
                      }
                    >
                      <label className="flex w-32 shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-ink">
                        <input
                          type="checkbox"
                          checked={d.open}
                          onChange={(e) =>
                            setWeek((prev) =>
                              prev.map((x, j) =>
                                j === i ? { ...x, open: e.target.checked } : x,
                              ),
                            )
                          }
                          className="h-4 w-4 accent-violet-500"
                        />
                        {JOURS[i]}
                      </label>

                      {d.open ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="time"
                            value={toHHMM(d.startMin)}
                            onChange={(e) =>
                              setWeek((prev) =>
                                prev.map((x, j) =>
                                  j === i ? { ...x, startMin: fromHHMM(e.target.value) } : x,
                                ),
                              )
                            }
                            style={{ colorScheme: "dark" }}
                            className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink outline-none"
                          />
                          <span className="text-xs text-muted">→</span>
                          <input
                            type="time"
                            value={toHHMM(d.endMin)}
                            onChange={(e) =>
                              setWeek((prev) =>
                                prev.map((x, j) =>
                                  j === i ? { ...x, endMin: fromHHMM(e.target.value) } : x,
                                ),
                              )
                            }
                            style={{ colorScheme: "dark" }}
                            className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink outline-none"
                          />
                          {d.endMin <= d.startMin && (
                            <span className="text-[10px] font-medium text-red-400">
                              Fin avant début
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted">Fermé</span>
                      )}
                    </div>
                  ))}
                </div>

                {!hasOpenDay && (
                  <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-[11px] font-medium text-red-400">
                    Ouvre au moins un jour, sinon ton calendrier n&apos;affichera
                    aucun créneau.
                  </p>
                )}

                <p className="text-[10px] leading-relaxed text-muted">
                  Les exceptions ponctuelles (congés, jour férié) se règlent
                  après création, dans l&apos;onglet Disponibilités.
                </p>
              </>
            )}
          </div>
        )}

        {/* ── ÉTAPE 4 — Paiement ── */}
        {step === 3 && (
          <div className="mt-4 grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { id: false, label: "Gratuit", hint: "Le participant réserve directement." },
                { id: true, label: "Payant", hint: "Il paie d'abord, puis choisit son créneau." },
              ].map((opt) => (
                <button
                  key={String(opt.id)}
                  type="button"
                  onClick={() => setPaid(opt.id)}
                  aria-pressed={paid === opt.id}
                  className={
                    "rounded-xl border p-3 text-left transition " +
                    (paid === opt.id
                      ? "border-violet-500/60 bg-violet-500/10 ring-1 ring-inset ring-violet-500/30"
                      : "border-line bg-canvas hover:border-violet-500/40")
                  }
                >
                  <span className="block text-sm font-semibold text-ink">{opt.label}</span>
                  <span className="mt-0.5 block text-[11px] text-muted">{opt.hint}</span>
                </button>
              ))}
            </div>

            {paid && (
              <>
                {/* 🆕 ONBOARDING CHARIOW.
                    L'ordre des trois étapes n'est pas cosmétique : c'est le
                    redirect_url du produit qui fait que seuls les payeurs
                    atteignent le calendrier. Sans lui, le client paie et
                    n'arrive jamais sur la page de réservation. */}
                <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3">
                  <p className="text-xs font-bold text-ink">
                    Comment ça marche : le participant paie d&apos;abord
                  </p>
                  <ol className="mt-2 grid gap-1.5 text-[11px] leading-relaxed text-ink">
                    <li>
                      <strong>1.</strong> Dans Chariow, crée un produit de type{" "}
                      <strong>Service</strong> au prix de ton rendez-vous.
                    </li>
                    <li>
                      <strong>2.</strong> Dans les réglages de ce produit, mets{" "}
                      <strong>l&apos;URL de redirection</strong> sur ton lien de
                      réservation AutoFunnel. C&apos;est ce qui ramène le client
                      vers ton calendrier après le paiement.
                    </li>
                    <li>
                      <strong>3.</strong> Copie l&apos;URL publique du produit et
                      colle-la ci-dessous.
                    </li>
                  </ol>
                  <p className="mt-2 text-[10px] leading-relaxed text-muted">
                    Le lien de réservation te sera donné juste après la création
                    du type — reviens compléter l&apos;étape 2 dans Chariow à ce
                    moment-là.
                  </p>
                  <a
                    href="https://chariow.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-500 underline underline-offset-2"
                  >
                    Ouvrir Chariow <ExternalLink size={11} />
                  </a>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Prix affiché
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="50"
                      className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-violet-500/50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Devise
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      style={{ colorScheme: "dark" }}
                      className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-violet-500/50"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Lien du produit Chariow *
                  </label>
                  <input
                    type="url"
                    value={paymentUrl}
                    onChange={(e) => setPaymentUrl(e.target.value)}
                    placeholder="https://ton-store.mychariow.shop/prd_xxxxx"
                    className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-violet-500/50"
                  />
                  {!paymentReady && (
                    <p className="mt-1 text-[11px] font-medium text-red-400">
                      Sans ce lien, le bouton « Payer » ne mènerait nulle part.
                    </p>
                  )}
                </div>

                <p className="rounded-lg border border-line bg-canvas p-2.5 text-[10px] leading-relaxed text-muted">
                  Le prix ci-dessus sert à <strong>l&apos;affichage</strong>. Le
                  montant réellement encaissé est celui de ton produit Chariow :
                  si tu changes l&apos;un, pense à changer l&apos;autre.
                </p>
              </>
            )}
          </div>
        )}

        {/* ── ÉTAPE 5 — Finalisation ── */}
        {step === 4 && (
          <div className="mt-4 grid gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                Nom affiché au prospect
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-violet-500/50"
              />
            </div>

            {/* 🆕 QUI ANIME — rattaché au RENDEZ-VOUS, pas au compte.
                Un même utilisateur peut proposer « Appel avec Dramane » et
                « Coaching avec Awa » : lier la fiche au compte rendrait le
                second cas impossible.
                `hostName` est le déclencheur — sans lui, aucun bloc n'est rendu
                côté public, pour ne pas afficher une fiche anonyme. */}
            <div className="rounded-lg border border-line bg-canvas p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Qui anime ce rendez-vous ? <span className="normal-case">(optionnel)</span>
              </p>
              {/* 🆕 Photo — la seule chose qui transforme « un rendez-vous »
                  en « un rendez-vous avec quelqu'un ». Placée en tête du bloc
                  parce qu'elle porte plus que les trois champs réunis. */}
              <div className="mt-2 flex items-center gap-3">
                <div
                  className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-canvas"
                  aria-hidden
                >
                  {hostAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={hostAvatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserRound size={22} className="text-muted" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar || !hostName.trim()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-violet-500/50 disabled:opacity-50"
                    >
                      {uploadingAvatar ? (
                        <Loader2 size={13} className="animate-spin motion-reduce:animate-none" />
                      ) : (
                        <Upload size={13} />
                      )}
                      {hostAvatarUrl ? "Changer la photo" : "Ajouter une photo"}
                    </button>
                    {hostAvatarUrl && (
                      <button
                        type="button"
                        onClick={() => setHostAvatarUrl("")}
                        className="text-xs font-medium text-muted transition hover:text-red-400"
                      >
                        Retirer
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-muted">
                    JPG, PNG ou WebP — 5 Mo maximum.
                  </p>
                  {avatarError && (
                    <p className="mt-1 text-[11px] font-medium text-red-400">{avatarError}</p>
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadAvatar(f);
                  }}
                />
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="Prénom et nom"
                  maxLength={80}
                  className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-violet-500/50"
                />
                <input
                  type="text"
                  value={hostTitle}
                  onChange={(e) => setHostTitle(e.target.value)}
                  placeholder="Titre — ex. Coach business"
                  maxLength={120}
                  disabled={!hostName.trim()}
                  className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-violet-500/50 disabled:opacity-50"
                />
              </div>
              <textarea
                rows={2}
                value={hostBio}
                onChange={(e) => setHostBio(e.target.value)}
                placeholder="Deux phrases sur toi. C'est ce qui rassure avant de réserver."
                maxLength={600}
                disabled={!hostName.trim()}
                className="mt-2 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-violet-500/50 disabled:opacity-50"
              />
              <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
                Sans nom renseigné, aucun bloc « Avec… » n&apos;apparaît sur ta
                page. La photo s&apos;ajoute ensuite dans l&apos;onglet du
                rendez-vous.
              </p>
            </div>

            {/* 🆕 COULEUR — réglée ici, plus dans un onglet séparé. Elle teinte
                la page publique ; la choisir maintenant évite d'y revenir. */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                Couleur de ta page de réservation
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {BOOKING_COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Couleur ${c}`}
                    aria-pressed={color === c}
                    style={{ backgroundColor: c }}
                    className={
                      "h-8 w-8 rounded-full transition " +
                      (color === c
                        ? "ring-2 ring-ink ring-offset-2 ring-offset-[color:var(--ff-surface)]"
                        : "hover:scale-110")
                    }
                  />
                ))}

                {/* 🆕 COULEUR LIBRE. Les préréglages ne sont qu'un raccourci :
                    une marque a rarement exactement l'une de ces six teintes.
                    Le sélecteur natif ouvre la palette du système (pipette
                    incluse sur desktop) et le champ hexadécimal permet de
                    coller une valeur venue d'une charte graphique. */}
                <label
                  className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-full ring-1 ring-line"
                  title="Couleur personnalisée"
                  style={{
                    background: isCustomColor
                      ? color
                      : "conic-gradient(#ef4444,#f59e0b,#22c55e,#06b6d4,#6366f1,#d946ef,#ef4444)",
                  }}
                >
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Choisir une couleur personnalisée"
                  />
                  {isCustomColor && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-ink ring-offset-2 ring-offset-[color:var(--ff-surface)]"
                    />
                  )}
                </label>

                <input
                  type="text"
                  value={color}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    // On accepte la saisie en cours (« #a7 ») sans la refuser :
                    // bloquer à chaque caractère rendrait le champ inutilisable.
                    // Seule une valeur complète est propagée.
                    if (/^#[0-9a-f]{0,6}$/i.test(v)) setColor(v);
                  }}
                  onBlur={() => {
                    // Une valeur incomplète au moment de quitter le champ
                    // produirait une couleur invalide côté serveur.
                    if (!/^#[0-9a-f]{6}$/i.test(color)) {
                      setColor(BOOKING_COLOR_PRESETS[0] ?? "#7C3AED");
                    }
                  }}
                  spellCheck={false}
                  className="w-24 rounded-lg border border-line bg-canvas px-2 py-1.5 text-xs font-mono uppercase text-ink outline-none focus:border-violet-500/50"
                />
              </div>
            </div>

            {/* 🆕 CHAMPS — éditables dès la création. Le préréglage propose une
                base cohérente ; l'utilisateur ajuste sans quitter le parcours. */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                Ce qui sera demandé au participant
              </label>
              <PopupFieldsEditor
                fields={fields ?? preset.formFields}
                onChange={(next) => setFields(next ?? preset.formFields)}
              />
            </div>

            {isEvent && (
              <p className="flex items-start gap-2 rounded-lg border border-line bg-canvas p-3 text-[11px] leading-relaxed text-muted">
                <CalendarDays size={13} className="mt-0.5 shrink-0" />
                {sessions.length} séance{sessions.length > 1 ? "s" : ""} ·{" "}
                {capacity} places chacune.
              </p>
            )}
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => (step === 0 ? (reset(), onClose()) : setStep((s) => s - 1))}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted transition hover:text-ink disabled:opacity-50"
          >
            {step === 0 ? "Annuler" : (<><ArrowLeft size={14} /> Retour</>)}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={busy || !canContinue}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-600 disabled:opacity-50"
            >
              Continuer <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={busy || !canContinue}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-600 disabled:opacity-50"
            >
              {busy && <Loader2 size={15} className="animate-spin motion-reduce:animate-none" />}
              Créer mon rendez-vous
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
