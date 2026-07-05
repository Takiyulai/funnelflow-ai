-- ============================================================
-- AutoFunnel AI - Sprint A : Enrichissement table leads
-- ============================================================
-- Migration additive : ajoute colonnes de traçabilité +
-- anti-spam léger + index de performance pour le dashboard.

-- ------------------------------------------------------------
-- 1. Nouvelles colonnes sur leads
-- ------------------------------------------------------------
alter table public.leads
  add column if not exists page_slug text,
  add column if not exists section_id text,
  add column if not exists ip_hash text,
  add column if not exists user_agent text,
  add column if not exists consent boolean not null default false,
  add column if not exists language text;

-- Rendre `name` nullable (certains formulaires n'ont qu'un email)
alter table public.leads
  alter column name drop not null;

-- ------------------------------------------------------------
-- 2. Index pour le dashboard (liste paginée + filtres)
-- ------------------------------------------------------------
create index if not exists leads_funnel_created_idx
  on public.leads(funnel_id, created_at desc);

create index if not exists leads_user_created_idx
  on public.leads(user_id, created_at desc);

create index if not exists leads_status_idx
  on public.leads(status);

create index if not exists leads_page_slug_idx
  on public.leads(funnel_id, page_slug);

-- ------------------------------------------------------------
-- 3. Policy d'insertion publique : on garde l'esprit existant
--    (le user_id doit correspondre au propriétaire du funnel
--     ET le funnel doit être publié)
--    Pas de changement structurel : la policy existante suffit.
-- ------------------------------------------------------------
-- (Note : l'API utilisera service_role et bypassera RLS,
--  mais on garde la policy en filet de sécurité.)
