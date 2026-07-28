# Rapport — Page « Accès », audit des tunnels, animations au scroll

**Date :** 27 juillet 2026
**Périmètre :** génération de tunnels (wizard classique + Express IA), matrice CTA, moteur d'animations.

> ⚠️ **Build non exécuté.** Le sandbox Linux de la session est indisponible
> (`HYPERVISOR_VIRT_DISABLED`). `npm run build` / `npm run lint` / `vitest`
> **doivent être lancés localement** avant tout commit. La section
> « Tests à exécuter » liste ce qu'il faut vérifier.

---

## 1. Problème 1 — Suppression de la page « Accès » (Lead magnet)

### Structure finale du tunnel Lead magnet

| # | Rôle | Slug | Statut |
|---|------|------|--------|
| 1 | `optin` | `accueil` | toujours générée |
| 2 | `oto` (tripwire 7–27 €) | `offre-speciale` | **optionnelle**, cochable dans l'aperçu du wizard |
| 3 | `thankyou` | `merci` | toujours générée — **page terminale** |

→ **2 pages par défaut : Capture → Merci** (identique en wizard classique et en Express IA,
les deux passant par `generateMultiPageFunnelWithAI`).

Le tripwire, qui s'insérait auparavant *entre* « Merci » et « Livraison », se place
désormais **juste après la capture**, avant la page de remerciement.

### Ce qui a été vérifié pour ne rien casser

- **Navigation / redirections** : aucune page n'est référencée en dur. La page
  suivante est calculée à l'exécution (`nextPageId`, sinon index+1) dans
  `FunnelPreview` et `lib/export/html.ts`. Le bouton « étape suivante » de
  `SuccessChannels` disparaît naturellement puisque « Merci » est maintenant la
  dernière page.
- **Compteur de pages** : dérivé de `funnel.pages.length`, aucun littéral.
- **Aperçu / publication** : les deux passent par `FunnelPreview`, piloté par les données.
- **Rétrocompatibilité** : le rôle `delivery` reste défini partout
  (`types.ts`, `pageGenerator.ts` PAGE_COPY, `cta-matrix.ts`, `PageSelector`,
  `theme-css.ts`, export systeme.io). Les tunnels déjà générés en 3 pages
  continuent de s'afficher, de se publier et de s'exporter à l'identique.
  **Seule la génération de nouveaux tunnels change.**

### Page « Merci » enrichie

- **Confirmation boîte mail** : déjà produite par `ensureCelebratoryThankYou`
  (branche « offre gratuite ») → « Votre inscription est confirmée / Votre accès
  arrive par email d'ici quelques minutes… ». Le prompt de rôle `thankyou`
  précise maintenant que c'est la **dernière page** et qu'il n'y a **qu'un seul
  bouton**.
- **Boutons WhatsApp / Telegram** — *cause racine du bug « demandés mais absents »* :
  `funnel.meta.socialChannels` n'était renseignable **que dans l'éditeur**
  (Style global). Le wizard ne collectait rien, donc `SuccessChannels` n'avait
  jamais de lien à afficher. Corrigé de bout en bout :
  `FunnelBrief.communityWhatsappUrl` / `communityTelegramUrl` → champs wizard
  (étape « Génération », donc **présents aussi en Express IA**) → schéma zod de
  l'API → `applyCommunityChannels()` → `meta.socialChannels` → `SuccessChannels`
  (aperçu + publication).
- **Double bouton « Vérifier ma boîte mail »** : `dedupeSuccessPageCtas()`
  supprime, sur toute page de succès, les CTA en doublon (même libellé normalisé
  **ou** même destination). Une section `cta` devenue redondante est retirée
  entièrement ; sur les autres sections, seul le bouton l'est.
- **Sous-titres redondants** : `dedupeRedundantSubheadlines()` vide un sous-titre
  qui paraphrase le titre de sa propre section, ou qui est quasi identique à
  celui de la section précédente (comparaison normalisée : minuscules, sans
  accents, inclusion, ou ≥ 80 % de mots significatifs communs). Appliqué à
  **tous les types de tunnels**. Une directive de copywriting a également été
  ajoutée au prompt (FR + EN/ES).

---

## 2. Problème 2 — Audit des autres types de tunnels

### 2.1 Anomalies CORRIGÉES

**A. Boutons contradictoires sur les pages qui vendent une offre secondaire** *(critique)*

`resolveCTAIntent()` retombait sur `convert-primary` pour tout rôle non couvert
par l'archétype. Conséquences mesurées :

| Tunnel | Page | Libellé produit | Destination produite |
|---|---|---|---|
| Lead magnet | tripwire `oto` (7–27 €) | « Télécharger gratuitement » | page de **capture** |
| Webinaire | vente post-webinaire `sales` | « Je réserve ma place » | page d'**inscription** |
| Challenge | pitch final `sales` | « S'inscrire gratuitement » | page d'**inscription** |
| Booking / Coaching | `oto` | « Réserver mon créneau » | page de **réservation** |

Le bouton d'achat renvoyait donc le visiteur en arrière, vers le formulaire déjà rempli.

**Correctif** — nouvelle intention `offer-primary` :
- libellé neutre d'achat (`OFFER_PRIMARY_LABEL` : « Je profite de l'offre » / « Get this offer » / « Aprovechar la oferta ») ;
- destination = **ancre vers la section offre/pricing de la page courante**, sinon `#ff-checkout` ; plus jamais `pageId` vers la page de capture ;
- appliquée aux rôles `oto`, `upsell`, `downsell`, `sales` **uniquement là où l'archétype ne définissait aucune règle** (`withOfferRoleDefaults`). Purement additif : la page `sales` de `digital-product` garde son `convert-primary` vers la page de commande.

**B. Checkout interne absent des pages d'offre secondaire**

`applyInternalCheckoutCtas()` ne re-ciblait les CTA de section que sur
`isHome || role === "sales"`. Les pages `oto` / `upsell` / `downsell` en étaient
exclues alors qu'elles vendent. Rôles ajoutés à la liste (garde
`pageHasPaidOffer` inchangée).

**C. Sous-titres redondants** — corrigé pour tous les types (voir §1).

**D. CTA communautaires manquants** — corrigé pour tous les types : `SuccessChannels`
s'affiche sur toutes les pages de succès, quel que soit le tunnel.

### 2.2 Anomalies SIGNALÉES — validation requise avant modification

| # | Type | Constat | Recommandation |
|---|------|---------|----------------|
| 1 | **Vente produit digital** | Le tunnel génère `merci` (slug `merci`) **et** `access` (slug `acces`). Même doublon structurel que le lead magnet : la plateforme n'héberge rien, la page « Accès » ne peut contenir qu'un lien externe que la page « Merci » pourrait porter. | Supprimer `access` du blueprint (→ 3 pages : Vente → Paiement → Merci) **ou** le garder comme espace membre volontairement distinct. À trancher : c'est un choix produit, pas un bug. |
| 2 | **Challenge** | Le « Pitch final » (`sales`) est généré **systématiquement**, sans vérifier qu'une offre payante existe. C'est exactement le bug déjà corrigé côté webinaire (`postWebinarOfferName`) : sans offre réelle, l'IA fabrique une page de vente factice. | Ajouter un champ wizard « Offre vendue à la fin du challenge » et rendre la page conditionnelle, comme pour le webinaire. Nécessite une modif du wizard → non fait. |
| 3 | **Vente produit digital** | `upsell` / `downsell` ont une règle explicite `convert-primary` → leurs boutons pointent vers la page de **commande du produit principal**, alors que le commentaire de `applyUpsellDeclineLinks` indique que « le CTA principal d'achat reste `#ff-checkout` ». Incohérence interne. | Basculer ces deux rôles sur `offer-primary`. Non fait car cela **écraserait une règle existante** (contrainte : ne pas modifier un type non concerné sans validation). |
| 4 | **Lead magnet + tripwire** | `applyInternalCheckoutCtas()` n'est appelé que si l'offre **principale** est payante. Sur un lead magnet gratuit avec tripwire, le checkout interne n'est donc jamais câblé (le correctif A ancre au moins le bouton sur la section offre de la page). | Déclencher aussi le câblage quand **une page** porte une offre payante, indépendamment du prix principal. |
| 5 | **Coaching high ticket** | `case-studies` est `publiclyLinked: true` et générée systématiquement, en fin de chaîne après `confirmation`. Pas incohérent, mais peu accessible depuis le parcours. | Aucune action ; à considérer comme page optionnelle si l'usage le confirme. |

### 2.3 Points vérifiés — RAS

- **Webinaire** : page de vente déjà conditionnée à `postWebinarOfferName` ; `live` / `replay` structurellement justifiées ; mode evergreen géré séparément.
- **Booking** : `qualification` déjà optionnelle ; embed calendrier avec repli formulaire cohérent.
- **Coaching high ticket** : VSL optionnelle qui devient page d'entrée — chaîne CTA cohérente.
- **upsell / downsell** : déjà conditionnés à la saisie d'un prix ou d'une offre.

---

## 3. Problème 3 — Animations au scroll

### Diagnostic : la chaîne config → sauvegarde → rendu

| Maillon | État | Verdict |
|---|---|---|
| Éditeur (`StyleTab`) | écrit bien `section.animations[target]` | ✅ OK |
| Sauvegarde | `section.animations` persisté dans le funnel | ✅ OK |
| Lecture au rendu | `FunnelPreview` lit `section.animations` (repli `fade-up`) | ✅ OK |
| **Déclencheur JS** | **`useScrollReveal` révélait TOUT au bout de 1,2 s** | ❌ **maillon cassé** |
| **CSS des préréglages** | seuls `fade-up`, `fade-in`, `zoom-in` implémentés | ❌ cassé |
| Patterns de section | `data-ff-anim="fade-up"` codé en dur | ❌ config ignorée |
| `SectionRenderer` | repli `"none"` au lieu de `"fade-up"` | ❌ incohérent |

**Cause racine n°1 (celle qui rend les tunnels « statiques ») :**
`hooks/useScrollReveal.ts` posait un filet de sécurité anti-écran-blanc qui,
1,2 s après le montage, appelait `activate()` sur **tous** les éléments
`[data-ff-anim]`, y compris ceux situés des milliers de pixels sous la ligne de
flottaison. L'animation se jouait donc hors écran : au moment où l'utilisateur
scrollait, tout était déjà révélé. Même défaut dans `hooks/useFunnelAnimations.ts`
(filet à 900 ms sur `[data-reveal]`, utilisé par les skins/templates bespoke).

### Correctifs

1. **`hooks/useScrollReveal.ts`** — le filet ne révèle plus que les éléments
   **atteints par le scroll** (`isReached` : `rect.top < viewport.bottom`). Tout
   ce qui est sous la ligne de flottaison reste observé et s'anime à l'entrée
   dans le viewport. Ajout d'une doublure `scroll` throttlée à 250 ms, qui
   s'auto-désactive quand plus rien n'est en attente : la garantie « jamais
   d'écran vide » est conservée même si l'`IntersectionObserver` reste muet.
2. **`hooks/useFunnelAnimations.ts`** — même correction pour `[data-reveal]`
   (skins et templates bespoke).
3. **`components/funnel/SectionRenderer.tsx`** — `animOf` replie sur `"fade-up"`
   (au lieu de `"none"`), avec repli par cible (`fade-in` image, `zoom-in`
   vidéo). Le `<section>` porte désormais `data-ff-anim` / `data-ff-anim-scope`.
   → **animations au scroll actives par défaut sur les tunnels générés**, qui ne
   portent aucun bloc `animations`.
4. **`app/funnel-theme.css`** — implémentation des 5 préréglages manquants
   (`fade-down`, `slide-left`, `slide-right`, `zoom-out`, `pulse`) : l'éditeur
   les proposait mais aucune règle CSS n'existait côté aperçu/publication
   (l'élément passait de `opacity:0` à `1` sans transition). L'export
   `theme-css.ts` les gérait déjà.
5. **`data-ff-anim-scope`** (nouveau) — le préréglage choisi sur la section
   pilote aussi les éléments internes des **patterns** (`BenefitsPatterns`,
   `PricingPatterns`, `FaqPatterns`, `ProcessPatterns`…), qui codaient
   `fade-up` en dur et ignoraient donc complètement le réglage de l'éditeur.
6. **« Aucune » (`none`)** — l'élément n'est plus masqué en attendant le scroll :
   il est visible immédiatement, sans transition.
7. **`StyleTab`** — le sélecteur affichait « none » alors que le rendu animait en
   `fade-up`, ce qui faisait croire les animations désactivées. Il affiche
   maintenant la valeur réellement appliquée (`ANIM_DEFAULTS`, aligné sur les
   trois moteurs de rendu).

### Performance et accessibilité

- `will-change: opacity, transform` est **relâché** (`will-change: auto`) dès
  qu'un élément est révélé — sinon chaque élément animé conservait une couche de
  compositing à vie (saccades sur mobile).
- `@media (prefers-reduced-motion: reduce)` ajouté dans `app/funnel-theme.css`
  **et** `styles/funnel-animations.css` : contenu immédiatement visible, aucune
  transition. Couvre aussi le cas « avant hydratation / sans JS ».
  (`useScrollReveal` et `useFunnelAnimations` respectaient déjà `reduce` côté JS ;
  l'export `theme-css.ts` avait déjà sa règle.)
- La doublure `scroll` est throttlée à 250 ms et se détache d'elle-même.

---

## 4. Fichiers modifiés

**Structure des tunnels**
- `lib/funnels/pageCatalogs.ts` — retrait du blueprint `delivery` du lead magnet ; repositionnement du tripwire avant « Merci ».
- `lib/funnels/kinds.ts` — libellé « 2 pages : Capture → Merci » (fr/en/es).

**CTA & copy**
- `lib/ai/cta-matrix.ts` — intention `offer-primary`, `OFFER_PRIMARY_LABEL`, `OFFER_ROLES`, `withOfferRoleDefaults()`.
- `lib/ai/generate.ts` — traitement de `offer-primary` ; `dedupeSuccessPageCtas()` ; `dedupeRedundantSubheadlines()` ; `applyCommunityChannels()` ; `normalizeForCompare()` / `isNearDuplicate()` ; rôles de checkout élargis ; directives de copywriting anti-doublon.
- `lib/ai/prompts.ts` — règles sémantiques des rôles `thankyou` (page terminale, un seul bouton) et `delivery` (marqué legacy).

**Brief & wizard**
- `lib/funnels/types.ts` — `FunnelBrief.communityWhatsappUrl` / `communityTelegramUrl`.
- `app/api/ai/generate-funnel/route.ts` — champs ajoutés au schéma zod (sinon retirés silencieusement du brief).
- `components/funnel/CreateFunnelWizard.tsx` — composant `CommunityChannelsFields`, rendu à l'étape « Génération ».

**Animations**
- `hooks/useScrollReveal.ts`
- `hooks/useFunnelAnimations.ts`
- `components/funnel/SectionRenderer.tsx`
- `components/funnel/FunnelPreview.tsx` — `data-ff-anim-scope` sur hero et sections ; hero respecte `section.animations`.
- `components/editor/tabs/StyleTab.tsx` — valeurs par défaut affichées, texte d'aide.
- `app/funnel-theme.css`
- `styles/funnel-animations.css`

---

## 5. Tests à exécuter (build indisponible côté session)

```bash
npm run lint
npm run build
npx vitest run
```

**Vérifications manuelles ensuite :**

1. **Lead magnet — wizard classique** : générer → l'aperçu ne doit contenir que
   « Accueil » et « Merci » dans le sélecteur de pages.
2. **Lead magnet — Express IA** : même résultat (2 pages).
3. **Lead magnet + tripwire coché** : 3 pages, ordre Accueil → Offre spéciale →
   Merci ; le bouton du tripwire ne doit **pas** ramener sur la page de capture.
4. **Canaux communautaires** : saisir un lien WhatsApp à l'étape « Génération » →
   les boutons doivent apparaître sur « Merci » en aperçu **et** après publication.
5. **Page Merci** : un seul bouton (pas de « Vérifier ma boîte mail » en double),
   pas de sous-titres jumeaux.
6. **Animations — aperçu** : page longue, scroll lent → les sections doivent
   apparaître **au fur et à mesure**, pas toutes d'un coup au chargement.
7. **Animations — publication** : même test sur `/tunnel/[slug]`.
8. **Animations — éditeur** : Style → Animations → « slide-left » sur une section
   → l'effet doit être visible ; « none » → section visible immédiatement.
9. **Réduction des animations** (macOS : Réglages → Accessibilité → Affichage →
   Réduire les animations) → tout doit être visible, sans transition.
10. **Rétrocompatibilité** : ouvrir un lead magnet **existant en 3 pages** → la
    page « Accès » doit toujours s'afficher, se publier et s'exporter.
11. **Mobile** : scroll fluide, pas de saccade sur une page longue.
