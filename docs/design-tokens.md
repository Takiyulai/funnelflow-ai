# Système de jetons — interface AutoFunnel AI

**Mis en place le 28 juillet 2026.**
Source de vérité : `app/globals.css` (`:root` et `.ff-theme-dark`) exposée à
Tailwind via `tailwind.config.ts`.

---

## Périmètre — à lire avant toute modification

Ces jetons pilotent **l'interface de l'application** : dashboard, éditeur, CRM,
workflows, admin.

⚠️ **Ils ne concernent PAS les tunnels générés.** Ceux-ci gardent leurs propres
thèmes (`app/funnel-theme.css`, `lib/export/theme-css.ts`) et **doivent rester
colorés et variés** : cette diversité chromatique est le produit que vendent nos
utilisateurs. Uniformiser les tunnels serait une régression produit, pas une
amélioration.

---

## Les trois règles

### 1. Les gris construisent la hiérarchie

La rampe `ash` compte **13 nuances**. L'interface n'en avait que 4
(`ink`/`muted`/`line`/`canvas`), ce qui rendait impossible de créer du contraste
sans recourir à la couleur — d'où l'accumulation d'accents au fil du temps.

Une interface d'outil doit s'effacer derrière le travail de l'utilisateur.
L'éditeur entoure un aperçu de tunnel volontairement coloré : si le cadre est
coloré lui aussi, les deux se disputent l'attention et l'ensemble paraît
brouillon, quelle que soit la qualité de chaque partie. Figma, Framer et Webflow
sont gris pour cette raison précise.

### 2. Un seul accent

L'or est la seule couleur de marque. Vert, ambre, rouge et bleu sont
**sémantiques** : ils signalent un état. Jamais un bouton d'action, jamais un
titre, jamais un encadré « pour faire joli ».

### 3. L'or ne s'écrit pas sur du blanc

`#C7A436` sur blanc mesure **2,4:1** de contraste, sous le seuil WCAG AA de
4,5:1. Un texte à ce niveau est perçu comme *flou*, pas comme *élégant*.

| Usage | Jeton | Contraste sur blanc |
|---|---|---|
| Texte sur fond clair | `text-accent-ink` (`#8A6F1F`) | 4,6:1 ✅ |
| Aplat, bordure, élément actif | `bg-accent` (`#C7A436`) | — |
| Texte sur aplat d'accent | `text-accent-contrast` (`#080E1A`) | ✅ |
| Fond de badge | `bg-accent-soft` | — |

---

## Référence

### Rampe de neutres

| Jeton | Clair | Usage type |
|---|---|---|
| `ash-0` | `#FFFFFF` | Fond des cartes |
| `ash-25` | `#FAFAFB` | Fond d'application |
| `ash-50` | `#F4F5F7` | Lignes alternées, survol |
| `ash-100` | `#EBECEF` | Fonds désactivés |
| `ash-200` | `#DFE1E6` | Bordures |
| `ash-300` | `#C6C9D0` | Bordures marquées |
| `ash-400` | `#9BA1AC` | Texte de remplacement |
| `ash-500` | `#6F7681` | Texte secondaire |
| `ash-600` | `#545B66` | Texte tertiaire |
| `ash-700` | `#3C424B` | Corps de texte |
| `ash-800` | `#262B32` | Titres |
| `ash-900` | `#151920` | Titres forts |
| `ash-950` | `#080E1A` | Encre de marque — sidebar, boutons primaires |

En mode sombre, la rampe **s'inverse automatiquement**. Un composant écrit avec
`ash-*` bascule seul, sans aucune règle `!important`.

### Couleurs sémantiques

| Rôle | Aplat | Texte sur clair | Fond de badge |
|---|---|---|---|
| Succès | `bg-success` | `text-success-ink` | `bg-success-soft` |
| Avertissement | `bg-warning` | `text-warning-ink` | `bg-warning-soft` |
| Erreur | `bg-danger` | `text-danger-ink` | `bg-danger-soft` |
| Information | `bg-info` | `text-info-ink` | `bg-info-soft` |

### Élévation — deux niveaux

`shadow-card` (`--ff-elev-1`) pour une carte posée, `shadow-elevated`
(`--ff-elev-2`) pour un élément flottant (modale, menu). Il n'y a pas de
troisième niveau : six profondeurs d'ombre, l'œil ne les distingue pas, ça ne
produit pas de la richesse mais du flou.

`shadow-premium`, `shadow-gold` et `shadow-dark` restent réservés à la
**landing** (mise en scène marketing sur surfaces sombres), jamais à l'interface.

### Espacement

L'échelle Tailwind par défaut est déjà en base 4 px. La discipline, c'est de s'y
tenir : `p-1 p-2 p-3 p-4 p-6 p-8 p-12 p-16`. **Aucune valeur arbitraire**
(`p-[13px]`, `gap-[7px]`). L'irrégularité des espacements fait « amateur » bien
avant le choix des couleurs.

### Typographie

Trois tailles de texte maximum par écran, deux graisses (`font-medium`,
`font-bold`). Beaucoup d'interfaces en utilisent sept sans le savoir.

---

## Migration — état

**Fait :**
- rampe complète et jetons sémantiques, en clair et en sombre ;
- exposition Tailwind (`ash-*`, `accent*`, `success*`, `warning*`, `danger*`, `info*`) ;
- élévation ramenée à deux niveaux réels ;
- les 6 occurrences de `text-gold` sur fond clair corrigées (`AppShell`, `Celebration`, `ChatWidget`, `WorkflowsClient` ×3), dont un `AlertTriangle` repassé en `warning` — un avertissement n'est pas un accent de marque.

**Rétrocompatibilité :** `ink`, `muted`, `line`, `canvas`, `surface` continuent
de fonctionner — ils puisent désormais dans la rampe. Aucun code existant n'est
cassé.

**Reste à faire, progressivement :**
1. Remplacer les hexadécimaux codés en dur (`#08498D`, `#31845C`, `#F8F9FB`…) par les jetons. C'est ce qui permettra de supprimer les dizaines de rattrapages `!important` du mode sombre dans `globals.css` — ils n'existent que parce que les couleurs sont écrites en dur.
2. Traquer les valeurs d'espacement arbitraires.
3. Réduire le nombre de tailles de texte par écran.

À faire **au fil des modifications**, pas en une passe globale : une réécriture
massive sans vérification visuelle écran par écran casserait des choses de façon
invisible.
