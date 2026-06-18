-- db/funnels-rls-fix.sql
-- Corrige la publication 404 + les tunnels supprimés qui réapparaissent.
-- Cause : la table public.funnels accepte la LECTURE mais refuse les ÉCRITURES
-- (UPDATE pour publier, DELETE pour supprimer) → RLS incomplet. Possiblement
-- aussi des colonnes de publication manquantes.
--
-- À exécuter dans Supabase → SQL Editor. 100% idempotent (ré-exécutable sans
-- risque). Ne touche à AUCUNE donnée existante.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Colonnes de publication (au cas où elles manqueraient sur une vieille table)
alter table public.funnels add column if not exists status text not null default 'draft';
alter table public.funnels add column if not exists published_slug text;
alter table public.funnels add column if not exists published_content jsonb;
alter table public.funnels add column if not exists published_at timestamptz;

-- 2) RLS activé + politiques par propriétaire (auth.uid() = user_id)
alter table public.funnels enable row level security;

drop policy if exists "funnels_select_own" on public.funnels;
create policy "funnels_select_own" on public.funnels
  for select using (auth.uid() = user_id);

drop policy if exists "funnels_insert_own" on public.funnels;
create policy "funnels_insert_own" on public.funnels
  for insert with check (auth.uid() = user_id);

drop policy if exists "funnels_update_own" on public.funnels;
create policy "funnels_update_own" on public.funnels
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "funnels_delete_own" on public.funnels;
create policy "funnels_delete_own" on public.funnels
  for delete using (auth.uid() = user_id);

-- 3) (Optionnel — à activer plus tard) Lecture PUBLIQUE des tunnels publiés,
--    pour que des visiteurs NON connectés voient /tunnel/<slug>.
--    ⚠️ Cette politique exposerait aussi json_content (brouillon) en lecture
--    anonyme. On la laisse commentée : on la remplacera par une vue/RPC qui
--    n'expose QUE published_content. Décommente seulement pour un test rapide.
-- drop policy if exists "funnels_public_published_select" on public.funnels;
-- create policy "funnels_public_published_select" on public.funnels
--   for select using (status = 'published');

-- ─────────────────────────────────────────────────────────────────────────────
-- DIAGNOSTIC (exécute ces 2 requêtes pour vérifier l'état si besoin) :
--
-- Colonnes présentes :
--   select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'funnels' order by ordinal_position;
--
-- Politiques RLS présentes :
--   select policyname, cmd, qual, with_check from pg_policies
--   where schemaname = 'public' and tablename = 'funnels';
-- ─────────────────────────────────────────────────────────────────────────────
