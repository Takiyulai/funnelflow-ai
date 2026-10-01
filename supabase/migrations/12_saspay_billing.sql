-- SasPay — paiement ponctuel de 30 jours pour les plans AutoFunnel AI.
--
-- Cette migration est volontairement additive : Chariow continue d'utiliser
-- public.user_licenses et ses routes historiques. Aucun objet Chariow n'est
-- supprimé ou modifié.

create table if not exists public.billing_payment_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('platform_plan')),
  plan_id text not null check (plan_id in ('starter', 'pro', 'agency')),
  provider text not null check (provider in ('saspay')),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency = 'XOF'),
  status text not null default 'creating'
    check (status in ('creating', 'pending', 'succeeded', 'failed', 'cancelled', 'expired')),
  provider_description text not null,
  provider_checkout_id text,
  provider_checkout_url text,
  provider_transaction_id text,
  provider_transaction_reference text,
  last_error_code text,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_payment_intents_user_created_idx
  on public.billing_payment_intents (user_id, created_at desc);

create unique index if not exists billing_payment_intents_checkout_unique
  on public.billing_payment_intents (provider, provider_checkout_id)
  where provider_checkout_id is not null;

create unique index if not exists billing_payment_intents_transaction_unique
  on public.billing_payment_intents (provider, provider_transaction_id)
  where provider_transaction_id is not null;

create unique index if not exists billing_payment_intents_one_open_idx
  on public.billing_payment_intents (user_id, provider, purpose)
  where status in ('creating', 'pending');

create table if not exists public.billing_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('saspay')),
  plan_id text not null check (plan_id in ('starter', 'pro', 'agency')),
  status text not null default 'active'
    check (status in ('active', 'expired', 'revoked')),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  activated_by_payment_id uuid not null
    references public.billing_payment_intents(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

create index if not exists billing_entitlements_active_idx
  on public.billing_entitlements (user_id, expires_at desc)
  where status = 'active';

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('saspay')),
  event_key text not null,
  event_type text not null,
  provider_object_id text,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_key)
);

create index if not exists billing_webhook_events_object_idx
  on public.billing_webhook_events (provider, provider_object_id)
  where provider_object_id is not null;

alter table public.billing_payment_intents enable row level security;
alter table public.billing_entitlements enable row level security;
alter table public.billing_webhook_events enable row level security;

drop policy if exists billing_payment_intents_select_own
  on public.billing_payment_intents;
create policy billing_payment_intents_select_own
  on public.billing_payment_intents for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists billing_entitlements_select_own
  on public.billing_entitlements;
create policy billing_entitlements_select_own
  on public.billing_entitlements for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Supabase ne garantit plus l'exposition automatique des nouvelles tables au
-- Data API. Les grants sont donc explicites et minimaux.
revoke all on table public.billing_payment_intents from anon, authenticated;
revoke all on table public.billing_entitlements from anon, authenticated;
revoke all on table public.billing_webhook_events from anon, authenticated;
grant select on table public.billing_payment_intents to authenticated;
grant select on table public.billing_entitlements to authenticated;
grant all on table public.billing_payment_intents to service_role;
grant all on table public.billing_entitlements to service_role;
grant all on table public.billing_webhook_events to service_role;

-- Activation atomique et idempotente : un paiement ne prolonge l'accès
-- qu'une seule fois, même si le webhook est rejoué ou si la page de succès
-- lance simultanément une réconciliation serveur.
create or replace function public.activate_saspay_payment(
  p_payment_id uuid,
  p_provider_transaction_id text,
  p_provider_transaction_reference text,
  p_paid_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  payment public.billing_payment_intents%rowtype;
  entitlement_start timestamptz;
begin
  select * into payment
  from public.billing_payment_intents
  where id = p_payment_id and provider = 'saspay'
  for update;

  if not found then
    return false;
  end if;

  if payment.status = 'succeeded' then
    return false;
  end if;
  if payment.status not in ('creating', 'pending') then
    return false;
  end if;
  if payment.provider_transaction_id is not null
     and payment.provider_transaction_id <> p_provider_transaction_id then
    raise exception 'provider transaction mismatch';
  end if;

  update public.billing_payment_intents
  set status = 'succeeded',
      provider_transaction_id = p_provider_transaction_id,
      provider_transaction_reference = p_provider_transaction_reference,
      paid_at = p_paid_at,
      last_error_code = null,
      updated_at = now()
  where id = p_payment_id;

  select greatest(coalesce(expires_at, now()), now())
    into entitlement_start
  from public.billing_entitlements
  where user_id = payment.user_id and provider = 'saspay'
  for update;

  if entitlement_start is null then
    entitlement_start := now();
  end if;

  insert into public.billing_entitlements (
    user_id, provider, plan_id, status, starts_at, expires_at,
    activated_by_payment_id, updated_at
  ) values (
    payment.user_id, 'saspay', payment.plan_id, 'active', now(),
    entitlement_start + interval '30 days', payment.id, now()
  )
  on conflict (user_id, provider) do update
  set plan_id = excluded.plan_id,
      status = 'active',
      starts_at = excluded.starts_at,
      expires_at = excluded.expires_at,
      activated_by_payment_id = excluded.activated_by_payment_id,
      updated_at = now();

  return true;
end;
$$;

revoke execute on function public.activate_saspay_payment(uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.activate_saspay_payment(uuid, text, text, timestamptz)
  to service_role;
