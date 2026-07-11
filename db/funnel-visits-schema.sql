-- db/funnel-visits-schema.sql
-- 🆕 VAGUE 1 / LOT 2 — Analytics de tunnel v1.
-- Table d'événements de visite ANONYMES sur les tunnels publiés + fonction
-- d'agrégation pour le dashboard. À exécuter dans Supabase → SQL Editor
-- (idempotent, additif — ne touche à aucune table existante).
--
-- Vie privée (by design) :
--   • AUCUNE donnée personnelle : pas d'IP, pas de user-agent stockés.
--   • `visitor_id` est un UUID aléatoire posé en localStorage côté navigateur,
--     jamais relié à un compte, un email ou un lead.
--   • Compatible avec le scrubbing Sentry (rien à masquer).

create table if not exists public.funnel_visits (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels (id) on delete cascade,
  user_id uuid not null,
  page_slug text,
  visitor_id text not null,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now()
);

create index if not exists funnel_visits_funnel_created_idx
  on public.funnel_visits (funnel_id, created_at desc);
create index if not exists funnel_visits_user_idx
  on public.funnel_visits (user_id);

alter table public.funnel_visits enable row level security;

-- Lecture : propriétaire uniquement. Écriture : service role uniquement
-- (aucune policy insert → seule l'API /api/track/visit, via le client admin,
-- peut écrire ; un visiteur ne peut pas injecter de fausses lignes en direct).
drop policy if exists funnel_visits_owner_select on public.funnel_visits;
create policy funnel_visits_owner_select
  on public.funnel_visits for select
  using (auth.uid() = user_id);

-- ─── Agrégats du dashboard ───────────────────────────────────────────────────
-- SECURITY INVOKER (défaut) → la RLS s'applique : un utilisateur connecté ne
-- peut agréger que SES visites/leads. Appelée côté serveur avec le client de
-- session (app/(app)/funnels/[id]/stats).
create or replace function public.funnel_stats_v1(p_funnel_id uuid, p_since timestamptz)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'views', (
      select count(*) from public.funnel_visits v
      where v.funnel_id = p_funnel_id and v.created_at >= p_since
    ),
    'uniques', (
      select count(distinct v.visitor_id) from public.funnel_visits v
      where v.funnel_id = p_funnel_id and v.created_at >= p_since
    ),
    'leads', (
      select count(*) from public.leads l
      where l.funnel_id = p_funnel_id and l.created_at >= p_since
    ),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pageSlug', t.ps, 'views', t.views, 'uniques', t.uniques
      ) order by t.views desc)
      from (
        select coalesce(v.page_slug, '') as ps,
               count(*) as views,
               count(distinct v.visitor_id) as uniques
        from public.funnel_visits v
        where v.funnel_id = p_funnel_id and v.created_at >= p_since
        group by 1
      ) t
    ), '[]'::jsonb),
    'leadsByPage', coalesce((
      select jsonb_agg(jsonb_build_object('pageSlug', t.ps, 'leads', t.n))
      from (
        select coalesce(l.page_slug, '') as ps, count(*) as n
        from public.leads l
        where l.funnel_id = p_funnel_id and l.created_at >= p_since
        group by 1
      ) t
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('source', t.src, 'views', t.n) order by t.n desc)
      from (
        select coalesce(nullif(v.utm_source, ''), nullif(v.referrer_host, ''), 'direct') as src,
               count(*) as n
        from public.funnel_visits v
        where v.funnel_id = p_funnel_id and v.created_at >= p_since
        group by 1
        order by 2 desc
        limit 20
      ) t
    ), '[]'::jsonb)
  );
$$;

-- Pas d'accès anonyme aux agrégats.
revoke execute on function public.funnel_stats_v1(uuid, timestamptz) from anon;
