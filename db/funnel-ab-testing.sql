-- ============================================================================
-- AutoFunnel AI — A/B TESTING DES TUNNELS
-- ✅ DÉJÀ APPLIQUÉE en production le 2026-07-29 (migration `funnel_ab_testing`).
-- Conservée ici comme source de vérité du schéma.
--
-- CE QUI EST TESTÉ. Une variante B remplace les SECTIONS d'une page. C'est le
-- bon grain : plus fin (tester un seul titre) oblige à un modèle de patch
-- fragile, plus large (tester tout un tunnel) empêche d'attribuer le gain à
-- quoi que ce soit.
--
-- COMMENT LE VISITEUR EST AFFECTÉ. Pas de tirage au sort à chaque visite —
-- sinon quelqu'un verrait A puis B et le test ne mesurerait rien. L'affectation
-- est DÉTERMINISTE : hachage de (identifiant du test + identifiant visiteur),
-- modulo 100, comparé au pourcentage de répartition. Même visiteur, même test,
-- même variante, indéfiniment, sans rien stocker (cf. lib/ab/assign.ts).
-- ============================================================================

create table if not exists public.funnel_ab_tests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  funnel_id     uuid not null references public.funnels(id) on delete cascade,
  -- Identifiant de la page testée dans funnel.pages[]
  page_id       text not null,
  name          text not null,
  status        text not null default 'running',   -- running | paused | finished
  -- Pourcentage du trafic envoyé vers la variante B
  traffic_split int  not null default 50,
  -- Sections de la variante B (même forme que funnel.pages[i].sections)
  variant_b     jsonb not null,
  winner        text,                              -- null | 'a' | 'b'
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  created_at    timestamptz not null default now(),
  constraint funnel_ab_status_chk check (status in ('running','paused','finished')),
  constraint funnel_ab_split_chk  check (traffic_split between 1 and 99),
  constraint funnel_ab_winner_chk check (winner is null or winner in ('a','b'))
);

-- Un seul test EN COURS par page : deux tests actifs rendraient l'affectation
-- du visiteur ambiguë. Garanti par la BASE et non par l'application, pour
-- résister à deux créations concurrentes (même motif que la garde de
-- ré-entrée des workflows).
create unique index if not exists funnel_ab_one_running_per_page
  on public.funnel_ab_tests (funnel_id, page_id)
  where status = 'running';
create index if not exists funnel_ab_user_idx   on public.funnel_ab_tests (user_id);
create index if not exists funnel_ab_funnel_idx on public.funnel_ab_tests (funnel_id);

create table if not exists public.funnel_ab_events (
  id          uuid primary key default gen_random_uuid(),
  test_id     uuid not null references public.funnel_ab_tests(id) on delete cascade,
  user_id     uuid not null,
  variant     text not null,        -- 'a' | 'b'
  kind        text not null,        -- 'view' | 'conversion'
  -- Identifiant visiteur anonyme (cookie ff_ab). Jamais relié à un compte.
  visitor_key text not null,
  created_at  timestamptz not null default now(),
  constraint funnel_ab_events_variant_chk check (variant in ('a','b')),
  constraint funnel_ab_events_kind_chk    check (kind in ('view','conversion'))
);

-- Un visiteur compte UNE fois par type d'événement. Sans cet index, un simple
-- rechargement de page gonflerait les vues et écraserait le taux de
-- conversion — le test dirait alors le contraire de la vérité.
create unique index if not exists funnel_ab_events_unique
  on public.funnel_ab_events (test_id, visitor_key, kind);
create index if not exists funnel_ab_events_test_idx on public.funnel_ab_events (test_id);

alter table public.funnel_ab_tests  enable row level security;
alter table public.funnel_ab_events enable row level security;

-- ⚠️ DEUX RÉGIMES DIFFÉRENTS, et les confondre a coûté un bug :
--
--   • `funnel_ab_tests` est piloté par le PROPRIÉTAIRE depuis l'interface, qui
--     passe par le client de SESSION. Il lui faut donc les droits d'écriture
--     sur ses propres lignes. La première version n'avait qu'une politique
--     SELECT — la création de test échouait avec un « Création impossible »
--     sans explication.
--
--   • `funnel_ab_events` contient les MESURES, écrites uniquement par le
--     serveur (rendu public, capture de lead) via le service role. Lecture
--     seule pour le propriétaire : sinon n'importe qui pourrait fabriquer de
--     faux résultats depuis son navigateur.
drop policy if exists funnel_ab_tests_owner on public.funnel_ab_tests;

drop policy if exists funnel_ab_tests_owner_select on public.funnel_ab_tests;
create policy funnel_ab_tests_owner_select on public.funnel_ab_tests
  for select using (auth.uid() = user_id);

drop policy if exists funnel_ab_tests_owner_insert on public.funnel_ab_tests;
create policy funnel_ab_tests_owner_insert on public.funnel_ab_tests
  for insert with check (auth.uid() = user_id);

drop policy if exists funnel_ab_tests_owner_update on public.funnel_ab_tests;
create policy funnel_ab_tests_owner_update on public.funnel_ab_tests
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists funnel_ab_tests_owner_delete on public.funnel_ab_tests;
create policy funnel_ab_tests_owner_delete on public.funnel_ab_tests
  for delete using (auth.uid() = user_id);

-- Mesures : lecture seule pour le propriétaire.
drop policy if exists funnel_ab_events_owner on public.funnel_ab_events;
create policy funnel_ab_events_owner on public.funnel_ab_events
  for select using (auth.uid() = user_id);

-- Agrégats d'un test. SECURITY INVOKER (défaut) → la RLS s'applique.
create or replace function public.ab_test_stats_v1(p_test_id uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'a', jsonb_build_object(
      'views',       (select count(*) from public.funnel_ab_events e where e.test_id = p_test_id and e.variant = 'a' and e.kind = 'view'),
      'conversions', (select count(*) from public.funnel_ab_events e where e.test_id = p_test_id and e.variant = 'a' and e.kind = 'conversion')
    ),
    'b', jsonb_build_object(
      'views',       (select count(*) from public.funnel_ab_events e where e.test_id = p_test_id and e.variant = 'b' and e.kind = 'view'),
      'conversions', (select count(*) from public.funnel_ab_events e where e.test_id = p_test_id and e.variant = 'b' and e.kind = 'conversion')
    )
  );
$$;

revoke execute on function public.ab_test_stats_v1(uuid) from anon;
