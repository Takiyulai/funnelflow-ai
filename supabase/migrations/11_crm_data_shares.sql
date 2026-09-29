-- Partage CRM volontairement limité et en lecture seule.
-- La table ne contient aucune donnée CRM : elle enregistre uniquement qui
-- autorise quel autre utilisateur à consulter un aperçu CRM filtré côté serveur.

create table if not exists public.crm_data_shares (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  grantee_user_id uuid not null references public.users(id) on delete cascade,
  permission text not null default 'read_only'
    check (permission = 'read_only'),
  created_at timestamptz not null default now(),
  constraint crm_data_shares_distinct_users
    check (owner_user_id <> grantee_user_id),
  constraint crm_data_shares_owner_grantee_key
    unique (owner_user_id, grantee_user_id)
);

create index if not exists crm_data_shares_grantee_idx
  on public.crm_data_shares (grantee_user_id, created_at desc);

alter table public.crm_data_shares enable row level security;

revoke all on table public.crm_data_shares from anon, authenticated;
grant select, insert, delete on table public.crm_data_shares to authenticated;

create policy "CRM share participants can view grants"
  on public.crm_data_shares
  for select
  to authenticated
  using (
    (select auth.uid()) = owner_user_id
    or (select auth.uid()) = grantee_user_id
  );

create policy "CRM owners can create read only grants"
  on public.crm_data_shares
  for insert
  to authenticated
  with check (
    (select auth.uid()) = owner_user_id
    and permission = 'read_only'
  );

create policy "CRM owners can revoke grants"
  on public.crm_data_shares
  for delete
  to authenticated
  using ((select auth.uid()) = owner_user_id);

comment on table public.crm_data_shares is
  'Autorisations de consultation CRM en lecture seule. Les données partagées sont projetées côté serveur avec une liste de colonnes explicitement limitée.';

comment on column public.crm_data_shares.permission is
  'Permission volontairement limitée à read_only dans cette première version.';
