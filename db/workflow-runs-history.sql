-- 🆕 HISTORIQUE D'EXÉCUTION DES WORKFLOWS + GARDE DE RÉ-ENTRÉE
--
-- Deux manques comblés d'un seul coup, parce qu'ils partagent la même table :
--
--  1. OBSERVABILITÉ. `workflow_pending_runs` est une FILE D'ATTENTE (ce qui
--     reste à faire), pas un JOURNAL (ce qui a été fait). Impossible aujourd'hui
--     de répondre à « qu'est-ce que ce workflow a fait pour ce contact ? » —
--     exactement la question posée le jour où un utilisateur dit « mon
--     automatisation ne marche pas ».
--
--  2. RÉ-ENTRÉE. Rien n'empêchait un même contact de relancer le même workflow.
--     Une double soumission du formulaire = deux exécutions parallèles = emails
--     en double.
--
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  user_id uuid not null,

  -- Contact concerné (null possible : workflow déclenché hors contexte contact)
  lead_id uuid,
  lead_email text,

  trigger_event text not null,
  funnel_id uuid,

  status text not null default 'running'
    check (status in ('running', 'done', 'failed', 'skipped_duplicate')),

  -- Journal pas à pas : [{ position, kind, status, at, detail? }]
  -- Un JSONB plutôt qu'une table dédiée : une seule écriture par exécution,
  -- suffisant pour la chronologie par contact ET pour compter les passages par
  -- branche via une requête sur le JSONB.
  steps jsonb not null default '[]'::jsonb,

  actions_total int not null default 0,
  actions_done int not null default 0,
  error text,

  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- ─── Garde de ré-entrée, sans condition de concurrence ───────────────────────
--
-- `dedupe_key` vaut '<workflow_id>:<lead_id>' quand la ré-entrée est INTERDITE,
-- et NULL quand elle est autorisée. En PostgreSQL, les NULL ne s'opposent pas
-- dans un index unique : les workflows ré-entrants peuvent donc s'exécuter
-- autant de fois que nécessaire, tandis que les autres sont bloqués par la base
-- elle-même.
--
-- C'est volontairement la BASE qui tranche, et non le code applicatif : deux
-- soumissions simultanées passeraient toutes deux un simple « est-ce que ça
-- existe déjà ? » avant que l'une n'ait écrit. Ici, la seconde insertion échoue,
-- point.
alter table public.workflow_runs add column if not exists dedupe_key text;

create unique index if not exists workflow_runs_dedupe_idx
  on public.workflow_runs (dedupe_key)
  where dedupe_key is not null;

-- Consultation : « les exécutions de ce workflow », « celles de ce contact ».
create index if not exists workflow_runs_workflow_idx
  on public.workflow_runs (workflow_id, started_at desc);

create index if not exists workflow_runs_lead_idx
  on public.workflow_runs (lead_id, started_at desc);

create index if not exists workflow_runs_user_idx
  on public.workflow_runs (user_id, started_at desc);

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Le moteur écrit via la clé service (qui contourne RLS), exactement comme
-- `scheduled_emails` et `workflow_pending_runs`. La policy ci-dessous ne sert
-- qu'à la LECTURE par le propriétaire depuis l'interface.
alter table public.workflow_runs enable row level security;

drop policy if exists workflow_runs_select_own on public.workflow_runs;
create policy workflow_runs_select_own on public.workflow_runs
  for select using (auth.uid() = user_id);
