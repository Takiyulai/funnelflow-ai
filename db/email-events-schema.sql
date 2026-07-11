-- db/email-events-schema.sql
-- 🆕 VAGUE 1 / LOT 3 — Statistiques email : ouvertures (pixel) + clics.
-- À exécuter dans Supabase → SQL Editor (idempotent, additif).
--
-- Un événement = une ouverture OU un clic sur UN message envoyé.
-- `message_id` référence la ligne d'envoi : scheduled_emails.id (file cron :
-- séquences, workflows, newsletters programmées, livraison) ou
-- crm_email_sends.id (campagne envoyée immédiatement).
-- Les taux sont calculés en MESSAGES distincts ouverts/cliqués (pas en
-- événements bruts) → un contact qui ouvre 5 fois compte pour 1.

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('open', 'click')),
  source_type text,          -- 'newsletter' | 'sequence' | 'workflow' | 'delivery'
  campaign_id uuid,
  sequence_id uuid,
  message_id uuid,
  contact_id uuid,
  url text,                  -- clics uniquement (destination réelle)
  created_at timestamptz not null default now()
);

create index if not exists email_events_campaign_idx
  on public.email_events (campaign_id, kind) where campaign_id is not null;
create index if not exists email_events_sequence_idx
  on public.email_events (sequence_id, kind) where sequence_id is not null;
create index if not exists email_events_user_idx
  on public.email_events (user_id);

alter table public.email_events enable row level security;

-- Lecture : propriétaire uniquement. Écriture : service role uniquement
-- (les endpoints /api/track/open et /api/track/click passent par le client
-- admin ; aucune policy insert publique).
drop policy if exists email_events_owner_select on public.email_events;
create policy email_events_owner_select
  on public.email_events for select
  using (auth.uid() = user_id);

-- ─── Agrégats (SECURITY INVOKER → RLS appliquée) ────────────────────────────

-- Ouvertures/clics par campagne (messages distincts).
create or replace function public.campaign_email_stats_v1(p_campaign_ids uuid[])
returns table (campaign_id uuid, opens bigint, clicks bigint)
language sql
stable
as $$
  select e.campaign_id,
         count(distinct coalesce(e.message_id, e.contact_id, e.id))
           filter (where e.kind = 'open') as opens,
         count(distinct coalesce(e.message_id, e.contact_id, e.id))
           filter (where e.kind = 'click') as clicks
  from public.email_events e
  where e.campaign_id = any (p_campaign_ids)
  group by e.campaign_id;
$$;

-- Envoyés/ouvertures/clics par séquence. `sent` provient de la file
-- scheduled_emails (nécessite la policy select propriétaire existante).
create or replace function public.sequence_email_stats_v1(p_sequence_ids uuid[])
returns table (sequence_id uuid, sent bigint, opens bigint, clicks bigint)
language sql
stable
as $$
  with sends as (
    select se.sequence_id, count(*) filter (where se.status = 'sent') as sent
    from public.scheduled_emails se
    where se.sequence_id = any (p_sequence_ids)
    group by 1
  ),
  events as (
    select e.sequence_id,
           count(distinct coalesce(e.message_id, e.contact_id, e.id))
             filter (where e.kind = 'open') as opens,
           count(distinct coalesce(e.message_id, e.contact_id, e.id))
             filter (where e.kind = 'click') as clicks
    from public.email_events e
    where e.sequence_id = any (p_sequence_ids)
    group by 1
  )
  select coalesce(s.sequence_id, e.sequence_id) as sequence_id,
         coalesce(s.sent, 0) as sent,
         coalesce(e.opens, 0) as opens,
         coalesce(e.clicks, 0) as clicks
  from sends s
  full join events e on e.sequence_id = s.sequence_id;
$$;

revoke execute on function public.campaign_email_stats_v1(uuid[]) from anon;
revoke execute on function public.sequence_email_stats_v1(uuid[]) from anon;
