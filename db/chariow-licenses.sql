-- 🆕 Chariow Niveau 1 — table des licences utilisateurs (paywall SaaS).
-- Alimentée par /api/license/validate (activation manuelle par l'utilisateur)
-- et par le webhook Pulses /api/webhooks/chariow (vente, expiration, révocation).
-- À exécuter dans l'éditeur SQL Supabase.

create table if not exists public.user_licenses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  license_key text not null unique,
  status text not null default 'active'
    check (status in ('active', 'expired', 'revoked', 'invalid')),
  plan text not null default 'pro',
  product_id text,
  expires_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_licenses_license_key_idx
  on public.user_licenses (license_key);

-- updated_at automatique
create or replace function public.user_licenses_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_user_licenses_updated_at on public.user_licenses;
create trigger trg_user_licenses_updated_at
  before update on public.user_licenses
  for each row execute function public.user_licenses_set_updated_at();

-- RLS : l'utilisateur ne peut LIRE que sa propre licence. Toutes les écritures
-- passent par le service role (API serveur + webhook), jamais par le client.
alter table public.user_licenses enable row level security;

drop policy if exists "user_licenses_select_own" on public.user_licenses;
create policy "user_licenses_select_own"
  on public.user_licenses for select
  using (auth.uid() = user_id);

-- (Pas de policy insert/update/delete : réservé au service role.)
