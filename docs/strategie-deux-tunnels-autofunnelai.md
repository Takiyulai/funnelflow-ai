# AutoFunnelAI — stratégie de deux tunnels de vente

**Version :** 1.0 — audit du produit au 1er octobre 2026  
**Périmètre :** stratégie, messages, parcours, preuves et briefs d’assets.  
**Hors périmètre :** développement des landings, modification du produit ou du wizard, production vidéo finale.

---

## 1. Résumé exécutif

AutoFunnelAI ne doit pas être présenté comme un simple générateur de pages. Le produit réellement livré couvre une chaîne plus large :

> **décrire une offre → générer un tunnel multi-page → l’éditer → le publier → capturer les prospects → les organiser dans le CRM → les relancer par email et workflows → mesurer les résultats.**

Cette continuité est la différence centrale à exploiter. L’export systeme.io et HTML est utile, mais secondaire : la promesse prioritaire est de faire fonctionner le système dans AutoFunnelAI.

| Tunnel | Désir d’entrée | Transformation vendue | Angle principal |
|---|---|---|---|
| **A — Vendre son offre** | Obtenir plus d’inscriptions, de rendez-vous ou de ventes sans assembler plusieurs outils | Passer d’une offre peu systématisée à un parcours connecté, publié et suivi | « Transforme ton offre en système de vente connecté. » |
| **B — Apprendre à construire des tunnels** | Acquérir une compétence pratique et savoir produire un tunnel cohérent pour soi ou un client | Passer de pages assemblées au hasard à une méthode de conception reproductible | « Apprends la logique d’un vrai tunnel en en construisant un. » |

### Décisions structurantes

1. **Le tunnel A conduit rapidement vers l’essai Free**, avec une démonstration du parcours complet et un lead magnet secondaire pour les visiteurs non prêts.
2. **Le tunnel B commence davantage par l’éducation.** Le guide gratuit y joue un rôle plus central, puis l’application devient l’atelier où la méthode est appliquée.
3. **Le wizard est une preuve forte dans les deux tunnels**, mais son rôle change : accélérateur de mise en marché dans A, support pédagogique et cadre méthodologique dans B.
4. **Aucune promesse de revenus, de clients garantis ou de richesse** ne doit apparaître dans B. Le bénéfice est une compétence, une méthode, un livrable et un gain de temps.
5. **Les preuves visuelles doivent venir du vrai produit.** Les captures de l’interface réelle sont préférables aux faux dashboards générés par IA.

---

## 2. Base factuelle : ce que le produit permet réellement

| Domaine | Capacité réellement présente | Valeur commerciale | Sources principales |
|---|---|---|---|
| Création IA | Deux entrées : « Pas à pas » et « Express IA » | Réduit la difficulté du brief initial sans retirer le contrôle | `components/funnel/CreateFunnelWizard.tsx` |
| Types de tunnels | Lead magnet, produit digital, webinaire, rendez-vous, coaching high ticket, challenge | Partir d’un parcours adapté à l’objectif | `lib/funnels/kinds.ts` |
| Génération | Tunnel multi-page, sections, copywriting et design | Une première version exploitable, pas seulement du texte | `lib/ai/prompts.ts`, `lib/funnels/types.ts` |
| Édition | Pages, sections, contenu, médias, CTA, style, fonds, formulaires, preuves et prix | Rend le résultat modifiable et réutilisable | `components/editor/`, `components/editor/tabs/` |
| Régénération IA | Section ou page ciblée, avec consignes | Accélère les itérations sans repartir de zéro | `SectionRegenPanel.tsx`, `PageRegenPanel.tsx` |
| Aperçu | Desktop/mobile et aperçu navigateur | Réduit les erreurs avant publication | `components/funnel/FunnelPreview.tsx` |
| Publication | URL publique native `/tunnel/[slug]` | Le tunnel peut vivre entièrement dans AutoFunnelAI | `app/tunnel/[slug]/` |
| Capture et CRM | Formulaires, popups, contacts, statuts, tags, listes, filtres | Rend les leads actionnables après la capture | `app/(app)/leads/page.tsx`, `lib/crm/` |
| Suivi CRM avancé | Temps actif par page pour un prospect identifié, sessions et dernière visite | Aide à repérer l’engagement réel | `components/crm/ContactDetail.tsx` |
| Partage CRM | Lecture seule des contacts, listes et tags | Collaboration sans exposer tout le compte | `components/crm/CrmSharingClient.tsx` |
| Email | Diffusions, séquences, éditeur riche, variables, ciblage tags/listes | Nourrit les contacts dans le même outil | `components/crm/EmailsModule.tsx`, `EmailRichEditor.tsx` |
| Livraison d’un guide | Email automatique avec lien | Permet d’opérer un lead magnet | `components/editor/DeliveryEmailTab.tsx` |
| Workflows | Déclencheurs, délais, tags, listes, statuts, séquences, emails, notifications, conditions | Automatise le suivi | `lib/workflows/types.ts`, `WorkflowsClient.tsx` |
| Paiements | Stripe/Stripe Connect ou CinetPay selon configuration | Vendre directement depuis le parcours | `app/(app)/paiements/page.tsx`, `app/api/checkout/route.ts` |
| Rendez-vous | Types, disponibilités et widget public | Couvre services et appels de vente | `components/booking/`, `app/rdv/` |
| Statistiques | Visites, uniques, leads, conversion, pages, sources | Lecture opérationnelle du tunnel | `FunnelStatsOverview.tsx` |
| Tests A/B | Répartition A/B, variations textuelles et choix du gagnant | Améliorer une variable à la fois | `AbTestsPanel.tsx` |
| Import | Clonage d’une page par URL puis édition | Reconstruire plus vite une base existante | `app/(app)/import/page.tsx` |
| Modèles et tutoriels | Galerie communautaire et bibliothèque de tutoriels | Réduit le temps de départ et soutient l’apprentissage | `/galerie`, `/tutoriels` |
| Intégrations | Pixels Meta, GA4, GTM, TikTok ; export systeme.io et HTML | Acquisition, mesure et porte de sortie | `TrackingPixelsTab.tsx`, `SystemeIoExportMenu.tsx` |

### Limites à dire clairement

- Free permet de construire et tester, mais **n’inclut pas la publication**.
- AutoFunnelAI **n’héberge pas un espace membre ni les fichiers d’un produit**. Un guide est livré par un lien dans l’email automatique.
- Les domaines personnalisés de tunnels et les espaces clients/agence ne sont pas encore livrés.
- Agency est large mais pas illimité en copy IA : **1 000 régénérations par mois**.
- L’A/B testing actuel porte sur des variations textuelles ciblées, pas deux designs complets.
- Le suivi du temps commence après identification du contact, pas avant la capture.

### Plans réels (`lib/billing/plans.ts`)

| Plan | Prix | Positionnement utile |
|---|---:|---|
| Free | 0 € | Découvrir la méthode et générer un premier tunnel en édition |
| Starter | 19 €/mois | Lancer : 5 tunnels, 1 publié, CRM, campagnes et paiements |
| Pro | 59 €/mois | Automatiser : 25 tunnels, 10 publiés, workflows, suivi du temps et domaine d’envoi |
| Agency | 129 €/mois | Produire en volume : 150 générations et 1 000 régénérations copy par mois |

---

## 3. Audit du wizard et rôle dans les tunnels

Le wizard commence par **Pas à pas**, puis **Express IA**. Le parcours guidé contrôle le format, le template, l’objectif, la marque, l’offre, le prix, les bénéfices, la garantie, l’auteur, l’audience, la promesse, le ton, les médias, le CTA, l’ambiance et les options propres au webinaire, au rendez-vous ou au challenge. Express IA part d’une description libre, mais impose aussi un type de tunnel explicite.

Il promet donc implicitement plus qu’une page : une architecture, une hiérarchie de sections, un angle de copywriting, des CTA, une direction visuelle et une base de suivi cohérente.

### Placement recommandé

- **Tunnel A :** après le problème et la démonstration du système connecté, avant les tarifs. Le wizard prouve qu’une offre réelle peut être transformée en parcours.
- **Tunnel B :** plus tôt. Chaque question devient une décision pédagogique. Message : « Tu n’apprends pas en regardant seulement des vidéos : tu avances décision par décision sur un vrai projet. »

Ne jamais présenter Express IA comme un bouton magique. Pour le tunnel B : **« L’IA produit une première version ; le wizard t’aide à donner le bon brief et l’éditeur te permet d’exercer ton jugement. »**

---

## 4. Tunnel A — transformer une offre en système de vente connecté

### Persona

Solopreneur, coach, consultant, freelance, formateur ou créateur de produit digital francophone. Il a une offre vendable, parfois une audience, mais son parcours est incomplet ou dispersé.

**Situation :** traitement manuel des demandes, plusieurs outils mal reliés, page sans suivi, construction repoussée par manque de temps ou de clarté.  
**Désirs :** lancer vite, capturer et organiser, relancer sans tout refaire, garder le contrôle et modifier sans prestataire.  
**Objections :** texte IA générique, complexité technique, offre trop particulière, nouvel outil à connecter, absence de garantie de vente, limites de Free.

Réponse honnête : montrer les questions réelles du wizard, l’édition manuelle et la chaîne native jusqu’au CRM. Expliquer que Free permet de construire/tester et que Starter est le premier plan publiable.

### Transformation et angle

**Avant :** une offre, des actions éparpillées, des relances manuelles.  
**Après :** un tunnel multi-page publié, des contacts organisés, une livraison ou séquence email et des actions automatiques dans une seule application.

> **Promesse : « Mets en place un système qui capture, organise et relance pendant que tu te concentres sur ton offre. »**

**Ennemi :** les passages manuels entre « quelqu’un s’intéresse » et « quelqu’un devient client ».  
**Mécanisme :** quatre expertises IA coordonnent stratégie, copywriting, mise en page et suivi.  
**Preuve :** un contact traverse réellement page, formulaire, CRM et workflow.

### Architecture de la landing

| Ordre | Section | But | Message / preuve |
|---:|---|---|---|
| 1 | Hero | Promesse | « Transforme ton offre en système de vente connecté. » CTA « Créer mon tunnel gratuitement » |
| 2 | Barre de preuve | Étendue sans catalogue | Tunnel multi-page · CRM · Emails · Workflows · Paiements |
| 3 | Problème | Reconnaissance | Cartes Page, Formulaire, CRM, Emails et Relances non connectées |
| 4 | Nouveau mécanisme | Expliquer la continuité | Offre → Tunnel → Lead → CRM → Relance → Conversion |
| 5 | Wizard | Crédibiliser l’IA | Pas à pas / Express, vraies questions, génération |
| 6 | Résultat éditable | Lever la boîte noire | Pages, sections, mobile, modification d’un titre et CTA |
| 7 | Après publication | Différencier d’un builder | Capture → liste/tag → email de livraison → workflow |
| 8 | Cas d’usage | Projection | Lead magnet, produit, webinaire, RDV, coaching, challenge |
| 9 | Preuves | Réduire le risque | Captures annotées, démos, témoignages uniquement vérifiés |
| 10 | Tarifs | Orienter | Free pour construire ; Starter pour publier ; Pro pour automatiser |
| 11 | Guide secondaire | Capter les hésitants | « Pas prêt maintenant ? Reçois le guide… » |
| 12 | FAQ | Objections | IA, publication, données, export et limites Free |
| 13 | CTA final | Activation | « Décris ton offre aujourd’hui. » |

### Suite du parcours

- **Inscription :** rappeler ce qui est immédiatement disponible dans Free, sans promettre la publication gratuite.
- **Activation :** envoyer directement au wizard ; premier jalon = choisir un format et remplir l’offre.
- **Branche guide :** formulaire prénom/email, page merci, email de livraison natif, puis 5 emails.

### Emails après téléchargement

| Email | Objectif | Sujet indicatif |
|---:|---|---|
| 0 | Livrer | « Ton guide est prêt » |
| 1 | Faire voir la fragmentation | « Une page n’est pas encore un système » |
| 2 | Enseigner le parcours | « Les 5 passages entre intérêt et client » |
| 3 | Montrer la chaîne | « Regarde un lead traverser tout le système » |
| 4 | Lever l’objection IA | « Ce que l’IA prépare — et ce que tu contrôles » |
| 5 | Activer | « Construis la première version de ton tunnel » |

---

## 5. Tunnel B — apprendre à construire des tunnels professionnels

### Persona

Freelance débutant/intermédiaire, assistant marketing, community manager, copywriter, designer ou entrepreneur qui veut comprendre la construction d’un tunnel et éventuellement proposer cette compétence à des clients.

**Situation :** il connaît les termes, mais pas leur ordre logique ; consomme des tutoriels sans produire ; manque de cadre ; commence par le design ; ignore ce qu’un livrable client doit contenir.  
**Désirs :** comprendre les décisions, produire un premier exemple, répéter la méthode, aller plus vite sans dépendre aveuglément de l’IA.  
**Objections :** peur de ne rien apprendre avec l’IA, absence de client ou d’offre, manque de compétences design/copy, confusion entre outil et formation.

AutoFunnelAI apporte un parcours guidé, des templates, un éditeur, des tutoriels et un environnement de pratique. Il ne doit pas être présenté comme une certification ni comme une garantie de clients.

### Transformation et garde-fous

**Avant :** tutoriels accumulés, pages isolées et décisions prises au hasard.  
**Après :** méthode structurée, premier tunnel démontrable et capacité à refaire le processus.

> **Promesse : « Apprends la logique d’un tunnel en construisant un parcours complet, étape par étape. »**

Promesse secondaire : « Utilise ensuite cette méthode pour tes propres offres ou comme compétence de service. »

Ne pas promettre de revenu, de clients, de richesse, de certification ou de résultat garanti. Les modèles sont des bases adaptables, pas des résultats automatiques.

### Architecture de la landing

| Ordre | Section | But | Message / preuve |
|---:|---|---|---|
| 1 | Hero | Promesse pédagogique | « Apprends à construire un vrai tunnel en en réalisant un. » |
| 2 | Symptôme | Reconnaissance | « Tu sais faire une page, pas encore orchestrer le parcours. » |
| 3 | Carte de la compétence | Montrer le programme réel | Offre → cible → pages → copy → capture → suivi → mesure |
| 4 | Guide gratuit | Première victoire | Chapitres/frameworks à confirmer après réception |
| 5 | Wizard comme méthode | Prouver le cadre | Chaque question correspond à une décision professionnelle |
| 6 | Quatre expertises | Modèle mental | Analyste → Rédacteur → Designer → Closer |
| 7 | Atelier pratique | Montrer la production | Générer, corriger, prévisualiser, publier/livrer |
| 8 | Progression | Clarifier | Comprendre → construire → connecter → mesurer → répéter |
| 9 | Cas pratique | Tangible | Brief d’un coach → lead magnet + suivi |
| 10 | Usage professionnel | Ouvrir la possibilité de service | Brief, mobile, CTA, formulaire, livraison |
| 11 | Plans | Relier usage et besoin | Free apprendre ; Starter publier ; Pro automatiser |
| 12 | FAQ | Objections | Niveau, IA, absence de client, modifications, export |
| 13 | CTA final | Faire agir | « Construis ton premier cas pratique » |

### Parcours et emails

La page merci confirme l’envoi du guide, fournit une mini-checklist de préparation et propose « Commencer le cas pratique ». La page produit suivante montre : brief, architecture, génération, édition, capture, suivi et livrable final.

| Email | Objectif | Sujet indicatif |
|---:|---|---|
| 0 | Livrer | « Voici ton plan de construction » |
| 1 | Replacer la compétence | « Un tunnel n’est pas une suite de jolies pages » |
| 2 | Enseigner le brief | « Les 5 questions avant d’ouvrir un éditeur » |
| 3 | Décomposer l’architecture | « Quelle page vient après laquelle — et pourquoi » |
| 4 | Faire pratiquer | « Construis aujourd’hui la version 1 » |
| 5 | Montrer le jugement humain | « Où corriger l’IA » |
| 6 | Introduire l’usage client | « Ce qu’un livrable sérieux doit contenir » |
| 7 | Activer | « Ton prochain cas pratique est prêt » |

---

## 6. Analyse du guide gratuit — statut et grille de décision

Le guide mentionné dans le brief **n’est pas présent dans les pièces jointes ni dans le dépôt**. `AutoFunnel-AI-Script-Tutoriel.docx` est un script de tutoriel produit, pas le lead magnet demandé. Son contenu ne doit pas être inventé.

Conclusions provisoires : le guide est probablement central dans le tunnel B et secondaire dans A. Son titre, sa promesse, ses extraits et son placement exact restent à confirmer.

### Grille à appliquer dès réception

1. Quelle promesse précise et atteignable livre-t-il ?
2. Parle-t-il davantage au vendeur d’une offre ou au futur funnel builder ?
3. Quel niveau suppose-t-il ?
4. Quelle première victoire est possible en moins de 30 minutes ?
5. Quelle étape devient naturellement plus simple dans AutoFunnelAI ?
6. Répète-t-il la landing ou délivre-t-il une vraie valeur ?
7. Contient-il des preuves, exemples ou frameworks vérifiables ?
8. Comment sera-t-il hébergé et livré ?
9. Son CTA final conduit-il naturellement au wizard ?
10. Quels chapitres peuvent devenir des emails autonomes ?

**Placement :** s’il enseigne la structure d’un tunnel, il devient l’actif principal de B. S’il traite de l’automatisation des ventes, il devient plus fort dans A. S’il est trop générique, il doit être retravaillé avant lancement.

---

## 7. Brief motion design — tunnel A

**Concept :** « De l’offre au suivi automatique »  
**Durée :** 45 s · 16:9, puis 1:1 et 9:16  
**Style :** interface réelle, profondeur 2.5D légère, fond sombre, accents or/vert.  
**But :** montrer une continuité, pas un catalogue.

| Temps | Image | Mouvement | Message écran |
|---:|---|---|---|
| 0–5 s | Cartes Page, Formulaire, CRM, Emails dispersées | Connexions rompues | « Une page seule n’est pas un système. » |
| 5–9 s | Cartes alignées sur un fil or | Impulsion lumineuse | « Relie chaque étape. » |
| 9–15 s | Vrai choix Pas à pas / Express IA | Saisie du brief | « Décris ton offre. » |
| 15–21 s | Pages générées en profondeur | Apparition page par page | « L’IA structure le parcours. » |
| 21–27 s | Éditeur et aperçu mobile | Modification puis publication | « Ajuste et publie. » |
| 27–33 s | Formulaire public soumis | Carte contact vers CRM | « Le prospect devient un contact. » |
| 33–40 s | Tag → attente → email | Nœuds activés successivement | « Le suivi continue automatiquement. » |
| 40–45 s | Système complet | Zoom arrière et CTA | « Ton système de vente, dans une seule app. » |

Son : pulsation discrète, clics réels, confirmations sur génération/publication/capture/email. La compréhension ne dépend pas de la voix ; une version sous-titrée est obligatoire.

---

## 8. Brief motion design — tunnel B

**Concept :** « Apprendre en construisant »  
**Durée :** 50 s · 16:9, puis 1:1 et 9:16  
**Style :** blueprint animé + interface réelle, traits or et annotations pédagogiques.  
**But :** rendre visible le passage de la théorie à un livrable.

| Temps | Image | Mouvement | Message écran |
|---:|---|---|---|
| 0–5 s | Tutoriels et pages isolées empilés | La pile devient confuse | « Regarder ne suffit pas pour savoir construire. » |
| 5–10 s | Blueprint Offre → Cible → Pages → Suivi | Le chemin se dessine | « Commence par la logique. » |
| 10–17 s | Wizard Pas à pas | Une réponse alimente chaque nœud | « Chaque question prépare une décision. » |
| 17–24 s | Les quatre expertises | Passage de relais lumineux | « Quatre expertises préparent la première version. » |
| 24–31 s | Tunnel puis édition | Titre, média, CTA, mobile corrigés | « L’IA propose. Tu apprends à décider. » |
| 31–38 s | Formulaire, CRM, email, workflow | Connexion guidée | « Un tunnel continue après la page. » |
| 38–45 s | Aperçu public / dossier de livraison | Contrôles validés | « Un cas pratique montrable. » |
| 45–50 s | Guide + application | CTA final | « Apprends en construisant ton premier tunnel. » |

Ne pas montrer de revenu projeté, notification fictive de client, certification inexistante, espace client Agency non livré ou dashboard avec chiffres inventés.

---

## 9. Noms et ordre réels des expertises IA

La landing les définit dans `app/page.tsx` et l’animation dans `components/marketing/AgentWorkflowAnimation.tsx`.

1. **L’Analyste — Stratégie** : étudie l’offre et l’audience, puis choisit la structure.
2. **Le Rédacteur — Copywriting** : rédige accroches, bénéfices et CTA.
3. **Le Designer — Mise en page** : construit un rendu cohérent et mobile-first.
4. **Le Closer — Conversion & suivi** : relie capture, CRM et relances.

Cet ordre doit rester constant dans les animations, schémas et textes.

---

## 10. Assets statiques — priorisation

### Catégorie A — indispensables

| Asset | Nature | Source réelle | Usage |
|---|---|---|---|
| Carte du système connecté | SVG sur fond sombre | Étapes réelles du produit | Hero / mécanisme |
| Pas à pas / Express IA | Capture annotée | `/create` | Point de départ |
| Questions du wizard | Montage de 3 écrans | `/create` | Preuve de méthode |
| Éditeur + mobile | Capture réelle | `/editor/[id]` | Édition et responsive |
| Lead → CRM → workflow | Triptyque réel | tunnel public, `/leads`, `/workflows` | Continuité |
| Plans | Tableau natif fidèle à `plans.ts` | Landing / abonnement | Transparence |

**Spécifique A :** formulaire puis même contact dans le CRM ; workflow « lead → liste → bienvenue » ; statistiques de démonstration explicitement identifiées ; paiement si l’offre montrée est vendue.  
**Spécifique B :** blueprint des sept décisions ; avant/après expliqué ; checklist de livraison ; carte des quatre expertises.

### Catégorie B — renforce la conversion

- GIF de génération des pages ;
- GIF Desktop/Mobile ;
- ciblage email par liste/tag ;
- condition workflow « appartient à la liste » ;
- A/B test d’une accroche ;
- galerie de trois architectures ;
- extrait des tutoriels ;
- partage CRM en lecture seule.

### Catégorie C — après validation

- portraits/illustrations de personas ;
- variantes publicitaires sectorielles ;
- carrousels sociaux ;
- miniatures de tutoriels ;
- cas clients filmés ;
- versions anglaise et espagnole.

### Décision sur les images générées

Aucune fausse capture produit n’est générée. Les assets A reposent sur l’interface réelle ; une interface fictive affaiblirait la preuve. Les images IA ne sont pertinentes que comme fonds abstraits ou métaphores, après validation artistique et réception du guide.

---

## 11. Comparaison des deux tunnels

| Dimension | Tunnel A | Tunnel B |
|---|---|---|
| Question | « Comment vendre et suivre sans tout connecter ? » | « Comment apprendre à construire un tunnel cohérent ? » |
| Produit perçu | Système opérationnel tout-en-un | Atelier guidé de conception |
| CTA | Créer mon tunnel | Recevoir le plan / Construire mon cas |
| Guide | Secondaire | Central |
| Preuve forte | Un lead traverse tout le système | Un brief devient un livrable |
| Fonctions phares | CRM, email, workflow | Wizard, templates, édition, tutoriels |
| Plan naturel | Starter puis Pro | Free puis Starter |
| Objection | « Encore un outil à connecter » | « L’IA m’empêchera d’apprendre » |
| Réponse | Chaîne native | L’IA propose, l’utilisateur décide |
| Surpromesse à éviter | Vente automatique garantie | Carrière/revenu garantis |

---

## 12. Inventaire de production

### Données de démonstration

- une marque fictive cohérente sans faux témoignage ;
- une offre simple avec prix, cible et promesse ;
- un guide accessible par URL ;
- un tunnel lead magnet publié ;
- un formulaire avec liste et tag ;
- une séquence de bienvenue ;
- un workflow simple et un conditionnel ;
- des contacts de test clairement identifiés ;
- un paiement test si nécessaire ;
- des visites de test non présentées comme résultats clients.

### Captures à produire

1. Dashboard.
2. Choix Pas à pas / Express IA.
3. Type de tunnel et architecture annoncée.
4. Offre et audience.
5. Génération.
6. Éditeur desktop/mobile.
7. Formulaire public.
8. CRM, listes, tags, fiche contact.
9. Email de livraison.
10. Séquence et variables de substitution.
11. Workflow.
12. Statistiques et A/B test.
13. Paiements.
14. Tutoriels.

### Formats

- landing : WebP/AVIF 2× ;
- réseaux : 1080×1080, 1080×1350, 1080×1920 ;
- motion : 1920×1080, 30 fps, master et version sous-titrée ;
- GIF/vidéo web : 6–10 secondes, boucle propre ;
- schémas : SVG éditable ;
- guide : PDF optimisé sur URL stable.

---

## 13. Messages à tester

### Tunnel A

1. « Transforme ton offre en système de vente connecté. »
2. « Du premier clic à la relance : construis tout ton parcours dans une seule app. »
3. « Arrête d’assembler des outils. Lance un tunnel qui capture, organise et relance. »

### Tunnel B

1. « Apprends à construire un vrai tunnel en en réalisant un. »
2. « Une méthode guidée pour passer du brief à un tunnel complet. »
3. « Comprends la logique. Construis le parcours. Répète la méthode. »

---

## 14. Références et éléments manquants

### Produit audité

`CLAUDE.md`, `AGENTS.md`, `lib/billing/plans.ts`, `lib/funnels/types.ts`, `lib/funnels/kinds.ts`, `lib/ai/prompts.ts`, `components/funnel/CreateFunnelWizard.tsx`, `components/editor/`, `components/crm/`, `lib/workflows/types.ts`, `components/workflows/WorkflowsClient.tsx`, `components/funnel/FunnelStatsOverview.tsx`, `components/funnel/AbTestsPanel.tsx`, `app/(app)/paiements/page.tsx`, `app/api/checkout/route.ts`, `app/(app)/import/page.tsx`, `app/(app)/tutoriels/page.tsx`, `components/marketing/AgentWorkflowAnimation.tsx`, `motion-design/BRIEF_STORYBOARD.md`.

### Non vérifié

1. Le guide gratuit n’a pas été fourni.
2. Les deux URL Pinggy d’inspiration étaient inaccessibles pendant l’audit ; il faut des captures ou une URL stable.
3. Aucun témoignage ou chiffre client ne doit être publié sans preuve et autorisation.

---

## 15. Ordre de validation avant production

1. Fournir le guide gratuit.
2. Fournir des captures ou URLs stables des inspirations.
3. Choisir une promesse principale par tunnel.
4. Valider le rôle du guide.
5. Préparer les données de démonstration.
6. Capturer les assets A dans le vrai produit.
7. Écrire la copy complète et les emails.
8. Produire les animatics.
9. Tester les messages auprès d’une petite audience.
10. Développer les pages après validation.

