# Partie 3 — Comparaison directe : concurrents vs AutoFunnel AI

Chaque écart est classé : **🔴 À implémenter** (absent chez toi) · **🟠 À compléter** (partiel) · **🟡 À améliorer** (présent mais en retard) · **🟢 Avantage à conserver**.
Référence : audit Partie 1 (fichiers cités) + fiches Partie 2 (sources citées).

---

## Génération de tunnels

| Fonctionnalité | Marché | Toi | Verdict |
|---|---|---|---|
| Génération IA d'un tunnel complet multi-pages (structure + copy + navigation) | autofunnel.ai (< 60 s), involve.me (AI Agent) ; absent chez Funnelquik/LearnyBox/Simvoly/FG Funnels | ✅ mûr (`lib/ai/generate.ts`, wizard 6 types, régén. section/page) | 🟢 **Avantage à conserver** — c'est ton meilleur module, et la majorité des petits acteurs ne l'ont PAS |
| Clonage d'un tunnel depuis une URL | Rare (aucun des 9 ne le met en avant) | ✅ (`lib/clone/pipeline.ts`) | 🟢 **Avantage à conserver** — différenciateur peu commun |
| Multi-langue FR/EN/ES natif | Chacun est mono-marché (EN, ES, FR) | ✅ | 🟢 **Avantage** — tu couvres 3 marchés là où chaque concurrent en couvre 1 |
| Templates | 200+ (Funnelquik), 16 experts mobile (Perspective) | ✅ 18 design + 8 blueprints | 🟡 **À améliorer** — volume et preuve sociale ("templates testés") inférieurs ; qualité mobile à prouver |
| Éditeur | Drag & drop libre partout (Funnelquik, Simvoly, FG Funnels) | ⚠️ édition par sections, pas de canvas libre | 🟡 **À améliorer** — ton approche par sections est défendable (plus simple pour débutants) mais assume-la comme un choix, et fluidifie-la |
| Domaines personnalisés | Standard absolu chez TOUS (même à 19 €/mois) | ❌ vendu dans les plans, non implémenté | 🔴 **À implémenter — priorité absolue** : tu factures une fonctionnalité inexistante |
| A/B testing | Funnelquik, Simvoly (chaque étape), LearnyBox | ❌ | 🔴 **À implémenter** (après analytics — un A/B test sans mesure ne sert à rien) |

## Automatisation (ton axe de différenciation)

| Fonctionnalité | Marché | Toi | Verdict |
|---|---|---|---|
| Séquences email | Standard partout ; involve.me déclenche par réponse de quiz | ✅ + génération IA des séquences | 🟢 **Avantage** — la génération IA de séquences est rare (seul autofunnel.ai l'a) |
| Workflows/triggers | Simvoly (achats, panier abandonné, vues vidéo), FG Funnels (GHL = référence) | ✅ 7 déclencheurs actifs, mais linéaire | 🟠 **À compléter** : action « envoyer un email » directe, conditions si/alors, 5 triggers déclarés jamais émis (`lib/workflows/types.ts`) |
| Éditeur visuel de workflow (canvas) | FG Funnels/GHL oui ; les autres : formulaires simples | ⚠️ liste verticale de nœuds | 🟡 **À améliorer** — pas urgent : Funnelquik et involve.me n'ont pas de canvas non plus |
| Taux d'ouverture / stats email | Standard partout | ❌ ouvertures ; clics trackés mais non restitués | 🔴 **À implémenter** — un outil d'automatisation email sans open rate n'est pas crédible |
| Relances automatiques (panier abandonné, no-show) | Simvoly (panier abandonné), FG Funnels | ⚠️ possible via time.elapsed mais pas de trigger « checkout abandonné » | 🟠 **À compléter** |
| SMS / WhatsApp | FG Funnels (SMS), Simvoly (SMS+WhatsApp) | ❌ | 🔴 **À implémenter (plus tard)** — pertinent pour l'Afrique (WhatsApp >> email), mais gros chantier |
| Calendrier de RDV natif | autofunnel.ai, Funnelquik (Google Calendar, multi-opérateurs), FG Funnels | ❌ (type « booking » = simple formulaire ; trigger `appointment.booked` jamais émis) | 🟠 **À compléter** — tu as déjà le type de tunnel et le trigger déclaré ; il manque le moteur de créneaux |

## CRM

| Fonctionnalité | Marché | Toi | Verdict |
|---|---|---|---|
| Contacts + tags + segments | Standard | ✅ (`lib/crm/*`) | 🟢 OK — niveau marché |
| Notes, historique d'activité, champs personnalisés | Funnelquik (notes internes, champs custom, historique achats/RDV), Perspective (notes, tâches) | ❌ | 🔴 **À implémenter** — c'est ce qui transforme une liste de leads en CRM |
| Pipeline visuel / scoring | autofunnel.ai (scoring, pipeline) [S] | ❌ (statuts seulement) | 🟠 **À compléter** — une vue kanban des 5 statuts existants est un quick win |
| Consentement RGPD, téléphone E.164 + pays | Rarement mis en avant | ✅ | 🟢 **Avantage** (marché FR/RGPD) |

## Paiements & monétisation créateur

| Fonctionnalité | Marché | Toi | Verdict |
|---|---|---|---|
| Paiement mobile africain (CinetPay : XOF/XAF/CDF/GNF) | **AUCUN des 9 concurrents** | ✅ (`lib/billing/cinetpay.ts`) | 🟢 **Avantage majeur à conserver et à marteler** — barrière à l'entrée réelle |
| Stripe Connect avec commission dégressive | Modèle GHL/FG Funnels | ✅ | 🟢 OK |
| One-click upsell / order bump | autofunnel.ai (one-click upsells), Funnelquik (« un clic »), Simvoly (bumps + A/B) | ⚠️ upsell = page suivante avec re-checkout (`lib/funnels/postPurchase.ts`) | 🔴 **À implémenter** — impact direct sur le panier moyen de tes utilisateurs = argument de vente n°1 des concurrents |
| Abonnements/memberships vendus par le créateur | Funnelquik, LearnyBox (LearnyPay), Simvoly | ❌ (checkout one-time only, `/api/checkout`) | 🔴 **À implémenter** — indispensable pour coachs/formateurs |
| Multi-devises checkout créateur | Standard | ⚠️ EUR/USD/GBP (Stripe) + XOF/XAF/CDF/GNF/USD (CinetPay) | 🟢 plutôt bon — devises africaines uniques |

## Leads & Analytics

| Fonctionnalité | Marché | Toi | Verdict |
|---|---|---|---|
| Visites, conversion par page, sources | Funnelquik (UTM, ventes par funnel), Perspective (conversion par élément), Simvoly | ❌ (tracking limité aux contacts identifiés) | 🔴 **À implémenter — le trou n°1 du produit.** « Automatiser » sans mesurer = promesse invérifiable pour l'utilisateur |
| Pixels publicitaires (Meta, GA/GTM, TikTok) | Perspective (natif, y c. Conversion API), Funnelquik (GTM) | ❌ | 🔴 **À implémenter** — tes utilisateurs achètent du trafic ; sans pixel, tes tunnels sont inutilisables en paid |
| Export CSV leads | Standard | ✅ | 🟢 OK |

## Intégrations & écosystème

| Fonctionnalité | Marché | Toi | Verdict |
|---|---|---|---|
| Intégrations tierces / Zapier / webhooks sortants | Perspective (2 000+), involve.me (55 natives), Funnelquik (API publique) | ❌ | 🟠 **À compléter** — commence par webhooks sortants génériques (lead.created, purchase.completed : tu as déjà les événements internes !) |
| Cours / memberships / LMS | LearnyBox (cœur), FG Funnels, Funnelquik | ❌ | 🟡 hors scope court terme — ne pas se disperser |
| Export de sortie (systeme.io, HTML) | Personne ne le propose | ✅ | 🟢 **Avantage** original (anti lock-in = argument de confiance) |
| Livres/podcasts IA | autofunnel.ai uniquement | ❌ | 🟡 gadget probable (qualité critiquée) — ignorer |

---

## Bilan Partie 3

**🟢 Avantages réels à défendre (5)** : génération IA multi-pages (meilleure que 7 concurrents sur 9), clonage URL, CinetPay/devises africaines (unique au monde sur ce panel), séquences IA, trilinguisme FR/EN/ES + export anti lock-in.

**🔴 À implémenter (8, par ordre de gravité)** : analytics de tunnel (visites/conversions), domaines personnalisés (déjà facturés !), pixels publicitaires, one-click upsell + order bump, open rate email, abonnements créateur, notes/historique CRM, A/B testing.

**🟠 À compléter (5)** : workflows (action email directe, conditions, triggers morts), calendrier de RDV, relances panier abandonné, webhooks sortants, pipeline CRM kanban.

**🟡 À améliorer (3)** : volume/preuve des templates, fluidité éditeur, canvas workflows.
