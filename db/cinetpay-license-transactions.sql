-- 🆕 CinetPay (Mobile Money, Bénin, XOF) — abonnement SaaS AutoFunnel AI.
-- Table de suivi des tentatives de paiement CinetPay, distincte de
-- `public.user_licenses` (qui reste la source de vérité de l'accès effectif,
-- déjà utilisée par Chariow — voir db/chariow-licenses.sql).
--
-- Rôle de cette table :
--   1. Lier merchant_transaction_id ↔ (user_id, plan_id) au moment de
--      l'initiation du paiement (POST /v1/payment), pour que le webhook
--      /api/webhooks/cinetpay sache QUI activer et sur QUEL plan.
--   2. Stocker le notify_token renvoyé par CinetPay à l'initiation, pour le
--      comparer à celui reçu dans la notification webhook (sécurité).
--   3. Servir de verrou d'idempotence (dédoublonnage) via
--      cinetpay_transaction_id : une notification rejouée par CinetPay ne
--      doit pas réactiver la licence une seconde fois.
--
-- À exécuter dans l'éditeur SQL Supabase.

create table if not exists public.cinetpay_license_transactions (
  id uuid primary key default gen_random_uuid(),
  merchant_transaction_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null check (plan_id in ('starter', 'pro', 'agency')),
  amount_xof integer not null,
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed')),
  -- Id de transaction CinetPay (cpm_trans_id / transaction_id renvoyé par
  -- l'API), rempli une fois connu. Sert de clé d'idempotence webhook.
  cinetpay_transaction_id text,
  -- notify_token renvoyé par POST /v1/payment à l'initiation — comparé au
  -- token reçu dans la notification webhook avant toute activation.
  notify_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cinetpay_license_transactions_user_id_idx
  on public.cinetpay_license_transactions (user_id);

create unique index if not exists cinetpay_license_transactions_cp_tx_idx
  on public.cinetpay_license_transactions (cinetpay_transaction_id)
  where cinetpay_transaction_id is not null;

-- updated_at automatique
create or replace function public.cinetpay_license_transactions_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_cinetpay_license_transactions_updated_at
  on public.cinetpay_license_transactions;
create trigger trg_cinetpay_license_transactions_updated_at
  before update on public.cinetpay_license_transactions
  for each row execute function public.cinetpay_license_transactions_set_updated_at();

-- RLS : l'utilisateur peut lire ses propres tentatives de paiement (utile
-- pour afficher un état "en attente" côté /abonnement) ; TOUTES les
-- écritures (insert à l'initiation, update au webhook) passent par le
-- service role, jamais par le client.
alter table public.cinetpay_license_transactions enable row level security;

drop policy if exists "cinetpay_license_transactions_select_own"
  on public.cinetpay_license_transactions;
create policy "cinetpay_license_transactions_select_own"
  on public.cinetpay_license_transactions for select
  using (auth.uid() = user_id);

-- (Pas de policy insert/update/delete : réservé au service role.)
