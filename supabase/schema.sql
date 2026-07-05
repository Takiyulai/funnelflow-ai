-- ============================================================
-- AutoFunnel AI - Schéma principal
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Table: users
-- Profils applicatifs liés à auth.users
-- ------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  avatar_url text,
  plan text not null default 'starter' check (plan in ('starter', 'pro', 'agency')),
  language text not null default 'fr' check (language in ('fr', 'en', 'es')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Table: funnels
-- Tunnel complet (brief + JSON + HTML rendu)
-- ------------------------------------------------------------
create table if not exists public.funnels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  language text not null default 'fr' check (language in ('fr', 'en', 'es')),
  offer_type text,
  funnel_type text,
  brief jsonb not null default '{}'::jsonb,
  json_content jsonb not null default '{}'::jsonb,
  html_content text,
  default_cta jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists funnels_user_id_idx on public.funnels(user_id);
create index if not exists funnels_status_idx on public.funnels(status);

-- ------------------------------------------------------------
-- Table: funnel_sections
-- Sections éditables d'un tunnel (texte, CTA, image, style)
-- ------------------------------------------------------------
create table if not exists public.funnel_sections (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  type text not null,
  position int not null default 0,
  visible boolean not null default true,
  content jsonb not null default '{}'::jsonb,
  cta_config jsonb,
  image_config jsonb,
  style_config jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists funnel_sections_funnel_id_idx on public.funnel_sections(funnel_id);
create index if not exists funnel_sections_position_idx on public.funnel_sections(funnel_id, position);

-- ------------------------------------------------------------
-- Table: leads
-- Contacts collectés via les formulaires des tunnels publiés
-- ------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  status text not null default 'nouveau' check (status in ('nouveau', 'contacte', 'qualifie', 'client', 'perdu')),
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists leads_funnel_id_idx on public.leads(funnel_id);
create index if not exists leads_user_id_idx on public.leads(user_id);
create index if not exists leads_email_idx on public.leads(email);

-- ------------------------------------------------------------
-- Table: templates
-- Catalogue de modèles de tunnels (lecture publique)
-- ------------------------------------------------------------
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  objective text not null,
  audience text,
  language text not null default 'fr' check (language in ('fr', 'en', 'es')),
  badge text,
  sections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Table: exports
-- Historique des exports HTML / systeme.io / ZIP
-- ------------------------------------------------------------
create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('html', 'systeme_full', 'systeme_block', 'zip')),
  mode text check (mode in ('full', 'block')),
  file_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists exports_funnel_id_idx on public.exports(funnel_id);
create index if not exists exports_user_id_idx on public.exports(user_id);

-- ------------------------------------------------------------
-- Table: workflows
-- Automatisations (préparation, MVP léger)
-- ------------------------------------------------------------
create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  type text not null,
  position int not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workflow_steps_workflow_id_idx on public.workflow_steps(workflow_id);

-- ------------------------------------------------------------
-- Table: email_sequences
-- Séquences mail générées par l'IA et liées à un tunnel
-- ------------------------------------------------------------
create table if not exists public.email_sequences (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  language text not null default 'fr' check (language in ('fr', 'en', 'es')),
  emails jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_sequences_funnel_id_idx on public.email_sequences(funnel_id);

-- ------------------------------------------------------------
-- Table: brand_assets
-- Identité visuelle réutilisable par l'utilisateur
-- ------------------------------------------------------------
create table if not exists public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  logo_url text,
  primary_color text default '#080E1A',
  secondary_color text default '#C7A436',
  accent_color text default '#31845C',
  font_heading text default 'Bebas Neue',
  font_body text default 'DM Sans',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brand_assets_user_id_idx on public.brand_assets(user_id);

-- ------------------------------------------------------------
-- Table: section_images
-- Bibliothèque d'images par utilisateur (upload ou IA)
-- ------------------------------------------------------------
create table if not exists public.section_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  funnel_id uuid references public.funnels(id) on delete set null,
  url text not null,
  alt text,
  source text not null default 'upload' check (source in ('upload', 'ai-suggested')),
  credit text,
  source_url text,
  created_at timestamptz not null default now()
);

create index if not exists section_images_user_id_idx on public.section_images(user_id);
create index if not exists section_images_funnel_id_idx on public.section_images(funnel_id);

-- ============================================================
-- Triggers updated_at
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;

$$;

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists set_funnels_updated_at on public.funnels;
create trigger set_funnels_updated_at before update on public.funnels
for each row execute function public.set_updated_at();

drop trigger if exists set_funnel_sections_updated_at on public.funnel_sections;
create trigger set_funnel_sections_updated_at before update on public.funnel_sections
for each row execute function public.set_updated_at();

drop trigger if exists set_workflows_updated_at on public.workflows;
create trigger set_workflows_updated_at before update on public.workflows
for each row execute function public.set_updated_at();

drop trigger if exists set_email_sequences_updated_at on public.email_sequences;
create trigger set_email_sequences_updated_at before update on public.email_sequences
for each row execute function public.set_updated_at();

drop trigger if exists set_brand_assets_updated_at on public.brand_assets;
create trigger set_brand_assets_updated_at before update on public.brand_assets
for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.users enable row level security;
alter table public.funnels enable row level security;
alter table public.funnel_sections enable row level security;
alter table public.leads enable row level security;
alter table public.templates enable row level security;
alter table public.exports enable row level security;
alter table public.workflows enable row level security;
alter table public.workflow_steps enable row level security;
alter table public.email_sequences enable row level security;
alter table public.brand_assets enable row level security;
alter table public.section_images enable row level security;

-- Users
drop policy if exists "Users manage own profile" on public.users;
create policy "Users manage own profile" on public.users
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Funnels
drop policy if exists "Users manage own funnels" on public.funnels;
create policy "Users manage own funnels" on public.funnels
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Published funnels are public" on public.funnels;
create policy "Published funnels are public" on public.funnels
  for select using (status = 'published');

-- Funnel sections (via funnel ownership ou tunnel publié)
drop policy if exists "Users manage sections through funnels" on public.funnel_sections;
create policy "Users manage sections through funnels" on public.funnel_sections
  for all using (
    exists (
      select 1 from public.funnels f
      where f.id = funnel_sections.funnel_id and f.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.funnels f
      where f.id = funnel_sections.funnel_id and f.user_id = auth.uid()
    )
  );

drop policy if exists "Public sections via published funnels" on public.funnel_sections;
create policy "Public sections via published funnels" on public.funnel_sections
  for select using (
    exists (
      select 1 from public.funnels f
      where f.id = funnel_sections.funnel_id and f.status = 'published'
    )
  );

-- Leads
drop policy if exists "Users manage own leads" on public.leads;
create policy "Users manage own leads" on public.leads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Public can insert leads on published funnels" on public.leads;
create policy "Public can insert leads on published funnels" on public.leads
  for insert with check (
    exists (
      select 1 from public.funnels f
      where f.id = leads.funnel_id and f.status = 'published' and f.user_id = leads.user_id
    )
  );

-- Templates (lecture publique)
drop policy if exists "Templates are readable" on public.templates;
create policy "Templates are readable" on public.templates
  for select using (true);

-- Exports
drop policy if exists "Users manage own exports" on public.exports;
create policy "Users manage own exports" on public.exports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Workflows
drop policy if exists "Users manage own workflows" on public.workflows;
create policy "Users manage own workflows" on public.workflows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage workflow steps through workflows" on public.workflow_steps;
create policy "Users manage workflow steps through workflows" on public.workflow_steps
  for all using (
    exists (
      select 1 from public.workflows w
      where w.id = workflow_steps.workflow_id and w.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.workflows w
      where w.id = workflow_steps.workflow_id and w.user_id = auth.uid()
    )
  );

-- Email sequences
drop policy if exists "Users manage own email sequences" on public.email_sequences;
create policy "Users manage own email sequences" on public.email_sequences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Brand assets
drop policy if exists "Users manage own brand assets" on public.brand_assets;
create policy "Users manage own brand assets" on public.brand_assets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Section images
drop policy if exists "Users manage own section images" on public.section_images;
create policy "Users manage own section images" on public.section_images
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- Sync auth.users -> public.users
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;

$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
