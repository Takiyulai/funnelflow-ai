create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  plan text not null default 'starter',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.funnels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  language text not null check (language in ('fr', 'en')),
  offer_type text,
  json_content jsonb not null default '{}'::jsonb,
  html_content text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.funnel_sections (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  type text not null,
  position int not null default 0,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  status text not null default 'nouveau' check (status in ('nouveau', 'contacté', 'qualifié', 'client', 'perdu')),
  source text,
  created_at timestamptz not null default now()
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  objective text not null,
  sections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('html', 'systeme', 'zip')),
  file_url text,
  created_at timestamptz not null default now()
);

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

create table if not exists public.email_sequences (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  emails jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  logo_url text,
  primary_color text default '#082B4C',
  secondary_color text default '#F4C542',
  accent_color text default '#35B779',
  created_at timestamptz not null default now()
);

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

create policy "Users manage own profile" on public.users for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users manage own funnels" on public.funnels for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Published funnels are public" on public.funnels for select using (status = 'published');
create policy "Users manage own leads" on public.leads for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Templates are readable" on public.templates for select using (true);
create policy "Users manage own exports" on public.exports for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own workflows" on public.workflows for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own email sequences" on public.email_sequences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own brand assets" on public.brand_assets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage sections through funnels" on public.funnel_sections for all using (
  exists (select 1 from public.funnels where funnels.id = funnel_sections.funnel_id and funnels.user_id = auth.uid())
) with check (
  exists (select 1 from public.funnels where funnels.id = funnel_sections.funnel_id and funnels.user_id = auth.uid())
);
create policy "Users manage workflow steps through workflows" on public.workflow_steps for all using (
  exists (select 1 from public.workflows where workflows.id = workflow_steps.workflow_id and workflows.user_id = auth.uid())
) with check (
  exists (select 1 from public.workflows where workflows.id = workflow_steps.workflow_id and workflows.user_id = auth.uid())
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
