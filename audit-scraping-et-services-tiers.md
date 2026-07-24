---
title: "AutoFunnel AI — Comparatif scraping & audit des services tiers"
date: "24 juillet 2026"
---

# AutoFunnel AI — Comparatif scraping & audit des services tiers

Document préparé pour Dramane. Toutes les données de prix/limites ci-dessous proviennent de recherches web effectuées le **24 juillet 2026** (pages officielles quand disponibles, sinon recoupement de plusieurs sources tierces datées 2026). Les prix et quotas des fournisseurs SaaS changent souvent — **à revérifier avant toute décision d'achat**, surtout pour les lignes marquées ⚠️.

## Sommaire

- [Partie 1 — Comparatif des fournisseurs de scraping](#partie-1--comparatif-des-fournisseurs-de-scraping)
  - [1.1 Tableau comparatif](#11-tableau-comparatif)
  - [1.2 Fiabilité réelle sur les cibles anti-bot (Nadia+)](#12-fiabilité-réelle-sur-les-cibles-anti-bot-nadia)
  - [1.3 Avertissement légal — LinkedIn / Facebook / Instagram](#13-avertissement-légal--linkedin--facebook--instagram)
  - [1.4 Recommandation — mono-fournisseur ou fallback ?](#14-recommandation--mono-fournisseur-ou-fallback-)
  - [1.5 Recommandation — quel(s) fournisseur(s) ?](#15-recommandation--quels-fournisseurs-)
  - [1.6 Écart avec le code déjà en place](#16-écart-avec-le-code-déjà-en-place)
- [Partie 2 — Audit des services tiers](#partie-2--audit-des-services-tiers)
  - [2.1 Supabase](#21-supabase)
  - [2.2 Vercel](#22-vercel)
  - [2.3 Resend](#23-resend)
  - [2.4 Sentry](#24-sentry)
  - [2.5 OpenRouter](#25-openrouter)
  - [2.6 Fournisseur de scraping (retenu en Partie 1)](#26-fournisseur-de-scraping-retenu-en-partie-1)
  - [2.7 CinetPay](#27-cinetpay)
  - [2.8 Chariow](#28-chariow)
  - [2.9 Stripe (détecté, non mentionné dans ta liste)](#29-stripe-détecté-non-mentionné-dans-ta-liste)
  - [2.10 Upstash Redis (détecté, non mentionné dans ta liste)](#210-upstash-redis-détecté-non-mentionné-dans-ta-liste)
  - [2.11 Synthèse priorisée](#211-synthèse-priorisée)

---

## Partie 1 — Comparatif des fournisseurs de scraping

### 1.1 Tableau comparatif

| Critère | **Scrape.do** | **Scrapingdog** | **ScrapingBee** |
|---|---|---|---|
| **Offre gratuite** | 1 000 crédits **par mois, récurrents** — palier "Free" à part entière, pas un essai unique. Toutes les fonctionnalités débloquées dès le gratuit : proxies résidentiels/mobiles, rendu JS, géociblage 160+ pays, sessions persistantes. Pas de CB requise. | Selon la page tarifs officielle : 200 crédits à l'inscription. Plusieurs sources tierces (non officielles) parlent plutôt d'un essai "30 jours / 1 000 crédits". ⚠️ **Écart non résolu avec certitude** — à vérifier au moment de l'inscription. Pas de CB requise. | 1 000 crédits, présentés comme un **essai ponctuel** plutôt qu'un palier gratuit qui se renouvelle chaque mois. Pas de CB requise. |
| **Pay-as-you-go sans abonnement** | ❌ Non trouvé — uniquement palier gratuit puis abonnements mensuels. | ✅ Oui — packs de crédits à la demande, **aucun engagement**, crédits **n'expirent jamais** (25 000 crédits pour 10 $). Abonnement mensuel dispo en option (~50 % moins cher au crédit, plus de concurrence simultanée). | ❌ Non trouvé — uniquement abonnements mensuels. |
| **1er palier payant** | Hobby : **29 $/mois** — 250 000 crédits (0,11 $/1k), 10 requêtes concurrentes | Pack PAYG dès **10 $** (25 000 crédits) ou abonnement mensuel (non détaillé publiquement dans les sources trouvées) | Freelance : **49 $/mois** — 250 000 crédits, 50 requêtes concurrentes |
| **Coût dégressif au volume** | 0,11 → 0,06 $/1k du palier Hobby (29 $) à Advanced (699 $) | ~0,058 $/1k en formule premium selon un comparatif tiers (source à prendre avec prudence, cf. § fiabilité) | 0,196 → 0,075 $/1k du palier Freelance (49 $) à Business+ (599 $) |
| **Endpoints dédiés pertinents pour Nadia+** | Google Maps (Ready API) ✅. Pas de LinkedIn/Instagram dédié trouvé. | **Google Maps, LinkedIn, Instagram, TikTok** — endpoints dédiés, retour JSON structuré, approche "no-code". C'est le seul des trois à couvrir explicitement les 4 cibles citées. | Pas d'endpoint réseau social dédié. Dédiés disponibles : Google, Amazon, YouTube, Walmart, ChatGPT, Gemini. |
| **Documentation / intégration** | Complète, API REST simple (token + url), SDKs. | Complète, API REST simple, dashboard clair. | Déjà **intégré et fonctionnel en prod** dans AutoFunnel AI (`lib/clone/fetcher.ts`, clonage de tunnels) — aucun problème rapporté à ce jour. |

Sources : [Scrape.do pricing](https://scrape.do/pricing/) · [Scrapingdog pricing](https://www.scrapingdog.com/pricing/) · [Scrapingdog — PAYG](https://www.scrapingdog.com/blog/introducing-pay-as-you-go-pricing-model/) · [ScrapingBee pricing](https://www.scrapingbee.com/pricing/)

### 1.2 Fiabilité réelle sur les cibles anti-bot (Nadia+)

**⚠️ Mise en garde importante avant les chiffres** : la quasi-totalité des comparatifs chiffrés trouvés en ligne (taux de succès, vitesse) sont **publiés par l'un des fournisseurs lui-même**, comparant ses propres résultats à ceux d'un concurrent — un biais évident. Je n'ai pas trouvé de discussion Reddit ou de benchmark réellement indépendant et récent comparant précisément ces trois outils sur Google Maps/LinkedIn/Instagram/Facebook. À traiter comme des indications, pas des preuves.

- **Scrape.do** revendique un taux de succès moyen de 98,19 % dans un comparatif... publié par Scrape.do lui-même face à ScrapingBee (92,69 %). Sur sa propre page de vente, il revendique aussi 99,98 % de succès global. [Source](https://scrape.do/blog/best-web-scraping-api/)
- **Scrapingdog** revendique 100 % de succès sur Google Maps, Amazon, Glassdoor, eBay, Walmart, Google dans ses propres comparatifs publiés. Sur Trustpilot (575+ avis, ~4/5 ⭐), plusieurs avis **indépendants** mentionnent spécifiquement une bonne fiabilité pour extraire des données Google Maps/Places à l'échelle. [Trustpilot](https://www.trustpilot.com/review/scrapingdog.com) · [Comparatif Scrapingdog vs ScrapingBee vs ScraperAPI](https://www.scrapingdog.com/blog/scrapingbee-vs-scraperapi-vs-scrapingdog/)
- **ScrapingBee** obtient des résultats mitigés dans un comparatif publié **par Scrapingdog** (0 % de succès sur Glassdoor, 40 % sur Walmart) — à prendre avec beaucoup de recul vu la source. Sur Capterra, des avis plus neutres le décrivent comme fiable en production, API simple, support réactif. Point le plus solide en sa faveur : il tourne **déjà en production dans ce projet** pour le clonage de tunnels, sans incident connu.
- Aucun des trois n'a d'endpoint LinkedIn dédié sauf Scrapingdog — mais voir § 1.3 ci-dessous : la difficulté n'est pas que technique.

### 1.3 Avertissement légal — LinkedIn / Facebook / Instagram

Point à ne pas sous-estimer pour Nadia+ : la disponibilité technique d'un endpoint ne dit rien du risque. En avril 2025, LinkedIn a mené une vague d'application stricte de ses conditions qui a fait bloquer du jour au lendemain des outils de prospection très établis comme **Apollo.io et Seamless.ai**. La distinction entre "violer les CGU" et "être illégal" existe, mais les CGU restent le levier que les plateformes utilisent réellement pour couper l'accès (bannissement de compte, blocage IP). Les recommandations qui reviennent le plus souvent :

- Ne jamais scraper derrière un mur de connexion — rester sur des pages publiques.
- Le RGPD (UE), le CCPA (Californie) et des lois équivalentes traitent les données personnelles scrapées comme un "traitement" nécessitant une base légale — pertinent si Nadia+ collecte des noms/emails/téléphones de prospects.
- Google Maps / Google Business est une cible **nettement moins risquée** juridiquement que LinkedIn/Facebook/Instagram (données d'établissements publics, pas de compte personnel derrière) — c'est le cas d'usage à prioriser en premier pour Nadia+.

[Source — LinkedIn/Facebook scraping légal 2026](https://sociavault.com/blog/linkedin-scraping-legal-guide-2026) · [Source — légalité du scraping 2026](https://use-apify.com/docs/what-is-apify/is-apify-legal)

**Recommandation concrète** : lance Nadia+ d'abord sur Google Maps/Google Business (risque faible, tous les fournisseurs gèrent bien cette cible). Traite le scraping LinkedIn/Facebook/Instagram comme une fonctionnalité "à risque assumé" séparée — décide consciemment si tu acceptes ce risque avant de la construire, plutôt que d'y arriver par défaut parce que l'endpoint existe.

### 1.4 Recommandation — mono-fournisseur ou fallback ?

| | Un seul fournisseur | Fallback multi-fournisseurs |
|---|---|---|
| **Pour** | Setup plus simple, un seul dashboard/quota à suivre, un seul compte à financer au démarrage | Résiste aux pannes, aux quotas épuisés, aux blocages ponctuels d'un fournisseur sur une cible donnée ; répartit le risque "un compte se fait bannir" |
| **Contre** | Un seul point de défaillance : quota épuisé ou cible bloquée = Nadia+ s'arrête net | Trois comptes à ouvrir/surveiller/facturer (même à faible usage), complexité de code |

**Verdict : garde l'architecture fallback — mais ne finance pas les trois comptes dès le jour 1.**

Le Module 2 (fallback multi-fournisseurs) est **déjà codé** dans ce projet (`lib/scraping/`) : le coût de complexité est un coût déjà payé, pas un coût à venir. La vraie question n'est donc plus "faut-il coder le fallback ?" mais "faut-il alimenter les trois comptes tout de suite ?". Réponse : non. Démarre avec un seul compte réellement actif et crédité (le principal, cf. § 1.5), garde les deux autres clés dans l'infra (variables d'environnement prêtes) mais avec des comptes créés et laissés sur leur palier gratuit, non financés. Tu actives le fallback réel (achat de crédits) seulement à la première vraie panne ou au premier dépassement de quota constaté — sans avoir besoin de redéployer de code, juste d'ajouter des crédits sur un compte déjà existant.

### 1.5 Recommandation — quel(s) fournisseur(s) ?

**Principal recommandé : Scrapingdog.** C'est le seul des trois à avoir des endpoints dédiés sur *les quatre cibles citées* (Google Maps, LinkedIn, Instagram — TikTok en bonus), le seul avec un vrai modèle pay-as-you-go sans abonnement (correspond exactement à ta contrainte), et les avis indépendants (Trustpilot) le créditent spécifiquement d'une bonne fiabilité sur Google Maps/Places.

**Fallback 1 : ScrapingBee.** Déjà intégré et éprouvé en production dans ce projet pour le clonage de tunnels — le garder comme filet de sécurité ne coûte rien de plus et c'est un quantité connue.

**Fallback 2 : Scrape.do**, à la place de ScraperAPI actuellement codé (voir § 1.6) — meilleur taux de succès général revendiqué dans les comparatifs trouvés, et le palier gratuit le plus généreux des trois (1 000 crédits *renouvelés chaque mois*, toutes fonctionnalités incluses), ce qui en fait un bon filet de sécurité qui ne coûte rien tant qu'il n'est pas sollicité.

Rappel de ta propre contrainte, à respecter à l'ouverture des 3 comptes : un compte par fournisseur, sous ton identité/moyen de paiement propre à chacun — jamais deux comptes gratuits chez le même fournisseur.

### 1.6 Écart avec le code déjà en place

Le Module 2 déjà codé dans ce projet utilise **ScrapingBee (principal) → Scrapingdog (fallback 1) → ScraperAPI (fallback 2)** — un trio différent de celui demandé ici (Scrape.do / Scrapingdog / ScrapingBee). ScraperAPI n'a pas été comparé dans cette étude car tu ne l'as pas demandé. Deux options :

1. **Ne rien changer** : l'architecture actuelle fonctionne, ScraperAPI reste un fallback de secours correct.
2. **Aligner le code sur cette étude** : promouvoir Scrapingdog en principal, garder ScrapingBee en fallback 1, remplacer ScraperAPI par Scrape.do en fallback 2. C'est un changement de quelques lignes dans `lib/scraping/index.ts` (constante `PROVIDER_ORDER`) plus l'ajout d'un connecteur `scrapedo.ts` sur le modèle des trois existants — pas une réécriture.

Je recommande l'option 2 si tu comptes utiliser Nadia+ sérieusement sur Google Maps/LinkedIn/Instagram — c'est précisément pour ces cibles que Scrapingdog est le mieux équipé des trois déjà codés. Dis-moi si tu veux que je fasse ce changement.

---

## Partie 2 — Audit des services tiers

Méthode : inspection de `package.json`, des appels `process.env.*` dans tout le code, et des routes API du projet — pas seulement ta liste de départ. Pour Supabase, j'ai aussi interrogé directement ton compte (organisation + taille de base) via les outils Supabase connectés à cette session ; c'est donc une donnée vérifiée, pas une supposition.

### 2.1 Supabase

| | |
|---|---|
| **Usage actuel** | Base Postgres (leads, funnels, workflows, CRM, admin…), Auth, Storage (médias uploadés/clonés). Colonne vertébrale de toute l'app. |
| **Offre actuelle** | ✅ **Vérifié directement sur ton compte : plan "Free"**. Taille actuelle de la base : **78 Mo** sur les 500 Mo inclus (~16 %). |
| **Limites du gratuit** | 500 Mo base de données, 1 Go stockage fichiers, 5 Go egress/mois, 50 000 MAU, 500 000 invocations edge functions/mois, **max 2 projets actifs**, **pas de sauvegardes automatiques**, pas de SLA/SSO. |
| **Ce qu'implique "rester gratuit"** | Le point le plus critique n'est pas l'espace disque (tu es large) : **un projet gratuit se met en pause après 7 jours d'inactivité totale**. Pour un produit commercial vendu à de vrais clients, c'est un risque de service inacceptable — pas une question de volume mais de disponibilité. Absence de sauvegardes automatiques = risque en cas de mauvaise manip base de données. |
| **Plans payants** | Pro : **25 $/mois** (8 Go base incluse + overage, pas de pause, sauvegardes quotidiennes, 100 Go egress). Team : ~599 $/mois. |
| **Nécessité de payer** | Oui, dès maintenant en pratique — pas à cause du volume (tu es loin des limites), mais à cause du **risque de pause** dès qu'il y a de vrais clients payants qui doivent pouvoir se connecter à n'importe quel moment, y compris après une semaine calme. |
| **Priorité** | 🔴 **Critique** — à traiter dès le lancement commercial réel, indépendamment du volume. |

Sources : [Supabase pricing 2026](https://uibakery.io/blog/supabase-pricing) · [Supabase free tier detail](https://cotera.co/articles/supabase-pricing-guide)

### 2.2 Vercel

| | |
|---|---|
| **Usage actuel** | Hébergement Next.js (App Router), cron (`/api/cron/send-scheduled-emails`), fonctions serverless. |
| **Offre actuelle** | ⚠️ Non vérifiée directement (pas d'accès à ton compte Vercel dans cette session) — à confirmer toi-même dans le dashboard. |
| **Limites du gratuit (Hobby)** | 100 Go bande passante/mois, 1M requêtes edge, 1M invocations fonctions, 4h CPU actif/mois. **Aucune option de dépassement** : au-delà des limites, le déploiement est mis en pause jusqu'au mois suivant — le site tombe hors ligne. |
| **Ce qu'implique "rester gratuit"** | ⚠️ **Point le plus important de tout cet audit** : d'après la FAQ officielle Vercel, *"Our Hobby plan is for personal, non-commercial use"* — c'est écrit noir sur blanc dans leurs conditions. AutoFunnel AI est un produit commercial vendu (abonnements Chariow, paiements Stripe/CinetPay des clients finaux) : l'utiliser sur le plan Hobby est **une violation des conditions d'utilisation de Vercel**, indépendamment du volume de trafic. Ce n'est donc pas une question de seuil à atteindre — c'est déjà non conforme si c'est le cas aujourd'hui. |
| **Plans payants** | Pro : **20 $/mois par utilisateur** + 20 $ de crédit d'usage inclus, 1 To de bande passante inclus, puis facturation à l'usage (PAYG) au-delà. |
| **Nécessité de payer** | Oui, immédiatement, pour une raison contractuelle et non de volume. |
| **Priorité** | 🔴 **Critique — à vérifier en priorité absolue.** Si le compte est actuellement sur Hobby, passe sur Pro avant toute autre dépense de cette liste. |

Source (page officielle, données structurées) : [vercel.com/pricing](https://vercel.com/pricing)

### 2.3 Resend

| | |
|---|---|
| **Usage actuel** | Envoi de tous les emails transactionnels + séquences/campagnes CRM. |
| **Offre actuelle** | ⚠️ Non vérifiée directement — à confirmer sur ton dashboard Resend. |
| **Limites du gratuit** | 3 000 emails/mois, **plafonné à 100/jour**, 1 domaine, 30 jours de rétention, 10 000 exécutions d'automatisation/mois, 5 crédits IA/mois. |
| **Ce qu'implique "rester gratuit"** | Le plafond de 100/jour est le vrai risque : dès que plusieurs clients de la plateforme envoient des séquences/campagnes le même jour, ce plafond peut être atteint et bloquer des envois pour **tout le monde** (c'est un compte Resend partagé par toute la plateforme, pas un compte par client). Les logs Vercel consultés plus tôt dans cette conversation montrent déjà des dizaines d'emails programmés sur une fenêtre courte — le seuil peut être atteint plus vite que prévu une fois plusieurs clients actifs. |
| **Plans payants** | Pro : **20 $/mois** — 50 000 emails/mois, **pas de plafond quotidien**, 10 domaines, 100 crédits IA. Scale : 90 $/mois — 100 000 emails/mois. |
| **Nécessité de payer** | Dès que le volume cumulé de tous les utilisateurs de la plateforme dépasse ~100 emails/jour de façon régulière — plausible dès une poignée de clients actifs en séquences email. |
| **Priorité** | 🟠 **Recommandé dès les premiers clients payants actifs**, 🔴 **critique** dès le premier blocage réel constaté. |

Source (page officielle) : [resend.com/pricing](https://resend.com/pricing)

### 2.4 Sentry

| | |
|---|---|
| **Usage actuel** | Observabilité/suivi d'erreurs (`@sentry/nextjs`, `instrumentation.ts`). |
| **Offre actuelle** | ⚠️ Non vérifiée directement — à confirmer sur ton dashboard Sentry. |
| **Limites du gratuit (Developer)** | 5 000 erreurs/mois, **1 seul utilisateur**, 30 jours de rétention, ~10 000 unités de performance/mois. |
| **Ce qu'implique "rester gratuit"** | Deux limites distinctes : (1) un seul compte utilisateur — bloquant si tu veux donner accès à un collaborateur/développeur un jour ; (2) au-delà de 5 000 erreurs/mois, les nouvelles erreurs ne sont simplement plus capturées (pas de facturation surprise, juste une perte de visibilité). |
| **Plans payants** | Team : **26 $/mois** (50 000 erreurs, multi-utilisateurs, dépassement facturé à l'usage). Business : 80 $/mois. |
| **Nécessité de payer** | Tant que tu es seul aux commandes et que le volume d'erreurs reste faible, le gratuit suffit largement. |
| **Priorité** | 🟢 **Peut attendre** — passer à Team seulement quand un collaborateur a besoin d'un accès, ou si le volume d'erreurs approche 5 000/mois. |

Sources : [Sentry pricing 2026](https://last9.io/blog/sentry-pricing/) · [Sentry free plan detail](https://sentrypricing.com/free-plan)

### 2.5 OpenRouter

| | |
|---|---|
| **Usage actuel** | Deux clés distinctes : (1) génération IA des tunnels — payante, modèle `z-ai/glm-4.6` consommé via crédits OpenRouter ; (2) chatbot support — clé séparée `OPENROUTER_CHATBOT_API_KEY`, restreinte par le code à des modèles `:free` uniquement, coût nul par construction. |
| **Offre actuelle** | Pas un "plan" classique — système de crédits prépayés (PAYG pur), pas d'abonnement mensuel. |
| **Limites du gratuit (clé chatbot)** | Modèles `:free` : **50 requêtes/jour** tant qu'aucun crédit n'a jamais été acheté sur le compte ; ce plafond monte à **1 000/jour** dès qu'au moins **10 $** de crédits ont été achetés une fois (achat ponctuel, pas récurrent). Frais sur achat de crédits : 5,5 % (min. 0,80 $) par carte, 5 % en crypto. |
| **Ce qu'implique "rester gratuit"** | La clé génération n'est **jamais gratuite par nature** : elle nécessite un solde de crédits en continu — ce n'est pas un seuil à surveiller, c'est déjà actif dès le premier tunnel généré. La clé chatbot, elle, peut réellement rester à coût zéro, mais plafonnée à 50 req/jour tous visiteurs confondus tant qu'aucun crédit n'a été déposé. |
| **Plans payants** | Aucun "plan" — juste des dépôts de crédits à la demande. |
| **Nécessité de payer** | Clé génération : déjà payante en continu, il faut juste veiller à ne jamais tomber à sec (le code a un `AI_KILL_SWITCH` qui coupe proprement la génération si besoin — bon garde-fou déjà en place). Clé chatbot : un dépôt ponctuel de 10 $ (frais unique ~0,80 $) suffit à passer de 50 à 1 000 req/jour, sans engagement récurrent — à faire dès que le trafic du chatbot dépasse ~50 visiteurs/jour posant une question. |
| **Priorité** | Clé génération : 🔴 **déjà critique en continu** (surveiller le solde). Clé chatbot : 🟢 **peut rester gratuite**, 🟠 recommandé de déposer 10 $ une fois le trafic du site plus soutenu. |

Sources : [OpenRouter FAQ officiel](https://openrouter.ai/docs/faq)

### 2.6 Fournisseur de scraping (retenu en Partie 1)

| | |
|---|---|
| **Usage actuel** | (1) Clonage de tunnels par URL — déjà en prod via ScrapingBee (`lib/clone/fetcher.ts`) ; (2) futur agent de prospection Nadia+ (Google Maps, réseaux sociaux) via le Module 2 fallback. |
| **Offre actuelle** | ⚠️ Compte ScrapingBee existant non vérifié directement — probablement déjà au-delà du palier d'essai gratuit vu l'usage en prod pour le clonage ; à vérifier sur son dashboard. |
| **Ce qu'implique "rester gratuit"** | Le clonage de tunnels étant déjà en prod, il est probable que le compte ScrapingBee actuel consomme déjà des crédits payants ou soit proche de l'épuisement de son essai. Nadia+ ajoutera un volume de requêtes potentiellement bien plus élevé (recherches répétées quotidiennes) — c'est probablement **le poste de coût variable le plus sensible au volume de toute cette liste**, avant même l'IA de génération. |
| **Nécessité de payer** | Dès que Nadia+ tourne réellement en prospection active (pas au stade démo/test) — pas un "si", plutôt un "quand". |
| **Priorité** | 🟠 **Recommandé de budgéter dès le lancement de Nadia+** — c'est le cœur fonctionnel de cet agent, pas une dépense à retarder. |

### 2.7 CinetPay

| | |
|---|---|
| **Usage actuel** | (1) Vérification/activation de licences plateforme achetées via CinetPay (Mobile Money) ; (2) encaissement Mobile Money des clients finaux sur les tunnels publiés. |
| **Offre actuelle** | Pas de plan gratuit/payant classique — modèle 100 % à la commission par transaction. |
| **Limites** | Aucune limite de type "palier gratuit" — chaque transaction encaissée est déjà commissionnée dès la première vente. |
| **Taux exact** | ⚠️ **Non trouvé publiquement** — CinetPay ne publie pas de grille tarifaire en ligne ; le taux dépend du pays et du volume, sur devis auprès de leur équipe commerciale. |
| **Nécessité de payer** | Non applicable — il n'y a rien à "passer payant", le service facture déjà à la transaction. |
| **Priorité** | Pas de priorité d'upgrade — mais je recommande de **contacter CinetPay directement** pour obtenir ton taux exact par pays et confirmer qu'il n'y a pas de frais fixes mensuels cachés sur le compte marchand, information que je n'ai pas pu vérifier avec certitude. |

Source : [cinetpay.com/products/payments](https://cinetpay.com/products/payments)

### 2.8 Chariow

| | |
|---|---|
| **Usage actuel** | Vente des abonnements à la plateforme AutoFunnel AI elle-même (Starter/Pro/Agency) — **canal actif principal actuellement** (le canal Stripe équivalent est en pause, voir § 2.9). |
| **Offre actuelle** | ✅ Vérifié sur la page officielle. Pas de frais mensuel, pas de frais d'installation. |
| **Commission** | **15 % flat** tant que le chiffre d'affaires cumulé est **inférieur à 5 000 $** ; **10 % flat** au-delà. Reversement des gains sous 72h. |
| **Nécessité de payer** | Non applicable — commission automatique par vente, rien à activer. |
| **Priorité** | Pas de priorité d'upgrade — le palier à 10 % s'applique automatiquement une fois 5 000 $ de CA cumulé atteints, aucune action de ta part n'est nécessaire. |

Source (page officielle) : [chariow.com/fr/pricing](https://chariow.com/fr/pricing)

### 2.9 Stripe (détecté, non mentionné dans ta liste)

| | |
|---|---|
| **Usage détecté dans le code** | Deux usages bien distincts, à ne pas confondre : **(a)** abonnement à la plateforme AutoFunnel AI elle-même (`/api/subscribe`, `/api/stripe/webhook`, portail de facturation) — d'après un commentaire explicite dans le code (`PlanPicker.tsx`), ce canal est actuellement **"MUET"/en pause**, affiché grisé "Bientôt disponible" ; seuls les abonnés Stripe historiques gardent leur portail de gestion. **(b)** paiement one-time des **produits vendus dans les tunnels publiés** par tes utilisateurs (`/api/checkout`) + **Stripe Connect** (`connect/onboard`, `connect/refresh`, `connect/status`) qui permet à un créateur de tunnel de connecter son propre compte Stripe pour encaisser directement ses clients à l'international par carte — ce second usage est **actif** (visible dans l'onglet "Paiements" du dashboard). |
| **Offre actuelle** | Pas de plan gratuit/payant — facturation 100 % à la transaction. |
| **Tarifs** | Carte US : **2,9 % + 0,30 $**. Carte internationale : **4,4 % + 0,30 $** (majoration cross-border de 1,5 %). Stripe Connect (pour les créateurs connectés) : **2 $/mois + 0,25 % + 0,25 $ par virement de reversement**, en plus du taux de transaction standard. |
| **Nécessité de payer** | Déjà facturé à la transaction pour l'usage (b), sans action requise. |
| **Priorité** | ⚠️ **À clarifier avec toi** : ce double usage n'était pas dans ta liste de départ — je ne suis pas certain qu'il soit pleinement intentionnel/à jour, ou un reliquat d'une ancienne architecture de facturation avant le passage à Chariow. À vérifier : le canal d'abonnement Stripe legacy doit-il rester ouvert pour tes abonnés historiques, ou être fermé proprement ? |

Sources : [Stripe fees 2026](https://paymentcloudinc.com/blog/stripe-fees/) · [Stripe Connect fees 2026](https://feetrace.com/blog/stripe-connect-fees-for-saas-platforms-in-2026-a-comprehensive-guide)

### 2.10 Upstash Redis (détecté, non mentionné dans ta liste)

| | |
|---|---|
| **Usage détecté dans le code** | Rate-limiting anti-abus (`lib/rate-limit.ts`) — protège la génération IA et certaines API contre le spam. Le code est conçu en **fail-open** : si Upstash n'est pas configuré ou tombe en panne, le rate-limit est simplement désactivé (jamais bloquant pour l'utilisateur). |
| **Offre actuelle** | ⚠️ Non vérifiée directement — à confirmer si un compte est déjà ouvert. |
| **Limites du gratuit** | **256 Mo** + **500 000 commandes/mois**, utilisable indéfiniment, aucune carte requise. |
| **Ce qu'implique "rester gratuit"** | Chaque vérification de rate-limit consomme 2 commandes Redis (`INCR` + `EXPIRE`). Largement suffisant pour ce seul usage — il faudrait un trafic très important pour approcher 500 000 commandes/mois rien que pour du rate-limiting. |
| **Plans payants** | PAYG : 0,20 $/100 000 commandes + 0,25 $/Go-mois au-delà de 1 Go inclus. Forfaits fixes dès 10 $/mois. |
| **Nécessité de payer** | Quasiment jamais pour ce seul usage, sauf trafic massif. |
| **Priorité** | 🟢 **Peut attendre** — marge très confortable. |

Source : [Upstash pricing](https://upstash.com/pricing/redis)

### 2.11 Synthèse priorisée

**OK en gratuit pour le MVP, sans action à prévoir :**
- Sentry (tant que tu restes seul utilisateur du dashboard)
- Upstash Redis (marge énorme par rapport à l'usage réel)
- OpenRouter — clé chatbot (tant que <50 requêtes/jour, ou dépôt ponctuel de 10 $ pour passer à 1 000/jour)

**À faire passer payant en premier, dès le lancement commercial :**
1. 🔴 **Vercel** — vérifier immédiatement le plan actif ; passer sur Pro si le compte est sur Hobby, indépendamment du volume (question de conformité aux conditions d'utilisation, pas de trafic).
2. 🔴 **Supabase** — passer sur Pro dès les premiers vrais clients payants, pour éliminer le risque de mise en pause après 7 jours d'inactivité.
3. 🟠 **Resend** — passer sur Pro dès que le volume cumulé de tous les clients dépasse ~100 emails/jour de façon régulière.
4. 🟠 **Fournisseur de scraping (Nadia+)** — prévoir un budget dès que Nadia+ tourne réellement en prospection, pas au stade démo.
5. (déjà actif, à surveiller en continu) **OpenRouter — clé génération** : nécessite déjà un solde de crédits, ce n'est pas un "seuil" mais une dépense courante à réapprovisionner.

**Facturés à la transaction, sans "seuil" à surveiller (CinetPay, Chariow, Stripe Connect)** : rien à activer, ces trois-là scalent automatiquement avec le chiffre d'affaires.

**Estimation du coût mensuel minimal, ordre de grandeur, une fois les postes critiques activés** *(hors commissions transactionnelles CinetPay/Chariow/Stripe qui scalent avec le CA, et hors coût variable du scraping/IA qui dépend du volume réel)* :

| Poste | Coût |
|---|---|
| Vercel Pro | ~20 $/mois |
| Supabase Pro | ~25 $/mois |
| Resend Pro | ~20 $/mois |
| **Sous-total fixe** | **~65 $/mois** |
| OpenRouter (génération IA, variable) | à budgéter selon volume, ordre de grandeur 20-50 $/mois pour démarrer |
| Scraping Nadia+ (variable) | à budgéter selon volume, ordre de grandeur dès 10 $/mois (1er pack PAYG Scrapingdog) |

**Total réaliste au lancement, hors commissions sur ventes : environ 90 à 150 $/mois**, principalement tiré par le volume réel d'usage IA et de scraping plutôt que par des coûts fixes.

⚠️ Cette estimation est un ordre de grandeur construit à partir des tarifs publics 2026 trouvés — pas un devis. Les coûts variables (IA, scraping) dépendent entièrement du volume réel de Nadia+ et du nombre de tunnels générés par mois, que je n'ai pas les moyens d'estimer depuis le code seul.

---

## Informations non vérifiées avec certitude — récapitulatif

- Nombre exact de crédits gratuits Scrapingdog à l'inscription (200 vs 1 000 selon les sources).
- Plans actuellement actifs sur Vercel, Resend, Sentry, Upstash, ScrapingBee pour ce projet précis (seul Supabase a été vérifié directement via API).
- Taux de commission exact CinetPay par pays (non publié publiquement).
- Statut réel voulu du canal d'abonnement Stripe legacy (à clarifier avec toi).
- Tous les benchmarks de taux de succès/vitesse entre fournisseurs de scraping (sources majoritairement publiées par les fournisseurs eux-mêmes ou leurs concurrents directs).
