-- db/workflow-triggers-lot2-migration.sql
-- 🆕 LOT 2 — Extension des déclencheurs de Workflow.
--
-- Aucun changement de schéma requis sur `workflows` / `workflow_steps` : les
-- nouveaux événements et leurs filtres (funnelId, pageSlug, linkLabel,
-- afterEvent, delayDays, delayHours) sont déjà couverts par la colonne jsonb
-- `workflow_steps.config` existante.
--
-- Seule addition : la table `workflow_pending_runs`, qui porte les exécutions
-- DIFFÉRÉES du déclencheur `time.elapsed` (« X jours/heures après tel
-- événement »). Le moteur y insère une ligne quand l'événement de référence se
-- produit ; le CRON existant (/api/cron/send-scheduled-emails, étendu) la
-- traite quand `run_at` est dépassé, exactement comme `scheduled_emails`.

create table if not exists public.workflow_pending_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  user_id uuid not null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  lead_email text not null,
  lead_name text,
  run_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists workflow_pending_runs_due_idx
  on public.workflow_pending_runs (status, run_at);

create index if not exists workflow_pending_runs_workflow_idx
  on public.workflow_pending_runs (workflow_id);

comment on table public.workflow_pending_runs is
  'LOT 2 — Exécutions différées du moteur de Workflows pour le déclencheur "time.elapsed" : une ligne = exécuter les actions de ce workflow pour ce contact à cette date. Traitée par le CRON /api/cron/send-scheduled-emails (étendu).';

-- RLS activée sans policy publique : seul le client ADMIN (service role, qui
-- bypass RLS) lit/écrit cette table, exactement comme `scheduled_emails`. Aucun
-- accès anon/authenticated n'est nécessaire (pas d'UI directe sur cette table).
alter table public.workflow_pending_runs enable row level security;
