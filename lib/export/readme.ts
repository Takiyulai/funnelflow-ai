// lib/export/readme.ts
import type { Funnel } from "@/lib/funnels/types";

type BlockEntry = {
  fileName: string;
  type: string;
  label: string;
  hasPopup: boolean;
};

/**
 * Génère un README.md adapté au tunnel exporté, avec :
 * - guide pas-à-pas systeme.io
 * - liste exhaustive des blocs et de leurs spécificités
 * - troubleshooting
 */
export function createReadme(funnel: Funnel, blocks: BlockEntry[]): string {
  const language = funnel.language ?? "fr";
  if (language === "en") return createReadmeEn(funnel, blocks);
  if (language === "es") return createReadmeEs(funnel, blocks);
  return createReadmeFr(funnel, blocks);
}

function createReadmeFr(funnel: Funnel, blocks: BlockEntry[]): string {
  const popupBlocks = blocks.filter((b) => b.hasPopup);
  const blockList = blocks
    .map(
      (b, i) =>
        `${String(i + 1).padStart(2, "0")}. \`${b.fileName}\` — ${b.label}${
          b.hasPopup ? " *(contient un popup intégré)*" : ""
        }`
    )
    .join("\n");

  return `# ${funnel.funnelName} — Export systeme.io

Bienvenue ! Ce dossier contient votre tunnel **${funnel.funnelName}** prêt à être importé dans systeme.io.

---

## 📦 Contenu du dossier

- \`apercu-complet.html\` — Aperçu complet de votre tunnel à ouvrir dans un navigateur pour vérifier le rendu final.
- \`blocs-systeme-io/\` — Les ${blocks.length} blocs HTML à coller un par un dans systeme.io.
- \`README.md\` — Ce guide.

---

## 🚀 Importer dans systeme.io en 5 étapes

### Étape 1 — Créer la page dans systeme.io

1. Connectez-vous à votre compte systeme.io.
2. Allez dans **Tunnels** → **Créer un tunnel** (ou ouvrez un tunnel existant).
3. Choisissez le type de page : **Page de capture** ou **Page de vente** selon votre objectif.
4. Une fois la page créée, cliquez sur **Modifier la page**.

### Étape 2 — Préparer la zone de collage

1. Dans l'éditeur systeme.io, supprimez les sections par défaut (sauf si vous voulez les garder).
2. Cliquez sur **+ Ajouter un élément** dans la zone principale.
3. Choisissez l'élément **HTML personnalisé** (ou **Code HTML**).

### Étape 3 — Coller les blocs un par un, dans l'ordre

Voici l'ordre exact à respecter :

${blockList}

Pour **chaque** bloc :

1. Ouvrez le fichier \`.html\` correspondant avec un éditeur de texte (Bloc-notes, VSCode, Sublime Text…).
2. Sélectionnez **tout** le contenu du fichier (Ctrl+A) et copiez-le (Ctrl+C).
3. Dans systeme.io, dans l'élément **HTML personnalisé**, collez le contenu (Ctrl+V).
4. Cliquez sur **Enregistrer**.
5. Ajoutez un nouvel élément **HTML personnalisé** sous le précédent et passez au bloc suivant.

> 💡 **Astuce** : pour aller plus vite, vous pouvez ouvrir tous les fichiers \`.html\` du dossier \`blocs-systeme-io/\` en même temps dans VSCode et copier-coller dans l'ordre.

> ⚠️ **Pleine largeur (important)** : par défaut, systeme.io ajoute du **Rembourrage (≈40)** sur la **Section** et la **Rangée**, plus des **marges** sur le bloc Code HTML — ce qui rétrécit le rendu. Pour que le tunnel occupe toute la largeur : sélectionnez la **Section** puis la **Rangée** et mettez leur **Rembourrage à 0** ; mettez aussi les **Marges du bloc Code HTML à 0** (ou réglez la ligne sur **pleine largeur**).

### Étape 4 — Configurer les formulaires (si vous avez des popups)

${
  popupBlocks.length > 0
    ? `Votre tunnel contient **${popupBlocks.length} popup${popupBlocks.length > 1 ? "s" : ""}** avec formulaire :

${popupBlocks.map((b) => `- \`${b.fileName}\``).join("\n")}

Par défaut, ces popups affichent un formulaire de **démonstration** qui ne capture rien. Pour les rendre fonctionnels :

1. Dans systeme.io, allez dans **Contacts** → **Formulaires** → **+ Créer un formulaire**.
2. Configurez votre formulaire (champs nom/email, étiquette des contacts, séquence email à déclencher…).
3. Enregistrez le formulaire et cliquez sur **Code d'intégration**.
4. Copiez le code HTML généré par systeme.io.
5. Revenez dans **votre application FunnelForge** → ouvrez le tunnel → onglet **CTA** de la section concernée → mode **Popup** → collez le code dans le champ **Code d'embed formulaire systeme.io**.
6. Réexportez le ZIP et recollez le bloc concerné dans systeme.io.

> ⚠️ Le formulaire de démonstration est volontairement non-fonctionnel pour vous éviter de perdre des leads sans le savoir.`
    : `Aucun popup avec formulaire dans ce tunnel — vous pouvez sauter cette étape.

Si vous avez une section formulaire (\`99-form-...\`), elle utilise un formulaire générique non-connecté. Pour collecter de vrais leads, remplacez ce bloc par un **élément Formulaire** natif de systeme.io que vous configurez dans leur builder.`
}

### Étape 5 — Vérifier et publier

1. Cliquez sur **Aperçu** dans systeme.io pour voir le rendu.
2. Vérifiez sur **mobile** (icône smartphone dans la barre d'aperçu).
3. Testez tous les boutons CTA :
   - Les boutons de **redirection** doivent ouvrir la bonne URL.
   - Les boutons **"aller au formulaire"** doivent faire défiler jusqu'au formulaire en bas.
   - Les boutons **popup** doivent ouvrir l'overlay correctement.
4. Si tout fonctionne : cliquez sur **Publier**.

---

## 💬 Popup aux couleurs du tunnel (optionnel)

Pour que votre **popup natif systeme.io** prenne automatiquement les couleurs de votre tunnel :

1. Dans **systeme.io**, créez votre **popup** (texte, champ/formulaire, CTA) et configurez son **déclencheur natif** (délai, exit-intent, au clic, etc.).
2. **Cliquez sur le bloc/la rangée** du popup : son **id** s'affiche (ex. \`row-c66ce9c8\`). ⚠️ N'utilisez **pas** l'id du script de formulaire (\`form-script-tag-…\`), ce n'est pas un élément visible.
3. Dans **AutoFunnel** → menu **Export systeme.io** → **« Styliser un popup systeme.io »** → collez cet **id** (ou le bloc HTML). Optionnel : l'**id du bouton CTA** (ex. \`button-…\`, pour un **dégradé animé**) et les **ids des champs de saisie** (ex. \`form-input-…\`). Puis **Générer & copier le CSS**.
4. Dans le popup systeme.io, glissez un bloc **Code HTML** et **collez-y** ce CSS.

Le popup garde son **formulaire, son CTA et son ouverture/fermeture** (gérés par systeme.io) ; seules les **couleurs** (fond, texte, bouton) sont adaptées à votre branding. CSS pur, aucun script.

> 💡 Astuce : le \`<style>\` s'applique globalement, vous pouvez donc coller le bloc Code HTML n'importe où dans le popup.

---

## 🔧 Dépannage

**Le bloc s'affiche mais les styles sont cassés**
Vérifiez que vous avez bien collé **tout** le contenu du fichier, y compris la balise \`<style>\` au début. Si systeme.io a un mode "Texte" et un mode "HTML", utilisez bien le mode HTML.

**Deux blocs ont des styles qui se chevauchent**
Chaque bloc a une classe CSS unique préfixée (ex: \`ff-hero-abc123\`). Si vous voyez des conflits, c'est probablement que vous avez collé deux fois le même bloc — vérifiez l'ordre dans systeme.io.

**Le popup ne s'ouvre pas**
Vérifiez que le bouton CTA est bien dans le **même bloc** que le popup. Si vous avez modifié le HTML manuellement, l'attribut \`data-ff-popup-target\` doit pointer vers l'ID du popup (ex: \`ff-hero-abc123-popup\`).

**Le formulaire de mon popup ne capture rien**
Voir l'**Étape 4** ci-dessus — il faut coller votre code d'embed systeme.io dans l'éditeur FunnelForge puis réexporter.

**Les boutons ouvrent dans le même onglet alors que je veux un nouvel onglet**
Dans l'éditeur FunnelForge, onglet **CTA**, mode **Redirection**, choisissez **Nouvel onglet**, puis réexportez.

---

## 📞 Support

Vous avez une question ? Ouvrez votre tunnel dans FunnelForge et utilisez le bouton **Aide**.

Bon lancement 🚀
`;
}

function createReadmeEn(funnel: Funnel, blocks: BlockEntry[]): string {
  const popupBlocks = blocks.filter((b) => b.hasPopup);
  const blockList = blocks
    .map(
      (b, i) =>
        `${String(i + 1).padStart(2, "0")}. \`${b.fileName}\` — ${b.label}${
          b.hasPopup ? " *(includes embedded popup)*" : ""
        }`
    )
    .join("\n");

  return `# ${funnel.funnelName} — systeme.io export

This folder contains your **${funnel.funnelName}** funnel ready to be imported into systeme.io.

## 📦 Folder contents

- \`funnel-complete.html\` — Full preview to open in a browser.
- \`blocs-systeme-io/\` — The ${blocks.length} HTML blocks to paste into systeme.io.
- \`README.md\` — This guide.

## 🚀 Import into systeme.io

1. In systeme.io, open your funnel and click **Edit page**.
2. Add a **Custom HTML** element.
3. Paste the contents of each block file in order:

${blockList}

4. ${popupBlocks.length > 0 ? "For popups: paste your systeme.io form embed code in FunnelForge's CTA tab (Popup mode), then re-export." : "No popups in this funnel."}
5. Preview and publish.

## 🔧 Troubleshooting

If styles look broken, make sure you copied the whole file including the \`<style>\` tag.
If popups don't open, the trigger button must be in the same block as the popup.
`;
}

function createReadmeEs(funnel: Funnel, blocks: BlockEntry[]): string {
  const popupBlocks = blocks.filter((b) => b.hasPopup);
  const blockList = blocks
    .map(
      (b, i) =>
        `${String(i + 1).padStart(2, "0")}. \`${b.fileName}\` — ${b.label}${
          b.hasPopup ? " *(incluye popup integrado)*" : ""
        }`
    )
    .join("\n");

  return `# ${funnel.funnelName} — Exportación systeme.io

Esta carpeta contiene tu embudo **${funnel.funnelName}** listo para importar en systeme.io.

## 📦 Contenido

- \`embudo-completo.html\` — Vista previa completa.
- \`blocs-systeme-io/\` — Los ${blocks.length} bloques HTML.
- \`README.md\` — Esta guía.

## 🚀 Importar en systeme.io

1. En systeme.io, abre tu embudo y haz clic en **Editar página**.
2. Añade un elemento **HTML personalizado**.
3. Pega el contenido de cada bloque en orden:

${blockList}

4. ${popupBlocks.length > 0 ? "Para los popups: pega tu código de incrustación de formulario systeme.io en la pestaña CTA de FunnelForge (modo Popup), luego vuelve a exportar." : "Sin popups en este embudo."}
5. Vista previa y publica.
`;
}
