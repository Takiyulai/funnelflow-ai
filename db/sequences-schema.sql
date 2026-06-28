-- db/sequences-schema.sql
-- 🆕 ÉTAPE 5/6 — Schéma des SÉQUENCES email + extension de la file d'envoi.
-- À exécuter dans Supabase → SQL Editor APRÈS validation. Idempotent.
--
-- Principe : on RÉUTILISE la table existante `scheduled_emails` (déjà alimentée
-- par les newsletters programmées via `source_type='newsletter'`). Le CRON lira
-- cette table UNIQUE pour TOUT envoyer (newsletters + séquences).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Séquence (en-tête)
create table if not exists public.crm_sequences (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  -- bienvenue | nurturing | relance | lancement | reengagement | autre
  type        text not null default 'autre',
  context     text,
  language    text not null default 'fr',
  -- tunnel rattaché (optionnel) ; on garde la séquence si le tunnel est supprimé
  funnel_id   uuid references public.funnels(id) on delete set null,
  -- draft | active | archived
  status      text not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists crm_sequences_user_idx on public.crm_sequences (user_id);

-- 2) Emails d'une séquence (ordonnés, avec délai en jours)
create table if not exists public.crm_sequence_emails (
  id          uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.crm_sequences(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  position    int  not null default 0,
  delay_days  int  not null default 0,
  subject     text not null default '',
  content     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists crm_sequence_emails_seq_idx on public.crm_sequence_emails (sequence_id);

-- 3) Extension de la file d'envoi existante `scheduled_emails`
--    (déjà : id, user_id, source_type, campaign_id, contact_id, recipient_email,
--     subject, content, scheduled_at, status, sent_at?, error?, created_at)
--    On autorise les lignes de séquence (campaign_id nul) + on relie la séquence.
alter table public.scheduled_emails alter column campaign_id drop not null;
alter table public.scheduled_emails
  add column if not exists sequence_id uuid references public.crm_sequences(id) on delete cascade;
alter table public.scheduled_emails
  add column if not exists sequence_email_id uuid references public.crm_sequence_emails(id) on delete set null;
-- Colonnes de suivi d'envoi (lues/écrites par le CRON). Idempotent.
alter table public.scheduled_emails add column if not exists sent_at timestamptz;
alter table public.scheduled_emails add column if not exists error text;
alter table public.scheduled_emails add column if not exists created_at timestamptz not null default now();
-- Index pour la requête du cron (dues + en attente).
create index if not exists scheduled_emails_due_idx
  on public.scheduled_emails (status, scheduled_at);

-- 4) RLS (propriétaire uniquement), aligné sur le reste du CRM.
alter table public.crm_sequences enable row level security;
alter table public.crm_sequence_emails enable row level security;

drop policy if exists crm_sequences_owner on public.crm_sequences;
create policy crm_sequences_owner on public.crm_sequences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists crm_sequence_emails_owner on public.crm_sequence_emails;
create policy crm_sequence_emails_owner on public.crm_sequence_emails
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- NB : le CRON n'utilise PAS la RLS (il lit via le client admin / service role
-- côté serveur, comme loadPublished), donc pas de policy publique nécessaire.
