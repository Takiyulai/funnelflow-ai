-- docs/sql/20260809_backfill_public_users.sql
--
-- ⚠️ DÉJÀ APPLIQUÉE EN PRODUCTION (migration `backfill_public_users_and_fix_signup_trigger`).
-- Conservée ici pour l'historique et pour tout nouvel environnement.
--
-- ── LE SYMPTÔME ────────────────────────────────────────────────────────────
-- Un bêta-testeur ne pouvait pas partager un tunnel importé. Message reçu :
--
--   [23503] insert or update on table "funnels" violates foreign key
--   constraint "funnels_user_id_fkey" — Key is not present in table "users".
--
-- Le partage n'était pas en cause : il enregistre le tunnel au passage, et
-- c'est cette écriture qui échouait. Le même compte ne pouvait donc pas non
-- plus créer de lead, de workflow ni d'export.
--
-- ── LA CAUSE ───────────────────────────────────────────────────────────────
-- La base porte DEUX tables d'utilisateurs :
--
--   • `auth.users`   — gérée par Supabase Auth, alimentée à l'inscription ;
--   • `public.users` — table applicative, avec plan, langue, is_active…
--
-- Les clés étrangères sont partagées entre les deux, sans règle apparente :
--
--   → auth.users   : booking_event_types, bookings, orders, crm_*, profiles,
--                    user_licenses, funnel_ab_tests, cinetpay_*
--   → public.users : funnels, leads, exports, workflows, brand_assets,
--                    email_sequences, lead_custom_field_defs, section_images
--
-- Or le trigger d'inscription `on_auth_user_created` n'alimentait QUE
-- `public.profiles` :
--
--   insert into public.profiles (user_id, status) values (new.id, 'inactive');
--
-- Rien ne créait jamais la ligne dans `public.users`. Tout compte créé après
-- la mise en place de ce trigger pouvait donc se connecter et naviguer
-- normalement, mais échouait à la première écriture sur l'une des huit tables
-- ci-dessus. Les quelques comptes qui fonctionnaient — dont celui du
-- propriétaire — avaient leur ligne d'un mécanisme antérieur.
--
-- Constat au moment du correctif : 10 comptes dans auth.users, 4 dans
-- public.users. 6 comptes sur 10 étaient inutilisables, silencieusement.
--
-- ── POURQUOI CE CORRECTIF, ET PAS UNE REFONTE ──────────────────────────────
-- Faire pointer les huit clés étrangères vers `auth.users` unifierait le
-- modèle, mais `public.users` porte des colonnes métier (plan, langue,
-- is_active) qu'aucune autre table ne remplace. La refonte est souhaitable ;
-- elle n'est pas urgente, et elle ne doit pas être faite sous la pression
-- d'une production cassée. On rétablit d'abord l'invariant : toute ligne de
-- auth.users a sa contrepartie dans public.users.

-- ── 1. RATTRAPAGE DES COMPTES EXISTANTS ────────────────────────────────────
-- `coalesce` sur l'e-mail : une inscription par téléphone laisse `email` nul,
-- alors que public.users.email est NOT NULL. L'identifiant garantit l'unicité
-- de la valeur de repli.
insert into public.users (id, email)
select a.id, coalesce(a.email, a.id::text || '@sans-email.local')
from auth.users a
where not exists (select 1 from public.users u where u.id = a.id)
on conflict do nothing;

-- ── 2. LE TRIGGER ALIMENTE DÉSORMAIS LES DEUX TABLES ───────────────────────
-- `on conflict do nothing` sans cible : idempotent quelle que soit la
-- contrainte d'unicité qui se déclenche, et sans supposer le nom de la clé.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Table référencée par funnels, leads, exports, workflows, brand_assets,
  -- email_sequences, lead_custom_field_defs et section_images. Sans cette
  -- ligne, l'utilisateur se connecte mais ne peut rien enregistrer.
  insert into public.users (id, email)
  values (new.id, coalesce(new.email, new.id::text || '@sans-email.local'))
  on conflict do nothing;

  insert into public.profiles (user_id, status)
  values (new.id, 'inactive')
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

-- ── VÉRIFICATION ───────────────────────────────────────────────────────────
-- Doit renvoyer 0. À rejouer après toute modification du flux d'inscription.
--
--   select count(*) from auth.users a
--   where not exists (select 1 from public.users u where u.id = a.id);
