-- 🆕 MESSAGERIE — boîte de réception intégrée (Telegram d'abord, WhatsApp ensuite)
--
-- OBJECTIF : l'utilisateur connecte SON canal, ses prospects lui écrivent, il
-- voit et répond depuis AutoFunnel — sans jamais ouvrir Telegram.
--
-- Le schéma est volontairement AGNOSTIQUE du canal (`provider`) : WhatsApp
-- viendra s'y greffer sans nouvelle table, seul l'adaptateur d'envoi/réception
-- changera. C'est le point qui évite une réécriture dans trois mois.

-- ─── 1. Canal connecté (le bot d'un utilisateur) ────────────────────────────
create table if not exists public.messaging_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null check (provider in ('telegram', 'whatsapp')),

  -- Identité publique du bot (id numérique et @nom), affichée dans l'interface.
  external_id text,
  display_name text,
  username text,

  -- 🔒 Jeton du bot. N'est JAMAIS renvoyé au navigateur : toutes les routes
  -- sélectionnent explicitement les colonnes, jamais `*`. Seule la clé service
  -- (qui contourne RLS) le lit, pour appeler l'API du fournisseur.
  credentials jsonb not null default '{}'::jsonb,

  -- Secret partagé avec Telegram (`secret_token` de setWebhook), renvoyé dans
  -- l'en-tête X-Telegram-Bot-Api-Secret-Token à chaque appel entrant. C'est ce
  -- qui empêche n'importe qui de poster de faux messages sur notre webhook.
  webhook_secret text not null,

  status text not null default 'active'
    check (status in ('active', 'error', 'disconnected')),
  last_error text,
  connected_at timestamptz not null default now(),

  -- Un utilisateur = un bot par canal (v1). Suffisant, et évite d'avoir à
  -- choisir « depuis quel bot je réponds » à chaque message.
  unique (user_id, provider)
);

create index if not exists messaging_channels_user_idx
  on public.messaging_channels (user_id);

-- ─── 2. Conversations ───────────────────────────────────────────────────────
create table if not exists public.messaging_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  channel_id uuid not null references public.messaging_channels(id) on delete cascade,

  -- Identifiant du fil côté fournisseur (chat_id Telegram).
  external_chat_id text not null,

  -- Rattachement au CRM. Nullable : un prospect peut écrire avant d'avoir été
  -- capturé comme lead. Le rapprochement se fait ensuite (email/téléphone).
  contact_id uuid,

  display_name text,
  username text,

  last_message_at timestamptz,
  last_message_preview text,
  unread_count int not null default 0,

  status text not null default 'open' check (status in ('open', 'archived')),
  created_at timestamptz not null default now(),

  -- Le fournisseur peut renvoyer le même chat plusieurs fois : cette contrainte
  -- rend l'upsert du webhook naturellement idempotent.
  unique (channel_id, external_chat_id)
);

create index if not exists messaging_conversations_user_idx
  on public.messaging_conversations (user_id, last_message_at desc nulls last);

create index if not exists messaging_conversations_contact_idx
  on public.messaging_conversations (contact_id);

-- ─── 3. Messages ────────────────────────────────────────────────────────────
create table if not exists public.messaging_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  conversation_id uuid not null
    references public.messaging_conversations(id) on delete cascade,

  direction text not null check (direction in ('in', 'out')),
  body text,

  external_message_id text,
  status text not null default 'received'
    check (status in ('received', 'sent', 'failed')),
  error text,

  created_at timestamptz not null default now()
);

create index if not exists messaging_messages_conversation_idx
  on public.messaging_messages (conversation_id, created_at);

-- Idempotence des messages ENTRANTS : Telegram réémet un update quand notre
-- webhook ne répond pas assez vite. Sans cette contrainte, un message lent à
-- traiter apparaîtrait plusieurs fois dans le fil.
create unique index if not exists messaging_messages_external_idx
  on public.messaging_messages (conversation_id, external_message_id)
  where external_message_id is not null;

-- ─── 4. RLS ─────────────────────────────────────────────────────────────────
-- Écriture par la clé service (webhook, envoi) ; lecture par le propriétaire.
alter table public.messaging_channels enable row level security;
alter table public.messaging_conversations enable row level security;
alter table public.messaging_messages enable row level security;

drop policy if exists messaging_channels_select_own on public.messaging_channels;
create policy messaging_channels_select_own on public.messaging_channels
  for select using (auth.uid() = user_id);

drop policy if exists messaging_conversations_select_own on public.messaging_conversations;
create policy messaging_conversations_select_own on public.messaging_conversations
  for select using (auth.uid() = user_id);

drop policy if exists messaging_messages_select_own on public.messaging_messages;
create policy messaging_messages_select_own on public.messaging_messages
  for select using (auth.uid() = user_id);
