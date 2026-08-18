-- supabase/migrations/07_security_hardening.sql
--
-- 🔒 Durcissement issu de l'audit du 18 août 2026.
-- Deux corrections, toutes deux remontées par le linter Supabase.
--
-- ⚠️ CETTE MIGRATION N'EST PAS COUVERTE PAR LE PREVIEW VERCEL.
-- Un preview déploie du code, pas un schéma : il pointe vers la MÊME base que
-- la production. Appliquer ce fichier touche donc la prod immédiatement, quelle
-- que soit la branche. À exécuter sciemment, après lecture — pas « en même
-- temps que le merge ».
--
-- Les deux blocs sont idempotents et rejouables sans risque.


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. RETIRER L'EXÉCUTION RPC DES FONCTIONS `SECURITY DEFINER`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- PostgREST expose toute fonction de `public` sur /rest/v1/rpc/<nom>. Ces trois
-- fonctions sont des fonctions de TRIGGER ou d'administration : rien ne
-- justifie qu'un visiteur anonyme puisse les appeler à la main.
--
-- La plus préoccupante est `rls_auto_enable()` — une fonction qui manipule des
-- politiques RLS, accessible sans être connecté.
--
-- ── POURQUOI CE REVOKE NE CASSE RIEN ───────────────────────────────────────
-- PostgreSQL ne vérifie PAS le droit EXECUTE lorsqu'une fonction est appelée
-- par un trigger : c'est le propriétaire de la table qui l'exécute. Le trigger
-- `on_auth_user_created` continue donc de créer les profils exactement comme
-- avant. Seul l'appel direct par l'API est fermé.
--
-- ── CE QUI N'EST VOLONTAIREMENT PAS TOUCHÉ ─────────────────────────────────
-- `consume_usage(...)` est également signalée par le linter comme appelable par
-- le rôle `authenticated`. Elle N'EST PAS révoquée ici : c'est une fonction de
-- comptage de quotas, potentiellement appelée en RPC par l'application. La
-- révoquer à l'aveugle casserait le décompte d'usage. À trancher séparément,
-- après avoir vérifié si le code l'appelle via `.rpc('consume_usage')`.

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef                                   -- SECURITY DEFINER seulement
      and p.proname in ('rls_auto_enable', 'handle_new_user', 'log_custom_code_audit')
  loop
    execute format('revoke execute on function %s from anon, authenticated', fn.sig);
    raise notice '[07] EXECUTE révoqué (anon, authenticated) sur %', fn.sig;
  end loop;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. FIGER LE `search_path` DES FONCTIONS SIGNALÉES
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Une fonction dont le `search_path` n'est pas fixé résout ses noms de tables
-- selon le search_path de l'APPELANT. Sur une fonction `SECURITY DEFINER`,
-- c'est un vecteur d'élévation de privilèges connu : un utilisateur crée un
-- schéma contenant une table homonyme, le place en tête de son search_path, et
-- la fonction privilégiée travaille sur SA table.
--
-- `pg_temp` est placé en DERNIER volontairement. S'il venait en premier, un
-- attaquant pourrait créer une table temporaire homonyme et la faire résoudre
-- avant la vraie — exactement l'attaque qu'on cherche à fermer.
--
-- ── POURQUOI UNE BOUCLE PLUTÔT QUE 9 `ALTER FUNCTION` ──────────────────────
-- `alter function` exige la signature complète des arguments. Les écrire à la
-- main, c'est risquer une migration qui échoue sur une virgule. La boucle
-- résout les signatures depuis le catalogue (`oid::regprocedure`), et ignore
-- proprement une fonction absente ou déjà corrigée.
--
-- NOTE — l'audit mentionnait « 8 fonctions ». Le linter Supabase en liste
-- 9 ; c'est le chiffre retenu ici. La liste ci-dessous est celle du linter.

do $$
declare
  fn record;
  n int := 0;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n2 on n2.oid = p.pronamespace
    where n2.nspname = 'public'
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
      -- Ne pas retoucher celles qui le définissent déjà.
      and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path%'
  loop
    execute format('alter function %s set search_path = public, pg_temp', fn.sig);
    raise notice '[07] search_path figé sur %', fn.sig;
    n := n + 1;
  end loop;

  raise notice '[07] % fonction(s) corrigée(s).', n;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS APPLICATION
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Ne renvoie plus AUCUNE ligne quand la migration a fait son travail :
--
--   select p.proname,
--          has_function_privilege('anon', p.oid, 'execute') as anon_peut,
--          coalesce(array_to_string(p.proconfig, ','), '(aucun)') as config
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.prosecdef
--     and (has_function_privilege('anon', p.oid, 'execute')
--          or coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path%')
--     and p.proname <> 'consume_usage';
--
-- Puis relancer le linter : Dashboard → Advisors → Security.
