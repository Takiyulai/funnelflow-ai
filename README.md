# FunnelFlow AI

FunnelFlow AI est une plateforme SaaS IA pour créer des tunnels de vente premium en français ou en anglais, orientés produits digitaux, ebooks, coaching, formations et services. La V1 inclut landing page, auth Supabase, dashboard, génération IA, templates, aperçu, publication publique, CRM simple, export HTML/CSS, export Systeme.io, import d’inspiration et workflows simples.

## Stack

- Next.js + Tailwind CSS
- Supabase Auth, PostgreSQL et Storage
- OpenAI API pour la génération de tunnels
- Resend pour les emails transactionnels
- Stripe pour les plans Starter, Pro et Agency
- Sentry pour le monitoring
- Vercel pour le déploiement

## Installation

```bash
npm install
cp .env.example .env.local
npm run dev
```

Ouvrez ensuite `http://localhost:3000`.

## Variables d’environnement

Renseignez `.env.local` à partir de `.env.example`.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SENTRY_DSN`

Sans `OPENAI_API_KEY`, l’application utilise un générateur local de démonstration pour rester testable.

## Configuration Supabase

1. Créez un projet Supabase.
2. Exécutez `supabase/schema.sql` dans SQL Editor.
3. Exécutez `supabase/storage.sql` pour créer le bucket `brand-assets`.
4. Activez Supabase Auth par email.
5. Ajoutez l’URL locale et l’URL Vercel dans les redirect URLs Supabase.

Tables créées : `users`, `funnels`, `funnel_sections`, `leads`, `templates`, `exports`, `workflows`, `workflow_steps`, `email_sequences`, `brand_assets`.

## OpenAI

La génération principale passe par `app/api/ai/generate-funnel/route.ts` et les prompts sont dans `lib/ai/prompts.ts`. Le code utilise l’API Responses officielle d’OpenAI quand `OPENAI_API_KEY` est configurée.

## Exports

- HTML complet : `lib/export/html.ts`
- Blocs Systeme.io copy/paste : `createSystemeBlocks`
- Guide d’import : `createImportGuide`
- ZIP HTML/CSS : route `/api/export/systeme`

## Tests

```bash
npm run test
```

La suite couvre prompts/parser, templates, aperçu de tunnel et export HTML/Systeme.io.

## Déploiement Vercel

1. Poussez le projet sur GitHub.
2. Importez le repo dans Vercel.
3. Ajoutez toutes les variables d’environnement.
4. Connectez Supabase, Resend, Stripe et Sentry.
5. Déployez.

## Plans intégrés

- Starter — 29€/mois : 3 tunnels, Export HTML, Templates de base, CRM simple.
- Pro — 49€/mois : 10 tunnels, Export Systeme.io, Régénération IA, Emails automatiques, Templates premium.
- Agency — 97€/mois : Tunnels illimités, Import URL, Workflows simples, CRM avancé, Branding client.

## Ce qui manque avant production

- Clés API Supabase, OpenAI, Resend, Stripe et Sentry.
- Domaine final et nom de marque définitif.
- Webhooks Stripe et logique de quotas par plan.
- Persistance complète des funnels générés dans Supabase depuis l’assistant.
- Envoi réel des emails Resend après capture lead.
- Intégration API Systeme.io si une API publique adaptée est confirmée.
