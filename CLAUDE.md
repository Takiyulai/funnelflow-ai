# FunnelFlow AI — Contexte projet

## Description
FunnelFlow AI est une plateforme tout-en-un de création de tunnels de vente
assistée par IA. La PRIORITÉ est de permettre à l'utilisateur de TOUT faire
dans l'application elle-même : générer, cloner, éditer, publier ses tunnels,
capturer ses leads et les gérer via un CRM intégré — sans avoir à sortir de
l'outil.

L'export vers systeme.io est une fonctionnalité BONUS / de sortie, destinée
uniquement aux utilisateurs qui souhaitent migrer ou prolonger leur tunnel sur
systeme.io. Ce n'est pas le cœur du produit : l'écosystème complet doit vivre
dans FunnelFlow AI.

Cible : solopreneurs / freelances francophones.
Concurrent direct de référence : FunnelForge (à étudier pour s'en inspirer et
se différencier).

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase (auth + base de données)
- Déploiement : Vercel
- Tests : Vitest

## Structure clé
- `app/(app)/dashboard/` — tableau de bord
- `components/dashboard/` — AppShell, Sidebar, FunnelRow, etc.
- `components/ui/` — Button, Card, Badge, ConfirmDialog
- `lib/store/funnelStore.ts` — store des tunnels
- Modèle de données : un funnel a `funnel.pages[]`, chaque page a `sections[]`

## Règles absolues
- NE JAMAIS modifier `.env.local`, ni committer de clés API.
- NE JAMAIS toucher aux fichiers hors de ce dossier projet.
- Toujours faire `npm run build` localement avant de considérer une tâche terminée.
- Préserver la compatibilité ascendante (anciens funnels mono-page ET nouveaux multi-pages).
- Travailler par petites étapes, tester, puis passer à la suivante.
- Le code doit passer le build Vercel sans erreur TypeScript ni ESLint.
- L'expérience interne (création → publication → leads → CRM) prime sur l'export
  systeme.io, qui reste secondaire.

## Conventions
- Composants en français pour le contenu visible, code/commentaires techniques au choix.
- Formatage : Tailwind, pas de CSS inline sauf cas spécifiques déjà présents.
