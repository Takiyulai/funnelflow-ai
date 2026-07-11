# Partie 1 — Audit factuel d'AutoFunnel AI (état du code au 2026-07-10)

Base de référence pour la comparaison concurrentielle. Chaque affirmation renvoie à un fichier du repo.
Légende : ✅ complet · ⚠️ partiel · ❌ absent.

---

## 1. Génération de tunnels

| Fonctionnalité | État | Preuve (code) |
|---|---|---|
| Types de tunnels guidés (wizard) : lead-magnet (3 pages), produit digital (4 pages + upsell/downsell), webinaire (5 pages), booking/RDV, coaching… + anciens types (vsl, formation, service, saas) en rétrocompat lecture | ✅ | `lib/funnels/kinds.ts` |
| Génération IA d'un tunnel complet multi-pages (structure + copywriting + CTA + navigation chaînée) | ✅ | `lib/ai/generate.ts` (~2 600 lignes), `lib/ai/prompts.ts`, `lib/funnels/pageGenerator.ts` |
| Abstraction fournisseur IA : OpenAI (défaut) / Anthropic / Z.AI via env `AI_PROVIDER` + health check | ✅ | `lib/ai/generate.ts:2612`, `lib/ai/health.ts`, `/api/ai/health` |
| Régénération IA par section et par page entière | ✅ | `/api/ai/regenerate-section`, `/api/ai/regenerate-page`, `components/editor/SectionRegenPanel.tsx`, `PageRegenPanel.tsx` |
| Templates : 8 blueprints de structure (ebook-lead-magnet, premium-ebook, webinar, high-ticket-service…) + 18 templates design (clean-light, neo-brutalist, aurora-glow, trust-pro, bold-energy…) avec variants de layout et animations | ✅ | `lib/funnels/templates.ts`, `lib/funnels/sectionVariants.ts`, `lib/funnels/moods.ts` |
| Éditeur par sections : contenu, style, fond, CTA, header, médias, icônes, couleurs inline, styles globaux, FAQ/pricing/témoignages/bonus/garantie/form fields, popups internes, compte à rebours (timer) | ✅ | `components/editor/*` (34 composants), `TimerEditor.tsx`, `InternalPopupEditor.tsx` |
| Éditeur libre type canvas drag & drop (placer n'importe quel bloc n'importe où) | ⚠️ | Édition structurée par sections + réordonnancement ; pas de canvas libre (`components/editor/EditorSidebar.tsx`) |
| Clonage/import d'un tunnel depuis une URL externe (fetch ScrapingBee → parse → upload médias Supabase → sections éditables + fallback raw-html) | ✅ | `lib/clone/pipeline.ts` et `lib/clone/*` (14 fichiers) |
| Multi-langue FR / EN / ES (wizard + génération) | ✅ | `lib/i18n/wizard.ts`, `lib/funnels/types.ts` (Language) |
| Multi-pages avec chaînage explicite (`nextPageId`) + rétrocompat mono-page | ✅ | `lib/funnels/postPurchase.ts`, `lib/store/normalizeFunnel.ts` |
| Publication interne sur `autofunnelai.cloud/tunnel/[slug]` + revalidation | ✅ | `app/tunnel/[slug]/`, `/api/revalidate-tunnel` |
| Domaines personnalisés pour les tunnels | ❌ | Déclaré dans les plans (`lib/billing/plans.ts:56`) mais **aucune implémentation** (aucun routage hostname, rien dans `middleware.ts`) |
| A/B testing de pages ou de sections | ❌ | Aucune trace dans le code |
| Espaces de travail clients (mode agence) | ❌ | Déclaré dans les plans (`clientWorkspaces`) mais aucune implémentation trouvée |

## 2. Automatisation (axe de différenciation revendiqué)

| Fonctionnalité | État | Preuve (code) |
|---|---|---|
| Séquences email générées par IA (rôles : bienvenue, nurturing, relance, offre, témoignage, lancement, réengagement, autre), délais J+N, CRUD, statuts draft/active | ✅ | `lib/crm/sequences.ts`, `lib/crm/types.ts`, `/api/crm/sequences/*` (dont `/generate`) |
| Enrôlement de contacts dans une séquence (manuel + via workflow) | ✅ | `/api/crm/sequences/[id]/enroll`, `lib/workflows/engine.ts` |
| Campagnes broadcast : segments dynamiques (tags any/all, statuts, funnel, recherche) OU sélection manuelle, planification (`scheduled_at`), compteurs sent/failed | ✅ | `lib/crm/campaigns.ts`, `lib/crm/types.ts` (Segment, Campaign), `/api/crm/campaigns/*` |
| Moteur de workflows : 1 trigger + N actions ordonnées | ✅ | `lib/workflows/engine.ts`, `repository.ts`, `types.ts` |
| Déclencheurs branchés (émis réellement) : `lead.created`, `tag.added`, `status.changed`, `purchase.completed`, `page.visited` (contacts identifiés), `email.link_clicked`, `time.elapsed` (planifié via `workflow_pending_runs`) | ✅ | `/api/leads`, `/api/crm/tags/assign`, `/api/crm/contacts/[id]`, `lib/billing/orders.ts:349`, `/api/track/page-view`, `/api/track/click` |
| Déclencheurs déclarés mais NON émis : `webinar.registered/attended/absent`, `application.submitted`, `appointment.booked` (prévus LOT 4/7/8) | ⚠️ | `lib/workflows/types.ts:32-44` ; aucun `runWorkflowsForEvent` avec ces events dans `app/` |
| Actions disponibles : add_tag, set_status, enroll_in_sequence, notify_owner, wait (j/h/min) | ✅ | `lib/workflows/types.ts:78-83` |
| Action « envoyer un email » directement dans le workflow (sans passer par une séquence) | ❌ | Non présent dans `WorkflowActionKind` |
| Branchements conditionnels si/alors, split de chemins | ❌ | Workflow strictement linéaire |
| Éditeur de workflow : liste verticale de nœuds (trigger → actions), pas de canvas visuel libre | ⚠️ | `components/workflows/WorkflowsClient.tsx`, `WorkflowNode.tsx` (pas de react-flow) |
| File d'envoi + CRON unique : `scheduled_emails` + `workflow_pending_runs` + campagnes programmées | ✅ | `/api/cron/send-scheduled-emails` |
| Tracking des CLICS email (proxy `/api/track/click`) alimentant le déclencheur | ✅ | `lib/crm/emailTracking.ts` |
| Tracking des OUVERTURES email (pixel) / taux d'ouverture | ❌ | Aucune trace |
| Envoi via Resend, expéditeur « X via AutoFunnel » + reply-to créateur | ✅ | `lib/email/sender.ts`, `userSender.ts` |
| Domaine d'envoi personnalisé (premium) | ⚠️ | Résolution codée (`custom_email_from/status` dans `userSender.ts`) mais « UI plus tard » : pas de flux de vérification utilisateur |
| SMS / WhatsApp | ❌ | Aucune trace |

## 3. CRM

| Fonctionnalité | État | Preuve (code) |
|---|---|---|
| Contacts (= leads étendus) : email, nom, téléphone E.164 + pays, statut pipeline (nouveau/contacté/qualifié/client/perdu), source, consentement, langue, metadata | ✅ | `lib/crm/types.ts`, `lib/crm/contacts.ts`, `lib/crm/phone.ts` |
| Tags colorés + assignation (masse) + segments dynamiques réutilisables | ✅ | `lib/crm/tags.ts`, `/api/crm/tags/*`, type `Segment` |
| Pages UI : liste contacts, fiche contact, leads par tunnel, page leads globale | ✅ | `app/(app)/crm/contacts/`, `app/(app)/leads/`, `app/(app)/funnels/[id]/leads/` |
| Export CSV des leads | ✅ | `/api/leads/export` |
| Notes, historique d'activité, scoring, vue pipeline kanban | ❌ | Non observé dans le code |

## 4. Paiements

| Fonctionnalité | État | Preuve (code) |
|---|---|---|
| Abonnement plateforme (créateur → AutoFunnel) : Stripe, 3 plans (Starter 29 €, Pro 59 €, Agency), checkout, webhook (6 handlers), portail de facturation, sync | ✅ | `lib/billing/plans.ts`, `stripe.ts`, `subscription.ts`, `subscriptionSync.ts`, `/api/subscribe`, `/api/stripe/webhook`, `/api/billing/portal` |
| Quotas d'usage par plan (tunnels, publiés, gens IA/mois, imports URL, leads max, emails/mois…) appliqués aux routes | ✅ | `lib/billing/usage.ts`, `apiGuard.ts`, `planGate.ts` |
| Licences Chariow (canal de vente alternatif) : webhook + activation | ✅ | `/api/webhooks/chariow`, `lib/billing/chariow.ts`, `/api/license/validate` |
| Encaissement PAR le créateur — Stripe Connect : onboarding, statut, refresh, disconnect, commission plateforme dégressive (application_fee 2 % Starter →) | ✅ | `lib/billing/connect.ts`, `/api/connect/*`, `plans.ts:59-62` |
| Encaissement PAR le créateur — CinetPay « clés propres » : XOF/XAF/CDF/GNF/USD, apikey chiffrée AES-256-GCM, notify webhook | ✅ | `lib/billing/cinetpay.ts`, `/api/cinetpay/*` — atout fort marché africain |
| Commandes multi-provider (stripe/cinetpay), statuts, parsing prix libre (€/$/£), stats de paiement par tunnel | ✅ | `lib/billing/orders.ts`, `/api/stats/payments` |
| Post-achat : chaînage de pages (Vente → paiement → Confirmation → Bonus → Upsell → Merci) | ⚠️ | `lib/funnels/postPurchase.ts` — l'« upsell » est une page suivante ; **pas de one-click upsell** (re-checkout nécessaire), **pas d'order bump** au checkout |
| Abonnements récurrents vendus PAR le créateur à SES clients | ❌ | Checkout créateur = one-time uniquement (aucun `mode: "subscription"` dans `/api/checkout`) |

## 5. Leads & Analytics

| Fonctionnalité | État | Preuve (code) |
|---|---|---|
| Capture de leads sur tunnels publiés + consentement + déclenchement workflows | ✅ | `/api/leads`, FormRenderer |
| Email de livraison automatique (lead magnet), fichier ICS webinaire | ✅ | `lib/funnels/deliveryEmail.ts`, `ics.ts`, `components/editor/DeliveryEmailTab.tsx` |
| Stats de paiement agrégées (commandes payées + leads) | ✅ | `/api/stats/payments`, `lib/billing/orders.ts` |
| Analytics visiteurs : visites anonymes, taux de conversion par page, sources de trafic | ❌ | `page-view` ne trace QUE les contacts identifiés (workflows) ; `lib/store/statsStore.ts` = simple compteur localStorage |
| Taux d'ouverture / clic par campagne (dashboard email) | ⚠️ | sent/failed comptés ; clics trackés côté workflow mais pas restitués en stats ; ouvertures ❌ |
| Pixels marketing (Meta Pixel, GA/GTM) injectables sur les tunnels | ❌ | Aucune trace dans `components/funnel/*` |

## 6. Intégrations & Export

| Fonctionnalité | État | Preuve (code) |
|---|---|---|
| Export systeme.io (bonus de sortie, pas le cœur) | ✅ | `/api/export/systeme`, `components/editor/SystemeIoExportMenu.tsx`, `SioLinkingTab.tsx` |
| Export HTML/CSS autonome (thème, FAQ script, README) | ✅ | `lib/export/html.ts`, `theme-css.ts`, `faq-script.ts`, `readme.ts` |
| Médias : upload, rehost, compression (Supabase Storage) | ✅ | `/api/media/*`, `lib/images/compress.ts` |
| API publique / webhooks sortants / Zapier / n8n | ❌ | Seule mention : « futur webhook n8n » en commentaire (`lib/crm/sequences.ts:4`) |
| Observabilité : Sentry (server/edge/client) avec scrubbing PII complet | ✅ | `lib/observability/sentryScrub.ts` (session précédente, non commité) |

---

## Synthèse de l'audit

**Le socle « écosystème » existe réellement** : génération IA multi-pages aboutie (le module le plus mûr du produit), CRM fonctionnel, séquences IA, campagnes segmentées, moteur de workflows avec 7 déclencheurs actifs, double rail de paiement Stripe Connect + CinetPay (différenciateur africain réel), quotas par plan.

**Les 5 trous les plus visibles face à l'ambition « génération + automatisation »** :

1. **Analytics quasi inexistants** — pas de visites, pas de conversion par page, pas d'open rate. Un outil d'automatisation sans mesure n'est pas crédible.
2. **Workflows linéaires** — pas de conditions si/alors, pas d'action « envoyer un email » directe, pas de canvas visuel ; 5 déclencheurs sur 12 sont déclarés mais morts.
3. **Monétisation créateur incomplète** — pas de one-click upsell, pas d'order bump, pas d'abonnements vendus par le créateur.
4. **Fonctionnalités vendues mais non implémentées** — domaines personnalisés, workspaces agence, domaine d'envoi perso (risque commercial : c'est dans la grille de plans).
5. **Aucune ouverture** — pas de pixels marketing, pas d'API/webhooks sortants, pas de Zapier.
