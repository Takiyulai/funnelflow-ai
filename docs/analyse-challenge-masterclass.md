# Analyse — types de tunnel « Challenge / Bootcamp » et « Masterclass »

**Date :** 30 juillet 2026
**Nature :** analyse et proposition. Aucun code modifié.

**Contrainte cadrante rappelée :** AutoFunnel ne stocke aucun fichier, n'a ni
espace membre ni authentification prospect. Vidéos = embeds externes, fichiers =
liens externes, emails = outil de l'utilisateur. Toute proposition ci-dessous
respecte cette contrainte ; ce qui ne la respecte pas est explicitement rangé en
V2 hors périmètre.

---

# A. État actuel

## A.1 — Challenge / Bootcamp

**Fichiers concernés**

| Fichier | Rôle |
|---|---|
| `lib/funnels/kinds.ts` | Option de wizard `challenge` (libellés, pages annoncées) |
| `lib/funnels/pageCatalogs.ts` | Blueprint `CHALLENGE` (4 rôles de pages) |
| `lib/funnels/types.ts` | Champs de brief `challengeDays`, `challengeOffer*` |
| `lib/ai/generate.ts` | Pitch conditionnel, double offre, `applyChallengeMultiDay` |
| `components/funnel/wizard/FunnelKindStep.tsx` | `ChallengeDetailsFields` (nombre de jours) |
| `components/funnel/CreateFunnelWizard.tsx` | Bloc « Offre vendue à la fin du challenge » |

### Structure de pages générée

| Ordre | Rôle | Slug | Lié publiquement | Sections par défaut |
|---|---|---|---|---|
| 1 | `challenge-landing` | `challenge` | **oui** | hero, benefits, program, testimonials, faq, cta, guarantee |
| 2 | `confirmation` | `confirmation` | non | hero, process, about, program, cta |
| 3 | `challenge-day` | `jour-1` … `jour-N` | non | hero, **video**, benefits, cta, faq |
| 4 | `sales` | `offre` | non | squelette direct-response complet (13 sections) |

Cadre de copywriting : AIDA sur la landing, REASSURANCE sur la confirmation, 4P
sur les jours, PAS sur le pitch final.

### Génération multi-jours

`applyChallengeMultiDay` (generate.ts, ~ligne 5860) :

1. L'IA ne génère **qu'une seule** page « Jour 1 », qui sert de gabarit.
2. Elle est clonée en `jour-2` … `jour-N` selon `challengeDays` (défaut 5,
   borné 1–30).
3. Sur chaque clone, un `relabelDay` réécrit `Jour 1` → `Jour N` dans
   `eyebrow`, `headline` et `subheadline`.
4. Les pages sont rechaînées : Jour 1 → Jour 2 → … → Jour N → pitch final.

### Corrections déjà appliquées — état vérifié

**✅ Champ « Offre vendue à la fin du challenge » — en bon état.**
`challengeOfferName`, `challengeOfferPrice`, `challengeOfferPromise` existent
dans `FunnelBrief` et sont exposés dans le sous-onglet « Offre » du wizard,
conditionnés à `funnelKind === "challenge"`.

**✅ Pitch final conditionnel — en bon état, symétrique du webinaire.**
`generate.ts` ligne ~3531 : sans `challengeOfferName`, le blueprint `sales` est
retiré. Ligne ~3792 : `isChallengeSalesPage` construit un `secondaryOffer` avec
une consigne `avoid` explicite (« ne parle pas du challenge comme de l'offre »).

### Accès au contenu quotidien — état actuel

Les pages « Jour N » ont `publiclyLinked: false`. Cette propriété **n'est qu'un
marqueur de blueprint** : rien dans le routage public ne la vérifie. La page
`/tunnel/{slug}/jour-3` est donc **accessible à quiconque connaît l'URL**.

Le modèle est donc : **non listé, mais non protégé.** C'est cohérent avec la
contrainte (pas d'authentification), mais il faut l'assumer et le dire à
l'utilisateur — aujourd'hui, rien ne le lui dit.

### Écarts identifiés

**⚠️ Écart 1 — le prix de l'offre de clôture n'est jamais injecté.**
`applyWebinarSalesOffer` (ligne 5795) commence par
`if (normalizeFunnelKind(brief.funnelKind) !== "webinar") return;`. **Il n'existe
aucun équivalent pour le challenge.** Le `challengeOfferPrice` saisi au wizard
n'atteint donc jamais les cartes de prix du pitch final : c'est le prix inventé
par l'IA qui subsiste.

**⚠️ Écart 2 — la porte « offre payante » ignore le challenge.**
Ligne 4154 : `effectivePriceForPaidGate` ne traite que `webinar`. Pour un
challenge gratuit avec offre de clôture payante, c'est `brief.price`
(« Gratuit ») qui est évalué. Le repli `funnelHasPaidOffer` que nous avions
ajouté rattrape le cas **si** l'IA a écrit un prix payant sur la page — donc le
défaut est intermittent, ce qui est pire qu'un défaut franc. Conséquence directe
ligne 4185 : `appendPriceToFinalCta` ne s'applique pas.

**⚠️ Écart 3 — les jours 2 à N sont des copies quasi identiques.**
Le seul mécanisme de différenciation est `relabelDay`, qui ne réécrit que si le
texte contient littéralement « Jour 1 ». Si l'IA a titré « On attaque les
fondations », les cinq jours affichent **exactement le même contenu**. C'est le
défaut le plus visible pour l'utilisateur final, et le plus dommageable
commercialement : un challenge de 5 jours livre 5 pages identiques.

## A.2 — Masterclass

**Constat principal : la Masterclass n'existe pas comme type distinct — et
c'est déjà, de fait, le bon choix.**

`lib/funnels/kinds.ts` ligne 67 :

```
label: { fr: "Webinaire / Masterclass", en: "Webinar / Masterclass", … }
```

Le type `webinar` porte donc déjà les deux appellations. Aucun blueprint
`masterclass`, aucun `FunnelKind` correspondant.

### Structure du type Webinaire

| Ordre | Rôle | Slug | Conditionnel |
|---|---|---|---|
| 1 | `registration` | `inscription` | — |
| 2 | `confirmation` | `confirmation` | — |
| 3 | `live` | `en-direct` | — |
| 4 | `replay` | `replay` | — |
| 5 | `sales` | `offre` | **oui** — seulement si `postWebinarOfferName` |

Champs de brief associés : `webinarDate`, `webinarUrgency`,
`webinarExternalLink`, `replayExpiryHours`, `webinarMode` (`live` /
`evergreen`), `evergreenVideoUrl`, `evergreenOfferHours`,
`postWebinarOfferName` / `Price` / `Promise`.

### Faut-il un type distinct ? Non.

Une masterclass, c'est : on s'inscrit, on reçoit une confirmation, on assiste à
une session, on peut la revoir, on se voit proposer une offre. **C'est
exactement la séquence du webinaire.** Les différences sont de vocabulaire et de
ton, pas de structure.

Créer un `kind: "masterclass"` dupliquerait :

- le blueprint `WEBINAR` (5 pages, 2 × ~40 lignes de configuration) ;
- `applyWebinarSchedule` (date, compte à rebours, lien externe) ;
- la logique de page de vente conditionnelle ;
- le mode evergreen entier ;
- `applyWebinarSalesOffer` ;
- les branches `normalizedKind === "webinar"` disséminées dans `generate.ts`.

**Chaque correction future du webinaire devrait alors être appliquée deux fois**
— et l'expérience de ce projet montre que la seconde est oubliée (voir
précisément les écarts 1 et 2 du challenge, qui sont des oublis de symétrie).

**Recommandation : la Masterclass doit rester une VARIANTE du webinaire**,
pilotée par un champ de vocabulaire, pas par un type.

---

# B. Propositions priorisées

## B.1 — NÉCESSAIRE

### N1. Injecter le prix de l'offre de clôture du challenge
Créer l'équivalent challenge d'`applyWebinarSalesOffer`, ou mieux, généraliser
la fonction existante pour couvrir les deux types (une seule fonction
paramétrée, plutôt qu'un doublon qui divergera).
**Effort : 0,5 j.** Corrige un champ du wizard actuellement sans effet.

### N2. Étendre la porte « offre payante » au challenge
`effectivePriceForPaidGate` doit retenir `challengeOfferPrice` pour le kind
`challenge`, comme il retient `postWebinarPrice` pour `webinar`.
**Effort : 0,25 j.** Rend déterministe un comportement aujourd'hui intermittent.

### N3. Différencier réellement les jours du challenge
Aujourd'hui les jours 2 à N sont des clones. Deux options :

- **N3-a (légère)** — un champ wizard « Titres des jours », une ligne par jour,
  pré-rempli et modifiable. Le titre saisi remplace le `headline` du hero de
  chaque page. Contenu du corps toujours cloné, mais chaque jour a son sujet.
  **Effort : 1 j.**
- **N3-b (complète)** — l'IA génère les N jours en un seul appel, à partir des
  titres saisis, avec un contenu propre à chaque jour.
  **Effort : 2 à 3 j** et **N × le coût de génération** — à peser, tes crédits
  sont déjà un sujet.

**Recommandation : N3-a d'abord.** Elle supprime le défaut le plus visible pour
un coût modeste et sans surcoût de génération. N3-b reste ouverte ensuite.

## B.2 — RECOMMANDÉ

### R1. Masterclass comme preset du webinaire
Ajouter `sessionKind?: "webinar" | "masterclass"` au brief (défaut `webinar`).
Effets, **et rien d'autre** :

- vocabulaire des prompts (« masterclass », « formation », « session » au lieu
  de « webinaire ») ;
- noms de pages générées (« Page d'inscription à la masterclass ») ;
- deux cartes distinctes dans le sélecteur de type du wizard, pointant sur le
  même `kind: "webinar"` avec un `sessionKind` différent.

Aucun blueprint dupliqué, aucune branche de génération supplémentaire.
**Effort : 1 j.**

### R2. Avertir sur la nature des URL « Jour N »
Un encart dans le wizard et dans l'éditeur : *« Ces pages ne sont pas listées
publiquement, mais restent accessibles à qui connaît l'URL. Envoie-les jour
après jour par email. »*
**Effort : 0,25 j.** Corrige une attente implicite dangereuse : un utilisateur
peut croire que ses jours sont protégés.

### R3. Bloc « Diffusion par email » sur la page de confirmation du challenge
Une section générée qui explique au participant qu'il recevra chaque jour un
email avec son lien. Aligne l'attente du prospect sur le fonctionnement réel.
**Effort : 0,5 j.**

### R4. Renseigner le champ « durée » du challenge dans le copywriting
`challengeDays` alimente la génération des pages mais n'est pas passé au
copywriting de la landing (« challenge de 5 jours » n'apparaît pas
automatiquement).
**Effort : 0,25 j.**

## B.3 — HORS PÉRIMÈTRE (V2)

Explicitement **non proposé et non à implémenter** :

- espace membre / espace challenge avec identification du prospect ;
- déblocage progressif côté serveur (`available` / `unlocked` / `completed`) ;
- suivi de complétion jour par jour, badges, progression ;
- hébergement de vidéos ou de fichiers ;
- moteur de drip-content ;
- tags CRM de progression automatique par jour ;
- expiration automatique des URL de jour.

---

# C. Impact sur le wizard

## C.1 — Challenge

| Champ | État actuel | Proposition |
|---|---|---|
| Nom du challenge | ✅ via `offerName` | — |
| Promesse | ✅ via `promise` | — |
| Durée (jours) | ✅ `challengeDays` (1–30, défaut 5) | Passer aussi au copywriting (R4) |
| Gratuit / payant | ⚠️ via `price` uniquement | Rendre explicite : bouton « Gratuit » / « Payant » qui pré-remplit `price` |
| Créateur / animateur | ✅ via `aboutText` | — |
| **Titres des jours** | ❌ **absent** | **À ajouter (N3-a)** — N lignes selon `challengeDays` |
| Offre finale | ✅ bloc dédié | — |

## C.2 — Masterclass

| Champ | État actuel | Proposition |
|---|---|---|
| Sujet | ✅ via `offerName` / `promise` | Libellés adaptés au vocabulaire masterclass (R1) |
| Format live / enregistré | ✅ `webinarMode` (`live` / `evergreen`) | Renommer les libellés : « En direct » / « À la demande » |
| Date / heure | ✅ `webinarDate` | — |
| Offre | ✅ `postWebinarOfferName/Price/Promise` | — |
| Replay | ✅ `replayExpiryHours` | — |

**Aucun champ nouveau n'est nécessaire pour la Masterclass.** Elle est déjà
entièrement couverte par les champs du webinaire — ce qui confirme qu'un type
distinct serait une duplication pure.

---

# D. Récapitulatif V2 (repoussé)

1. Espace membre / authentification prospect
2. Déblocage progressif serveur du contenu
3. Suivi de complétion et progression
4. Hébergement de vidéos et fichiers
5. Moteur de drip-content
6. Tags CRM de progression
7. Génération IA différenciée des N jours (N3-b) — techniquement dans le
   périmètre, mais repoussée pour raison de coût de génération

---

# E. Questions à trancher avant implémentation

1. **N3-a ou N3-b ?** Titres des jours saisis à la main (1 j, sans surcoût IA),
   ou génération IA différenciée par jour (2–3 j, N × le coût de génération) ?
   Ma recommandation : N3-a maintenant.

2. **La Masterclass doit-elle apparaître comme une carte séparée** dans le
   sélecteur de type du wizard (deux cartes → même `kind`, `sessionKind`
   différent), ou reste-t-elle un simple libellé partagé comme aujourd'hui ?

3. **Le champ « gratuit / payant » du challenge** doit-il devenir un vrai
   sélecteur, ou reste-t-on sur la saisie libre de `price` ?

4. **Combien de jours au maximum** veux-tu autoriser ? La borne actuelle est 30,
   ce qui autorise un tunnel de 33 pages — lourd à générer et à éditer. Une
   borne à 14 serait plus réaliste.

5. **R2 (avertissement sur les URL non protégées)** : veux-tu ce message, ou
   préfères-tu ne pas attirer l'attention sur cette limite ? Je recommande de
   l'afficher : la mauvaise surprise coûte plus cher que l'aveu.
