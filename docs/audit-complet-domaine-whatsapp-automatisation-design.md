# AutoFunnel AI — Audit : domaine personnalisé, WhatsApp/Telegram, automatisation, design

**Date :** 28 juillet 2026
**Auteur :** analyse technique sur la base du code réel + cahier des charges FunnelAI Pro v1.0

> **Format.** Ce document devait être livré en `.docx`. La génération Word exige
> Node et la bibliothèque `docx`, disponibles uniquement dans l'environnement
> Linux de la session — indisponible depuis plusieurs heures. Le contenu est
> intégral ; la conversion Word se fera dès que l'environnement redémarre.
> En attendant, Word ouvre directement ce fichier Markdown.

---

## Synthèse en une page

| Sujet | Verdict |
|---|---|
| **Domaine personnalisé** | Techniquement simple sur Vercel. Le vrai coût est le **support client**, pas la technique. 4–6 j, ~0 € marginal |
| **Telegram** | À faire en premier : gratuit, sans validation, 3–4 j. Une limite structurelle à connaître (§2.4) |
| **WhatsApp** | Le piège n'est pas le prix, c'est **l'architecture multi-comptes** (§2.2). Se tromper ici coûte une réécriture complète |
| **Automatisation** | ❌ **Non, l'existant ne suffit pas.** La plomberie est bonne, le vocabulaire d'orchestration est quasi vide (§4) |
| **Design** | Le problème n'est pas la palette, c'est qu'il y a **quatre accents et quatre neutres** (§5). Et l'or échoue les normes de contraste |

---

## 1. Rattacher un nom de domaine à un tunnel

### 1.1 Deux besoins distincts, souvent confondus

**Cas A — sous-domaine de TON domaine** : `client.autofunnel.app`.
Tu contrôles le DNS, tout est automatique, aucune action de l'utilisateur.

**Cas B — domaine de TON UTILISATEUR** : `tunnels.monagence.fr`.
C'est ce que demande le cahier (§08 et §15). L'utilisateur doit modifier son
propre DNS — c'est là que naissent les difficultés.

Je recommande de livrer **le cas A d'abord** : il apporte 80 % de la valeur
perçue (une URL propre, sans `/tunnel/xxx`) pour 20 % de l'effort et zéro
support.

### 1.2 Comment ça marche techniquement

**Étape 1 — schéma.**

```
custom_domains
  id, user_id, funnel_id, hostname (unique),
  status(pending_dns|verifying|active|error),
  vercel_domain_id, verification_txt, last_checked_at, created_at
```

**Étape 2 — routage par le `Host`.** Un `middleware.ts` lit l'en-tête `Host` de
chaque requête, cherche le hostname dans `custom_domains`, et réécrit en interne
vers `/tunnel/[slug]`. Le visiteur ne voit jamais l'URL interne. C'est le patron
multi-tenant standard de Next.js — le même middleware servira à l'affectation
des variantes A/B.

**Étape 3 — provisionnement.** Ajout du domaine au projet via l'API Vercel, qui
renvoie les enregistrements DNS à créer. L'utilisateur les pose chez son
registrar :

| Type de domaine | Enregistrement |
|---|---|
| Sous-domaine (`tunnels.monsite.fr`) | `CNAME → cname.vercel-dns.com` |
| Racine (`monsite.fr`) | `A → 76.76.21.21` |

**Étape 4 — vérification et certificat.** On interroge l'API Vercel en boucle
jusqu'à ce que la propagation soit constatée. Le certificat SSL est ensuite
émis automatiquement, sans intervention.

Pour le cas A (sous-domaines des tiens), un **domaine wildcard** `*.autofunnel.app`
suffit : chaque sous-domaine résout automatiquement et Vercel émet le certificat
à la volée. Contrainte : le wildcard **impose d'utiliser les serveurs de noms de
Vercel** pour ton domaine, afin qu'il puisse répondre aux défis DNS.

### 1.3 Contraintes et risques réels

**Le domaine racine est fragile.** Un `A` pointe vers une IP fixe ; si Vercel la
change, les sites de tes clients tombent. **Impose `www.` ou un sous-domaine
dédié** et propose une redirection depuis la racine. C'est ce que font Shopify
et Webflow, pour cette raison exacte.

**Le support est le vrai coût.** La quasi-totalité des tickets sur cette
fonctionnalité tient en une phrase : « j'ai mis le CNAME au mauvais endroit ».
Prévois dès la v1 un écran de diagnostic qui affiche ce qui est réellement
résolu côté DNS, plutôt qu'un simple « en attente » — sinon tu répondras
toi-même à chaque client.

**Vérification de propriété obligatoire.** Sans jeton TXT de validation,
n'importe qui peut pointer un domaine vers ton infrastructure et te faire servir
du contenu sous une identité qu'il ne possède pas. **Ne sers jamais un hostname
non vérifié.**

**Émission différée.** Le certificat prend de quelques minutes à quelques
heures. L'interface doit exposer un état « en cours » explicite, sinon
l'utilisateur croit que c'est cassé et recommence.

**Renouvellement silencieux.** Si un client retire son enregistrement DNS six
mois plus tard, le renouvellement du certificat échoue sans bruit. Prévois une
vérification hebdomadaire et une alerte email.

**Impact transverse à ne pas rater :** dès qu'un tunnel est servi sous le
domaine du client, les cookies (dont celui d'affectation A/B), les URL de retour
Stripe et les pixels publicitaires vivent sur **ce** domaine. Toute URL absolue
codée en dur dans le code casse. À vérifier avant de livrer.

**Limite d'API :** environ 100 ajouts de domaine par heure et par équipe. Sans
effet à ton échelle, sauf migration en masse.

### 1.4 Coût

| Poste | Coût |
|---|---|
| Domaines personnalisés Vercel | Inclus, illimités |
| Vercel Pro (probablement nécessaire) | ~20 $/mois/membre |
| Certificats SSL | 0 € (automatiques) |
| Achat du domaine | À la charge de l'utilisateur (~10–15 €/an) |

**Coût marginal par client : 0 €.** Effort : **4–6 jours** (2–3 j pour le seul cas A).
C'est une fonctionnalité à fort effet de levier commercial : elle justifie à elle
seule le passage au plan Agency.

---

## 2. WhatsApp & Telegram

### 2.1 Le prix — ce qui a changé

Depuis le 1ᵉʳ juillet 2025, Meta facture **par message délivré**, et non plus par
conversation de 24 h. Quatre catégories :

| Catégorie | Prix indicatif | Usage |
|---|---|---|
| Marketing | ~0,01–0,14 $/message selon le pays | Promotions, annonces |
| Utility | 80–90 % moins cher que marketing | Confirmation de RDV, rappel |
| Authentication | idem utility | Codes à usage unique |
| Service | **gratuit** | Réponses dans la fenêtre de 24 h |

À cela s'ajoute la marge de l'intermédiaire (BSP) : ~0,003–0,010 $/message.

**Ce qu'il faut en retenir :** les cas d'usage du cahier des charges
(confirmation de RDV, rappel H-2, rappel de webinaire) tombent en catégorie
**utility**, la moins chère. Et toute réponse dans les 24 h suivant un message du
prospect est **gratuite**. Le coût réel sera très inférieur à ce que suggère le
tarif marketing — à condition de ne pas classer tes messages en marketing par
paresse de configuration.

⚠️ Des évolutions tarifaires sont annoncées pour le 1ᵉʳ août et le 1ᵉʳ octobre 2026.
À revalider avant de s'engager.

### 2.2 Le vrai piège : à qui appartient le compte WhatsApp ?

**C'est la décision structurante de tout le module.** Un compte WhatsApp Business
(WABA) appartient à *une* entreprise. Tes utilisateurs veulent envoyer des
messages **sous leur propre identité**, pas sous la tienne.

| Option | Description | Verdict |
|---|---|---|
| **A — Ton numéro pour tous** | Tous les messages partent de ton WABA | ❌ **À proscrire.** Contraire aux règles Meta sur l'envoi pour compte de tiers. Un signalement et ton numéro est banni — tous tes clients tombent en même temps |
| **B — L'utilisateur apporte ses identifiants** | Chacun crée son compte 360dialog/Twilio et colle sa clé | ✅ **Recommandé pour la v1.** Aucune validation Meta à obtenir, développement simple, responsabilité chez l'utilisateur |
| **C — Embedded Signup (Tech Provider)** | L'utilisateur connecte son WABA via un parcours OAuth intégré | ✅ La cible à terme. Excellente expérience, mais exige de devenir **Tech Provider vérifié** chez Meta et de passer une revue d'application |

**Beaucoup d'équipes construisent l'option A sans le savoir et doivent tout
réécrire.** Commence par B ; passe à C quand le volume le justifie.

### 2.3 360dialog ou Twilio ?

| Critère | 360dialog | Twilio |
|---|---|---|
| Modèle | Forfait mensuel, sans marge par message | À l'usage, marge par message |
| Rentabilité | Meilleure à volume élevé | Meilleure à faible volume |
| Mise en route | Plus artisanale | Plus fluide, documentation supérieure |
| Autres canaux | WhatsApp uniquement | SMS, voix, email — un seul fournisseur |
| Verdict | À volume établi | ✅ **Pour démarrer** |

**Recommandation : Twilio en v1.** Non pour le prix, mais parce que le même
compte servira si tu ajoutes le SMS, et que le temps d'intégration économisé
dépasse largement l'écart tarifaire aux volumes de départ.

### 2.4 Telegram — à faire en premier, avec une réserve

Gratuit, sans validation, sans vérification d'entreprise, sans approbation de
gabarits. L'utilisateur crée un bot auprès de `@BotFather` et te colle son jeton.

**Mais une limite structurelle que le cahier des charges passe sous silence :**
un bot Telegram **ne peut pas écrire à quelqu'un qui ne lui a pas parlé en
premier**. Impossible de prendre l'initiative sur une liste de contacts. Telegram
sert donc au *réengagement* (le prospect démarre le bot depuis la page de
remerciement, puis reçoit rappels et suivi), pas à la prospection.

Concrètement : le bouton « Rejoindre Telegram » que tu as déjà sur la page de
remerciement devient le **point d'entrée obligatoire** du canal. Ça reste très
utile — mais ce n'est pas un canal d'envoi groupé, contrairement à ce que laisse
entendre le §10.

### 2.5 Autres contraintes WhatsApp

- **Gabarits pré-approuvés** : tout message à l'initiative de l'entreprise passe par un modèle validé par Meta (24–48 h). Tes utilisateurs ne pourront pas taper un texte libre — l'interface doit l'expliquer, sinon incompréhension garantie.
- **Vérification d'entreprise** : documents légaux, plusieurs jours à plusieurs semaines. À lancer très tôt si le module est prioritaire.
- **Qualité du numéro** : Meta note chaque numéro ; trop de signalements et la limite d'envoi s'effondre. Le bouton « envoi groupé » du §10 est un risque à encadrer.

### 2.6 Effort et coût

| Lot | Effort | Coût récurrent |
|---|---|---|
| Telegram (bot, gabarits, action de workflow) | 3–4 j | **0 €** |
| WhatsApp via identifiants utilisateur (option B) | 6–8 j | 0 € pour toi — payé par l'utilisateur |
| WhatsApp Embedded Signup (option C) | +8–10 j | Idem + revue Meta |

**Point clé de modèle économique :** en option B, **tu ne paies rien**. C'est
ton utilisateur qui règle sa facture Meta. Cela supprime le seul poste de coût
variable inquiétant du module — et c'est un argument de plus pour l'option B.

---

## 3. Ce qui reste à implémenter — vue consolidée

Effort en jours-homme, développeur seul connaissant la base.

| Module | État | Effort | Risque | Coût externe |
|---|---|---|---|---|
| Preuve sociale (§12) | ❌ | 3–4 j | Faible | 0 € |
| A/B Testing (§07) | ❌ | 5–7 j | **Moyen** — piège de cache | 0 € |
| Sous-domaine `*.autofunnel.app` | ❌ | 2–3 j | Faible | 0 € |
| Domaine client complet (§15) | ❌ | +2–3 j | **Moyen** — support | 0 € |
| Telegram (§10) | ❌ | 3–4 j | Faible | 0 € |
| Kanban CRM (§14) | 🟡 | 4–6 j | Faible | 0 € |
| Exports JSON manquants (§16) | 🟡 | 3–5 j | Faible | 0 € |
| **Nœuds Attente + Condition (§13)** | ❌ | 4–6 j | **Élevé** — cœur métier | 0 € |
| Calendrier RDV natif (§08) | ❌ | 8–12 j | **Élevé** — fuseaux, concurrence | 0 € |
| WhatsApp option B (§10) | ❌ | 6–8 j | **Élevé** — validations Meta | 0 € pour toi |
| Canvas de workflows (§13) | ❌ | 6–9 j | Moyen | 0 € |
| Chatbots configurables (§11) | 🟡 | 8–12 j | **Élevé** — coût LLM ouvert | Variable ⚠️ |
| Espace revendeur (§17) | 🟡 | 8–12 j | Moyen | 0 € |
| SMTP personnalisé (§09) | ❌ | 3–4 j | Moyen — délivrabilité | 0 € |

**Total : environ 65 à 95 jours-homme** pour l'intégralité du cahier des charges.

### Le seul risque financier ouvert

Tous les modules sont à coût externe nul **sauf les chatbots IA**. Un chatbot
public branché sur un LLM est une surface de consommation sans plafond naturel :
un tunnel qui marche bien, ou un robot qui le martèle, et la facture OpenRouter
explose. **Plafond par utilisateur et par jour à concevoir dès le départ**, pas
après le premier incident.

---

## 4. Automatisation — mon avis honnête

**Non, ce qui est en place ne suffit pas** pour positionner AutoFunnel comme une
plateforme d'automatisation. Mais le manque n'est pas là où on l'attend.

### 4.1 Ce qui est solide

La **plomberie d'exécution** est de bonne qualité, meilleure que beaucoup de
produits commerciaux : file `scheduled_emails` avec verrouillage atomique
(`pending` → `sending`), reprise des envois bloqués, distribution immédiate après
capture, tracking d'ouverture et de clic avec garde anti-faux-positifs, cron
externe de secours. Ça, c'est fait, et bien fait.

> ⚠️ **CORRECTION du 28 juillet 2026.** La première version de cette section
> était **largement fausse**. Elle affirmait qu'il manquait les nœuds Attente et
> Condition, qu'il n'existait que deux déclencheurs et qu'aucune action ne
> touchait le CRM. Vérification faite dans `lib/workflows/types.ts` et
> `engine.ts` : tout cela existe. Section réécrite sur la base du code réel.

### 4.2 Ce qui existe réellement — et c'est beaucoup

**Treize déclencheurs**, pas deux : `lead.created`, `tag.added`,
`status.changed`, `purchase.completed`, `webinar.registered`,
`webinar.attended`, `webinar.absent`, `application.submitted`,
`appointment.booked`, `time.elapsed`, `time.before_event`,
`email.link_clicked`, `page.visited`.

**L'attente existe, sous deux formes** : `wait` (jours / heures / minutes) et
`wait_until` (date et heure absolues). La seconde est plus fine que ce que
proposent beaucoup d'outils commerciaux : elle ancre l'horloge du workflow sur
un instant fixe, ce qui permet un rappel « la veille du webinaire à 18 h » et
non « 3 jours après l'inscription ».

**La condition existe**, avec branches `then` / `otherwise`, imbrication, et
sept types de tests : présence d'un tag, statut CRM, langue, source, pays,
ouverture d'email et clic sur lien. Les deux derniers descendent à une finesse
inhabituelle : on peut tester l'ouverture d'**un email précis d'une séquence
précise**, ou un clic dont **l'URL contient un texte donné** — ce qui permet de
distinguer « a cliqué le lien d'achat » de « a cliqué un lien quelconque ».
Beaucoup d'outils du marché ne savent pas faire cette distinction.

**Les actions CRM existent** : `add_tag`, `set_status`, `enroll_in_sequence`,
`notify_owner`, `send_email`.

**La reprise après attente est gérée proprement** : `workflow_pending_runs`
stocke les `remaining_actions`, donc un workflow interrompu par une attente
reprend exactement où il s'était arrêté, y compris au milieu d'une condition.

L'exemple phare du cahier des charges — *Inscription → Email → Condition « a
participé ? » → Offre OU Relance* — est donc **constructible aujourd'hui**, à
l'exception de l'étape WhatsApp.

### 4.3 Ce qui manque réellement (vérifié)

**1. Les conditions de sortie.** C'est le seul manque grave, et il est réel :
rien n'annule les emails déjà programmés dans `scheduled_emails` quand un
contact convertit. Le filtre existant ne couvre que les désinscrits (RGPD).
Concrètement, quelqu'un qui achète au 2ᵉ email d'une relance en 5 **reçoit
quand même les 3 suivants**, qui lui demandent d'acheter ce qu'il vient de
payer. Une seule campagne suffit à abîmer la confiance dans l'outil.
→ ~2 jours.

**2. Le multicanal.** `WorkflowActionKind` ne contient aucune action WhatsApp ni
Telegram. Une fois la messagerie construite, il faudra les exposer comme
actions. → ~1 jour une fois le canal en place.

**3. L'observabilité.** Aucune table d'historique d'exécution :
`workflow_pending_runs` est une file d'attente, pas un journal. Impossible donc
de savoir combien de contacts sont passés par chaque branche, ni de retracer ce
qu'un workflow a fait pour un contact donné. C'est ce qui manquera le jour où un
utilisateur dira « mon automatisation ne marche pas ». → ~3 jours.

**4. Règle de ré-entrée.** Je n'ai trouvé aucun garde empêchant un même contact
d'entrer deux fois dans le même workflow — quelqu'un qui soumet le formulaire
deux fois déclencherait deux exécutions parallèles, donc des emails en double.
À confirmer par un test avant de chiffrer. → ~1 jour si confirmé.

### 4.4 Ce qui reste vrai : le canvas n'est pas la priorité

Le cahier des charges met en vedette le canvas visuel (§13, React Flow), et
c'est ce qui se voit sur une capture d'écran. Mais le moteur en dessous est
déjà bien plus riche que l'interface qui l'expose : l'écran de workflows est un
enchaînement de formulaires, alors que le moteur sait attendre, brancher et
tester finement.

Le canvas reste donc utile — non pour ajouter de la puissance, mais pour
**rendre visible celle qui existe déjà**. C'est un travail d'interface, pas de
moteur. Et il vient après les quatre points ci-dessus.

**Total réel : environ 6 à 9 jours** pour combler les manques, contre les
15 jours annoncés à tort dans la première version de ce document.

---

## 5. Design — avis honnête et proposition

### 5.1 Pourquoi tu n'es jamais satisfait

Tu améliores le design à chaque itération sans être satisfait, et je pense
savoir pourquoi : **tu corriges avec de la couleur un problème qui n'en est pas
un.**

L'interface utilise aujourd'hui **quatre accents** — or `#C7A436`, bleu
`#08498D`, vert `#31845C`, rouge — sans hiérarchie claire entre eux. Quand tout
est mis en valeur, plus rien ne l'est. Et à chaque insatisfaction, le réflexe est
d'ajouter une couleur, ce qui aggrave exactement le symptôme qu'on cherche à
traiter.

En face, il n'y a que **quatre neutres** (`ink`, `canvas`, `line`, `muted`).
C'est très peu. Les interfaces qui « font cher » — Linear, Vercel, Stripe — ont
dix à douze nuances de gris et **un seul** accent. La hiérarchie visuelle s'y
construit avec des gris, de l'espace et de la typographie ; la couleur ne sert
qu'à signaler.

### 5.2 Un problème mesurable : l'or est illisible

Ce n'est pas une question de goût. J'ai calculé le contraste :

| Couleur | Sur blanc | Norme WCAG AA (4,5:1) |
|---|---|---|
| Or `#C7A436` | **2,4:1** | ❌ **Échec** |
| Bleu `#08498D` | 9,0:1 | ✅ Excellent |
| Vert `#31845C` | 4,6:1 | ✅ Juste passé |

**Tout texte or sur fond blanc est sous le seuil légal d'accessibilité.** Et
au-delà de la norme : un texte à 2,4:1 est perçu comme *flou* plutôt que comme
*élégant*. C'est probablement une bonne part de ton insatisfaction diffuse.

L'or reste superbe **en aplat** (fond or, texte encre) ou **sur fond sombre**.
C'est comme texte sur blanc qu'il échoue.

### 5.3 L'idée structurante, propre à ton produit

**L'interface doit être silencieuse pour que les tunnels puissent être bruyants.**

Ton éditeur entoure un aperçu de tunnel qui est, par nature, coloré, contrasté,
vendeur — c'est son métier. Si l'interface autour est elle aussi colorée, les
deux se disputent l'attention et l'ensemble paraît brouillon, quelle que soit la
qualité de chaque partie.

Figma, Framer, Webflow sont tous gris. Ce n'est pas un manque d'ambition : c'est
que **le travail de l'utilisateur est le héros**, et que le cadre doit
disparaître. C'est exactement ta situation.

### 5.4 Proposition concrète

**Garde `#080E1A` comme ancrage de marque** — c'est une excellente couleur, sobre
et distinctive. Construis une vraie rampe de neutres autour :

| Jeton | Hex | Usage |
|---|---|---|
| `neutral-0` | `#FFFFFF` | Fond des cartes |
| `neutral-25` | `#FAFAFB` | Fond d'application |
| `neutral-50` | `#F4F5F7` | Zones alternées, survol |
| `neutral-100` | `#EBECEF` | Fonds désactivés |
| `neutral-200` | `#DFE1E6` | Bordures |
| `neutral-300` | `#C6C9D0` | Bordures marquées, séparateurs |
| `neutral-400` | `#9BA1AC` | Texte de remplacement |
| `neutral-500` | `#6F7681` | Texte secondaire |
| `neutral-600` | `#545B66` | Texte tertiaire |
| `neutral-700` | `#3C424B` | Corps de texte |
| `neutral-800` | `#262B32` | Titres |
| `neutral-900` | `#151920` | Titres forts |
| `neutral-950` | `#080E1A` | **Ton encre actuelle** — sidebar, boutons primaires |

**Un seul accent.** Deux options défendables :

**Option 1 — l'or, corrigé (recommandée).** Tu conserves ton identité. L'or
devient un accent strictement décoratif : aplats, bordures, éléments actifs sur
fond sombre. Pour tout texte or sur blanc, tu utilises une version foncée :
`#8A6F1F` (contraste 4,6:1, conforme). L'or clair `#C7A436` ne s'emploie plus
jamais en texte sur blanc.

**Option 2 — le bleu promu accent unique.** `#08498D` est déjà dans ta palette,
il passe le contraste haut la main, il est plus « logiciel » et moins « luxe ».
L'or serait alors réservé aux seuls signaux premium (licences, plan Agency),
ce qui lui rendrait sa force par rareté.

**Les couleurs sémantiques cessent d'être décoratives.** Vert, ambre et rouge ne
servent plus qu'à dire un état : réussite, avertissement, erreur. Jamais un
bouton d'action, jamais un titre, jamais un encadré « pour faire joli ».

**Ce qui compte davantage que la palette :**

- **Une échelle d'espacement stricte** de base 4 px (4, 8, 12, 16, 24, 32, 48, 64) — appliquée sans exception. L'irrégularité des espacements est ce qui fait « amateur » bien avant le choix des couleurs.
- **Trois tailles de texte maximum par écran.** Beaucoup d'interfaces en utilisent sept sans le savoir.
- **Deux graisses.** Le cahier des charges a raison sur ce point (400 et 500 uniquement) — c'est le seul de ses conseils de design que je reprendrais.
- **Une seule intensité d'ombre**, ou aucune. Aujourd'hui il y a `sm/md/lg/xl` : quatre profondeurs, c'est trois de trop pour une interface d'outil.

### 5.5 Sur la palette violette du cahier des charges

Je ne la reprendrais pas. Le violet `#534AB7` est correct, mais c'est la couleur
par défaut de la moitié des prototypes SaaS — et tu perdrais l'encre + or, qui
est distinctive et t'appartient. **Le problème n'a jamais été le choix des
teintes ; c'est leur nombre et l'absence de hiérarchie.**

### 5.6 Effort

Refonte des jetons de couleur et de l'échelle d'espacement de l'interface
d'application (pas des tunnels générés — ils gardent leurs thèmes) :
**3 à 5 jours**. C'est peu, et c'est ce qui changera le plus ta perception du
produit, bien plus qu'un module supplémentaire.

⚠️ **Ne touche pas aux thèmes des tunnels.** Ils doivent rester colorés et
variés : c'est le produit que vendent tes clients.

---

## 6. Décisions attendues de ta part

| # | Décision | Recommandation |
|---|---|---|
| 1 | Domaine : cas A seul, ou A + B ? | **A d'abord**, B ensuite (§1.1) |
| 2 | Domaine racine autorisé ? | **Non** — imposer `www.` ou un sous-domaine (§1.3) |
| 3 | Architecture WhatsApp : A, B ou C ? | **B** en v1, C plus tard. Jamais A (§2.2) |
| 4 | 360dialog ou Twilio ? | **Twilio** pour démarrer (§2.3) |
| 5 | Lancer la vérification d'entreprise Meta ? | Oui si WhatsApp est prioritaire — le délai est long (§2.5) |
| 6 | Automatisation : nœuds d'abord ou canvas d'abord ? | **Les nœuds.** Sans hésitation (§4.3) |
| 7 | Design : or corrigé, ou bleu promu ? | **Or corrigé** — tu gardes ton identité (§5.4) |
| 8 | Plafond de consommation LLM pour les chatbots | À concevoir avant la première ligne de code (§3) |

---

## 7. Prérequis, toujours bloquant

Rien ne doit démarrer avant que le build soit vert. **Six lots de modifications
n'ont jamais été compilés** : correctifs d'animations, CTA, footer, fetcher de
scraping, bugs de l'éditeur cloné, dashboard admin. L'environnement Linux est
indisponible depuis plusieurs heures, donc je n'ai pas pu les vérifier moi-même.

`npm run lint && npm run build && npx vitest run` — puis on avance.

---

## Sources

- [Pricing on the WhatsApp Business Platform — Meta for Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- [WhatsApp Business API Pricing 2026: Conversation Categories, Costs, and What Changed](https://blueticks.co/blog/whatsapp-business-api-pricing-2026)
- [WhatsApp Business API Pricing 2026: Exact Per-Message Costs & Billing Explained](https://www.uptail.ai/blog/whatsapp-business-api-pricing-2026-what-it-costs-and-how-billing-works)
- [Vercel — Multi-tenant Limits](https://vercel.com/docs/multi-tenant/limits)
- [Vercel — Configuring Custom Domains](https://vercel.com/docs/multi-tenant/domain-management)
- [Vercel — Working with domains](https://vercel.com/docs/domains/working-with-domains)
