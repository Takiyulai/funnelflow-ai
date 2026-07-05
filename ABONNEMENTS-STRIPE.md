# Abonnements AutoFunnel AI — configuration Stripe (test) + gating

Ce guide couvre l'abonnement **à la plateforme** (le solopreneur qui paie son
plan Starter / Pro / Agency pour pouvoir générer des tunnels). Il est **distinct**
du paiement « one-time » existant (`/api/checkout`) qui sert au client FINAL d'un
tunnel à acheter le produit du solopreneur. Les deux cohabitent.

---

## 1. Les deux flux de paiement (à ne pas confondre)

| | Abonnement plateforme (NOUVEAU) | Paiement produit (existant) |
|---|---|---|
| Qui paie | Le solopreneur (ton client) | Le client final du tunnel |
| Quoi | Accès à AutoFunnel | Le produit vendu dans le tunnel |
| Mode Stripe | `subscription` (récurrent) | `payment` (one-time) |
| Route | `/api/subscribe` | `/api/checkout` |
| Table | `profiles` | `orders` |

---

## 2. Variables d'environnement à ajouter (Vercel + `.env.local`)

```
# Déjà requis pour le paiement produit
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_BASE_URL=http://localhost:3000   # en prod : https://ton-domaine

# NOUVEAU — price_id récurrents des 3 plans (créés à l'étape 3)
STRIPE_PRICE_STARTER=price_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_AGENCY=price_xxx

# NOUVEAU — interrupteur du gating d'accès
#   absent / false  → personne n'est bloqué (phase de test)
#   true            → seuls les abonnés actifs accèdent à la plateforme
BILLING_ENFORCED=false
```

> Tant que `BILLING_ENFORCED` n'est pas à `true`, **rien ne change** pour les
> utilisateurs : ils gardent l'accès complet (limites = plan Agency). Tu actives
> le gating quand tout est prêt côté Stripe.

---

## 3. Configurer Stripe en mode test

Active le **Test mode** (bouton en haut à droite du dashboard Stripe).

**a) Créer les produits + prix récurrents** (Product catalog → Add product) :

| Produit | Prix | Récurrence |
|---|---|---|
| AutoFunnel Starter | 29 € | Mensuel |
| AutoFunnel Pro | 59 € | Mensuel |
| AutoFunnel Agency | 97 € | Mensuel |

Chaque prix génère un `price_id` (`price_…`) → reporte-les dans
`STRIPE_PRICE_STARTER / PRO / AGENCY`.

**b) Clés API** (Developers → API keys, en test) → `STRIPE_SECRET_KEY` (sk_test).

**c) Webhook.** Le endpoint `/api/stripe/webhook` gère désormais **les deux flux**.
Events à cocher :

- `checkout.session.completed` (déjà là — sert aux 2 flux)
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

En local :

```
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

→ copie le `whsec_…` affiché dans `STRIPE_WEBHOOK_SECRET`.

En prod : Developers → Webhooks → Add endpoint →
`https://ton-domaine/api/stripe/webhook` → coche les events ci-dessus → copie le
signing secret.

**d) Portail client** (pour que l'abonné gère/annule) : Settings → Billing →
Customer portal → active-le (sinon `/api/billing/portal` renverra une erreur).

**e) Cartes de test** : succès `4242 4242 4242 4242` · échec
`4000 0000 0000 0341` · date future + CVC quelconque.

---

## 4. Base de données (Supabase)

Exécute **`db/subscriptions-schema.sql`** dans le SQL Editor. Il crée la table
`public.profiles` (plan + statut + ids Stripe), la RLS, et un trigger qui crée
automatiquement une ligne à chaque inscription (+ back-fill des comptes
existants).

---

## 5. Se débloquer en test (sans payer)

Quand `BILLING_ENFORCED=true`, ton propre compte sera bloqué tant qu'il n'a pas
d'abonnement actif. Pour tester l'app, passe ton compte en Agency actif :

```sql
update public.profiles set plan='agency', status='active'
where user_id = (select id from auth.users where email='ton@email.com');
```

---

## 6. Le parcours complet

1. Landing → CTA « Choisir Pro » pointe vers `/signup?plan=pro`.
2. Après inscription/connexion, l'utilisateur est envoyé sur
   `/abonnement?plan=pro`.
3. Il clique « Choisir Pro » → `/api/subscribe` crée un Checkout Stripe en mode
   `subscription` → redirection vers la page de paiement Stripe.
4. Paiement OK → Stripe appelle le webhook → `profiles.plan='pro'`,
   `status='active'`.
5. Le retour se fait sur `/dashboard`. La garde `app/(app)/layout.tsx` voit
   l'abonnement actif et laisse passer.
6. Un utilisateur **sans** abonnement actif (gating activé) est redirigé vers
   `/abonnement` dès qu'il tente d'entrer dans l'app.

---

## 7. Matrice des plans (ce qui est inclus)

| Fonctionnalité | Starter (29€) | Pro (59€) | Agency (97€) |
|---|:--:|:--:|:--:|
| Tunnels | 3 | 15 | illimité |
| Génération IA | ✅ | ✅ | ✅ |
| Templates | ✅ | ✅ | ✅ |
| Publication + leads | ✅ | ✅ | ✅ |
| CRM contacts/leads | ✅ | ✅ | ✅ |
| Export CSV leads | ✅ | ✅ | ✅ |
| Campagnes email | 500/mois | 5 000/mois | illimité |
| Import / clonage par URL | ❌ | ✅ | ✅ |
| Régénération IA de section | ❌ | ✅ | ✅ |
| Workflows / automatisations | ❌ | ✅ | ✅ |
| Multi-plateforme | ❌ | ✅ | ✅ |
| Export systeme.io | ✅ | ✅ | ✅ |
| Espaces clients | — | — | 25 |
| Domaine personnalisé | — | 1 | illimité |
| Support prioritaire | ❌ | ✅ | ✅ |

> La matrice est centralisée dans **`lib/billing/plans.ts`** — c'est le seul
> endroit à modifier pour ajuster limites et fonctionnalités.

---

## 8. Où l'accès est contrôlé (côté serveur)

L'UI masque ce qui n'est pas inclus, mais **le serveur est la vraie barrière** :

- `app/(app)/layout.tsx` — bloque toute l'app si pas d'abonnement actif.
- `/api/ai/generate-funnel` — quota de tunnels du plan.
- `/api/clone-funnel` — fonctionnalité `urlImport` (Pro/Agency) + quota.
- `/api/ai/regenerate-section` — fonctionnalité `sectionRegeneration`.
- `/api/crm/campaigns/[id]/send` — fonctionnalité `campaigns`.

---

## 9. À faire ensuite (non bloquant)

- **Plafond d'emails/mois** : les colonnes `emails_sent_this_period` /
  `email_period_start` existent dans `profiles` mais le décompte/réinitialisation
  n'est pas encore branché. À implémenter dans `lib/crm/campaigns.ts` (incrément
  après envoi + reset mensuel + refus au-delà du cap).
- **Domaine personnalisé** : prévu plus tard (feature Agency, via l'API Vercel
  Domains).

---

## 10. Récap des fichiers ajoutés / modifiés

Ajoutés : `lib/billing/plans.ts`, `lib/billing/subscription.ts`,
`lib/billing/subscriptionSync.ts`, `lib/billing/apiGuard.ts`,
`app/api/subscribe/route.ts`, `app/api/billing/portal/route.ts`,
`app/api/billing/me/route.ts`, `app/(app)/layout.tsx`, `app/abonnement/page.tsx`,
`components/billing/PlanPicker.tsx`, `db/subscriptions-schema.sql`.

Modifiés : `lib/billing/stripe.ts` (ré-export de la matrice),
`app/api/stripe/webhook/route.ts` (events abonnement),
`app/api/ai/generate-funnel/route.ts`, `app/api/clone-funnel/route.ts`,
`app/api/ai/regenerate-section/route.ts`,
`app/api/crm/campaigns/[id]/send/route.ts` (gardes de plan),
`components/auth/AuthForm.tsx` (redirection post-auth vers l'abonnement),
`components/dashboard/Sidebar.tsx` (carte plan dynamique), `app/page.tsx` (CTA
pricing → `/signup?plan=`).
