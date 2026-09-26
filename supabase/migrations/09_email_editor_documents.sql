-- Email Editor MVP — stockage hybride, rétrocompatible avec le HTML existant.
-- Migration additive uniquement : aucune donnée ni colonne existante supprimée.

alter table if exists public.crm_campaigns
  add column if not exists editor_document jsonb,
  add column if not exists editor_version integer,
  add column if not exists preheader text not null default '';

alter table if exists public.crm_sequence_emails
  add column if not exists editor_document jsonb,
  add column if not exists editor_version integer,
  add column if not exists preheader text not null default '';

comment on column public.crm_campaigns.editor_document is
  'Document structure canonique de l''éditeur email. NULL pour les campagnes legacy.';
comment on column public.crm_campaigns.editor_version is
  'Version du schéma editor_document.';
comment on column public.crm_campaigns.preheader is
  'Texte d''aperçu affiché par les clients email.';

comment on column public.crm_sequence_emails.editor_document is
  'Document structure canonique de l''éditeur email. NULL pour les emails legacy.';
comment on column public.crm_sequence_emails.editor_version is
  'Version du schéma editor_document.';
comment on column public.crm_sequence_emails.preheader is
  'Texte d''aperçu affiché par les clients email.';
