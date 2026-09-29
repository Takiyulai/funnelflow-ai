-- Bibliothèque de tutoriels AutoFunnel AI.
-- Table additive : aucune table ni policy existante n'est modifiée.

create table if not exists public.tutorials (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  description text not null default '' check (char_length(description) <= 1200),
  video_url text not null check (char_length(video_url) <= 2000),
  thumbnail_url text check (thumbnail_url is null or char_length(thumbnail_url) <= 2000),
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tutorials_published_order_idx
  on public.tutorials (is_published, sort_order, created_at desc);

alter table public.tutorials enable row level security;
revoke all on table public.tutorials from anon, authenticated;
grant select on table public.tutorials to authenticated;

create policy "Authenticated users can view published tutorials"
  on public.tutorials
  for select
  to authenticated
  using (is_published = true);

comment on table public.tutorials is
  'Vidéos de formation visibles dans l application. Les écritures passent exclusivement par une API administrateur avec service_role.';
