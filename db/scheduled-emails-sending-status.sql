-- 🆕 CORRECTIF EMAILS — Ajoute le statut transitoire 'sending' à la file
-- d'envoi. Utilisé comme « claim » atomique par lib/crm/deliverScheduled.ts
-- pour éviter tout double envoi quand le cron et l'envoi immédiat (post-
-- capture de lead) se chevauchent. Non destructif : les valeurs existantes
-- restent valides.

alter table public.scheduled_emails
  drop constraint if exists scheduled_emails_status_check;

alter table public.scheduled_emails
  add constraint scheduled_emails_status_check
  check (status in ('pending', 'sending', 'sent', 'failed', 'canceled'));
