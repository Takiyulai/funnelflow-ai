-- supabase/migrations/03_booking_form_fields.sql
--
-- 🆕 Champs de formulaire personnalisables sur les types de rendez-vous,
--    et réponses associées sur les réservations.
--
-- POURQUOI. Le formulaire de réservation était figé dans le code : prénom,
-- email, téléphone, note. Un hôte qui a besoin du budget, du niveau, d'un lien
-- ou d'un choix de sujet devait le demander après coup par email — donc perdre
-- une partie des réponses, et qualifier ses rendez-vous à la main.
--
-- RÉTROCOMPATIBILITÉ. Les deux colonnes sont NULLABLES et sans valeur par
-- défaut imposée :
--   • `form_fields` NULL  → le widget applique DEFAULT_BOOKING_FIELDS, qui
--     reproduit à l'identique le formulaire historique ;
--   • `answers` NULL      → réservation sans champ personnalisé.
-- Aucune ligne existante n'est modifiée, aucun code existant ne casse.

-- ── 1. Définition des champs, portée par le TYPE de rendez-vous ────────────
-- Portée au type et non au compte : un même hôte propose « Appel découverte »
-- (2 champs) et « Audit approfondi » (8 champs) — ce ne sont pas les mêmes
-- informations à demander.
alter table public.booking_event_types
  add column if not exists form_fields jsonb;

comment on column public.booking_event_types.form_fields is
  'Champs du formulaire de réservation (FormFieldItem[]). NULL = champs par défaut (nom, email, téléphone, note).';

-- ── 2. Réponses, portées par la RÉSERVATION ────────────────────────────────
-- Objet plat { nom_du_champ: valeur }. Ne contient que les champs
-- personnalisés : nom, email, téléphone et note gardent leurs colonnes
-- dédiées, qui sont lues par les emails, le .ics et l'export.
alter table public.bookings
  add column if not exists answers jsonb;

comment on column public.bookings.answers is
  'Réponses aux champs personnalisés, indexées par name de champ. Exclut nom/email/téléphone/note qui ont leurs propres colonnes.';

-- ── 3. Index de recherche ──────────────────────────────────────────────────
-- GIN sur jsonb : permet de filtrer les réservations par réponse
-- (« tous ceux dont le budget est > 5000 ») sans parcours complet de table.
-- Créé seulement s'il y a matière — sur une base vide, il coûte plus qu'il ne
-- rapporte, mais il est indolore et évite une seconde migration plus tard.
create index if not exists bookings_answers_gin
  on public.bookings using gin (answers);
