-- ============================================================================
-- AutoFunnel AI — Abonnements plateforme (profiles)
-- À EXÉCUTER dans l'éditeur SQL de Supabase (Dashboard → SQL Editor).
--
-- Une ligne `profiles` par utilisateur. Elle porte le PLAN d'abonnement à
-- AutoFunnel (starter | pro | agency) et son statut. C'est la SOURCE DE VÉRITÉ
-- de l'accès à la plateforme : seul un `status = 'active'` (ou 'trialing')
-- débloque la génération de tunnels.
--
-- Écritures : UNIQUEMENT via le service role (webhook Stripe + routes serveur).
-- Le client peut seulement LIRE sa propre ligne (RLS).
--
-- ⚠️ Ne contient pas d'info de paiement sensible : juste les identifiants
--    Stripe nécessaires pour relier le compte à son abonnement.
-- ============================================================================

create table if not exists public.profiles (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  plan                    text,                       -- null | 'starter' | 'pro' | 'agency'
  status                  text not null default 'inactive',
                          -- inactive | active | trialing | past_due | canceled
  stripe_customer_id      text,
  stripe_subscription_id  text,
  current_period_end      timestamptz,
  -- Compteur d'emails envoyés sur le mois courant (pour le plafond campagnes).
  emails_sent_this_period integer not null default 0,
  email_period_start      timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create unique index if not exists profiles_customer_uk
  on public.profiles (stripe_customer_id) where stripe_customer_id is not null;
create index if not exists profiles_subscription_idx
  on public.profiles (stripe_subscription_id) where stripe_subscription_id is not null;

alter table public.profiles enable row level security;

-- Lecture : l'utilisateur voit son propre profil.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = user_id);

-- Aucune policy insert/update/delete côté client : tout passe par le service
-- role (webhook /api/stripe/webhook et routes serveur).

-- ----------------------------------------------------------------------------
-- Création automatique d'une ligne profile à l'inscription d'un utilisateur.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, status)
  values (new.id, 'inactive')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Back-fill : créer une ligne profile pour les utilisateurs déjà existants.
-- ----------------------------------------------------------------------------
insert into public.profiles (user_id, status)
select id, 'inactive' from auth.users
on conflict (user_id) do nothing;

-- ----------------------------------------------------------------------------
-- ASTUCE TEST : pour te débloquer en test sans payer, passe ton compte en
-- Agency actif (remplace l'email) :
--   update public.profiles set plan='agency', status='active'
--   where user_id = (select id from auth.users where email='ton@email.com');
-- ----------------------------------------------------------------------------
