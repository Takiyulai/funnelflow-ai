-- supabase/migrations/06_welcome_email.sql
--
-- 🆕 Garde anti-doublon de l'email de bienvenue.
--
-- POURQUOI UNE COLONNE ET PAS UN SIMPLE « if last_login_at is null ».
-- Le point d'accroche est le premier chargement du tableau de bord. En React
-- 18 en mode strict, un effet se déclenche DEUX FOIS en développement ; en
-- production, un rechargement pendant l'envoi rejouerait l'appel. Sans marqueur
-- dédié, l'utilisateur recevrait deux ou trois fois le même message.
--
-- La date sert aussi au diagnostic : « a-t-il reçu son mail, et quand ».
alter table public.users
  add column if not exists welcome_email_sent_at timestamptz;

comment on column public.users.welcome_email_sent_at is
  'Date d''envoi de l''email de bienvenue. NULL = jamais envoyé. Sert de verrou anti-doublon.';
