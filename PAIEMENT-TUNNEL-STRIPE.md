# Flux de paiement Stripe des tunnels — AutoFunnel AI

Paiement **unique** (one-time) déclenché depuis la page de vente d'un tunnel
publié. Distinct de l'abonnement plateforme (voir `ABONNEMENTS-STRIPE.md`).

Parcours : **Page de vente → Stripe Checkout → /success (confirmation) →
étape suivante du tunnel (bonus / upsell) → /merci**.

---

## 1. Vue d'ensemble du flux

1. Le prospect clique sur un CTA d'achat. Un CTA « achat » est un lien
   `href="#ff-checkout"` ou un élément portant `data-ff-checkout` (déjà posé par
   le générateur sur les CTA de pricing quand l'offre est payante).
2. `components/funnel/PublicFunnelRuntime.tsx` intercepte le clic et appelle
   `POST /api/checkout` avec `{ funnelSlug, pageSlug }`.
3. `/api/checkout` lit le **prix côté serveur** depuis `published_content`
   (item pricing `highlighted`), calcule l'**étape suivante** du tunnel, crée la
   **session Stripe Checkout** et une commande `pending`, puis renvoie l'URL.
4. Le prospect paie sur Stripe.
5. Stripe le redirige vers `…/tunnel/{slug}/success?session_id=…`.
6. La page `/success` **vérifie** que la session est payée (lecture Stripe
   serveur), affiche une confirmation, puis **enchaîne** automatiquement vers
   l'étape suivante (`nextUrl` stocké dans la session).
7. En parallèle, le **webhook** Stripe reçoit `checkout.session.completed` :
   commande → `paid`, prospect → `client`, email de confirmation (Resend).

> Sécurité : aucun montant n'est envoyé par le client (anti-falsification). Le
> prix vient toujours de `published_content`. Aucune clé Stripe n'est exposée
> côté navigateur.

---

## 2. URLs configurées

- **Success** : `/tunnel/{slug}/success?session_id={CHECKOUT_SESSION_ID}`
- **Cancel** : `/tunnel/{slug}/cancel`

(`{slug}` = identifiant public du tunnel, l'équivalent du « funnelId ».)

La page `/success` ne modifie PAS la base : la source de vérité reste le
webhook. Elle se contente de lire le statut Stripe pour décider de continuer le
parcours — ça évite toute course/duplication avec le webhook.

---

## 3. Flux configurable (où vont les prospects après paiement)

L'étape suivante est calculée par `lib/funnels/postPurchase.ts` à partir du
**chaînage de pages que tu édites déjà** :

1. `page.nextPageId` de la page de vente (chaînage explicite) ;
2. sinon, la page suivante dans l'ordre du tunnel ;
3. sinon, `/merci`.

Donc pour obtenir « Vente → Confirmation → Bonus → Upsell → Merci », il suffit
que ces pages se suivent dans le tunnel (ou de définir leurs `nextPageId`).
`nextUrl` est figé dans les métadonnées de la session au moment du checkout.

---

## 4. Webhooks Stripe à enregistrer

Endpoint unique : `https://VOTRE_DOMAINE/api/stripe/webhook`.
Events à cocher (le endpoint gère paiements tunnel **et** abonnements) :

Paiement tunnel :
- `checkout.session.completed` — commande payée + prospect → client + email
- `payment_intent.succeeded` — filet de sécurité / traçabilité
- `payment_intent.payment_failed` — marque la commande `failed`

Abonnement plateforme (déjà documentés ailleurs) :
- `customer.subscription.created` / `updated` / `deleted`
- `invoice.payment_failed`

La clé de signature va dans `STRIPE_WEBHOOK_SECRET`.

---

## 5. Variables d'environnement

```
STRIPE_SECRET_KEY=sk_test_xxx          # (live : sk_live_xxx)
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_BASE_URL=https://funnelflow-ai.vercel.app   # sert aux success/cancel URLs
# Supabase (déjà présents) : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#   SUPABASE_SERVICE_ROLE_KEY
# Email (optionnel) : RESEND_API_KEY
```

---

## 6. Base de données

Table `public.orders` — **déjà créée** dans ta base Supabase
(`xhjhdheskjwbmdjzazoq`) via migration `create_orders_table`. Colonnes clés :
`status` (pending|paid|failed|refunded), `amount` (centimes), `currency`,
`customer_email`, `funnel_id`, `lead_id`, `stripe_session_id`,
`stripe_payment_intent`, `page_slug`, `next_url`, `paid_at`. RLS : chaque
utilisateur ne voit que ses commandes ; écritures via service role uniquement.

---

## 7. Tester en mode Stripe Test

1. Avoir un tunnel **publié** avec une offre **payante** (section pricing/offer
   avec un prix lisible, ex. « 49 € »). Sinon `/api/checkout` renvoie `no_price`.
2. Définir `STRIPE_SECRET_KEY` (sk_test) en local + `NEXT_PUBLIC_BASE_URL=http://localhost:3000`.
3. Lancer le relai webhook :
   `stripe listen --forward-to localhost:3000/api/stripe/webhook`
   → copier le `whsec_…` dans `STRIPE_WEBHOOK_SECRET`.
4. Ouvrir la page de vente, cliquer le CTA d'achat → Stripe Checkout.
5. Payer avec **4242 4242 4242 4242** (date future, CVC quelconque).
6. Vérifier : redirection `/success` → confirmation → continuation vers l'étape
   suivante ; dans Supabase la commande passe `paid` ; le lead devient `client` ;
   le **dashboard** affiche CA / paiements / clients / taux de conversion.
7. Tester l'échec avec **4000 0000 0000 0341**, et l'annulation (bouton retour de
   Stripe) → page `/cancel`.

---

## 8. Passage en production

1. Basculer les clés Stripe en **live** (`sk_live_…`) côté Vercel.
2. Enregistrer le webhook sur l'URL **de prod** (`https://funnelflow-ai.vercel.app/api/stripe/webhook`)
   et mettre son `whsec_…` (live) dans `STRIPE_WEBHOOK_SECRET`.
3. `NEXT_PUBLIC_BASE_URL=https://funnelflow-ai.vercel.app`.
4. La table `orders` existe déjà (rien à refaire).
5. Vérifier dans le dashboard Stripe (live) qu'un vrai paiement test arrive et
   que la commande passe `paid`.

---

## 9. Évolutivité (n8n / automatisations CRM)

Le webhook est le **point d'entrée unique** des événements de paiement, et
chaque session/PaymentIntent porte des métadonnées exploitables :
`type=funnel_purchase`, `funnelId`, `userId`, `funnelSlug`. Pour brancher n8n
plus tard, deux options propres sans rien casser :

- ajouter dans le handler `checkout.session.completed` un POST vers un webhook
  n8n (fire-and-forget) avec le payload de la commande ;
- ou un trigger Supabase sur `orders` (status → `paid`) qui notifie n8n.

La table `orders` sert déjà de **journal d'audit** complet (montant, devise,
email, funnel, dates) pour les stats et les automatisations.

---

## 10. Fichiers créés / modifiés

Créés : `lib/funnels/postPurchase.ts`, `app/tunnel/[slug]/success/page.tsx`,
`app/tunnel/[slug]/cancel/page.tsx`, `app/api/stats/payments/route.ts`.

Modifiés : `app/api/checkout/route.ts` (pageSlug + nextUrl + success/cancel +
métadonnées), `app/api/stripe/webhook/route.ts` (events payment_intent),
`lib/billing/orders.ts` (helpers PI + stats + page_slug/next_url),
`components/funnel/PublicFunnelRuntime.tsx` (transmet pageSlug),
`app/(app)/dashboard/page.tsx` (cartes CA / paiements / clients / conversion).

Base : migration `create_orders_table` appliquée sur Supabase.
