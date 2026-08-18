# Audit de sécurité — AutoFunnel AI

**Date :** 18 août 2026 · **Projet Supabase :** `xhjhdheskjwbmdjzazoq` (eu-central-1)
**Nature :** lecture seule. Aucun fichier modifié, aucune donnée écrite.
**Secrets :** aucun secret n'est reproduit dans ce rapport — uniquement les noms
de variables et leur lieu de lecture.

---

## Tableau récapitulatif

| # | Point | Statut | Preuve | Recommandation |
|---|---|---|---|---|
| 1 | Rate limiting login | ⚠️ | `components/auth/AuthForm.tsx:10-12` — le code ne fait que *traduire* l'erreur « rate limit » de Supabase | Aucune limite applicative. On dépend entièrement des quotas Supabase Auth. Ajouter un limiteur par IP dans `middleware.ts` |
| 2 | Hachage mots de passe | ✅ | `AuthForm.tsx:73,86` — `signInWithPassword` / `signUp` uniquement. Aucune table applicative ne porte de colonne mot de passe | RAS. Les mots de passe ne transitent jamais par notre code |
| 3 | Expiration sessions | ❓ | Non lisible via MCP | À relever dans Dashboard → Auth → Sessions (JWT expiry, refresh rotation) |
| 4 | Confirmation email | ⚠️ | `auth.users` : 10 comptes, **2 non confirmés**, 8 confirmés (6 via Google, auto-confirmés) | La confirmation semble active. Mais `AuthForm.tsx:94-95` redirige vers `/dashboard` **sans vérifier qu'une session existe** — écran incohérent pour l'inscrit non confirmé |
| 5 | Message d'erreur login unique | ✅ / ⚠️ | `AuthForm.tsx:13-15` → « Email ou mot de passe incorrect » ✅ | **Mais `:16-18` renvoie « Cet email est déjà utilisé »** → énumération de comptes via le formulaire d'inscription |
| 6 | RLS | ✅ | 45/45 tables de `public` ont RLS actif (requête `pg_class.relrowsecurity`) | Aucune table sensible exposée. Voir détail ci-dessous |
| 7 | Droits vérifiés côté serveur | ✅ | RLS actif partout + routes authentifiées (`requireUser()` dans `app/api/booking/event-types/route.ts:16-22,121`) | Modèle à deux niveaux : RLS en base + contrôle en route |
| 8 | Clés Supabase / secrets | ✅ | Seuls `NEXT_PUBLIC_` : `APP_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `STRIPE_PUBLISHABLE_KEY`, `SENTRY_DSN`, `BASE_URL`, `SITE_URL` | Aucun secret préfixé `NEXT_PUBLIC_`. `SUPABASE_SERVICE_ROLE_KEY` lue uniquement côté serveur (`lib/supabase/admin.ts`) et scripts |
| 9 | Validation des entrées | ✅ | Zod présent sur les routes de mutation, ex. `app/api/booking/event-types/route.ts:41-118` (schéma exhaustif) | Bon niveau. Voir réserve ci-dessous sur les clés absentes du schéma |
| 10 | Taille max upload | ✅ | `app/api/media/upload/route.ts:19` — `MAX_FILE_SIZE = 15 Mo`, vérifié `:107` | RAS |
| 11 | Types de fichiers | ⚠️ | `app/api/media/upload/route.ts:20-36` — allowlist présente, **mais contient `image/svg+xml`** | Un SVG peut embarquer `<script>`. Voir analyse ci-dessous |
| 12 | HTTPS | ✅ | Aucun `http://` en dur dans les appels sortants. Vercel force HTTPS | RAS |
| 13 | CORS | ✅ | **Aucun `Access-Control-Allow-Origin` dans tout le dépôt** | Les routes API Next sont same-origin par défaut. L'absence de configuration est ici l'état sûr |
| 14 | Signatures webhooks | ⚠️ | Stripe ✅ (`app/api/stripe/webhook/route.ts`). Chariow : pas de signature — token en query documenté `app/api/webhooks/chariow/route.ts:7-9` | Chariow ne signe pas ses Pulses. Le token en URL fuite dans les logs |
| 15 | Erreurs génériques en prod | ⚠️ | `AuthForm.tsx:26` — `return message` renvoie l'erreur Supabase brute en repli ; `:24` cite des noms de variables d'env | Normaliser le repli sur un message générique |
| 16 | `console.log` sensibles | ✅ / ⚠️ | 4 occurrences seulement. Clés jamais loggées : seul le *nom* de la variable l'est (`lib/scraping/index.ts:68`, `lib/clone/fetcher.ts:130`). Clé de licence tronquée (`chariow/route.ts:98`) | **Une seule réserve** : `lib/platform/emails.ts:188` logge l'email complet du destinataire (donnée personnelle) |
| 17 | Dépendances à jour | ❓ | `npm audit` non exécutable — environnement Linux indisponible (`HYPERVISOR_VIRT_DISABLED`) | À lancer localement, voir commandes ci-dessous |
| 18 | Sauvegardes base | ❓ | Non lisible via MCP | Dashboard → Database → Backups |

---

## Détail RLS (point 6)

**45 tables sur 45 ont RLS actif.** Aucune table sensible n'est exposée.

Répartition des policies :

| Policies | Tables |
|---:|---|
| 5 | `funnels`, `shared_templates` |
| 4 | `booking_event_types`, `funnel_ab_tests`, `lead_custom_field_defs` |
| 3 | `bookings`, `template_likes` |
| 2 | `leads` |
| 1 | 35 tables, dont `users`, `orders`, `user_licenses`, `cinetpay_license_transactions`, `scheduled_emails` |
| **0** | `custom_code_audit`, `orphan_media_queue`, `workflow_pending_runs` |

**Les trois tables à zéro policy ne sont pas une faille.** RLS actif sans policy
signifie *refus par défaut* pour `anon` et `authenticated` : personne ne peut
rien lire ni écrire via l'API publique. Seule la `service_role` y accède, ce qui
correspond à leur usage (journal d'audit, file de purge, file de workflows).
Supabase les remonte en `INFO`, pas en `WARN` — c'est un rappel, pas une alerte.

**Rappel utile :** `published_content` n'est pas une table mais une colonne
`jsonb` de `funnels`. Elle hérite donc des 5 policies de `funnels`.

---

## Problèmes prioritaires

### 🔴 Critique

**Aucun.** Aucun secret exposé, aucune table sans RLS, aucune route de mutation
sans contrôle d'accès, aucun CORS ouvert. C'est un résultat solide.

### ⚠️ Moyens — à traiter

**1. Énumération de comptes au formulaire d'inscription**
`components/auth/AuthForm.tsx:16-18`
Le login est irréprochable (« Email ou mot de passe incorrect »), mais
l'inscription répond « Cet email est déjà utilisé ». Un attaquant teste une
liste d'emails et sait lesquels ont un compte — première étape d'une attaque
ciblée par mot de passe.
*Correction :* message identique dans les deux cas (« Si un compte existe, un
email vient d'être envoyé »), et laisser Supabase gérer le renvoi.
*Réserve :* c'est un arbitrage UX/sécurité réel. Le message actuel aide
l'utilisateur légitime qui a oublié qu'il avait un compte.

**2. `image/svg+xml` dans l'allowlist d'upload**
`app/api/media/upload/route.ts:26`
Un SVG est un document XML qui peut contenir `<script>`. Un utilisateur peut
donc téléverser du JavaScript exécutable.
*Ce qui limite la portée :* les fichiers partent sur Cloudinary
(`res.cloudinary.com`), une origine distincte de l'application. Un script qui s'y
exécuterait n'aurait accès ni aux cookies ni au `localStorage` d'AutoFunnel.
Le risque réel est donc le phishing hébergé, pas le vol de session.
*Correction :* retirer `image/svg+xml`, ou assainir le SVG avant envoi.

**3. Webhook Chariow authentifié par un token en URL**
`app/api/webhooks/chariow/route.ts:7-9`
Chariow ne signe pas ses Pulses — le choix d'un token en query est donc
contraint, et la re-validation systématique de la licence via leur API est une
bonne compensation. Mais une URL complète apparaît dans les journaux d'accès,
les en-têtes `Referer` et l'historique des proxys.
*Non vérifié :* je n'ai pas relu la ligne qui applique le contrôle, seulement
l'en-tête qui le documente. **À confirmer avant de clore ce point.**
*Correction :* passer le token en en-tête HTTP si Chariow le permet, et le faire
tourner.

**4. Fonctions `SECURITY DEFINER` appelables par `anon` / `authenticated`**
Advisor Supabase — `handle_new_user()`, `log_custom_code_audit()`,
`rls_auto_enable()` sont exposées via `/rest/v1/rpc/…` au rôle anonyme,
et `consume_usage(...)` au rôle authentifié.

`rls_auto_enable()` est la plus préoccupante : une fonction qui manipule des
politiques RLS ne devrait être appelable par personne depuis l'API publique.

**Ajout du 18/08/2026 — `consume_usage(...)` doit être révoquée aussi.**
Elle était laissée de côté par prudence, faute de savoir si l'application
l'appelait en RPC. Vérification faite : un seul appel dans tout le dépôt,
`lib/billing/usage.ts:46`, via `getSupabaseAdmin()` (ligne 44) — donc par la
`service_role`, qui contourne les grants. La révoquer ne casse rien.
Or elle est `SECURITY DEFINER` et exposée à `authenticated` : tout utilisateur
connecté peut l'invoquer directement avec les paramètres de son choix, dont
`p_user` et `p_amount`. C'est une exposition de la mécanique de quotas.

*Correction :* voir `supabase/migrations/07_security_hardening.sql`, bloc 1.

**5. Protection « mots de passe compromis » désactivée**
Advisor Supabase — la vérification HaveIBeenPwned est inactive.
*Correction :* Dashboard → Auth → Passwords → activer. Une case à cocher.

**6. Redirection après inscription sans session**
`components/auth/AuthForm.tsx:94-95` — `router.push()` est appelé sans vérifier
qu'une session a été créée. Si la confirmation email est active, l'inscrit
atterrit sur `/dashboard` sans être connecté.

### 🟢 Améliorations

- **`search_path` mutable sur 9 fonctions** (advisor Supabase).
  **Correction du 18/08/2026, après vérification en base :** ces 9 fonctions ne
  sont **pas** `SECURITY DEFINER` (`pg_proc.prosecdef = false`). Elles
  s'exécutent avec les droits de l'appelant : détourner leur résolution de noms
  ne donne accès à rien de plus. Ce n'est donc **pas** un vecteur d'élévation de
  privilèges, contrairement à ce que la première version de ce rapport
  affirmait. Défense en profondeur, rétrogradé de ⚠️ à 🟢.
  Symétriquement, les 3 fonctions qui *sont* `SECURITY DEFINER` avaient déjà un
  `search_path` défini — elles n'ont jamais eu ce problème.
  Correction : `alter function … set search_path = public, pg_temp;`
- **Erreur Supabase brute renvoyée en repli** — `AuthForm.tsx:26`.
- **Email complet dans les logs** — `lib/platform/emails.ts:188`. Tronquer, ou
  ne logger que l'identifiant Resend.
- **Noms de variables d'env dans un message utilisateur** — `AuthForm.tsx:24`.
  Sans gravité, mais ce message n'a rien à faire devant un client.
- **Pas de rate limiting applicatif** — on dépend des quotas Supabase, qui
  protègent le service mais pas nécessairement un compte ciblé.
- **Réserve sur la validation Zod** — les schémas sont exhaustifs, mais une clé
  absente du schéma est *silencieusement supprimée*. Le dépôt documente déjà ce
  piège (`app/api/booking/event-types/route.ts:79-81`), qui a causé au moins un
  bug en production. Ce n'est pas une faille, c'est un risque fonctionnel.

---

## Points non déterminables

Ces trois points exigent le dashboard Supabase ou un shell local — mon
environnement Linux n'a pas démarré (`HYPERVISOR_VIRT_DISABLED`).

**Point 3 — Sessions.** Dashboard → Authentication → Sessions. Relever : JWT
expiry (3600 s par défaut), rotation des refresh tokens, « inactivity timeout ».

**Point 17 — Dépendances.** À lancer localement, en lecture seule :

```bash
npm audit --omit=dev
npm outdated
```

Vérifier en priorité `next`, `@supabase/ssr`, `@supabase/supabase-js`, `stripe`.

**Point 18 — Sauvegardes.** Dashboard → Database → Backups. Sur le plan Pro,
les backups quotidiens sont normalement actifs avec 7 jours de rétention, et le
PITR est disponible en option payante — mais **il faut le vérifier**, pas le
supposer. Étant donné l'incident de saturation du stockage de ce mois-ci, c'est
le point que je vérifierais en premier.

---

## Ce que cet audit ne couvre pas

Par honnêteté sur son périmètre : je n'ai pas testé l'application en exécution.
Aucune tentative d'authentification, aucun test d'injection, aucune vérification
que les policies RLS sont *correctes* — seulement qu'elles existent. Une policy
présente mais permissive (`using (true)`) passerait ce contrôle sans être sûre.
Une revue du contenu des 5 policies de `funnels` et `shared_templates` serait le
prolongement naturel de ce rapport.
