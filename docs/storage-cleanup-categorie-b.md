# Nettoyage Storage — catégorie B (diagnostic, aucune suppression effectuée)

Bucket : `cloned-funnels-media` — projet `xhjhdheskjwbmdjzazoq`
Relevé du 17 août 2026, après suppression de la catégorie A.

## Méthode

Extraction par expression régulière de tous les chemins
`cloned-funnels-media/<...>` présents dans **l'intégralité des lignes** de
`funnels`, `shared_templates` et `funnel_ab_tests` (cast de la ligne entière en
texte, donc aucune colonne ne peut être oubliée — y compris `json_content`,
`published_content`, `brief`, `html_content`, `default_cta`, `content`,
`thumbnail_url`, `variant_b`).

### Le cas `published_content` (tranché le 17 août 2026)

Le diagnostic initial parlait de « 4 tables ». En réalité **`published_content`
n'est pas une table** : aucune table du schéma `public` ne porte ce nom. C'est
une colonne `jsonb` de `funnels`, couverte par le scan de la ligne entière.

Elle n'est pas accessoire pour autant :

| | |
|---|---:|
| Chemins présents dans `funnels.published_content` | 91 |
| **Présents nulle part ailleurs** | **10** |

Ces 10 fichiers ne sont cités que par la version publiée d'un tunnel dont la
version de travail a changé depuis. Un scan colonne par colonne qui oublierait
`published_content` casserait 10 images sur des pages en ligne.

**Balayage exhaustif** de toutes les tables de `public` à la recherche de la
chaîne `cloned-funnels-media`, sans liste présupposée :

| Table | Lignes contenant une référence |
|---|---:|
| `funnels` | 29 |
| `shared_templates` | 2 |
| `funnel_ab_tests` | 2 |

Aucune autre table. Les trois sources scannées couvrent 100 % des références.
Le script vérifie en plus, à chaque exécution, que `published_content` a bien
contribué des chemins, et s'arrête sinon.

**Contrôle de cohérence** : 965 chemins référencés distincts, 965 correspondances
exactes dans le Storage, **0 référence pointant vers un fichier absent**. Aucun
fichier n'est ambigu — chacun des 61 conservés est rattaché à un tunnel nommé.

## État global

| | Fichiers | Taille |
|---|---:|---:|
| Actuel | 3 479 | 1 307,1 Mo |
| Référencés (à conserver) | 965 | **190,9 Mo** |
| Non référencés (supprimables) | 2 514 | 1 116,2 Mo |

## 1. Dossiers 100 % supprimables

Aucun fichier à conserver à l'intérieur — suppression du dossier entier.

| Dossier | Fichiers | Taille |
|---|---:|---:|
| `ec3f8c28-d3e2-4fed-b27d-aa7bf3628eee/24df5e18-3e0d-4c83-9740-afb5a0eb6443/` | 46 | 53,0 Mo |
| `d2e3f27b-30b6-4af3-967e-098a3d9f0f56/` *(hors catégorie B — voir note)* | 38 | 14,2 Mo |
| `625774bc-d103-4133-b983-2f882e0f943a/3a602328-6cdb-44a9-822a-bbde02f06bc6/` | 13 | 6,9 Mo |
| `ec3f8c28-d3e2-4fed-b27d-aa7bf3628eee/5acde2ef-eee8-4d20-a071-bc401d6849ed/` | 6 | 4,4 Mo |
| **Total** | **103** | **78,5 Mo** |

> **Note** — `d2e3f27b-…` est un dossier racine à plat, sans aucun fichier
> référencé. Il n'appartenait pas à la catégorie B et a échappé au passage sur
> la catégorie A. Il est supprimable en entier.

**78,5 Mo ne suffisent pas** : il faut libérer au moins 207 Mo pour repasser
sous 1,1 Go. Les dossiers mixtes doivent donc être traités.

## 2. Dossiers mixtes

Pour chacun : tout est supprimable **sauf** les fichiers listés en partie 3.

| Dossier | Fichiers | À garder | Supprimables | Libérable |
|---|---:|---:|---:|---:|
| `ec3f8c28-…/f77acc91-6038-4a77-ae62-919791c39ef9/` | 971 | 10 | 961 | 355,7 Mo |
| `ec3f8c28-…/77fd4169-b6ce-4b01-8eee-805b7e01e1fc/` | 348 | 5 | 343 | 160,1 Mo |
| `ec3f8c28-…/1c732975-25a4-425a-ba7c-ab3fe8ec1baf/` | 315 | 5 | 310 | 137,0 Mo |
| `625774bc-…/b6809800-221c-40e9-94cd-617018fd9c19/` | 238 | 3 | 235 | 106,5 Mo |
| `ec3f8c28-…/04a2efb3-2e92-4f06-9687-6e034e11aaa8/` | 176 | 5 | 171 | 78,9 Mo |
| `625774bc-…/57605fc4-0fff-44e0-91cc-d0e8a188c95a/` | 57 | 1 | 56 | 64,5 Mo |
| `ec3f8c28-…/97e5955a-81c9-44df-9080-ca96c09759f2/` | 117 | 6 | 111 | 42,6 Mo |
| `ec3f8c28-…/a79ac5d5-d7f5-4aef-82c7-1f50161b8ed3/` | 128 | 5 | 123 | 38,8 Mo |
| `625774bc-…/40c2e5df-61b7-4b78-8221-c4ed11dadfab/` | 44 | 1 | 43 | 17,5 Mo |
| `ec3f8c28-…/65cdac5b-894d-47ce-ad90-c9d55e968c1a/` | 12 | 1 | 11 | 7,0 Mo |
| `ec3f8c28-…/3a602328-6cdb-44a9-822a-bbde02f06bc6/` | 18 | 6 | 12 | 6,7 Mo |
| `ec3f8c28-…/4effa0d5-4bc4-42bc-a902-21a79ec6762d/` | 6 | 1 | 5 | 5,8 Mo |
| `625774bc-…/b93bb8f9-084b-4af5-bad9-e0c16a266d91/` | 12 | 3 | 9 | 4,6 Mo |
| `ec3f8c28-…/642a12cb-ae8c-4f38-96f3-a85e6d05d8a2/` | 8 | 2 | 6 | 4,4 Mo |
| `625774bc-…/ef85cf34-2ad3-4dcb-82d5-71c1aade6428/` | 6 | 2 | 4 | 3,4 Mo |
| `ec3f8c28-…/2bc14d57-21e6-461a-a5fc-b663aa5125c8/` | 4 | 2 | 2 | 1,6 Mo |
| `625774bc-…/e25d000d-4a06-4810-b8e2-db6662fa9974/` | 9 | 2 | 7 | 1,6 Mo |
| `ec3f8c28-…/e8ea7693-dd37-42a0-ad1a-ccedf777b9f9/` | 3 | 1 | 2 | 1,1 Mo |
| **Total** | **2 472** | **61** | **2 411** | **1 037,7 Mo** |

## 3. À CONSERVER — les 61 fichiers référencés

### Utilisateur `625774bc-d103-4133-b983-2f882e0f943a` (12 fichiers)

| Sous-dossier / fichier | Référencé dans |
|---|---|
| `40c2e5df-…/43499df2-b63f-4a44-97bb-0334e88b4ad2.png` | `funnels.json_content` — Votre marque, Formation IA |
| `57605fc4-…/8f274eab-e7a3-47dc-b496-4f2b1f130e2e.png` | `json_content` + `published_content` — YEE, Webinaire anglais 30 jours |
| `b6809800-…/0366b600-58a9-4c28-9e28-f59502d278e4.jpg` | `json_content` + `published_content` — Africa Builderall Academy, Invitation privée |
| `b6809800-…/1d24d80e-ca0b-4905-bbd9-c97df942bce8.jpg` | idem |
| `b6809800-…/b0f5a7d3-0298-42c4-9084-a851dab2dc10.jpg` | idem |
| `b93bb8f9-…/1d10ac36-3170-43bd-a119-6625dfe5f9cf.jpg` | `json_content` — ABA, Le webinaire qui peut changer ta façon de te lancer |
| `b93bb8f9-…/8158022a-d101-459a-88ac-f31e1f0ff6bf.jpg` | idem |
| `b93bb8f9-…/e20ebde5-006f-45c3-8c35-5c9964c2e9f6.jpg` | idem |
| `e25d000d-…/64493750-98ed-4cab-b5b1-01a1ef7d54fd.png` | `json_content` — TAKDEV, Business Scalling |
| `e25d000d-…/7271bbc7-1b37-46d1-bde9-c7e48e281484.png` | `published_content` — TAKDEV, Business Scalling |
| `ef85cf34-…/2d90ed3e-be1b-4fa9-b68e-ef48a17875de.png` | `json_content` — ENGLISHWITHTAK, Guide complet |
| `ef85cf34-…/4631dd84-8f74-44ae-ace5-81559749ebe6.png` | idem |

### Utilisateur `ec3f8c28-d3e2-4fed-b27d-aa7bf3628eee` (49 fichiers)

| Sous-dossier / fichier | Référencé dans |
|---|---|
| `04a2efb3-…/1ff3b45f-c147-4816-a948-041d3d4f620e.jpg` | `json_content` — ABA, Kit 7 Jours |
| `04a2efb3-…/5446d424-a78f-4b69-b6ac-10973bc82a88.jpg` | `variant_b` + `json_content` + `published_content` — ABA, Kit 7 Jours |
| `04a2efb3-…/5a1552b0-1496-4247-b007-c2ea68937220.jpg` | `json_content` + `published_content` |
| `04a2efb3-…/85813d39-0dff-4f71-aca4-c8a1ad9dc69a.jpg` | `variant_b` + `published_content` |
| `04a2efb3-…/cf312493-102f-4e22-b072-34cfbf0c6b8a.jpg` | `variant_b` + `json_content` + `published_content` |
| `1c732975-…/22412297-158a-4338-986d-edcf8801e55e.jpg` | `json_content` + `published_content` — ABA, Le webinaire qui peut changer… |
| `1c732975-…/3b9ffbbd-fd03-4416-94b1-f8753b98f3bc.jpg` | idem |
| `1c732975-…/47700a1c-92e7-432b-a26c-745273722438.jpg` | idem |
| `1c732975-…/5dd8be40-9e99-4fb9-9751-80cf005c7b68.jpg` | idem |
| `1c732975-…/86390fe2-ee38-4823-95f7-f942de68cf6d.jpg` | idem |
| `2bc14d57-…/156a546a-bdae-46bf-b6eb-968c549b9e1b.jpg` | `json_content` — ABA, Gagne ton premier client grâce à l'IA |
| `2bc14d57-…/82c082d3-7278-45f4-87b7-0aaf1f160873.jpg` | idem |
| `3a602328-…/0739a4ae-4875-46c9-b5d7-8342e6b74778.png` | `json_content` — Mon Tunnel |
| `3a602328-…/2521e744-05a4-4719-8138-53c032c003c3.png` | `json_content` — Mon Tunnel |
| `3a602328-…/28d9550d-5f41-4663-b830-573c27409eef.png` | `published_content` — Mon Tunnel |
| `3a602328-…/3a93ed3a-6c8a-49db-b8ca-c2cfd95dcad7.png` | `json_content` — Mon Tunnel |
| `3a602328-…/b333030d-adff-46db-96ed-47f18968b8a2.png` | `published_content` — Mon Tunnel |
| `3a602328-…/ccacec08-369b-4b27-80f1-85f792c1758a.png` | `published_content` — Mon Tunnel |
| `4effa0d5-…/3b0ed90b-324a-43c8-bf36-7bf43fbbffac.png` | `json_content` — Mon Tunnel |
| `642a12cb-…/a922f023-153c-4334-ae6c-8c2560fc67b4.jpg` | `json_content` — ABA, Kit 7 Jours offert |
| `642a12cb-…/aa624064-6c3e-41e3-a6eb-23cb329c5e94.jpg` | idem |
| `65cdac5b-…/f9901c29-44da-4ed4-bc62-ee2318110524.png` | `json_content` + `published_content` — Mon Tunnel |
| `77fd4169-…/26d28625-f239-4d8a-8534-45896f017287.jpg` | `variant_b` + `json_content` + `published_content` — ABA, Le webinaire… |
| `77fd4169-…/ae13101e-9429-4442-83f8-f05c2ee0a2ec.jpg` | `json_content` + `published_content` |
| `77fd4169-…/c981ad18-55b6-4d5e-92f2-e554ef48c720.jpg` | `json_content` + `published_content` |
| `77fd4169-…/cfe54477-3610-4d99-90d1-1afbd4d1e95a.png` | `variant_b` + `json_content` + `published_content` |
| `77fd4169-…/f84b908d-55e1-4981-8a0e-95c5a4d714c6.jpg` | `json_content` + `published_content` |
| `97e5955a-…/3c09513c-b7b2-432b-980f-c1f3eafb440e.jpg` | `published_content` — ABA, Arrêtez d'acheter des formations théoriques |
| `97e5955a-…/43c0400e-c9a3-4a06-8e15-c80c2acf750b.jpg` | `json_content` + `published_content` |
| `97e5955a-…/6dd33e41-7c1c-4ae6-917d-9902ac2777ed.jpg` | `json_content` + `published_content` |
| `97e5955a-…/7ed47c9b-e267-4f22-b9fa-a7055b10aa57.jpg` | `json_content` + `published_content` |
| `97e5955a-…/e493229a-22d8-4804-9b03-3c90113d4160.jpg` | `json_content` + `published_content` |
| `97e5955a-…/f280402a-1705-451f-9fd6-476e71384557.jpg` | `json_content` |
| `a79ac5d5-…/0eeaf7f8-83dd-46b5-86d2-afa5318aaf89.jpg` | `json_content` — ABA, Arrêtez d'acheter… (variante) |
| `a79ac5d5-…/18cf574d-a1b1-4b2e-b98c-f0ca8d116506.jpg` | idem |
| `a79ac5d5-…/43ad3b2f-0a46-49d6-a724-69312d61d3d0.jpg` | idem |
| `a79ac5d5-…/d4631cc5-fa33-4e0d-b221-1786bdd76dba.png` | idem |
| `a79ac5d5-…/dfa4a210-769f-4a1c-b155-01f1b8c40ddf.jpg` | idem |
| `e8ea7693-…/0c61788b-df21-4d28-80fa-e288580997ca.png` | `json_content` — Votre marque, Ebook premium |
| `f77acc91-…/1e1d1d05-e85f-494f-b2bd-10139163dfed.jpg` | `published_content` — ABA, Le webinaire IA |
| `f77acc91-…/2957e9fd-66d5-4873-b4a0-c04e7a6c284c.jpg` | `json_content` — ABA, Le webinaire IA |
| `f77acc91-…/2dcf6ecd-da1d-467f-8c59-9264966e9ce3.jpg` | `published_content` |
| `f77acc91-…/2edf0963-1bb3-4ef9-8902-444425785a9e.jpg` | `published_content` |
| `f77acc91-…/737ab4f0-f6d3-4abd-907d-5f0819ffb3ac.jpg` | `json_content` |
| `f77acc91-…/81892f6d-09e5-46a3-a7dc-4375a111614d.jpg` | `json_content` |
| `f77acc91-…/9b6c3ee8-fc9c-4c99-9426-d60ffdcc3cc8.jpg` | `published_content` |
| `f77acc91-…/cd6c21ca-fcc1-4727-ad80-9f7531aad2e1.jpg` | `published_content` |
| `f77acc91-…/e0f0269d-41b6-48be-9062-7256360a7f4e.jpg` | `json_content` |
| `f77acc91-…/fb91cd10-2fd4-418d-928e-768a7f452205.jpg` | `json_content` |

## 4. Projection

| | Fichiers | Taille |
|---|---:|---:|
| Avant | 3 479 | 1 307,1 Mo |
| Après suppression des 2 514 non référencés | 965 | **190,9 Mo** |

Objectif « sous 1,1 Go » largement atteint, et le retour au plan Free redevient
possible (limite Free : 1 Go).

## 5. Exécution

Le tableau 1 (dossiers entiers) se fait au dashboard, mais ne libère que
78,5 Mo. Les dossiers mixtes contiennent 2 411 fichiers à supprimer pour 61 à
garder : la sélection manuelle au dashboard n'est pas réaliste.

Utiliser `scripts/purge-storage-orphans.mjs`, qui recalcule lui-même
l'ensemble des fichiers référencés avant de supprimer quoi que ce soit, et
refuse de démarrer si ce recalcul donne un résultat suspect.

```bash
node scripts/purge-storage-orphans.mjs          # simulation (par défaut)
node scripts/purge-storage-orphans.mjs --apply  # suppression réelle
```

### Pourquoi la lecture est lente

Poids réel des tables de référence :

| Table | Lignes | Poids total | Plus grosse ligne |
|---|---:|---:|---:|
| `funnels` | 59 | **62 Mo** | **9,45 Mo** |
| `shared_templates` | 12 | 1,68 Mo | 474 ko |
| `funnel_ab_tests` | 2 | 12 ko | 6,3 ko |

Une première version lisait `funnels` par pages de 200 lignes, soit les 62 Mo en
une seule réponse : `canceling statement due to statement timeout`. Comme une
seule ligne pèse déjà 9,45 Mo, aucune taille de page fixe n'est sûre à long
terme. Le script démarre donc à 3 lignes par page et **divise la page par deux à
chaque timeout**, jusqu'à 1 ligne, avec une pause de 120 ms entre les pages.
Compter environ une minute pour la phase de lecture.

Deux points de correction importants au passage :

- **`order("id")` sur chaque page.** Sans tri explicite, PostgreSQL ne garantit
  aucun ordre stable entre deux requêtes et `range()` peut sauter une ligne.
  Une ligne sautée, ce sont ses images classées orphelines, donc supprimées.
- **Toute erreur de lecture est fatale.** Y compris un timeout persistant à
  1 ligne. Poursuivre avec un jeu de références incomplet reviendrait à
  supprimer des fichiers encore utilisés.
