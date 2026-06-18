-- ============================================================================
-- FunnelFlow AI — Paiement Palier 2 : commandes (orders)
-- À EXÉCUTER dans l'éditeur SQL de Supabase (Dashboard → SQL Editor).
--
-- Une "order" = une tentative/transaction de paiement déclenchée depuis un
-- tunnel publié, payée via Stripe Checkout (compte Stripe de la PLATEFORME).
-- Le webhook /api/stripe/webhook la passe à 'paid' et marque le contact client.
--
-- RLS : chaque utilisateur ne voit que SES commandes. Les écritures serveur
-- (checkout + webhook) passent par le client admin (service role) et
-- contournent la RLS.
-- ============================================================================

create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  funnel_id          uuid references public.funnels(id) on delete set null,
  lead_id            uuid references public.leads(id) on delete set null,
  -- Montant en CENTIMES (entier) + devise ISO minuscule (ex: 'eur').
  amount             integer not null default 0,
  currency           text not null default 'eur',
  product_name       text,
  customer_email     text,
  status             text not null default 'pending', -- pending | paid | failed | refunded
  provider           text not null default 'stripe',
  stripe_session_id  text,
  stripe_payment_intent text,
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  paid_at            timestamptz
);

create index if not exists orders_user_idx    on public.orders (user_id);
create index if not exists orders_funnel_idx   on public.orders (funnel_id);
create unique index if not exists orders_session_uk
  on public.orders (stripe_session_id) where stripe_session_id is not null;

alter table public.orders enable row level security;

-- Lecture : l'utilisateur voit ses propres commandes.
drop policy if exists orders_select_own on public.orders;
create policy orders_select_own on public.orders
  for select using (auth.uid() = user_id);

-- Aucune policy insert/update côté client : tout passe par le service role
-- (routes serveur /api/checkout et /api/stripe/webhook).
