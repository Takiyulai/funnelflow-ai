-- ============================================================================
-- AutoFunnel AI — LISTES DE CONTACTS
-- À EXÉCUTER dans l'éditeur SQL de Supabase (Dashboard → SQL Editor).
--
-- POURQUOI UNE ENTITÉ SÉPARÉE DES TAGS ?
--   Un tag est une étiquette libre, posée à la main, qui décrit une QUALITÉ du
--   contact (« chaud », « a demandé un devis »). Une liste décrit sa PROVENANCE :
--   d'où vient ce paquet de contacts, quand, et combien étaient dedans.
--
--   Concrètement, l'import CSV avait un angle mort : des contacts arrivaient
--   sans tunnel associé et se noyaient parmi les leads capturés par les
--   tunnels, sans moyen de les retrouver ensemble. La liste est l'objet qui
--   rend ce lot identifiable — d'où les colonnes `origin`, `source_label` et
--   `imported_at`, qu'un simple tag ne porterait pas.
--
-- RELATION N-N assumée : un contact importé deux fois (deux salons, deux
-- campagnes) doit apparaître dans les DEUX listes. Une colonne `list_id` sur
-- `leads` écraserait la première appartenance à chaque nouvel import.
--
-- RLS : mêmes règles que le reste du CRM — chacun ne voit que ses lignes.
-- Les écritures serveur passent par le client de SESSION (RLS active) ; le
-- client admin n'est PAS utilisé ici, l'import reste dans le périmètre du
-- propriétaire.
-- ============================================================================

-- 1) LISTES
create table if not exists public.crm_lists (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  description  text,
  -- 'import' (fichier CSV/Excel) | 'manuel' (créée depuis l'interface)
  origin       text not null default 'manuel',
  -- Libellé libre de provenance, repris dans leads.source : « salon-cotonou »,
  -- « webinaire-mars ». Sert à tracer l'origine hors de tout tunnel.
  source_label text,
  color        text not null default '#6D5DF6',
  -- Date du dernier import ayant alimenté la liste (null si liste manuelle).
  imported_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- Unicité insensible à la casse, comme crm_tags : évite « Salon » + « salon ».
create unique index if not exists crm_lists_user_name_uk
  on public.crm_lists (user_id, lower(name));
create index if not exists crm_lists_user_idx on public.crm_lists (user_id);

-- 2) RELATION Contact <-> Liste (N-N)
create table if not exists public.crm_contact_lists (
  contact_id uuid not null references public.leads(id)      on delete cascade,
  list_id    uuid not null references public.crm_lists(id)  on delete cascade,
  user_id    uuid not null references auth.users(id)        on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, list_id)
);
create index if not exists crm_contact_lists_list_idx on public.crm_contact_lists (list_id);
create index if not exists crm_contact_lists_user_idx on public.crm_contact_lists (user_id);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.crm_lists         enable row level security;
alter table public.crm_contact_lists enable row level security;

-- `drop policy if exists` d'abord : rend le script rejouable sans erreur
-- « policy already exists » si on le passe deux fois.
drop policy if exists "crm_lists_owner" on public.crm_lists;
create policy "crm_lists_owner" on public.crm_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "crm_contact_lists_owner" on public.crm_contact_lists;
create policy "crm_contact_lists_owner" on public.crm_contact_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
