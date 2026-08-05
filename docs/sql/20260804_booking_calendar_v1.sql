-- docs/sql/20260804_booking_calendar_v1.sql
-- Module « Calendrier de RDV natif » — schéma v1.
--
-- ── PRINCIPE DE STOCKAGE DES HEURES ────────────────────────────────────────
-- Deux natures de temps cohabitent, et les confondre est LE bug classique :
--
--   1. Les RÈGLES de disponibilité sont des heures LOCALES DE L'HÔTE
--      (« je reçois de 9h à 17h »). On les stocke en minutes depuis minuit,
--      SANS fuseau : elles suivent l'hôte, pas un instant.
--
--   2. Les RÉSERVATIONS sont des INSTANTS ABSOLUS (timestamptz, UTC).
--      Un RDV lie deux personnes dans deux fuseaux : seul l'instant fait foi.
--
-- Le fuseau de l'hôte (IANA) fait le pont entre les deux. Il est stocké comme
-- identifiant IANA et jamais comme décalage : « UTC+1 » serait faux la moitié
-- de l'année pour Paris, alors que l'Afrique de l'Ouest ne change jamais.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Types de RDV
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.booking_event_types (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,

  -- Identifiant public de l'URL /rdv/<slug>. Unique globalement.
  slug           text not null,
  name           text not null,
  description    text,

  duration_min   integer not null default 30 check (duration_min between 5 and 480),
  -- Battement APRÈS chaque RDV (rangement, notes, respiration).
  buffer_min     integer not null default 0 check (buffer_min between 0 and 240),
  -- Délai minimum entre « maintenant » et le créneau réservable.
  min_notice_min integer not null default 240 check (min_notice_min between 0 and 43200),
  -- Horizon de réservation, en jours.
  horizon_days   integer not null default 30 check (horizon_days between 1 and 365),
  -- Granularité de la grille proposée (ex. créneaux toutes les 15 min).
  slot_step_min  integer not null default 15 check (slot_step_min between 5 and 120),

  -- Fuseau IANA de l'hôte : réfère les règles de disponibilité.
  timezone       text not null default 'Africa/Abidjan',

  location_kind  text not null default 'visio'
                 check (location_kind in ('visio', 'phone', 'in_person', 'custom')),
  location_value text,

  color          text,
  language       text not null default 'fr',
  active         boolean not null default true,

  funnel_id      uuid references public.funnels(id) on delete set null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists booking_event_types_slug_uidx
  on public.booking_event_types (lower(slug));
create index if not exists booking_event_types_user_idx
  on public.booking_event_types (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Disponibilités hebdomadaires récurrentes
-- ─────────────────────────────────────────────────────────────────────────────
-- Heures LOCALES DE L'HÔTE, en minutes depuis minuit (0-1440).
-- Plusieurs plages par jour autorisées (matin / après-midi).
create table if not exists public.booking_availability (
  id            uuid primary key default gen_random_uuid(),
  event_type_id uuid not null references public.booking_event_types(id) on delete cascade,

  weekday       smallint not null check (weekday between 0 and 6), -- 0 = dimanche
  start_min     integer  not null check (start_min between 0 and 1440),
  end_min       integer  not null check (end_min between 0 and 1440),

  created_at    timestamptz not null default now(),

  constraint booking_availability_range_ck check (end_min > start_min)
);

create index if not exists booking_availability_event_idx
  on public.booking_availability (event_type_id, weekday);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Exceptions : fermetures et ouvertures ponctuelles
-- ─────────────────────────────────────────────────────────────────────────────
-- `day` est une DATE CIVILE dans le fuseau de l'hôte (pas un instant).
-- kind = 'closed'  → journée entière fermée (start/end ignorés)
-- kind = 'window'  → remplace les règles hebdo ce jour-là par cette plage
create table if not exists public.booking_exceptions (
  id            uuid primary key default gen_random_uuid(),
  event_type_id uuid not null references public.booking_event_types(id) on delete cascade,

  day           date not null,
  kind          text not null default 'closed' check (kind in ('closed', 'window')),
  start_min     integer check (start_min between 0 and 1440),
  end_min       integer check (end_min between 0 and 1440),
  note          text,

  created_at    timestamptz not null default now(),

  constraint booking_exceptions_window_ck check (
    kind = 'closed'
    or (start_min is not null and end_min is not null and end_min > start_min)
  )
);

create index if not exists booking_exceptions_event_day_idx
  on public.booking_exceptions (event_type_id, day);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Réservations
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.bookings (
  id             uuid primary key default gen_random_uuid(),
  event_type_id  uuid not null references public.booking_event_types(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,

  -- INSTANTS ABSOLUS. `ends_at` inclut la durée mais PAS le battement :
  -- le battement est une règle de disponibilité, pas une part du rendez-vous
  -- (il ne doit pas apparaître dans le .ics du visiteur).
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,

  -- Fuseau que le VISITEUR voyait au moment de réserver. Conservé pour lui
  -- réafficher, dans les e-mails et les rappels, l'heure qu'il a effectivement
  -- choisie — même s'il a changé d'appareil ou voyagé depuis.
  visitor_timezone text not null default 'Africa/Abidjan',
  -- Fuseau de l'hôte figé à la réservation : s'il le change ensuite, les RDV
  -- déjà pris gardent leur contexte d'origine.
  host_timezone    text not null default 'Africa/Abidjan',

  visitor_name   text not null,
  visitor_email  text not null,
  visitor_phone  text,
  note           text,

  status         text not null default 'confirmed'
                 check (status in ('confirmed', 'cancelled', 'no_show', 'completed')),

  -- Jeton d'annulation/report, envoyé au visiteur. Non devinable.
  manage_token   text not null default encode(gen_random_bytes(24), 'hex'),

  cancelled_at   timestamptz,
  cancelled_by   text check (cancelled_by in ('visitor', 'host')),
  cancel_reason  text,

  lead_id        uuid references public.leads(id) on delete set null,
  funnel_id      uuid references public.funnels(id) on delete set null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint bookings_range_ck check (ends_at > starts_at)
);

create index if not exists bookings_event_start_idx
  on public.bookings (event_type_id, starts_at);
create index if not exists bookings_user_start_idx
  on public.bookings (user_id, starts_at);
create unique index if not exists bookings_manage_token_uidx
  on public.bookings (manage_token);

-- ⚠️ GARDE ANTI-DOUBLE-RÉSERVATION — au niveau BASE, pas applicatif.
--
-- Deux visiteurs qui cliquent sur le même créneau à la même seconde passent
-- tous les deux la vérification applicative « ce créneau est-il libre ? »
-- avant que l'un des deux n'ait écrit. Seule une contrainte d'unicité rend la
-- course impossible. On indexe donc (type de RDV, instant de début) en
-- ignorant les réservations annulées, pour qu'un créneau libéré redevienne
-- réservable.
create unique index if not exists bookings_no_double_booking_uidx
  on public.bookings (event_type_id, starts_at)
  where status <> 'cancelled';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS
-- ─────────────────────────────────────────────────────────────────────────────
-- Les tables de CONFIGURATION appartiennent à l'hôte (4 policies owner).
-- La table `bookings` est écrite par la route publique de réservation, qui
-- utilise la clé de service : aucune policy d'INSERT public n'est exposée —
-- sinon n'importe qui pourrait forger une réservation pour autrui.

alter table public.booking_event_types  enable row level security;
alter table public.booking_availability enable row level security;
alter table public.booking_exceptions   enable row level security;
alter table public.bookings             enable row level security;

drop policy if exists booking_event_types_select_own on public.booking_event_types;
create policy booking_event_types_select_own on public.booking_event_types
  for select using (auth.uid() = user_id);
drop policy if exists booking_event_types_insert_own on public.booking_event_types;
create policy booking_event_types_insert_own on public.booking_event_types
  for insert with check (auth.uid() = user_id);
drop policy if exists booking_event_types_update_own on public.booking_event_types;
create policy booking_event_types_update_own on public.booking_event_types
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists booking_event_types_delete_own on public.booking_event_types;
create policy booking_event_types_delete_own on public.booking_event_types
  for delete using (auth.uid() = user_id);

-- Disponibilités et exceptions : propriété dérivée du type de RDV parent.
drop policy if exists booking_availability_all_own on public.booking_availability;
create policy booking_availability_all_own on public.booking_availability
  for all
  using (exists (
    select 1 from public.booking_event_types t
    where t.id = event_type_id and t.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.booking_event_types t
    where t.id = event_type_id and t.user_id = auth.uid()
  ));

drop policy if exists booking_exceptions_all_own on public.booking_exceptions;
create policy booking_exceptions_all_own on public.booking_exceptions
  for all
  using (exists (
    select 1 from public.booking_event_types t
    where t.id = event_type_id and t.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.booking_event_types t
    where t.id = event_type_id and t.user_id = auth.uid()
  ));

-- Réservations : l'hôte lit et modifie les siennes. Aucune écriture publique.
drop policy if exists bookings_select_own on public.bookings;
create policy bookings_select_own on public.bookings
  for select using (auth.uid() = user_id);
drop policy if exists bookings_update_own on public.bookings;
create policy bookings_update_own on public.bookings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists bookings_delete_own on public.bookings;
create policy bookings_delete_own on public.bookings
  for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. updated_at
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists booking_event_types_touch on public.booking_event_types;
create trigger booking_event_types_touch before update on public.booking_event_types
  for each row execute function public.touch_updated_at();

drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();
