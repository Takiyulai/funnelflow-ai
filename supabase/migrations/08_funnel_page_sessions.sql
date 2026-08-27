-- Tracking du temps actif par page, uniquement pour des contacts déjà capturés.
-- Cette migration est volontairement fournie sans être appliquée automatiquement.

create table if not exists public.funnel_page_sessions (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  page_slug text not null default '',
  contact_id uuid not null references public.leads(id) on delete cascade,
  session_id uuid not null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  active_ms bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint funnel_page_sessions_page_slug_length
    check (char_length(page_slug) <= 100),
  constraint funnel_page_sessions_active_ms_nonnegative
    check (active_ms >= 0),
  constraint funnel_page_sessions_dates_ordered
    check (last_seen_at >= started_at),
  constraint funnel_page_sessions_session_funnel_page_key
    unique (session_id, funnel_id, page_slug)
);

comment on table public.funnel_page_sessions is
  'Temps actif cumulé par page et session, exclusivement pour des leads identifiés.';
comment on column public.funnel_page_sessions.active_ms is
  'Durée active cumulée en millisecondes ; alimentée par incréments serveur bornés.';

-- Lecture de la fiche CRM : contact d'abord, visite la plus récente ensuite.
create index if not exists funnel_page_sessions_contact_last_seen_idx
  on public.funnel_page_sessions (contact_id, last_seen_at desc);

-- Index explicites des clés étrangères et de la colonne utilisée par la RLS.
create index if not exists funnel_page_sessions_funnel_id_idx
  on public.funnel_page_sessions (funnel_id);
create index if not exists funnel_page_sessions_user_id_idx
  on public.funnel_page_sessions (user_id);

alter table public.funnel_page_sessions enable row level security;

-- La table n'est jamais écrite directement par un visiteur ou par le navigateur
-- authentifié. L'ingestion passe uniquement par l'endpoint serveur et la fonction
-- ci-dessous, exécutée avec le rôle serveur.
revoke all on table public.funnel_page_sessions from anon, authenticated;
grant select on table public.funnel_page_sessions to authenticated;
grant select, insert, update on table public.funnel_page_sessions to service_role;

drop policy if exists "Owners can read funnel page sessions"
  on public.funnel_page_sessions;
create policy "Owners can read funnel page sessions"
  on public.funnel_page_sessions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Upsert atomique d'un total cumulatif. greatest() rend les doublons et les
-- beacons arrivés en retard idempotents ; la progression positive entre deux
-- valeurs reste limitée à 60 secondes.
create or replace function public.increment_funnel_page_session(
  p_funnel_id uuid,
  p_user_id uuid,
  p_page_slug text,
  p_contact_id uuid,
  p_session_id uuid,
  p_active_ms bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected_rows integer;
  previous_active_ms bigint;
begin
  if p_active_ms < 1 then
    raise exception using
      errcode = '22023',
      message = 'active_ms must be positive';
  end if;

  if char_length(coalesce(p_page_slug, '')) > 100 then
    raise exception using
      errcode = '22023',
      message = 'page_slug too long';
  end if;

  if not exists (
    select 1
    from public.funnels as f
    join public.leads as l
      on l.id = p_contact_id
     and l.user_id = f.user_id
    where f.id = p_funnel_id
      and f.user_id = p_user_id
      and f.status = 'published'
  ) then
    raise exception using
      errcode = '42501',
      message = 'funnel/contact ownership mismatch';
  end if;

  select active_ms
    into previous_active_ms
  from public.funnel_page_sessions
  where session_id = p_session_id
    and funnel_id = p_funnel_id
    and page_slug = coalesce(p_page_slug, '');

  if previous_active_ms is null and p_active_ms > 60000 then
    raise exception using
      errcode = '22023',
      message = 'initial active_ms out of bounds';
  end if;

  if previous_active_ms is not null
     and p_active_ms > previous_active_ms
     and p_active_ms - previous_active_ms > 60000 then
    raise exception using
      errcode = '22023',
      message = 'active_ms increment out of bounds';
  end if;

  insert into public.funnel_page_sessions as existing (
    funnel_id,
    user_id,
    page_slug,
    contact_id,
    session_id,
    started_at,
    last_seen_at,
    active_ms
  ) values (
    p_funnel_id,
    p_user_id,
    coalesce(p_page_slug, ''),
    p_contact_id,
    p_session_id,
    now(),
    now(),
    p_active_ms
  )
  on conflict on constraint funnel_page_sessions_session_funnel_page_key
  do update set
    active_ms = greatest(existing.active_ms, excluded.active_ms),
    last_seen_at = greatest(existing.last_seen_at, excluded.last_seen_at),
    updated_at = now()
  where existing.user_id = excluded.user_id
    and existing.contact_id = excluded.contact_id
    and (
      excluded.active_ms <= existing.active_ms
      or excluded.active_ms - existing.active_ms <= 60000
    );

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using
      errcode = '42501',
      message = 'session ownership mismatch';
  end if;
end;
$$;

revoke all on function public.increment_funnel_page_session(
  uuid, uuid, text, uuid, uuid, bigint
) from public, anon, authenticated;
grant execute on function public.increment_funnel_page_session(
  uuid, uuid, text, uuid, uuid, bigint
) to service_role;
