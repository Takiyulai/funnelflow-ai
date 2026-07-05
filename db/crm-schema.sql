-- ============================================================================
-- AutoFunnel AI — CRM (étape 1 : modèle de données)
-- À EXÉCUTER dans l'éditeur SQL de Supabase (Dashboard → SQL Editor).
--
-- Choix validés :
--   • Contact   = table `leads` existante, ÉTENDUE (pas de table séparée).
--   • Segments  = filtre dynamique sauvegardé (recalculé à l'usage).
--   • Téléphone = E.164 dans `phone` + pays ISO dans `phone_country`.
--   • Campagnes = contenu HTML (rich text).
--
-- RLS : chaque utilisateur ne voit/écrit que ses lignes (comme `leads`).
-- Les écritures serveur passent par le client admin (service role) et
-- contournent la RLS ; la RLS protège l'accès direct côté client.
-- ============================================================================

-- 1) CONTACTS — on étend `leads`
alter table public.leads
  add column if not exists phone_country text;

-- 2) TAGS
create table if not exists public.crm_tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  color      text not null default '#6D5DF6',
  created_at timestamptz not null default now()
);
create unique index if not exists crm_tags_user_name_uk
  on public.crm_tags (user_id, lower(name));
create index if not exists crm_tags_user_idx on public.crm_tags (user_id);

-- 3) RELATION Contact <-> Tags (N-N)
create table if not exists public.crm_contact_tags (
  contact_id uuid not null references public.leads(id)     on delete cascade,
  tag_id     uuid not null references public.crm_tags(id)  on delete cascade,
  user_id    uuid not null references auth.users(id)       on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, tag_id)
);
create index if not exists crm_contact_tags_tag_idx  on public.crm_contact_tags (tag_id);
create index if not exists crm_contact_tags_user_idx on public.crm_contact_tags (user_id);

-- 4) SEGMENTS (filtre dynamique)
--    filter (jsonb) ex : {"tagIds":["…"],"match":"any","status":["client"],"funnelId":null,"search":""}
create table if not exists public.crm_segments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  filter     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_segments_user_idx on public.crm_segments (user_id);

-- 5) CAMPAGNES EMAIL
create table if not exists public.crm_campaigns (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  subject          text not null default '',
  content          text not null default '',          -- HTML (rich text)
  status           text not null default 'draft',     -- draft | sending | sent | failed
  segment_id       uuid references public.crm_segments(id) on delete set null,
  recipient_ids    jsonb,                              -- sélection manuelle (sinon segment)
  recipients_count int not null default 0,
  sent_count       int not null default 0,
  failed_count     int not null default 0,
  sent_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists crm_campaigns_user_idx on public.crm_campaigns (user_id);

-- 6) HISTORIQUE D'ENVOIS (par destinataire)
create table if not exists public.crm_email_sends (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.crm_campaigns(id) on delete cascade,
  contact_id  uuid references public.leads(id) on delete set null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text not null,
  status      text not null default 'pending',        -- pending | sent | failed
  resend_id   text,
  error       text,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists crm_email_sends_campaign_idx on public.crm_email_sends (campaign_id);
create index if not exists crm_email_sends_user_idx     on public.crm_email_sends (user_id);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.crm_tags         enable row level security;
alter table public.crm_contact_tags enable row level security;
alter table public.crm_segments     enable row level security;
alter table public.crm_campaigns    enable row level security;
alter table public.crm_email_sends  enable row level security;

create policy "crm_tags_owner" on public.crm_tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "crm_contact_tags_owner" on public.crm_contact_tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "crm_segments_owner" on public.crm_segments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "crm_campaigns_owner" on public.crm_campaigns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "crm_email_sends_owner" on public.crm_email_sends
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
