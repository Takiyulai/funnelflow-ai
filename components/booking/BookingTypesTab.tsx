"use client";

// components/booking/BookingTypesTab.tsx
// Sous-onglet « Types de RDV » : lien public, activation, couleur d'accent.

import { useRef, useState } from "react";
import { Check, Copy, Loader2, Trash2, Upload } from "lucide-react";
import {
  BOOKING_COLOR_PRESETS,
  isValidHexColor,
  readableTextOn,
  resolveBookingColor,
} from "@/lib/booking/colors";
import type { EventType } from "./types";
// Le même éditeur de champs que les formulaires de capture : un seul modèle de
// champ dans l'application, donc une seule interface à apprendre.
import { PopupFieldsEditor } from "@/components/editor/tabs/items/PopupFieldsEditor";

export function BookingTypesTab({
  active,
  publicUrl,
  copied,
  onCopy,
  onPatch,
}: {
  active: EventType;
  publicUrl: string;
  copied: boolean;
  onCopy: () => void;
  onPatch: (patch: Partial<EventType>) => void;
}) {
  const color = resolveBookingColor(active.color);

  // ── Téléversement de la photo de l'hôte ────────────────────────────────
  //
  // On réutilise /api/media/upload (Cloudinary), déjà en place pour les médias
  // de tunnel, plutôt que d'ajouter une route dédiée : même contrat de réponse
  // ({ url, path, mime, size }), aucune surface d'attaque supplémentaire.
  //
  // ⚠️ Cette route accepte AUSSI les vidéos. Un avatar n'en est pas une : on
  // filtre côté client, à la fois par `accept` sur le champ (confort) et par
  // un contrôle du type MIME avant l'envoi (le `accept` d'un input fichier est
  // une simple suggestion, contournable via un glisser-déposer).
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 5 Mo : la limite que Calendly applique aux avatars. Au-delà, c'est une
  // photo non redimensionnée sortie d'un téléphone — inutilement lourde pour
  // une vignette de 56 px.
  const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

  async function uploadAvatar(file: File) {
    setUploadError(null);

    if (!file.type.startsWith("image/")) {
      setUploadError("Choisis une image (jpg, png, webp…).");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setUploadError(
        `Image trop lourde (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum 5 Mo.`,
      );
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // Range les avatars à part des médias de tunnel : `funnelId` sert de
      // dossier côté Cloudinary.
      fd.append("funnelId", "booking-hosts");
      fd.append("spotId", `host-${active.id}`);

      const res = await fetch("/api/media/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.url) {
        setUploadError(json.error ?? "Envoi impossible. Réessaie.");
        return;
      }
      // ⚠️ On met à jour l'état local SEULEMENT. La persistance passe par le
      // bouton « Enregistrer » commun aux trois onglets : téléverser puis
      // quitter sans enregistrer ne doit pas modifier la page publique.
      onPatch({ hostAvatarUrl: json.url as string });
    } catch {
      setUploadError("Connexion impossible pendant l'envoi.");
    } finally {
      setUploading(false);
      // Réinitialise le champ : sans cela, re-choisir LE MÊME fichier après une
      // suppression ne déclencherait aucun `change`.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide opacity-60">Lien public</h2>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-black/30 px-3 py-2 text-sm">
            {publicUrl}
          </code>
          <button
            type="button"
            onClick={onCopy}
            className="rounded-lg border border-white/15 p-2"
            aria-label="Copier le lien"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active.active}
            onChange={(e) => onPatch({ active: e.target.checked })}
          />
          Réservations ouvertes
        </label>
      </section>

      {/* 🆕 FICHE HÔTE — entièrement optionnelle.

          Une page de réservation qui n'affiche qu'un calendrier ne dit pas à QUI
          le prospect s'apprête à donner une heure de son temps. C'est la raison
          pour laquelle Calendly place l'avatar et le nom de l'hôte au-dessus du
          calendrier, et le principal levier de conversion de cet écran.

          Rattachée au TYPE de RDV et non au compte : un même utilisateur peut
          proposer « Appel découverte avec Dramane » et « Coaching avec Awa ». */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide opacity-60">
          Qui anime ce rendez-vous
        </h2>
        <p className="mt-2 text-xs leading-relaxed opacity-60">
          Facultatif. Renseigne au moins le nom pour afficher le bloc sur la page de
          réservation. Laissé vide, rien n&apos;est affiché et la page reste inchangée.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs opacity-80">
            Nom affiché
            <input
              value={active.hostName ?? ""}
              onChange={(e) => onPatch({ hostName: e.target.value })}
              placeholder="Dramane D."
              maxLength={80}
              className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/40"
            />
          </label>

          <label className="grid gap-1.5 text-xs opacity-80">
            Rôle ou spécialité
            <input
              value={active.hostTitle ?? ""}
              onChange={(e) => onPatch({ hostTitle: e.target.value })}
              placeholder="Coach business"
              maxLength={120}
              className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/40"
            />
          </label>

          <div className="grid gap-1.5 text-xs opacity-80 sm:col-span-2">
            <span>Photo</span>
            <div className="flex flex-wrap items-center gap-3">
              {/* Vignette : ce que verra réellement le prospect, au même
                  diamètre et déjà rognée en rond. Une photo mal cadrée se
                  repère ici, pas après publication. */}
              {active.hostAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={active.hostAvatarUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-full object-cover"
                  style={{ boxShadow: `0 0 0 2px ${color}` }}
                />
              ) : (
                <span
                  aria-hidden
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-dashed border-white/25 text-white/30"
                >
                  <Upload size={16} />
                </span>
              )}

              {/* Le champ fichier natif est masqué : son rendu par défaut est
                  incohérent d'un navigateur à l'autre et ne peut pas être mis
                  en forme. On pilote un bouton, qui reste un vrai <button>
                  accessible au clavier. */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadAvatar(f);
                }}
              />

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold transition hover:bg-white/10 disabled:opacity-50 motion-reduce:transition-none"
              >
                {uploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
                    Envoi…
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    {active.hostAvatarUrl ? "Remplacer" : "Téléverser une photo"}
                  </>
                )}
              </button>

              {active.hostAvatarUrl && !uploading && (
                <button
                  type="button"
                  onClick={() => {
                    setUploadError(null);
                    onPatch({ hostAvatarUrl: null });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-white/50 transition hover:text-red-300 motion-reduce:transition-none"
                >
                  <Trash2 size={13} /> Retirer
                </button>
              )}
            </div>

            {uploadError ? (
              <span className="text-red-300">{uploadError}</span>
            ) : (
              <span className="opacity-50">
                Carrée de préférence, environ 200 × 200 px, 5 Mo maximum — elle est
                affichée en rond. L&apos;envoi ne devient définitif qu&apos;après
                « Enregistrer ».
              </span>
            )}
          </div>

          <label className="grid gap-1.5 text-xs opacity-80 sm:col-span-2">
            Présentation courte
            <textarea
              value={active.hostBio ?? ""}
              onChange={(e) => onPatch({ hostBio: e.target.value })}
              placeholder="Deux ou trois phrases : ton parcours, ce que le prospect va retirer de l'échange."
              rows={3}
              maxLength={600}
              className="resize-y rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/40"
            />
            <span className="opacity-50">{(active.hostBio ?? "").length} / 600</span>
          </label>
        </div>

        {/* Aperçu fidèle au rendu public : une URL d'image invalide se voit ici
            plutôt qu'après publication, sur la page vue par les prospects. */}
        {active.hostName?.trim() && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
            {active.hostAvatarUrl?.trim() ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={active.hostAvatarUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full object-cover"
                style={{ boxShadow: `0 0 0 2px ${color}` }}
              />
            ) : (
              <span
                aria-hidden
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold"
                style={{ backgroundColor: color, color: readableTextOn(color) }}
              >
                {active.hostName.trim().charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide opacity-40">Aperçu</p>
              <p className="text-sm font-semibold">{active.hostName}</p>
              {active.hostTitle && <p className="text-xs opacity-60">{active.hostTitle}</p>}
              {active.hostBio && (
                <p className="mt-1 text-xs leading-relaxed opacity-70">{active.hostBio}</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 🆕 CHAMPS DU FORMULAIRE. Le formulaire de réservation était figé
          dans le code — prénom, email, téléphone, note. L'hôte qui a besoin du
          budget, du niveau ou d'un lien devait le demander après coup par
          email, donc perdre une partie des réponses et qualifier ses
          rendez-vous à la main. */}
      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          Formulaire de réservation
        </h2>
        <p className="mt-1 text-xs text-muted">
          Ce que le participant remplit avant de valider son créneau. Les
          réponses arrivent dans « Mes rendez-vous », dans l&apos;email de
          confirmation, et sur la fiche du contact dans le CRM.
        </p>
        <div className="mt-3">
          <PopupFieldsEditor
            fields={active.formFields ?? undefined}
            onChange={(fields) => onPatch({ formFields: fields ?? null })}
          />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Un champ <strong className="text-ink">Email</strong> est toujours
          demandé, même si tu le retires : sans adresse, ni la confirmation ni
          le fichier agenda ne peuvent partir, et le participant ne peut plus
          annuler.
        </p>
      </section>

      {/* 🆕 Couleur d'accent. La colonne `color` existait en base sans jamais
          être exploitée : le calendrier public s'affichait toujours en violet,
          quel que soit l'univers visuel du tunnel qui y menait. */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide opacity-60">
          Couleur du calendrier
        </h2>
        <p className="mt-1 text-xs opacity-60">
          Appliquée aux accents de ta page de réservation : bouton, créneau sélectionné,
          jour choisi. Aligne-la sur ton tunnel pour que le prospect ne change pas
          d&apos;univers en cliquant.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {BOOKING_COLOR_PRESETS.map((preset) => {
            const selected = color === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onPatch({ color: preset })}
                aria-label={`Couleur ${preset}`}
                aria-pressed={selected}
                className={
                  "h-8 w-8 rounded-full border-2 transition " +
                  (selected ? "border-white scale-110" : "border-white/20 hover:border-white/50")
                }
                style={{ backgroundColor: preset }}
              />
            );
          })}

          <label className="ml-2 flex items-center gap-2 text-xs opacity-70">
            Personnalisée
            <input
              type="color"
              value={color}
              onChange={(e) => onPatch({ color: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded border border-white/15 bg-transparent p-0.5"
            />
          </label>

          <input
            type="text"
            value={active.color ?? ""}
            onChange={(e) => onPatch({ color: e.target.value })}
            placeholder={color}
            maxLength={7}
            className={
              "w-24 rounded-lg border bg-black/30 px-2 py-1 font-mono text-xs " +
              (active.color && !isValidHexColor(active.color)
                ? "border-red-400/60"
                : "border-white/15")
            }
          />
        </div>

        {active.color && !isValidHexColor(active.color) && (
          // Avertissement plutôt que blocage : la saisie est libre pendant la
          // frappe (« #a7 » est invalide mais en cours). Le serveur revalide,
          // et une valeur invalide retombe sur la couleur de marque.
          <p className="mt-2 text-xs text-amber-300">
            Format attendu : #a78bfa. En l&apos;état, la couleur de marque sera utilisée.
          </p>
        )}

        {/* Aperçu : ce que verra le prospect. */}
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <span className="text-xs opacity-50">Aperçu</span>
          <span
            className="rounded-lg px-3 py-1.5 text-sm font-medium"
            style={{ backgroundColor: color, color: readableTextOn(color) }}
          >
            10:30
          </span>
          <span
            className="rounded-lg px-3 py-1.5 text-sm font-bold"
            style={{ backgroundColor: color, color: readableTextOn(color) }}
          >
            Confirmer le rendez-vous
          </span>
        </div>
      </section>
    </div>
  );
}

export default BookingTypesTab;
