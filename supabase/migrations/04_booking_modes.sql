-- supabase/migrations/04_booking_modes.sql
--
-- 🆕 MODES DE RENDEZ-VOUS : consultation, event, classroom, recurring.
--
-- ── POURQUOI CE N'EST PAS QU'UNE ÉTIQUETTE ─────────────────────────────────
-- Jusqu'ici, un type de RDV était toujours la même chose : le client choisit
-- un créneau parmi les disponibilités de l'hôte, et un créneau accueille UNE
-- personne. Cette dernière garantie est structurelle — elle vient de l'index
-- unique `bookings_no_double_booking_uidx`, pas d'une règle applicative.
--
-- Deux besoins réels sortent de ce cadre :
--   • un ATELIER / WEBINAIRE : c'est l'hôte qui fixe la date, et 30 personnes
--     s'inscrivent au MÊME créneau ;
--   • un COURS HEBDOMADAIRE : même créneau, plusieurs participants, chaque
--     semaine.
--
-- Ces deux cas cassent l'index unique. Ils ne peuvent donc pas être un simple
-- préréglage : il faut que la contrainte d'unicité devienne CONDITIONNELLE.

-- ── 1. Mode du type de rendez-vous ─────────────────────────────────────────
-- `consultation` par défaut : tous les types existants gardent exactement le
-- comportement qu'ils ont aujourd'hui.
alter table public.booking_event_types
  add column if not exists mode text not null default 'consultation';

alter table public.booking_event_types
  drop constraint if exists booking_event_types_mode_check;

alter table public.booking_event_types
  add constraint booking_event_types_mode_check
  check (mode in ('consultation', 'event', 'classroom', 'recurring'));

comment on column public.booking_event_types.mode is
  'consultation = 1 personne, le client choisit son créneau. event = dates fixées par l''hôte, plusieurs inscrits. classroom = créneau hebdomadaire récurrent, plusieurs inscrits. recurring = 1 personne, créneau récurrent choisi par le client.';

-- ── 2. Capacité par créneau ────────────────────────────────────────────────
-- NULL = 1 (comportement historique). Une valeur > 1 n'a de sens que pour
-- `event` et `classroom`.
alter table public.booking_event_types
  add column if not exists capacity integer;

alter table public.booking_event_types
  drop constraint if exists booking_event_types_capacity_check;

alter table public.booking_event_types
  add constraint booking_event_types_capacity_check
  check (capacity is null or capacity between 1 and 10000);

comment on column public.booking_event_types.capacity is
  'Nombre de participants acceptés sur un même créneau. NULL = 1 (rendez-vous individuel).';

-- ── 3. Dates fixes, pour le mode `event` ───────────────────────────────────
-- Un atelier n'a pas de « disponibilités » : il a des SÉANCES, chacune avec sa
-- date et sa propre limite d'inscrits. Table dédiée plutôt qu'un jsonb : on
-- doit pouvoir compter les inscrits par séance, et donc joindre dessus.
create table if not exists public.booking_sessions (
  id uuid primary key default gen_random_uuid(),
  event_type_id uuid not null references public.booking_event_types(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Surcharge la capacité du type. NULL = on retombe sur event_types.capacity.
  capacity integer,
  created_at timestamptz not null default now(),
  constraint booking_sessions_time_check check (ends_at > starts_at)
);

create index if not exists booking_sessions_event_type_idx
  on public.booking_sessions (event_type_id, starts_at);

-- ── 4. Rattachement d'une réservation à une séance ─────────────────────────
alter table public.bookings
  add column if not exists session_id uuid references public.booking_sessions(id) on delete set null;

create index if not exists bookings_session_idx on public.bookings (session_id);

-- ── 5. L'unicité devient CONDITIONNELLE ────────────────────────────────────
--
-- ⚠️ C'EST LE CŒUR DE CETTE MIGRATION.
--
-- L'index actuel interdit deux réservations confirmées sur le même créneau,
-- sans condition. C'est ce qui protège un rendez-vous individuel de la double
-- réservation — et c'est aussi ce qui rend un atelier à 30 places impossible.
--
-- On le remplace par un index qui ne s'applique QU'AUX créneaux individuels,
-- identifiés par `session_id IS NULL`. Les inscriptions à une séance
-- (session_id renseigné) en sont exclues : leur limite est vérifiée par
-- comptage applicatif, puisqu'un index unique ne sait pas exprimer « au plus N ».
--
-- Le nom de l'ancien index est conservé au cas où il diffère : on tente les
-- deux graphies rencontrées dans le projet.
drop index if exists public.bookings_no_double_booking_uidx;
drop index if exists public.bookings_no_double_booking_idx;

create unique index if not exists bookings_no_double_booking_uidx
  on public.bookings (event_type_id, starts_at)
  where status = 'confirmed' and session_id is null;

comment on index public.bookings_no_double_booking_uidx is
  'Anti-double-réservation des créneaux INDIVIDUELS uniquement. Les inscriptions à une séance (session_id non nul) sont plafonnées par comptage applicatif.';
