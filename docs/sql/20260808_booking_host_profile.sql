-- docs/sql/20260808_booking_host_profile.sql
--
-- FICHE HÔTE PAR TYPE DE RENDEZ-VOUS (entièrement optionnelle).
--
-- ── POURQUOI PAR TYPE DE RDV, ET NON PAR COMPTE ────────────────────────────
-- Calendly rattache l'avatar au PROFIL (un compte = un visage), ce qui suffit
-- à un consultant seul. Notre cible — solopreneurs et petits collectifs
-- francophones — a besoin de plus de souplesse : « Appel découverte avec
-- Dramane » et « Séance de coaching avec Awa » sont deux types de RDV du même
-- compte, avec deux intervenants différents. Rattacher l'hôte au type de RDV
-- couvre les deux cas ; l'inverse ne le permet pas.
--
-- ── POURQUOI TOUT EST NULLABLE ─────────────────────────────────────────────
-- Aucun champ n'est requis. Un type de RDV créé avant cette migration reste
-- valide et s'affiche exactement comme avant. La page publique n'affiche le
-- bloc hôte QUE si au moins le nom est renseigné (règle appliquée côté rendu,
-- pas en base : un avatar sans nom ne doit pas produire un bloc anonyme).
--
-- ── CONVENTIONS REPRISES DU MARCHÉ ─────────────────────────────────────────
-- Calendly recommande un avatar carré de 90 × 90 px, < 5 Mo. On stocke une URL
-- (l'upload passe par Cloudinary, déjà en place pour les médias) plutôt qu'un
-- binaire : la base reste légère et le CDN sert l'image redimensionnée.

alter table public.booking_event_types
  -- Nom affiché de l'intervenant. C'est LE champ déclencheur : sans lui,
  -- aucun bloc hôte n'est rendu côté public.
  add column if not exists host_name       text,

  -- Rôle, spécialité ou société. Ligne secondaire sous le nom.
  -- Ex. « Coach business » ou « Fondatrice, Atelier Karité ».
  add column if not exists host_title      text,

  -- URL absolue de l'avatar (Cloudinary). Carré recommandé, rendu en cercle.
  add column if not exists host_avatar_url text,

  -- Présentation courte. Rassure le prospect avant qu'il n'engage son temps :
  -- c'est le principal levier de conversion d'une page de réservation.
  add column if not exists host_bio        text;

-- Garde-fous de longueur. Ils protègent la mise en page publique : un « nom »
-- de 400 caractères casserait l'en-tête, et une bio sans limite transformerait
-- la page de réservation en article de blog.
--
-- `not valid` : la contrainte s'applique aux écritures futures sans exiger la
-- revalidation des lignes existantes (elles sont toutes NULL de toute façon,
-- mais c'est l'habitude sûre sur une table déjà en production).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'booking_event_types_host_len_ck'
  ) then
    alter table public.booking_event_types
      add constraint booking_event_types_host_len_ck
      check (
        (host_name       is null or char_length(host_name)       <= 80)  and
        (host_title      is null or char_length(host_title)      <= 120) and
        (host_avatar_url is null or char_length(host_avatar_url) <= 2048) and
        (host_bio        is null or char_length(host_bio)        <= 600)
      ) not valid;
  end if;
end $$;

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Rien à ajouter : ces colonnes vivent dans booking_event_types, dont les
-- politiques existantes (propriétaire en écriture, lecture publique par slug
-- pour la page /rdv) s'appliquent automatiquement aux nouvelles colonnes.
-- On documente le point pour éviter qu'un relecteur ne cherche une politique
-- manquante.

comment on column public.booking_event_types.host_name is
  'Nom affiché de l''intervenant. Déclenche l''affichage du bloc hôte public.';
comment on column public.booking_event_types.host_avatar_url is
  'URL Cloudinary de l''avatar (carré ~90px recommandé, rendu en cercle).';
