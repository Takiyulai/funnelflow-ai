# Proposition d'implémentation — A/B testing, calendrier RDV natif, preuve sociale

**Date :** 28 juillet 2026
**Contexte :** les 3 modules absents identifiés dans l'analyse du cahier des charges.

> **Principe directeur.** Aucun de ces trois modules ne justifie une nouvelle
> couche technique. Chacun se branche sur une infrastructure qui existe déjà
> dans AutoFunnel : le chemin de rendu public, la file `scheduled_emails`, le
> moteur de workflows, la capture de leads. Là où j'introduis quelque chose de
> nouveau, c'est pour une raison précise, écrite.

---

## 1. A/B Testing

### 1.1 Le choix qui conditionne tout : où vit une variante ?

Trois modèles possibles :

| Modèle | Verdict |
|---|---|
| Dupliquer la page entière par variante | ❌ Double la maintenance : éditer une page oblige à éditer ses jumelles |
| Variante = tunnel séparé | ❌ Casse les statistiques, le CRM et les liens publics |
| **Variante = patch de champs sur une page** | ✅ Retenu |

**Retenu :** une variante ne stocke que ce qui change, sous forme de patch JSON
indexé par identifiant de section :

```jsonc
{
  "sections": {
    "hero_a1b2": { "headline": "…", "subheadline": "…", "cta": { "label": "…" } },
    "cta_final":  { "cta": { "label": "…" } }
  }
}
```

Conséquence directe : **le moteur de rendu n'est pas touché du tout.** On applique
le patch sur l'objet `funnel` avant de le passer à `PublishedFunnelView`. C'est
une transformation de données pure, testable sans navigateur.

### 1.2 Schéma

```
funnel_ab_tests
  id, funnel_id, page_id, name, status(draft|running|stopped),
  winner_variant_id, min_sample, created_at, started_at, stopped_at

funnel_ab_variants
  id, test_id, label('A'|'B'|…), weight(int), is_control(bool), patch(jsonb)

funnel_ab_events
  id, test_id, variant_id, kind('view'|'lead'|'sale'), contact_id?, created_at
```

**Pourquoi une table d'événements plutôt que des compteurs.** Des compteurs
seraient plus légers, mais on perdrait toute analyse temporelle — impossible de
voir qu'une variante gagne uniquement le week-end, ou de recalculer après avoir
exclu un pic de trafic frauduleux. À ton échelle le volume est négligeable, et
l'agrégation se fait dans une vue SQL.

### 1.3 Affectation du visiteur — le point délicat

L'affectation doit être **stable** (un visiteur voit toujours la même variante)
et **décidée avant le rendu**, sinon la page scintille à l'hydratation.

**Le bon endroit est `middleware.ts`**, pas la page. Dans Next 15, un Server
Component ne peut pas écrire de cookie ; seuls le middleware, les Route Handlers
et les Server Actions le peuvent. Le middleware intercepte `/tunnel/:slug*`,
tire une variante au sort pondéré, pose le cookie `ff_ab_<testId>` (1 an,
`SameSite=Lax`, `httpOnly=false` pour être lisible par le beacon), et la page se
contente de le lire.

⚠️ **Piège de cache.** Deux visiteurs sur la même URL doivent recevoir des HTML
différents. La route `/tunnel/[slug]` doit être en `dynamic = "force-dynamic"`,
et il faut vérifier qu'aucun cache CDN ne mutualise la réponse sans varier sur
le cookie. C'est la première chose à tester après implémentation : un test A/B
silencieusement mis en cache affiche 50/50 dans l'interface et 100/0 en réalité.

### 1.4 Mesure

- **Vue** : `PageViewBeacon` existe déjà — on lui ajoute le variantId.
- **Lead** : `app/api/leads/route.ts` reçoit déjà la capture ; il lit le cookie
  et écrit un événement `lead`.
- **Vente** : le webhook Stripe écrit un événement `sale`.

Aucun nouveau point d'entrée : les trois chemins de conversion existent.

### 1.5 « Recommandation IA » — non, statistique

Le cahier parle de recommandation IA avec un score de confiance (« 94 % »).
**Ce n'est pas un travail de LLM**, et en confier le calcul à un modèle serait à
la fois plus cher, plus lent et non reproductible.

**Approche bayésienne**, ~25 lignes de TypeScript, sans dépendance :

1. Pour chaque variante, distribution Beta(1 + conversions, 1 + échecs)
2. 100 000 tirages Monte-Carlo
3. « Probabilité que B batte A » = proportion de tirages où B > A

Le nombre affiché est exactement celui que décrit le cahier, il est
déterministe à graine fixée, et il coûte 0 €.

**Garde-fou obligatoire :** aucune recommandation tant qu'on n'a pas au minimum
100 visiteurs *et* 10 conversions par variante. Sans ce seuil, l'interface
annoncerait « 94 % de confiance » sur 7 visiteurs — le meilleur moyen de faire
prendre de mauvaises décisions à tes utilisateurs en toute confiance.

### 1.6 Décision produit à trancher

**Que se passe-t-il si l'utilisateur édite une page pendant un test ?** Les
patchs référencent des identifiants de section : supprimer une section pendant
un test rend son patch orphelin. Trois options, par ordre de préférence :

1. **Bloquer l'édition** de la page tant que le test tourne (message clair + bouton « arrêter le test ») — le plus simple et le plus honnête statistiquement, puisque modifier la page en cours de test invalide les résultats de toute façon.
2. Mettre le test en pause automatiquement à la première édition.
3. Laisser faire et ignorer les patchs orphelins — je le déconseille.

**Estimation : 5 à 7 jours.**

---

## 2. Calendrier RDV natif

Le module le plus dense des trois. Deux pièges classiques y coûtent
systématiquement plusieurs jours si on ne les traite pas dès le départ.

### 2.1 Schéma

```
booking_calendars
  id, user_id, funnel_id?, slug, title, duration_min,
  timezone(IANA), buffer_min, min_notice_hours, max_days_ahead, active

booking_availability
  calendar_id, weekday(0-6), start_time(time), end_time(time)   -- heure LOCALE

booking_blackouts
  calendar_id, start_at(timestamptz), end_at(timestamptz)

bookings
  id, calendar_id, contact_id, start_at(timestamptz), end_at(timestamptz),
  status(confirmed|cancelled|no_show), guest_name, guest_email, guest_phone,
  channel_pref(email|whatsapp|telegram), cancel_token, created_at
```

### 2.2 Piège n°1 — les fuseaux horaires

La règle, sans exception :

- **Les disponibilités se stockent en heure locale + fuseau IANA du propriétaire**
  (`Europe/Paris`), jamais en UTC. « Lundi 9h–17h » doit rester « 9h » après le
  changement d'heure ; stocké en UTC, ce créneau glisserait d'une heure deux fois
  par an.
- **Les réservations se stockent en `timestamptz`** (donc UTC) : un rendez-vous
  est un instant absolu.
- Le calcul des créneaux se fait **côté serveur**, jamais dans le navigateur.
- L'affichage se convertit dans le fuseau **du visiteur**, avec le fuseau écrit
  en toutes lettres sous le calendrier (« Heures affichées en Europe/Paris »).

La base de code a déjà ce raisonnement pour les webinaires
(`toWallClockString` / `wallClockToUtcDate` dans `lib/ai/generate.ts`) — même
logique, à factoriser plutôt qu'à réécrire.

### 2.3 Piège n°2 — la double réservation

Vérifier « le créneau est-il libre ? » puis insérer laisse une fenêtre de
concurrence : deux visiteurs qui cliquent à la même seconde réservent le même
créneau. Un index unique ne résout rien, puisqu'on compare des **intervalles**.

**La bonne réponse est une contrainte d'exclusion PostgreSQL :**

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    calendar_id WITH =,
    tstzrange(start_at, end_at) WITH &&
  ) WHERE (status = 'confirmed');
```

La base **refuse** physiquement le chevauchement, quelle que soit la concurrence.
L'API se contente d'attraper l'erreur et de répondre « créneau déjà pris ».
C'est la seule approche qui tient sous charge, et elle coûte trois lignes.

### 2.4 Confirmations et rappels — zéro infrastructure nouvelle

C'est la partie élégante. À la création d'une réservation, on insère dans la
file `scheduled_emails` existante :

- confirmation immédiate,
- rappel à J-24h,
- rappel à H-2.

Le cron `/api/cron/send-scheduled-emails` les draine déjà, avec son claim
atomique et sa reprise sur incident. **Aucun nouveau planificateur, aucun
nouveau cron.** Le canal WhatsApp/Telegram du cahier viendra s'y greffer quand
le module §10 existera ; en attendant, l'email couvre le besoin.

### 2.5 Intégration au reste

- **Page publique** `app/rdv/[slug]` : vue mensuelle, sélection de créneau, formulaire.
- **Section de tunnel** : un nouveau type `booking` affichant le sélecteur natif. `calendarEmbedUrl` (Calendly/Cal.com) reste supporté en repli — rétrocompatibilité des tunnels existants.
- **CRM** : une réservation crée ou met à jour un contact, exactement comme une capture de lead.
- **Workflows** : nouveau déclencheur `booking.created` (et `booking.cancelled`), qui s'insère dans le moteur existant sans le modifier.
- **ICS** : fichier « ajouter à mon agenda ». La génération ICS existe déjà pour les webinaires.
- **Annulation / report** : lien signé par `cancel_token`, sans authentification.

**Estimation : 8 à 12 jours.** Prévoir la marge haute : c'est le module où les
fuseaux et les cas limites (créneau à cheval sur minuit, changement d'heure,
congés) consomment le temps.

---

## 3. Preuve sociale

Techniquement le plus simple des trois. Mais c'est celui où **je te recommande
de ne pas suivre le cahier des charges**.

### 3.1 Ce que je refuse d'implémenter par défaut

Le §12 prévoit comme source de données : « vrais inscrits uniquement **ou mix
réel + templates IA** ».

Le second cas, ce sont des **notifications fabriquées** : afficher « Sophie vient
de s'inscrire » alors que personne ne s'est inscrit. Ce n'est pas une zone grise.
C'est une pratique commerciale trompeuse au sens de la directive européenne
2005/29/CE et du code de la consommation français, et la DGCCRF sanctionne les
faux avis et fausses preuves d'activité. Tes utilisateurs déploieraient ça sur
**leurs** pages, en engageant **leur** responsabilité, avec un outil que tu leur
as vendu.

**Ma recommandation :** ne pas livrer le mode fabriqué. Si tu tiens à l'avoir
pour la démo produit, alors il doit être cantonné à un mode « aperçu » visible
uniquement dans l'éditeur, jamais publiable.

### 3.2 Vie privée — le cahier passe à côté

Afficher « Sophie D. — Paris, il y a 2 min » publie une donnée personnelle d'un
lead à des inconnus. C'est un traitement qui doit avoir une base légale et être
mentionné dans la politique de confidentialité du tunnel.

**Ce que je propose par défaut :**

- prénom + initiale (« Sophie D. »), jamais le nom complet ;
- granularité **régionale** et non municipale quand la ville est peu peuplée ;
- pas d'horodatage inférieur à la minute (« à l'instant » plutôt que « il y a 12 s ») ;
- une case dans les réglages du tunnel, **décochée par défaut**, avec un rappel de l'obligation de mention dans la politique de confidentialité.

Sur ce point tu es mieux placé que ClickFunnels, qui vend ça sans avertissement.
C'est un argument de sérieux pour un public francophone.

### 3.3 Implémentation

**Configuration**, dans `funnel.meta` (aucune table nécessaire) :

```ts
socialProof?: {
  enabled: boolean;
  position: "bottom-left" | "bottom-right";
  delaySec: number;        // avant la 1re notification
  intervalSec: number;     // entre deux
  maxPerSession: number;   // plafond, pour ne pas harceler
  sources: ("lead" | "sale" | "booking")[];
}
```

**Données** : endpoint public `GET /api/tunnel/[slug]/social-proof` qui dérive
les notifications des `contacts` et commandes récents du tunnel — **aucune
nouvelle table**. Anonymisation faite côté serveur : le navigateur ne reçoit
jamais la donnée brute. Cache 60 s.

**Rendu** : composant monté dans `PublishedFunnelView`, aux côtés de
`PublicFunnelRuntime`.

Trois exigences non négociables, souvent oubliées :

- **ne jamais recouvrir le CTA sur mobile** — une pop-up posée sur le bouton fait *baisser* la conversion, exactement l'inverse du but recherché ;
- respecter `prefers-reduced-motion` (cohérent avec le travail fait sur les animations) ;
- notification **fermable**, et une fois fermée, plus rien de la session.

**Estimation : 3 à 4 jours.**

---

## 4. Ordre de réalisation

**Preuve sociale → A/B testing → Calendrier.**

Non pas par ordre de valeur, mais par ordre de risque croissant : la preuve
sociale valide la chaîne « config dans meta → endpoint public → rendu sur tunnel
publié » sur un cas simple. L'A/B testing réutilise cette même chaîne en y
ajoutant le middleware et la mesure. Le calendrier, le plus lourd, arrive quand
ces fondations sont éprouvées.

Total : **16 à 23 jours**, coût externe **0 €** — aucun de ces modules
n'introduit de dépendance payante.

---

## 5. Décisions attendues de ta part

| # | Décision | Impact |
|---|---|---|
| 1 | Édition d'une page pendant un test A/B : bloquer, mettre en pause, ou laisser faire ? | Je recommande **bloquer** (§1.6) |
| 2 | Mode « notifications fabriquées » : abandonné, ou cantonné à l'aperçu éditeur ? | Je recommande **abandonné** (§3.1) |
| 3 | Le calendrier gère-t-il plusieurs calendriers par utilisateur, ou un seul ? | Un seul divise le travail d'environ 2 jours |
| 4 | Ces modules sont-ils gatés par forfait (`planGate`) ? Lesquels à partir de quel plan ? | Structure l'UI dès le départ ; y revenir après coûte cher |

---

## 6. Prérequis bloquant

**Rien de tout cela ne doit démarrer avant que le build soit vert.** Les quatre
derniers lots (animations, CTA, footer, fetcher de scraping, bugs de l'éditeur
cloné, dashboard admin) n'ont **jamais été compilés** — le sandbox est
indisponible depuis plusieurs tours. Empiler trois modules sur une base non
vérifiée rendrait tout diagnostic ultérieur impossible : à la première erreur,
on ne saurait plus si elle vient du nouveau code ou de l'ancien.

Ordre : `npm run lint && npm run build && npx vitest run` → correction → puis
palier 1.
