-- Prospects ayant volontairement renseigné leurs coordonnées dans le chatbot
-- public de la landing. Ces données appartiennent à la plateforme, pas à un
-- tunnel client : elles restent donc séparées de public.leads.

create table if not exists public.chatbot_leads (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(first_name) between 1 and 80),
  email text not null unique check (char_length(email) between 3 and 320),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'converted', 'ignored')),
  source text not null default 'landing_chatbot'
    check (char_length(source) between 1 and 80),
  consent_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chatbot_leads_created_idx
  on public.chatbot_leads (created_at desc);

create index if not exists chatbot_leads_status_created_idx
  on public.chatbot_leads (status, created_at desc);

alter table public.chatbot_leads enable row level security;

-- La capture et la consultation passent par des routes serveur protégées.
revoke all on table public.chatbot_leads from anon, authenticated;
grant select, insert, update, delete on table public.chatbot_leads to service_role;

comment on table public.chatbot_leads is
  'Prospects capturés avec consentement depuis le chatbot public AutoFunnel AI.';
