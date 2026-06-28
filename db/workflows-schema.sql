-- db/workflows-schema.sql
-- 🆕 Moteur d'automatisation interne V1.
--
-- IMPORTANT : les tables `workflows` et `workflow_steps` EXISTENT DÉJÀ
-- (cf. supabase/schema.sql) avec leur RLS propriétaire. Aucune nouvelle table.
-- Ce fichier est OPTIONNEL et purement additif/idempotent : il ne fait
-- qu'ajouter un index de perf pour la requête du moteur. À exécuter dans
-- Supabase → SQL Editor si souhaité.
--
-- Modèle de données (rappel) :
--   workflows(id, user_id, name, status: draft|active|paused)
--   workflow_steps(id, workflow_id, type, position, config jsonb)
--     • type='trigger' , position=0 , config={ event:'lead.created', funnelId? }
--     • type='action'  , position≥1 , config={ kind, ... } où kind ∈
--         add_tag | set_status | enroll_in_sequence | notify_owner | wait
--
-- Emails (notify_owner / séquences enrôlées) : déposés dans la file EXISTANTE
-- `scheduled_emails` (source_type='workflow') et envoyés par le cron déjà en
-- place — aucune table ni planificateur supplémentaire.
-- ─────────────────────────────────────────────────────────────────────────────

-- Index : le moteur charge "workflows actifs d'un user" à chaque lead capturé.
create index if not exists workflows_user_status_idx
  on public.workflows (user_id, status);
