-- supabase/migrations/07_security_hardening.sql
--
-- 🔒 Durcissement issu de l'audit du 18 août 2026.
--
-- Deux blocs, de nature TRÈS DIFFÉRENTE — les confondre conduirait à appliquer
-- le second sans réfléchir, ou à repousser le premier :
--
--   • BLOC 1 = CORRECTIF DE SÉCURITÉ. Des fonctions `SECURITY DEFINER` sont
--     appelables en RPC par des rôles qui n'ont aucune raison de les invoquer.
--     C'est le seul bloc qui ferme une exposition réelle.
--
--   • BLOC 2 = HYGIÈNE. Fige le `search_path` de 9 fonctions signalées par le
--     linter Supabase. Ces 9 fonctions ne sont PAS `SECURITY DEFINER`
--     (`pg_proc.prosecdef = false`, vérifié en base le 18/08/2026) : elles
--     s'exécutent avec les droits de l'appelant. Détourner leur résolution de
--     noms ne donne donc accès à rien de plus que ce que l'appelant possède
--     déjà. Ce n'est PAS un vecteur d'élévation de privilèges — une version
--     antérieure de cet en-tête l'affirmait à tort. C'est de la défense en
--     profondeur : utile, non urgent.
--
-- ⚠️ CETTE MIGRATION N'EST PAS COUVERTE PAR UN PREVIEW VERCEL.
-- Un preview déploie du code, pas un schéma : il pointe vers la MÊME base que
-- la production. Appliquer ce fichier touche donc la prod immédiatement.
--
-- Les deux blocs sont idempotents et rejouables sans risque.


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 1 — CORRECTIF DE SÉCURITÉ
-- Retirer l'exécution RPC des fonctions `SECURITY DEFINER`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- PostgREST expose toute fonction de `public` sur /rest/v1/rpc/<nom>. Une
-- fonction `SECURITY DEFINER` s'exécute avec les droits de son PROPRIÉTAIRE :
-- l'exposer à `anon` ou `authenticated`, c'est offrir ces droits à qui sait
-- construire une requête HTTP.
--
-- Quatre fonctions concernées :
--
--   `rls_auto_enable`        — manipule des politiques RLS, appelable SANS
--                              être connecté. La plus grave.
--   `handle_new_user`        — fonction de trigger (création de profil).
--   `log_custom_code_audit`  — fonction de trigger (journal d'audit).
--   `consume_usage`          — décompte de quotas, exposée à `authenticated`.
--                              Un utilisateur connecté peut donc l'invoquer
--                              directement, avec les paramètres de son choix —
--                              y compris `p_user` et `p_amount`.
--
-- ── ⚠️ RÉVOQUER `PUBLIC`, PAS SEULEMENT `anon` ET `authenticated` ──────────
--
-- Erreur commise lors de la première application, le 18/08/2026, et rattrapée
-- par la requête de vérification — elle est consignée ici pour qu'elle ne soit
-- pas refaite.
--
-- PostgreSQL accorde `EXECUTE` à `PUBLIC` par défaut sur TOUTE fonction créée.
-- Un `revoke ... from anon, authenticated` ne retire que les grants DIRECTS :
-- les deux rôles conservent le droit par héritage de `PUBLIC`, et la fonction
-- reste appelable. La migration renvoyait pourtant `success` — d'où
-- l'importance de vérifier l'ÉTAT, jamais le code retour.
--
-- Trois des quatre fonctions étaient dans ce cas. Seule `consume_usage` avait
-- été réellement fermée, parce que sa migration d'origine contenait déjà un
-- `revoke from public`.
--
-- On révoque donc `PUBLIC` d'abord — c'est la ligne qui fait le travail — puis
-- `anon, authenticated` pour couvrir un éventuel grant direct posé ailleurs.
--
-- ── POURQUOI CE REVOKE NE CASSE RIEN ───────────────────────────────────────
--
-- 1) Les fonctions de trigger : PostgreSQL ne vérifie PAS le droit EXECUTE
--    quand une fonction est appelée par un trigger. Le trigger
--    `on_auth_user_created` continue donc de créer les profils à l'identique.
--
-- 2) `consume_usage` : VÉRIFIÉ dans le dépôt. Un seul appel,
--    `lib/billing/usage.ts:46`, et il passe par `getSupabaseAdmin()`
--    (ligne 44) — donc par la `service_role`, qui contourne les grants. Le
--    décompte de quotas est intact. Aucun appel depuis le navigateur.
--
-- 3) `service_role` et le propriétaire du schéma contournent les grants : les
--    routes serveur ne sont pas concernées.
--
-- Seul l'appel direct par l'API publique (/rest/v1/rpc/…) est fermé.

do $$
declare
  fn record;
  n int := 0;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.prosecdef                                   -- SECURITY DEFINER seulement
      and p.proname in (
        'rls_auto_enable',
        'handle_new_user',
        'log_custom_code_audit',
        'consume_usage'
      )
  loop
    -- L'ordre compte pour la lecture, pas pour le résultat : `public` porte le
    -- droit hérité, les deux autres d'éventuels grants explicites.
    execute format('revoke execute on function %s from public', fn.sig);
    execute format('revoke execute on function %s from anon, authenticated', fn.sig);
    raise notice '[07/bloc1] EXECUTE révoqué (public, anon, authenticated) sur %', fn.sig;
    n := n + 1;
  end loop;

  raise notice '[07/bloc1] % fonction(s) révoquée(s).', n;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 2 — HYGIÈNE
-- Figer le `search_path` des 9 fonctions signalées par le linter
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Une fonction dont le `search_path` n'est pas fixé résout ses noms de tables
-- selon le search_path de l'APPELANT. Sur ces 9 fonctions — toutes en
-- `SECURITY INVOKER` — le risque est limité : elles tournent déjà avec les
-- droits de l'appelant. Figer le chemin supprime néanmoins une classe de
-- comportements surprenants, et fait taire le linter.
--
-- `pg_temp` est placé en DERNIER volontairement. En tête, un attaquant
-- pourrait créer une table temporaire homonyme et la faire résoudre avant la
-- vraie — exactement ce qu'on veut éviter.
--
-- ── POURQUOI UNE BOUCLE PLUTÔT QUE 9 `ALTER FUNCTION` ──────────────────────
-- `alter function` exige la signature complète des arguments. Les écrire à la
-- main, c'est risquer une migration qui échoue sur une virgule. La boucle
-- résout les signatures depuis le catalogue, et ignore proprement une fonction
-- absente ou déjà corrigée.
--
-- Quatre de ces fonctions sont appelées en RPC par l'application
-- (`funnel_stats_v1`, `campaign_email_stats_v1`, `sequence_email_stats_v1`,
-- `ab_test_stats_v1`) : elles ne sont donc PAS révoquées, seulement durcies.

do $$
declare
  fn record;
  n int := 0;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.proname in (
        'set_updated_at',
        'touch_updated_at',
        'user_licenses_set_updated_at',
        'cinetpay_license_transactions_set_updated_at',
        'funnel_stats_v1',
        'campaign_email_stats_v1',
        'sequence_email_stats_v1',
        'ab_test_stats_v1',
        'list_orphan_media_v1'
      )
      and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path%'
  loop
    execute format('alter function %s set search_path = public, pg_temp', fn.sig);
    raise notice '[07/bloc2] search_path figé sur %', fn.sig;
    n := n + 1;
  end loop;

  raise notice '[07/bloc2] % fonction(s) corrigée(s).', n;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS APPLICATION — doit renvoyer 0 ligne
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `has_function_privilege()` évalue le droit EFFECTIF : il tient compte de
-- l'héritage via `PUBLIC` et via l'appartenance aux rôles. C'est exactement ce
-- qu'il faut ici — un contrôle qui lirait `pg_proc.proacl` à la main
-- manquerait le grant hérité, c'est-à-dire précisément le cas qui a échappé à
-- la première application.
--
--   select p.proname,
--          p.prosecdef,
--          has_function_privilege('anon', p.oid, 'execute')          as anon,
--          has_function_privilege('authenticated', p.oid, 'execute') as auth,
--          coalesce(array_to_string(p.proconfig, ','), '(aucun)')    as config
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and (
--       (p.prosecdef and (has_function_privilege('anon', p.oid, 'execute')
--                      or has_function_privilege('authenticated', p.oid, 'execute')))
--       or (p.proname in ('set_updated_at','touch_updated_at',
--                         'user_licenses_set_updated_at',
--                         'cinetpay_license_transactions_set_updated_at',
--                         'funnel_stats_v1','campaign_email_stats_v1',
--                         'sequence_email_stats_v1','ab_test_stats_v1',
--                         'list_orphan_media_v1')
--           and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path%')
--     );
--
-- Puis relancer le linter : Dashboard → Advisors → Security.
