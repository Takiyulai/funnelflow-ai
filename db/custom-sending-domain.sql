-- ============================================================================
-- AutoFunnel AI — DOMAINE D'ENVOI PERSONNALISÉ (module premium)
-- À EXÉCUTER dans l'éditeur SQL de Supabase (Dashboard → SQL Editor).
--
-- CONTEXTE. Les colonnes `custom_email_from`, `custom_email_domain` et
-- `custom_email_status` existent DÉJÀ et sont lues par
-- `lib/email/userSender.ts` : dès que le statut vaut 'verified', les emails
-- marketing partent de l'adresse du client au lieu du domaine partagé
-- d'AutoFunnel. Ce qui manquait, c'est de quoi PILOTER la vérification.
--
-- Les trois colonnes ajoutées ici servent uniquement à ça :
--   • `custom_email_domain_id`  — identifiant du domaine chez Resend. Sans lui,
--     impossible de relancer une vérification ni de supprimer le domaine : on
--     ne saurait plus de quel objet distant on parle.
--   • `custom_email_records`    — les enregistrements DNS renvoyés par Resend
--     (SPF, DKIM, DMARC). Stockés parce que l'utilisateur doit pouvoir les
--     retrouver plus tard, quand il ouvrira enfin l'interface de son
--     registrar — souvent plusieurs jours après.
--   • `custom_email_checked_at` — date de la dernière vérification, pour
--     afficher « vérifié il y a 3 minutes » plutôt qu'un statut sans âge.
--
-- Idempotent : `add column if not exists` permet de rejouer le script.
-- Aucune policy à ajouter — `profiles` est déjà protégée en RLS (lecture de
-- sa propre ligne uniquement, écritures réservées au service role).
-- ============================================================================

alter table public.profiles
  add column if not exists custom_email_domain_id  text,
  add column if not exists custom_email_records    jsonb,
  add column if not exists custom_email_checked_at timestamptz;

-- Un même domaine ne peut être revendiqué que par UN compte : chez Resend, un
-- nom de domaine est unique pour toute l'organisation. Sans cette contrainte,
-- deux utilisateurs pourraient enregistrer « client.com » en base, et le
-- second échouerait côté Resend avec un message incompréhensible — ou pire,
-- récupérerait le domaine du premier.
create unique index if not exists profiles_custom_email_domain_uk
  on public.profiles (lower(custom_email_domain))
  where custom_email_domain is not null;
