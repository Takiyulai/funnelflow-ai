-- db/sequences-roles-migration.sql
-- 🆕 LOT 1 — Refonte génération séquences : plusieurs rôles ordonnés au lieu
-- d'un type unique + un nombre de mails. Ajoute une colonne `roles` (jsonb,
-- tableau ordonné de { id, label? }) SANS toucher à `type` (conservé pour
-- rétrocompat/affichage : type = roles[0].id).
-- À exécuter dans Supabase → SQL Editor. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.crm_sequences
  add column if not exists roles jsonb;

comment on column public.crm_sequences.roles is
  'Liste ORDONNÉE des rôles de la séquence (1 rôle = 1 mail), ex: [{"id":"bienvenue"},{"id":"autre","label":"Étude de cas"}]. NULL sur les séquences créées avant le Lot 1 (retomber sur [{"id": type}] côté appli).';
