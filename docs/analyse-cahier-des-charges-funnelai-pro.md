# AutoFunnel AI vs. cahier des charges « FunnelAI Pro v1.0 »

**Date de l'analyse :** 28 juillet 2026
**Document analysé :** FunnelAI Pro — Cahier des Charges v1.0 (avril 2026)
**Base de code analysée :** `tu-es-codex-responsable-de-cr` (AutoFunnel AI)

> **Méthode.** Chaque verdict ci-dessous s'appuie sur une lecture du code, pas sur
> une déduction. Quand je n'ai pas pu vérifier, je l'écris. Les montants de la
> partie coûts sont des ordres de grandeur à revalider au moment de l'achat :
> je n'ai pas eu d'accès réseau pour consulter les grilles tarifaires à jour.

---

## 1. Le constat qui prime sur tous les autres

**Le cahier des charges est en retard sur ton produit, pas l'inverse.**

Le document recommande deux voies : Bubble.io (option A, ~100–150 $/mois,
4–8 semaines d'apprentissage) ou un MVP freelance à 3 000–8 000 € sur 2–3 mois
(option B). Son plan de déploiement étale sur 24 semaines la construction de
cinq modules prioritaires.

Or tu as **déjà construit l'option B, et tu es allé plus loin** : Next.js 15,
React 19, Supabase, Stripe, Resend, Sentry, déploiement Vercel — exactement la
stack recommandée §19 — avec des modules que le cahier des charges ne prévoit
pas du tout. Les chapitres §19 (stack), §20 (plan de déploiement) et la partie
budget de développement de §21 sont donc **caducs**. Les garder comme référence
te ferait planifier un travail déjà fait.

Ce qui reste pertinent dans le document : le **périmètre fonctionnel** (§04–17),
le **modèle économique** (§21, plans tarifaires) et la **méthode de gestion des
bugs** (§22).

---

## 2. État module par module

Légende : ✅ implémenté · 🟡 partiel · ❌ absent

| § | Module | État | Détail |
|---|--------|------|--------|
| 04 | Création de tunnels IA | ✅ **dépassé** | Voir §2.1 |
| 05 | Forge Import (duplication) | ✅ **dépassé** | Voir §2.2 |
| 06 | Éditeur visuel de sections | ✅ quasi complet | Voir §2.3 |
| 07 | A/B Testing intelligent | ❌ **absent** | Aucune trace dans le code |
| 08 | Calendrier RDV natif | ❌ **absent** | Embed Calendly/Cal.com uniquement |
| 09 | Emails directs | ✅ quasi complet | Voir §2.4 |
| 10 | WhatsApp & Telegram | 🟡 **liens seuls** | Voir §2.5 |
| 11 | Chatbots IA | 🟡 **hors cible** | Voir §2.6 |
| 12 | Preuve sociale (pop-ups) | ❌ **absent** | Voir §2.7 |
| 13 | Workflows visuels | 🟡 **moteur oui, canvas non** | Voir §2.8 |
| 14 | Pipeline CRM | 🟡 **liste oui, Kanban non** | Voir §2.9 |
| 15 | Hébergement natif | ✅ complet | Voir §2.10 |
| 16 | Export multi-plateformes | 🟡 **2 sur 8** | Voir §2.11 |
| 17 | Espace revendeur | 🟡 **licences oui, reste non** | Voir §2.12 |
| 18 | Design system | 🔀 **divergent assumé** | Voir §3 |

### 2.1 — Création de tunnels IA ✅ dépassé

Le cahier demande 6 étapes ; tu en as **10 en parcours guidé** (Format,
Template, Objectif, Ton offre, Audience, Copywriting, Médias, CTA, Ambiance,
Génération) **plus un mode Express IA** en 4 étapes que le document ne prévoit
pas.

Le cahier demande trois frameworks (AIDA, PAS, Story-Proof-Offer) ; le code en
implémente **onze** (`CopywritingFramework` : AIDA, PAS, PAS-FOMO, 4P, BAB, FAB,
REASSURANCE, NEXT-STEPS, STAR, QUEST, SCARCITY-URGENCY), appliqués **page par
page** via `pageCatalogs.ts`. Les trois langues sont natives partout.

Les six types de tunnels (lead magnet, produit digital, webinaire, RDV, coaching
high ticket, challenge) dépassent les cinq du cahier, avec des mécaniques
absentes du document : upsell, downsell, order bump, OTO/tripwire, webinaire
evergreen, challenge multi-jours.

**Écarts réels :** l'étape 5 du cahier (« choix de la plateforme de destination
parmi 8 ») n'existe pas — l'export est post-génération, ce qui est un meilleur
choix produit. Et **la génération de 2 variantes A/B n'existe pas** (voir §07).

### 2.2 — Forge Import ✅ dépassé

`lib/clone/` est plus abouti que ce que décrit le cahier. Le document prévoit
« remplacement des images par des placeholders » ; ton implémentation
**ré-héberge les vrais médias**. Le pipeline comprend un fetcher multi-fournisseur
(Scrapingdog principal, ScrapingBee en repli), un mapper de sections, des modules
de fonctionnalités détectées (WhatsApp flottant, pop-ups), un système de « spots »
éditables et un rendu en iframe sandboxée.

La section code HTML, l'harmonisation des pop-ups Systeme.io (`SioLinkingTab`) et
l'édition immédiate des textes/boutons/liens sont présentes.

**Écart :** l'« historique des imports avec date et tunnel source » n'apparaît pas.

### 2.3 — Éditeur visuel ✅ quasi complet

Présents : régénération IA **par section ET par page** (`SectionRegenPanel`,
`PageRegenPanel`, `/api/ai/regenerate-section`, `/api/ai/regenerate-page`) —
le cahier ne demandait que par section ; aperçu mobile dans un cadre smartphone ;
réglage fin espacement/couleurs/ombres par section ; timer d'urgence ; sections
vidéo ; redirection communauté WhatsApp/Telegram sur la page de remerciement.

**Écarts :** aucune bibliothèque de drag-and-drop n'est installée (ni `dnd-kit`
ni équivalent dans `package.json`) — la réorganisation des sections se fait
probablement par boutons monter/descendre, pas au glisser-déposer. Le widget
chatbot **par tunnel** n'existe pas (voir §11).

### 2.4 — Emails directs ✅ quasi complet

Campagnes, segments, séquences, file `scheduled_emails` avec claim atomique,
tracking ouverture/clic avec garde anti-bot, désabonnement, éditeur riche,
gabarit brandé. C'est solide et supérieur à la description du cahier sur la
fiabilité d'envoi.

**Écart :** pas de **SMTP personnalisé** (Resend uniquement, pas de SendGrid ni
Mailgun ni domaine propre configurable par l'utilisateur).

### 2.5 — WhatsApp & Telegram 🟡 liens seuls

Ce qui existe : boutons « Rejoindre WhatsApp/Telegram » sur les pages de succès,
bouton WhatsApp flottant sur les tunnels clonés, normalisation E.164
(`lib/crm/phone.ts`), lien click-to-chat depuis le CRM.

Ce qui n'existe pas — et c'est l'essentiel du module : **aucune API**. Pas de
WhatsApp Business API (Meta/360dialog/Twilio), pas de Telegram Bot API, pas de
templates de messages, pas de bot à mots-clés, pas d'envoi groupé, pas de
WhatsApp comme action de workflow.

### 2.6 — Chatbots IA 🟡 hors cible

Il existe un chatbot (`components/chatbot/ChatWidget.tsx`, `lib/chatbot/`), mais
c'est **le chatbot de support d'AutoFunnel lui-même** : sa base de connaissances
est ta FAQ produit et tes propres coordonnées. Le cahier décrit tout autre
chose : des bots **configurables par l'utilisateur**, déployables sur son tunnel,
son WhatsApp ou son Telegram, pour qualifier ses prospects.

L'infrastructure (appel LLM, widget, historique) est réutilisable — c'est le
modèle de données multi-bots et l'interface de configuration qui manquent.

### 2.7 — Preuve sociale ❌ absent

`PopupForm.tsx` existe mais c'est une pop-up de **capture de lead**, pas une
notification de preuve sociale. Aucun code de notification « Sophie vient de
s'inscrire ».

### 2.8 — Workflows 🟡 moteur oui, canvas non

Le **moteur** est là et fonctionne : `lib/workflows/engine.ts`, déclencheurs
sémantiques (`lead.created`, `webinar.registered`), actions (email, tags,
notification propriétaire), exécution différée, historique des runs.

Ce qui manque, c'est le **canvas visuel** : aucune dépendance React Flow, et
`WorkflowsClient.tsx` est une interface de formulaires. Manquent aussi les nœuds
Attente et Condition A/B, la bibliothèque de templates de workflows et le tableau
de bord par nœud.

### 2.9 — Pipeline CRM 🟡 liste oui, Kanban non

Contacts, fiches détaillées, tags, import CSV/XLSX, actions rapides
(WhatsApp/email) : présents. Le **Kanban à 6 colonnes**, le glisser-déposer entre
colonnes, les colonnes personnalisables, le compteur de valeur potentielle et
l'export CSV du pipeline : absents.

### 2.10 — Hébergement natif ✅ complet

`app/tunnel/[slug]/[pageSlug]`, publication, analytics (`PageViewBeacon`), pixels
publicitaires, SSL via Vercel, responsive, mise à jour sans changement d'URL.
Le champ domaine personnalisé existe dans le modèle de données.

### 2.11 — Export multi-plateformes 🟡 2 sur 8

Présents : **Systeme.io** (API + code de partage) et **HTML/CSS brut**.
Absents : Builderall, ClickFunnels, GoHighLevel, Kartra, Kajabi, et le **PDF
copywriting**.

### 2.12 — Espace revendeur 🟡 licences oui, reste non

Il existe un système de licences (`lib/billing/cinetpayLicense.ts`, badges de
licence dans l'admin) et une intégration Chariow. Manquent : le **lien de
collecte client** (formulaire prospect → génération automatique du tunnel), le
lien de livraison client, l'intégration Fiverr/Comup, le prix de revente suggéré
et le tableau de bord revendeur.

---

## 3. Ce qui est implémenté SANS être au cahier des charges

C'est une part importante du travail, et elle n'est nulle part dans le document.

**Différenciation produit :** la galerie communautaire de modèles (partage,
like, signalement, réutilisation) ; le système de skins et de patterns visuels
(des dizaines de variantes de sections pour éviter la monotonie) ; le moteur
d'animations au scroll ; le code personnalisé injectable (head/body).

**Monétisation :** checkout interne Stripe Connect, order bump, licences
CinetPay, intégration Chariow, système de plans avec gating par forfait
(`lib/billing/planGate.ts`).

**Exploitation :** dashboard d'administration (utilisateurs + suivi des crédits
API) — le cahier ne prévoit aucun module d'admin ; Sentry ; tracking email avec
garde anti-faux-positifs ; bibliothèque de médias ; groupes de tunnels.

**Verdict :** ce hors-périmètre n'est pas de la dispersion. Le checkout interne
et le gating par forfait sont des prérequis du modèle économique §21, que le
cahier avait tout simplement oubliés.

---

## 4. La divergence à trancher : le design system

Le §18 spécifie un violet `#534AB7`, Helvetica, poids 400/500 uniquement,
**aucune ombre** (flat design), sidebar 200 px, coins 6/8/12 px.

Ton produit utilise une identité différente : encre `#080E1A`, or `#C7A436`,
bleu `#08498D`, vert `#31845C`, polices Inter/Poppins, et des ombres assumées
(`--ff-shadow-*`, `data-ff-shadow`).

**Mon avis :** ne refactore pas. Aligner le design system a posteriori sur des
dizaines de composants, de templates et de patterns coûterait plusieurs semaines
pour zéro gain fonctionnel, et casserait l'identité visuelle des tunnels générés.
**Mets à jour le cahier des charges pour refléter l'identité réelle**, c'est
l'inverse qui a du sens ici.

Même raisonnement pour le §19 : le cahier impose Claude API
(`claude-sonnet-4-6`), tu utilises OpenRouter avec GLM. C'est un choix de coût
défendable — mais il doit être **écrit** dans le document, sinon un futur
développeur suivra le cahier et rebranchera Anthropic.

---

## 5. Roadmap de ce qui reste

Estimations en jours-homme pour un développeur seul connaissant la base. Elles
supposent le build vert au départ — ce qui n'est pas le cas aujourd'hui (voir §7).

### Palier 1 — Fort impact, coût externe nul (≈ 15–22 j)

Ce palier ferme les écarts qui se voient dans une démo commerciale, sans ajouter
un euro de coût récurrent.

**A/B Testing (§07) — 5 à 7 j.** Le plus rentable du lot. La génération de
variantes réutilise `regenerate-section` qui existe déjà ; il faut un modèle de
données variantes, l'attribution du visiteur par cookie, le comptage par
variante et le calcul de confiance. La « recommandation IA » du cahier est en
réalité du calcul statistique — pas besoin de LLM, ce qui la rend gratuite à
l'usage.

**Preuve sociale (§12) — 3 à 4 j.** Faible complexité : les données sont déjà
en base (leads, commandes). Un composant de notification, une config
(position/délai/source) et l'injection dans le tunnel publié.

**Pipeline CRM Kanban (§14) — 4 à 6 j.** Les données existent ; c'est de l'UI.
Nécessite une bibliothèque de glisser-déposer (`dnd-kit`, gratuite) qui servira
aussi à l'éditeur de sections (§06) et au canvas de workflows (§13).

**Exports manquants (§16) — 3 à 5 j.** ClickFunnels/GoHighLevel/Kartra/Kajabi
sont des exports JSON : le travail réel est de cartographier chaque schéma. Le
PDF copywriting est trivial. Builderall demande une API : à traiter à part.

### Palier 2 — Fort impact, coût externe réel (≈ 18–27 j)

**Calendrier RDV natif (§08) — 8 à 12 j.** Aucun coût externe, mais c'est le
module le plus dense du palier : disponibilités, fuseaux horaires, réservation
publique, anti-double-réservation, rappels. Attention au piège classique des
fuseaux — prévoir de la marge.

**WhatsApp & Telegram (§10) — 10 à 15 j + coûts récurrents.** Telegram est
simple et **gratuit** (Bot API) : commence par là, 3–4 j. WhatsApp Business API
est un autre monde : vérification d'entreprise Meta, approbation des templates
de message, facturation par conversation. C'est le seul module à vrai coût
variable.

### Palier 3 — Structurants (≈ 20–30 j)

**Chatbots IA configurables (§11) — 8 à 12 j.** Modèle multi-bots, interface de
configuration, déploiement multi-canal (dépend du palier 2 pour WA/TG). Coût
LLM proportionnel à l'usage — à surveiller de près, un chatbot public est une
surface de consommation ouverte.

**Canvas de workflows (§13) — 6 à 9 j.** React Flow (gratuit) sur un moteur qui
existe déjà. Ajouter les nœuds Attente et Condition.

**Espace revendeur (§17) — 8 à 12 j.** Le lien de collecte client est la brique
à vraie valeur ; Fiverr/Comup peut attendre (leurs API sont restrictives).

### Ordre que je recommande

Palier 1 d'abord, intégralement. Il ferme quatre écarts visibles pour ~20 jours
sans engager de coût récurrent, et rend le produit démontrable face à
ClickFunnels et GoHighLevel sur leur propre terrain. Ensuite Telegram seul (3–4 j,
gratuit) pour valider la valeur du canal messagerie avant d'engager la
vérification Meta.

---

## 6. Coûts

### Coûts récurrents actuels (estimation, à vérifier)

| Poste | Ordre de grandeur | Nature |
|---|---|---|
| Vercel | 0–20 $/mois | Palier gratuit puis Pro |
| Supabase | 0–25 $/mois | Palier gratuit puis Pro |
| OpenRouter (GLM) | à l'usage | **Poste principal** — proportionnel aux générations |
| Resend | 0–20 $/mois | Gratuit jusqu'à ~3 000 emails/mois |
| Scrapingdog | ~30 $/mois | Selon le volume d'imports |
| ScrapingBee | 0–49 $/mois | Repli, peu sollicité |
| Stripe | ~1,4 % + 0,25 € | Par transaction |
| Sentry | 0–26 $/mois | Palier gratuit souvent suffisant |

**Le poste à surveiller est OpenRouter**, seul coût qui croît linéairement avec
tes utilisateurs. Ton nouvel onglet « Clés API » sert exactement à ça.

### Coûts additionnels de la roadmap

**Palier 1 : 0 €.** `dnd-kit` est gratuit, le calcul statistique aussi.

**Palier 2 — WhatsApp Business API**, le seul vrai engagement financier :
- Vérification d'entreprise Meta : gratuite mais **longue** (documents légaux)
- Facturation Meta **par conversation de 24 h**, tarif très variable selon le
  pays du destinataire — c'est le point à modéliser avant de s'engager
- Fournisseur (360dialog ~15–50 $/mois, ou Twilio à l'usage)
- Telegram : **0 €**

**Palier 3 — chatbots :** coût LLM proportionnel au trafic. Prévois un plafond
par utilisateur dès la conception, sinon un tunnel viral peut faire exploser la
facture.

### Sur le modèle économique §21

Les plans (29/49/97 €, Lifetime 1 497 €) sont cohérents avec ce qui est déjà
construit — `lib/billing/plans.ts` et le gating existent. Deux remarques :

Le plan **Starter à 29 € sans hébergement** est difficile à défendre alors que
l'hébergement natif est justement ton avantage sur FunnelForge. Le brider, c'est
te priver de ton argument de vente sur l'entrée de gamme.

Les projections (4 340 € de MRR au mois 12) supposent un taux de conversion que
rien ne valide encore. La phase 1 du §20 — présenter à 20 entrepreneurs et
obtenir 5 à 10 pré-commandes — **n'a pas été faite**, et c'est la seule partie
du plan de déploiement qui reste entièrement pertinente. Tu as construit avant
de valider ; ça n'est pas rattrapable rétroactivement, mais ça reste faisable
avant le lancement officiel.

---

## 7. Ce qui nécessite ton intervention

| # | Action attendue | Pourquoi |
|---|---|---|
| 1 | Lancer `npm run lint && npm run build && npx vitest run` et me remonter les erreurs | Le sandbox est HS depuis plusieurs tours : **rien de ce que j'ai écrit dans les 4 derniers lots n'a été compilé** (correctifs animations, CTA, footer, fetcher scraping, bugs éditeur cloné, dashboard admin) |
| 2 | Trancher le design system (§4) | Aligner le code sur le cahier, ou mettre le cahier à jour. Je recommande la seconde |
| 3 | Acter OpenRouter/GLM dans le cahier | Sinon un futur développeur rebranchera Anthropic en suivant le document |
| 4 | Décider du plan Starter (§6) | Brider l'hébergement à 29 € affaiblit ton argument différenciant |
| 5 | Décider si on engage la vérification Meta pour WhatsApp | Processus long ; à lancer tôt si le module est prioritaire |
| 6 | Faire la validation marché du §20 phase 1 | 20 entretiens, 5–10 pré-commandes — jamais faite, et c'est ce qui déterminera l'ordre réel de la roadmap |
| 7 | Confirmer si les médias lents persistent | Le retrait du lazy-loading sur l'iframe devrait avoir aidé ; sinon je mesure |
| 8 | Rappels des lots précédents | Purge des 3 fichiers du repo public, DKIM/SPF/DMARC Resend, surveillance du cron externe |

---

## 8. Synthèse

Sur les 14 modules fonctionnels du cahier, **6 sont complets ou dépassés**,
**5 sont partiels**, **3 sont absents**. Les deux modules cœur — création IA et
Forge Import — sont nettement au-dessus de ce que décrit le document.

Les trois absences réelles (A/B testing, calendrier natif, preuve sociale) sont
aussi celles du tableau comparatif §01 face à ClickFunnels et GoHighLevel : ce
sont elles qui coûtent le plus cher en argumentaire commercial, et deux des trois
sont dans le palier 1 à coût externe nul.

Le vrai risque du projet n'est pas technique. C'est que **le cahier des charges
ne décrit plus le produit** : ni sa stack IA réelle, ni son identité visuelle, ni
la moitié de ce qui a été construit. Le remettre à jour coûte une journée et
évite qu'un futur intervenant reconstruise ce qui existe ou défasse ce qui a été
choisi.
