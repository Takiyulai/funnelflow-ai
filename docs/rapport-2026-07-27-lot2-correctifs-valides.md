# Rapport — Lot 2 : correctifs validés + footer

**Date :** 27 juillet 2026
**Suite de :** `rapport-2026-07-27-pages-cta-animations.md`

> ⚠️ **Build toujours non exécuté.** Le sandbox Linux reste indisponible
> (`HYPERVISOR_VIRT_DISABLED`). Aucune des modifications de ce lot ni du lot
> précédent n'a été compilée. Voir §4.

---

## 1. Les 4 correctifs validés (section 2.2 du rapport précédent)

### 1.1 — Vente produit digital : page « Accès » supprimée

**Structure finale :** `Vente → Paiement → Merci`
(+ `upsell` / `downsell` si un prix ou une offre est renseigné, + `oto` si coché).

- `lib/funnels/pageCatalogs.ts` — blueprint `access` retiré de `DIGITAL_PRODUCT`.
- `lib/funnels/kinds.ts` — libellé « 3 pages : Vente → Paiement → Merci » (fr/en/es).
- Le rôle `access` reste défini partout ailleurs → **les tunnels déjà générés en
  4 pages continuent de s'afficher, se publier et s'exporter**.

**Effet de bord corrigé au passage.** La page « Merci » devient terminale pour un
tunnel payant, or la règle sémantique du rôle `thankyou` envoyée à l'IA était
écrite **uniquement pour le lead magnet** (« le lead magnet est ENVOYÉ PAR
EMAIL », CTA « Ouvrir ma boîte Gmail ») et s'appliquait telle quelle à une vente
payée. `roleSemanticsBlock()` accepte désormais le `funnelKind` et sert une
variante « après achat » pour `digital-product`, `coaching-high-ticket`, `vsl`,
`formation`, `saas` : commande confirmée, email d'accès en route, interdiction de
reproposer l'achat, un seul bouton.

### 1.2 — Challenge : offre de fin + pitch final conditionnel

Symétrique exact du webinaire.

- `FunnelBrief.challengeOfferName` / `challengeOfferPrice` / `challengeOfferPromise`
  (`lib/funnels/types.ts`) + entrées dans le schéma zod de l'API (sans quoi zod
  les aurait retirées silencieusement du brief — le piège déjà rencontré avec
  `brandColors` et `authorName`).
- Bloc wizard « Offre vendue à la fin du challenge » (onglet *Offre*, visible
  uniquement pour `funnelKind === "challenge"`), calqué sur le bloc webinaire.
- `generateMultiPageFunnelWithAI` : sans `challengeOfferName`, la page `sales`
  est retirée du blueprint → **pas d'offre, pas de pitch final**.
- La génération de la page `sales` utilise l'offre de clôture (nom / prix /
  promesse) au lieu du challenge lui-même. La logique de substitution, jusqu'ici
  spécifique au webinaire, a été factorisée en un objet `secondaryOffer` partagé
  par les deux types.
- `lib/funnels/kinds.ts` — libellé mis à jour (« + Pitch final si une offre de
  fin est renseignée »).

### 1.3 — upsell / downsell → `offer-primary`

`PURCHASE_CONFIG` : les deux rôles passent de `convert-primary` à
`offer-primary`. Leurs boutons vendent désormais **leur** offre à **leur** prix,
au lieu de repartir vers la page de commande du produit principal — ce qui
contredisait le commentaire de `applyUpsellDeclineLinks` (« le CTA principal
d'achat reste `#ff-checkout` »).

### 1.4 — Checkout interne découplé du prix de l'offre principale

Nouvelle fonction `funnelHasPaidOffer(funnel)` : le câblage du checkout (lien de
paiement externe **ou** `#ff-checkout`) se déclenche dès qu'**une page** porte
une offre payante, et plus seulement quand l'offre principale l'est.

Débloque les cas : lead magnet gratuit + tripwire à 17 €, webinaire gratuit +
offre post-live, challenge gratuit + pitch final. Le garde `pageHasPaidOffer`
s'applique ensuite page par page → **aucun changement pour un tunnel 100 % gratuit**.

---

## 2. Espaces vides sous le footer

### Diagnostic

Un mécanisme « sticky footer » existait déjà : une chaîne flex
`shell 100vh → FunnelPreview → .ff-page → corps → footer`, avec
`.ff-fill-col { flex: 1 1 auto }` et `.ff-fill-col .ff-footer { margin-top: auto }`.

**Le problème de cette approche : elle exige que les six maillons aboutissent.**
Elle casse dès qu'un conteneur sort de la chaîne, et plusieurs cas le font :

| Contexte | Ce qui casse la chaîne | Ce qu'on voyait |
|---|---|---|
| Cadre mobile de l'éditeur | `height: 640px` fixe + `overflow-y: auto` | bande **noire** sous le footer |
| Aperçu desktop de l'éditeur | `maxHeight` + `background: #1a1a1a`, pas de `.ff-fill-col` (`isEmbed` faux) | bande **gris foncé** |
| Page publiée, tunnel court | chaîne OK mais fond du shell figé à `#0B0F14` | bande **sombre** sous un footer clair |
| Tunnel cloné (`raw-html`) | passe par `RawFrame`, hors chaîne | bande **blanche** |

Autrement dit : la cause n'est pas unique, c'est la **fragilité de la chaîne**.

### Correctif

Plutôt que de rallonger une chaîne flex déjà fragile, la teinte du footer
**déborde vers le bas** :

```css
[data-ff-template] .ff-footer {
  position: relative;
  box-shadow: 0 50vh 0 50vh var(--ff-footer-bg, #0b0f14);
}
```

Un `box-shadow` est de l'**encre pure** : il n'occupe aucune place dans le flux
et — c'est le point clé — **n'agrandit pas la zone scrollable**. Un `::after` en
`position: absolute` aurait au contraire rallongé réellement la page de 100vh
dans les conteneurs scrollables, remplaçant un bug d'affichage par un bug de
scroll.

Conséquences :
- fonctionne quel que soit le maillon défaillant, sur **tous** les types de tunnels ;
- **aperçu et publication**, **desktop et mobile** ;
- clippé naturellement par les conteneurs `overflow: hidden` (carte d'aperçu,
  cadre du téléphone) → le débordement ne fuit jamais hors du cadre ;
- aucun effet dès que la page remplit l'écran.

Règle miroir ajoutée dans `lib/export/theme-css.ts` pour l'export systeme.io
(page hôte à fond blanc).

La chaîne flex existante est **conservée** : elle reste la solution propre quand
elle aboutit, le débordement n'étant qu'un filet.

---

## 3. Fichiers modifiés dans ce lot

- `lib/funnels/pageCatalogs.ts` — retrait du blueprint `access` (digital-product).
- `lib/funnels/kinds.ts` — libellés digital-product et challenge.
- `lib/funnels/types.ts` — `challengeOfferName` / `challengeOfferPrice` / `challengeOfferPromise`.
- `app/api/ai/generate-funnel/route.ts` — schéma zod des 3 champs challenge.
- `components/funnel/CreateFunnelWizard.tsx` — bloc « Offre vendue à la fin du challenge ».
- `lib/ai/generate.ts` — pitch final conditionnel ; `secondaryOffer` factorisé ; `funnelHasPaidOffer()` ; déclenchement du checkout élargi.
- `lib/ai/cta-matrix.ts` — `upsell` / `downsell` → `offer-primary`.
- `lib/ai/prompts.ts` — `roleSemanticsBlock()` devient conscient du `funnelKind` ; variante `thankyou` « après achat ».
- `app/funnel-theme.css` — débordement de la teinte du footer.
- `lib/export/theme-css.ts` — idem pour l'export.

---

## 4. Ce qui n'a PAS pu être fait — et pourquoi

### 4.1 Build, lint et tests

Le sandbox Linux ne démarre pas (`HYPERVISOR_VIRT_DISABLED`). `npm run lint`,
`npm run build` et `npx vitest run` **n'ont pas été exécutés**, ni pour ce lot ni
pour le précédent. Tout le code a été relu ligne à ligne, mais une relecture ne
remplace pas un compilateur.

**Points les plus susceptibles de casser à la compilation** (à me remonter tels quels) :

1. `lib/ai/generate.ts` — l'objet `secondaryOffer` (union de deux littéraux + `null`) : TypeScript peut exiger un type explicite.
2. `lib/ai/generate.ts` — `dedupeSuccessPageCtas` / `dedupeRedundantSubheadlines` : affectation de `undefined` à `subheadline`, et `stripCta` sur un `FunnelSection`.
3. `lib/ai/cta-matrix.ts` — `withOfferRoleDefaults` : indexation de `Partial<Record<PageRole, PageCTARule>>`.
4. `hooks/useScrollReveal.ts` — `scrollTargets: EventTarget[]` et les déclarations `function` utilisées avant leur définition (ESLint `no-use-before-define`).
5. `components/funnel/CreateFunnelWizard.tsx` — équilibre du JSX du nouveau bloc challenge.
6. `lib/ai/prompts.ts` — `roleSemanticsBlock` : `args.funnelKind` doit être du type `FunnelKind` aux deux appels.

### 4.2 Test d'expérience utilisateur (génération de tunnels)

**Je ne peux pas le faire seul.** Générer un tunnel jusqu'à la prévisualisation
suppose :

1. l'application qui tourne (`npm install` + `npm run dev`) — sandbox HS ;
2. un accès réseau au fournisseur IA (OpenAI / OpenRouter selon `AI_PROVIDER`) —
   le sandbox n'a qu'un réseau restreint, et la clé est dans `.env.local`, que je
   ne dois ni lire ni modifier ;
3. une session Supabase authentifiée **et** un abonnement actif (la route
   `/api/ai/generate-funnel` renvoie `subscription-required` / `plan-limit` sinon) ;
4. un navigateur pour dérouler le wizard ;
5. de la consommation réelle de crédits API sur ton compte.

**La voie réaliste** — je dispose des outils Claude in Chrome, qui pilotent **ton**
navigateur. Concrètement :

1. tu lances `npm run dev` en local (après un build vert) ;
2. tu te connectes à l'application dans Chrome, avec l'extension Claude connectée ;
3. je déroule moi-même le wizard, type par type, dans l'ordre demandé
   (Coaching high ticket → Challenge/Bootcamp → lead magnet → vente digitale →
   webinaire → VSL → booking), avec des contextes inventés ;
4. je m'arrête à la prévisualisation, **sans jamais publier** ;
5. je lis les pages, teste le scroll et le mobile, et je te rends le rapport
   d'anomalies + les correctifs de code.

Si tu préfères, je peux aussi écrire un **script de test hors ligne** qui exécute
tout le pipeline de post-traitement (`harmonizeCTAsByFunnelKind`, dédoublonnages,
ordre canonique, layouts, animations…) sur des réponses IA simulées. Cela
validerait la **structure** des 7 types (pages générées, CTA, cibles, doublons)
sans clé API ni navigateur — mais pas la qualité du copywriting ni le rendu
visuel, qui exigent un vrai run.

---

## 5. Ce qui nécessite TON intervention

| # | Action attendue de ta part | Pourquoi |
|---|---|---|
| 1 | Lancer `npm run lint && npm run build && npx vitest run`, et me coller les erreurs | Sandbox HS — rien n'est compilé (§4.1) |
| 2 | Décider comment on fait le test UX : **(a)** `npm run dev` + Chrome pour que je pilote, **(b)** script de test structurel hors ligne, **(c)** les deux | Je ne peux pas générer de tunnel seul (§4.2) |
| 3 | Confirmer le libellé d'achat neutre « Je profite de l'offre » (EN « Get this offer », ES « Aprovechar la oferta ») | Choix de copywriting posé par défaut sur les pages tripwire / upsell / downsell / pitch final |
| 4 | Décider si l'offre de fin de challenge doit alimenter aussi les **emails** du CRM | J'ai limité le champ à la génération des pages. `lib/funnels/funnelContext.ts` et `lib/crm/types.ts` exposent déjà `postWebinarOfferName` aux prompts d'emails ; l'équivalent challenge n'y est pas |
| 5 | Vérifier sur un tunnel réel que le débordement du footer ne déborde pas hors d'un cadre inattendu | Je n'ai pas pu ouvrir de rendu (§4.2) |
| 6 | Rappel des points ouverts du contexte initial : purge des 3 fichiers du repo public, DKIM/SPF/DMARC Resend, surveillance du cron externe | Hors périmètre de ce lot, toujours en attente |
