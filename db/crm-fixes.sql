-- ============================================================================
-- FunnelFlow AI — CRM correctifs
-- À EXÉCUTER dans l'éditeur SQL Supabase (après db/crm-schema.sql).
-- ============================================================================

-- Un contact créé manuellement (ou via n8n) n'a pas de tunnel d'origine :
-- funnel_id doit pouvoir être NULL.
alter table public.leads
  alter column funnel_id drop not null;
