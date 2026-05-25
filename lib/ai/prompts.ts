// lib/ai/prompts.ts
import type {
  FunnelBrief,
  FunnelSection,
  FunnelSectionType,
  Language,
  MediaItem,
  CopywritingPrefs,
} from "@/lib/funnels/types";
import type { PageBlueprint } from "@/lib/funnels/pageCatalogs";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de langue
// ─────────────────────────────────────────────────────────────────────────────

function langName(lang: Language): string {
  return lang === "fr" ? "French" : lang === "es" ? "Spanish" : "English";
}

function tr<T extends Record<Language, string>>(map: T, lang: Language): string {
  return map[lang] ?? map.fr;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloc : règles produit/marque
// ─────────────────────────────────────────────────────────────────────────────

function productRuleBlock(brief: FunnelBrief): string {
  const lang = brief.language;
  const header = tr(
    {
      fr: "RÈGLES PRODUIT (à respecter strictement) :",
      en: "PRODUCT RULES (must be strictly respected):",
      es: "REGLAS DEL PRODUCTO (a respetar estrictamente):",
    },
    lang,
  );
  const lines = [
    `- ${tr({ fr: "Marque", en: "Brand", es: "Marca" }, lang)}: ${brief.brandName}`,
    `- ${tr({ fr: "Offre", en: "Offer", es: "Oferta" }, lang)}: ${brief.offerName}`,
    `- ${tr({ fr: "Prix", en: "Price", es: "Precio" }, lang)}: ${brief.price}`,
    `- ${tr({ fr: "Promesse", en: "Promise", es: "Promesa" }, lang)}: ${brief.promise}`,
    `- ${tr({ fr: "Cible", en: "Target audience", es: "Audiencia" }, lang)}: ${brief.targetAudience}`,
    `- ${tr({ fr: "Douleur principale", en: "Main pain", es: "Dolor principal" }, lang)}: ${brief.mainPain}`,
    `- ${tr({ fr: "Type de tunnel", en: "Funnel type", es: "Tipo de embudo" }, lang)}: ${brief.funnelType}`,
    `- ${tr({ fr: "Ton", en: "Tone", es: "Tono" }, lang)}: ${brief.tone}`,
    `- ${tr({ fr: "Style visuel", en: "Design style", es: "Estilo visual" }, lang)}: ${brief.designStyle}`,
    `- ${tr({ fr: "Langue de sortie", en: "Output language", es: "Idioma de salida" }, lang)}: ${lang} (${langName(lang)})`,
  ];
  return [header, ...lines].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloc : préférences de copywriting
// ─────────────────────────────────────────────────────────────────────────────

function copywritingPrefsBlock(prefs?: CopywritingPrefs, lang: Language = "fr"): string {
  if (!prefs) return "";
  const parts: string[] = [];
  const header = tr(
    {
      fr: "PRÉFÉRENCES DE COPYWRITING :",
      en: "COPYWRITING PREFERENCES:",
      es: "PREFERENCIAS DE COPYWRITING:",
    },
    lang,
  );
  if (prefs.tone) parts.push(`- Tone: ${prefs.tone}`);
  if (prefs.length) parts.push(`- Length: ${prefs.length}`);
  if (prefs.exampleSentence) parts.push(`- Example sentence to mimic style: "${prefs.exampleSentence}"`);
  if (prefs.avoidWords && prefs.avoidWords.length > 0) {
    parts.push(`- ${tr({ fr: "Mots à éviter", en: "Words to avoid", es: "Palabras a evitar" }, lang)}: ${prefs.avoidWords.join(", ")}`);
  }
  if (parts.length === 0) return "";
  return [header, ...parts].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloc : médias fournis par l'utilisateur
// ─────────────────────────────────────────────────────────────────────────────

function mediasBlock(medias?: MediaItem[], lang: Language = "fr"): string {
  if (!medias || medias.length === 0) return "";

  const header = tr(
    {
      fr: "MÉDIAS FOURNIS PAR L'UTILISATEUR (utilise-les obligatoirement) :",
      en: "MEDIA PROVIDED BY THE USER (you MUST use them):",
      es: "MEDIOS PROPORCIONADOS POR EL USUARIO (debes usarlos obligatoriamente):",
    },
    lang,
  );

  const instructions = tr(
    {
      fr: [
        "Pour CHAQUE média ci-dessous, place-le dans la section la PLUS pertinente sémantiquement :",
        "- Photo du fondateur, dirigeant, équipe → section \"about\" (de préférence) ou \"proof\".",
        "- Photo du produit, du livrable, de la couverture d'un ebook → section \"hero\" ou \"offer\".",
        "- Photo de résultats clients, avant/après → section \"proof\" ou \"testimonials\".",
        "- Vidéo de présentation → section \"video\" ou \"hero\".",
        "Dans le JSON de la section choisie, utilise OBLIGATOIREMENT le format :",
        "  \"image\": { \"mode\": \"upload\", \"mediaRef\": \"<id du média>\", \"alt\": \"<description courte>\" }",
        "Ne mets JAMAIS la même image dans deux sections différentes.",
      ].join("\n"),
      en: [
        "For EACH media below, place it in the MOST semantically relevant section:",
        "- Founder/team photo → \"about\" section (preferred) or \"proof\".",
        "- Product/deliverable/ebook cover → \"hero\" or \"offer\".",
        "- Client results, before/after → \"proof\" or \"testimonials\".",
        "- Presentation video → \"video\" or \"hero\".",
        "In the chosen section JSON, you MUST use the format:",
        "  \"image\": { \"mode\": \"upload\", \"mediaRef\": \"<media id>\", \"alt\": \"<short description>\" }",
        "NEVER place the same image in two different sections.",
      ].join("\n"),
      es: [
        "Para CADA medio a continuación, ubícalo en la sección MÁS relevante semánticamente:",
        "- Foto del fundador/equipo → sección \"about\" (preferida) o \"proof\".",
        "- Foto del producto/portada de ebook → \"hero\" u \"offer\".",
        "- Resultados de clientes, antes/después → \"proof\" o \"testimonials\".",
        "- Video de presentación → \"video\" o \"hero\".",
        "En el JSON de la sección elegida, USA OBLIGATORIAMENTE el formato:",
        "  \"image\": { \"mode\": \"upload\", \"mediaRef\": \"<id del medio>\", \"alt\": \"<descripción corta>\" }",
        "NUNCA pongas la misma imagen en dos secciones diferentes.",
      ].join("\n"),
    },
    lang,
  );

  const items = medias
    .map((m, i) => {
      const hint = m.sectionHint ? ` — suggested section: "${m.sectionHint}"` : "";
      const desc = m.description ? ` — description: "${m.description}"` : "";
      return `  ${i + 1}. id="${m.id}" (${m.kind})${desc}${hint}`;
    })
    .join("\n");

  return [header, instructions, "", items].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloc : exigences strictes anti-sections-fantômes
// ─────────────────────────────────────────────────────────────────────────────

function strictSectionRequirementsBlock(lang: Language = "fr"): string {
  return tr(
    {
      fr: [
        "EXIGENCES STRICTES DE CONTENU (ne JAMAIS produire des sections vides) :",
        "",
        "1. EYEBROW (OBLIGATOIRE pour CHAQUE section) :",
        "   - 2 à 5 mots, en MAJUSCULES de préférence.",
        "   - Exemples valides : \"POURQUOI NOUS\", \"ÉTAPE 1\", \"BONUS EXCLUSIF\", \"NOTRE GARANTIE\".",
        "   - INTERDIT : eyebrow vide, null, absent. Si tu hésites, utilise une étiquette liée au type de section.",
        "",
        "2. HEADLINE (OBLIGATOIRE) :",
        "   - Au moins 5 mots, apporte du sens. JAMAIS de placeholder type \"BRAND — type\".",
        "",
        "3. SUBHEADLINE (recommandé, ≥ 4 mots) : développe la headline.",
        "",
        "4. BODY :",
        "   - Texte libre court (1 à 3 phrases).",
        "   - INTERDICTION ABSOLUE : ne JAMAIS mettre de tirets \"-\", de puces \"•\" ou \"*\", ni de listes dans body.",
        "   - Si tu veux une liste, utilise OBLIGATOIREMENT le champ \"bullets\" (array de strings).",
        "",
        "5. BULLETS (quand pertinent) :",
        "   - Array de 3 à 6 strings courtes (5 à 12 mots chacune).",
        "   - Chaque string est un bénéfice / point clé, SANS tiret ni puce en préfixe.",
        "   - CORRECT : bullets: [\"Accès immédiat à la formation\", \"Support 7j/7\", \"Garantie 30 jours\"]",
        "   - INCORRECT : bullets: [\"- Accès immédiat\", \"• Support\"]",
        "   - INCORRECT : body: \"- Accès immédiat\\n- Support\\n- Garantie\"",
        "",
        "6. CONTENU MINIMUM :",
        "   - body ≥ 30 mots OU bullets ≥ 3 entrées pertinentes.",
        "   - N'INVENTE JAMAIS de section hors whitelist.",
        "   - Ne LAISSE JAMAIS une section listée vide.",
        "",
        "EXEMPLE CORRECT COMPLET :",
        "{",
        "  \"type\": \"benefits\",",
        "  \"eyebrow\": \"POURQUOI CETTE MÉTHODE\",",
        "  \"headline\": \"Transformez votre activité en 30 jours\",",
        "  \"subheadline\": \"Une méthode éprouvée par plus de 500 entrepreneurs pour scaler sans s'épuiser.\",",
        "  \"body\": \"Vous obtenez un système clé en main, des outils et un accompagnement pour appliquer dès aujourd'hui.\",",
        "  \"bullets\": [",
        "    \"Stratégie clé en main appliquée dès le jour 1\",",
        "    \"Modèles et scripts prêts à l'emploi\",",
        "    \"Communauté privée d'entrepreneurs\",",
        "    \"Coaching de groupe hebdomadaire\"",
        "  ]",
        "}",
      ].join("\n"),
      en: [
        "STRICT CONTENT REQUIREMENTS (NEVER produce empty sections):",
        "",
        "1. EYEBROW (REQUIRED for EVERY section):",
        "   - 2 to 5 words, preferably UPPERCASE.",
        "   - Valid examples: \"WHY US\", \"STEP 1\", \"EXCLUSIVE BONUS\", \"OUR GUARANTEE\".",
        "   - FORBIDDEN: empty, null, or missing eyebrow. If unsure, use a label tied to the section type.",
        "",
        "2. HEADLINE (REQUIRED):",
        "   - At least 5 meaningful words. NEVER placeholders like \"BRAND — type\".",
        "",
        "3. SUBHEADLINE (recommended, ≥ 4 words): expands the headline.",
        "",
        "4. BODY:",
        "   - Short free text (1 to 3 sentences).",
        "   - ABSOLUTELY FORBIDDEN: NEVER use dashes \"-\", bullets \"•\" or \"*\", or lists inside body.",
        "   - To list items, you MUST use the \"bullets\" field (string array).",
        "",
        "5. BULLETS (when relevant):",
        "   - Array of 3 to 6 short strings (5 to 12 words each).",
        "   - Each string is a benefit / key point, WITHOUT any leading dash or bullet character.",
        "   - CORRECT: bullets: [\"Instant access to the training\", \"7-day support\", \"30-day guarantee\"]",
        "   - INCORRECT: bullets: [\"- Instant access\", \"• Support\"]",
        "   - INCORRECT: body: \"- Instant access\\n- Support\\n- Guarantee\"",
        "",
        "6. MINIMUM CONTENT:",
        "   - body ≥ 30 words OR bullets ≥ 3 relevant entries.",
        "   - NEVER invent a section that is not in the whitelist.",
        "   - NEVER leave a listed section empty.",
      ].join("\n"),
      es: [
        "REQUISITOS ESTRICTOS DE CONTENIDO (NUNCA producir secciones vacías):",
        "",
        "1. EYEBROW (OBLIGATORIO para CADA sección):",
        "   - 2 a 5 palabras, preferentemente en MAYÚSCULAS.",
        "   - Ejemplos válidos: \"POR QUÉ NOSOTROS\", \"PASO 1\", \"BONO EXCLUSIVO\", \"NUESTRA GARANTÍA\".",
        "   - PROHIBIDO: eyebrow vacío, null o ausente.",
        "",
        "2. HEADLINE (OBLIGATORIO):",
        "   - Al menos 5 palabras significativas. NUNCA placeholder tipo \"MARCA — tipo\".",
        "",
        "3. SUBHEADLINE (recomendado, ≥ 4 palabras): desarrolla el titular.",
        "",
        "4. BODY:",
        "   - Texto libre corto (1 a 3 frases).",
        "   - ABSOLUTAMENTE PROHIBIDO: NUNCA uses guiones \"-\", viñetas \"•\" o \"*\", ni listas dentro de body.",
        "   - Para listar, DEBES usar el campo \"bullets\" (array de strings).",
        "",
        "5. BULLETS (cuando sea relevante):",
        "   - Array de 3 a 6 strings cortas (5 a 12 palabras cada una).",
        "   - Cada string es un beneficio / punto clave, SIN guion ni viñeta como prefijo.",
        "",
        "6. CONTENIDO MÍNIMO:",
        "   - body ≥ 30 palabras O bullets ≥ 3 entradas relevantes.",
        "   - NUNCA inventes una sección fuera de la whitelist.",
        "   - NUNCA dejes una sección listada vacía.",
      ].join("\n"),
    },
    lang,
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// 🆕 Bloc : règles sémantiques de CTA par rôle de page
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bloc CRITIQUE pour éviter les CTA incohérents :
 *  - "Télécharger le guide" sur une page Remerciement après opt-in email
 *  - "Confirmer mon email" sur une page de livraison directe
 *  - etc.
 *
 * Inséré dans mainPagePrompt et secondaryPagesPrompt avec le rôle exact
 * de la (ou des) page(s) à générer.
 */
function roleSemanticsBlock(roles: string[], lang: Language): string {
  if (roles.length === 0) return "";

  const header = tr(
    {
      fr: "RÈGLES SÉMANTIQUES PAR RÔLE DE PAGE (CRITIQUE — ne JAMAIS violer) :",
      en: "PAGE-ROLE SEMANTIC RULES (CRITICAL — NEVER violate):",
      es: "REGLAS SEMÁNTICAS POR ROL DE PÁGINA (CRÍTICO — NUNCA violar):",
    },
    lang,
  );

  const rulesFr: Record<string, string[]> = {
    optin: [
      "Rôle \"optin\" : page de capture du lead magnet GRATUIT.",
      "- Objectif : convaincre de laisser son email.",
      "- CTA principal : doit pointer vers le formulaire de la page (mode \"anchor\", anchorId=\"lead-form\"), label type \"Recevoir mon guide gratuit\", \"Télécharger gratuitement\", \"Je veux le guide\".",
      "- INTERDIT : CTA qui simule un téléchargement direct alors qu'aucun fichier n'est lié.",
    ],
    thankyou: [
      "Rôle \"thankyou\" : page de remerciement APRÈS opt-in. Le lead magnet est ENVOYÉ PAR EMAIL.",
      "- INTERDIT ABSOLU : CTA \"Télécharger maintenant\", \"Download\", \"Accéder au guide\" (le guide n'est PAS téléchargeable depuis cette page, il arrive par email).",
      "- CTA principal RECOMMANDÉ : { \"label\": \"Ouvrir ma boîte Gmail\", \"mode\": \"redirect\", \"url\": \"https://mail.google.com\", \"target\": \"_blank\" }",
      "  OU : { \"label\": \"Vérifier ma boîte mail\", \"mode\": \"redirect\", \"url\": \"mailto:\" }",
      "- Headline type : \"Merci ! Votre guide arrive dans votre boîte mail\", \"Inscription confirmée 🎉\" (sans emoji).",
      "- Body doit expliquer : (1) l'email arrive dans les 2 minutes, (2) vérifier les spams, (3) ajouter l'expéditeur aux contacts.",
    ],
    delivery: [
      "Rôle \"delivery\" : page de livraison DIRECTE du produit/ressource. C'est ICI que le téléchargement réel a lieu.",
      "- CTA principal AUTORISÉ : { \"label\": \"Télécharger mon guide\", \"mode\": \"redirect\", \"url\": \"#download\" } ou URL réelle du fichier.",
      "- Headline type : \"Votre guide est prêt\", \"Voici votre accès\".",
      "- Body doit donner des instructions claires sur l'utilisation de la ressource.",
    ],
    confirmation: [
      "Rôle \"confirmation\" : page de validation (double opt-in, inscription webinaire, réservation booking).",
      "- CTA principal : doit pointer vers l'étape suivante du tunnel (page d'accès, contenu, ressource).",
      "- Headline type : \"C'est confirmé !\", \"Inscription validée\".",
      "- INTERDIT : reproduire un formulaire d'opt-in.",
    ],
    sales: [
      "Rôle \"sales\" : page de vente principale.",
      "- CTA principal : achat de l'offre, label type \"Je commande maintenant\", \"Accéder à l'offre\".",
    ],
    checkout: [
      "Rôle \"checkout\" : page de paiement.",
      "- CTA principal : finalisation de l'achat. Pas de CTA \"En savoir plus\" : on est au moment de l'achat.",
    ],
    registration: [
      "Rôle \"registration\" : inscription webinaire.",
      "- CTA principal : pointe vers le formulaire (anchor lead-form), label type \"Réserver ma place\".",
    ],
    replay: [
      "Rôle \"replay\" : page de replay vidéo.",
      "- CTA principal : pointe vers l'offre payante associée.",
    ],
    landing: [
      "Rôle \"landing\" : page d'accueil booking/coaching.",
      "- CTA principal : pointe vers la prise de RDV ou la qualification.",
    ],
    booking: [
      "Rôle \"booking\" : page de prise de RDV (intégration calendrier).",
      "- CTA principal : pointe vers le widget calendrier ou le formulaire.",
    ],
    "case-studies": [
      "Rôle \"case-studies\" : études de cas.",
      "- CTA principal : pointe vers la candidature ou le RDV.",
    ],
    application: [
      "Rôle \"application\" : formulaire de candidature.",
      "- CTA principal : soumission du formulaire (anchor lead-form).",
    ],
    "challenge-landing": [
      "Rôle \"challenge-landing\" : inscription challenge.",
      "- CTA principal : inscription (anchor lead-form), label type \"Je participe\", \"Je rejoins le challenge\".",
    ],
    "challenge-day": [
      "Rôle \"challenge-day\" : journée du challenge.",
      "- CTA principal : passer au jour suivant ou découvrir l'offre payante.",
    ],
  };

  // Pour EN et ES : on garde les règles FR comme base et on traduit le header.
  // Les exemples de labels FR servent de modèle ; l'IA adapte au langName(lang).
  const lines: string[] = [];
  for (const role of roles) {
    const rules = rulesFr[role];
    if (rules && rules.length > 0) {
      lines.push("", ...rules);
    }
  }

  if (lines.length === 0) return "";

  const localizedNote = tr(
    {
      fr: "",
      en: "\n(Note: examples are written in French to be concrete — translate the CTA labels and headlines to the output language while keeping the same intent.)",
      es: "\n(Nota: los ejemplos están en francés para ser concretos — traduce las etiquetas CTA y los titulares al idioma de salida manteniendo la misma intención.)",
    },
    lang,
  );

  return [header, ...lines, localizedNote].filter(Boolean).join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 Lot B3 : Bloc — Sections riches (faq, testimonials, pricing, bonus, etc.)
// ─────────────────────────────────────────────────────────────────────────────

function richSectionsBlock(brief: FunnelBrief): string {
  const lang = brief.language;

  const header = tr(
    {
      fr: "FORMAT OBLIGATOIRE DES SECTIONS RICHES (faq, testimonials, proof, pricing, offer, bonus, guarantee) :",
      en: "MANDATORY FORMAT FOR RICH SECTIONS (faq, testimonials, proof, pricing, offer, bonus, guarantee):",
      es: "FORMATO OBLIGATORIO PARA SECCIONES RICAS (faq, testimonials, proof, pricing, offer, bonus, guarantee):",
    },
    lang,
  );

  const intro = tr(
    {
      fr: [
        "Pour ces sections, NE METS PAS le contenu dans `body` ou `bullets`. Utilise OBLIGATOIREMENT le tableau `items[]` avec le bon `kind` et la bonne structure `data`.",
        "Si tu utilises `items[]`, ne mets ni `body` ni `bullets` dans la section (ils seraient ignorés).",
      ].join("\n"),
      en: [
        "For these sections, DO NOT put content in `body` or `bullets`. You MUST use the `items[]` array with the correct `kind` and `data` structure.",
        "If you use `items[]`, do NOT put `body` or `bullets` in the section (they would be ignored).",
      ].join("\n"),
      es: [
        "Para estas secciones, NO pongas el contenido en `body` o `bullets`. DEBES usar el array `items[]` con el `kind` y la estructura `data` correctos.",
        "Si usas `items[]`, NO pongas `body` ni `bullets` en la sección (serían ignorados).",
      ].join("\n"),
    },
    lang,
  );

  const examples = [
    "",
    "─── faq (minimum 5 items) ───",
    `"items": [`,
    `  {"kind":"faq","data":{"question":"Combien de temps avant de recevoir l'accès ?","answer":"Immédiatement après votre inscription, par email."}},`,
    `  {"kind":"faq","data":{"question":"Est-ce que ça fonctionne sur mobile ?","answer":"Oui, tous les contenus sont 100% compatibles mobile et tablette."}}`,
    `]`,
    "",
    "─── testimonials / proof (minimum 3 items) ───",
    `"items": [`,
    `  {"kind":"testimonial","data":{"quote":"Résultat visible en 2 semaines, je recommande sans hésiter.","authorName":"Claire D.","authorRole":"Maman de 2 enfants","rating":5}},`,
    `  {"kind":"testimonial","data":{"quote":"Enfin un guide clair et actionnable. Bravo !","authorName":"Marc L.","authorRole":"Entrepreneur","rating":5}}`,
    `]`,
    "",
    "─── pricing / offer (1 à 3 items) ───",
    `"items": [`,
    `  {"kind":"pricing","data":{"name":"Accès complet","price":"${brief.price}","period":"paiement unique","description":"L'ebook + les bonus","features":["Ebook PDF (60+ pages)","3 bonus exclusifs","Garantie satisfait ou remboursé 30 jours","Accès à vie aux mises à jour"],"highlighted":true,"badge":"Recommandé","cta":{"label":"Je veux l'accès","mode":"anchor","anchorId":"lead-form"}}}`,
    `]`,
    "",
    "─── bonus (minimum 3 items) ───",
    `"items": [`,
    `  {"kind":"bonus","data":{"title":"Checklist actionnable","description":"Une liste pas-à-pas pour appliquer dès aujourd'hui.","value":"Valeur 19€","iconName":"checkCircle"}},`,
    `  {"kind":"bonus","data":{"title":"Vidéo bonus exclusive","description":"30 min pour aller plus loin sur le sujet.","value":"Valeur 29€","iconName":"play"}},`,
    `  {"kind":"bonus","data":{"title":"Modèles à copier","description":"Templates prêts à l'emploi.","value":"Valeur 15€","iconName":"download"}}`,
    `]`,
    "",
    "─── guarantee (exactement 1 item) ───",
    `"items": [`,
    `  {"kind":"guarantee","data":{"title":"Satisfait ou remboursé","description":"Si dans les 30 jours vous n'êtes pas satisfait, demandez votre remboursement, sans justification.","duration":"30 jours","iconName":"shield"}}`,
    `]`,
  ].join("\n");

  const rules = tr(
    {
      fr: [
        "",
        "RÈGLES :",
        "- faq : MINIMUM 5 paires question/réponse, chaque réponse fait au moins 1 phrase complète (15+ mots).",
        "- testimonials / proof : MINIMUM 3 témoignages. Chaque `authorName` doit être plausible (prénom + initiale ou prénom + ville). `quote` au moins 12 mots.",
        "- pricing / offer : 1 plan suffit pour un lead-magnet, mais le tableau `features` doit contenir au moins 4 éléments concrets.",
        "- bonus : MINIMUM 3 bonus distincts avec valeur (€) si possible et icône (checkCircle, play, download, gift, star, sparkles, award, zap, rocket).",
        "- guarantee : exactement 1 item, avec une `duration` claire (\"30 jours\", \"14 jours\").",
        "- Tous les `quote`, `description`, `answer` doivent être en " + langName(lang) + ".",
      ].join("\n"),
      en: [
        "",
        "RULES:",
        "- faq: MINIMUM 5 question/answer pairs, each answer at least 1 full sentence (15+ words).",
        "- testimonials / proof: MINIMUM 3 testimonials. Each `authorName` must be plausible (first name + initial or first name + city). `quote` at least 12 words.",
        "- pricing / offer: 1 plan is enough for a lead-magnet, but the `features` array must contain at least 4 concrete items.",
        "- bonus: MINIMUM 3 distinct bonuses with value if possible and icon (checkCircle, play, download, gift, star, sparkles, award, zap, rocket).",
        "- guarantee: exactly 1 item, with a clear `duration` (\"30 days\", \"14 days\").",
        "- All `quote`, `description`, `answer` must be in " + langName(lang) + ".",
      ].join("\n"),
      es: [
        "",
        "REGLAS:",
        "- faq: MÍNIMO 5 pares pregunta/respuesta, cada respuesta al menos 1 oración completa (15+ palabras).",
        "- testimonials / proof: MÍNIMO 3 testimonios. Cada `authorName` plausible (nombre + inicial o nombre + ciudad). `quote` al menos 12 palabras.",
        "- pricing / offer: 1 plan basta para un lead-magnet, pero `features` debe contener al menos 4 elementos concretos.",
        "- bonus: MÍNIMO 3 bonos distintos con valor si es posible e icono (checkCircle, play, download, gift, star, sparkles, award, zap, rocket).",
        "- guarantee: exactamente 1 item, con `duration` clara (\"30 días\", \"14 días\").",
        "- Todos los `quote`, `description`, `answer` en " + langName(lang) + ".",
      ].join("\n"),
    },
    lang,
  );

  return [header, intro, examples, rules].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Schéma JSON attendu (commun à plusieurs prompts)
// ─────────────────────────────────────────────────────────────────────────────

function commonJsonSchemaBlock(lang: Language = "fr"): string {
  return tr(
    {
      fr: `STRUCTURE JSON ATTENDUE (réponds UNIQUEMENT avec ce JSON, sans markdown, sans texte autour) :
{
  "funnelName": "string",
  "language": "fr" | "en" | "es",
  "sections": [
    {
      "id": "string-optionnel",
      "type": "hero" | "about" | "problem" | "solution" | "benefits" | "proof" | "testimonials" | "offer" | "bonus" | "guarantee" | "pricing" | "process" | "program" | "video" | "faq" | "cta" | "form",
      "eyebrow": "string-optionnel",
      "headline": "string-obligatoire",
      "subheadline": "string-optionnel",
      "body": "string-optionnel (interdit si items[] présent)",
      "bullets": ["string"] /* interdit si items[] présent */,
      "items": [ /* OBLIGATOIRE pour faq/testimonials/proof/pricing/offer/bonus/guarantee */
        { "kind": "faq" | "testimonial" | "pricing" | "bonus" | "guarantee", "data": { ... } }
      ],
      "cta": { "label": "string", "mode": "anchor" | "redirect", "url": "...", "anchorId": "lead-form", "target": "_self" | "_blank" },
      "image": { "mode": "none" | "upload" | "ai-suggested", "mediaRef": "id-optionnel", "alt": "string-optionnel" },
      "visible": true
    }
  ],
  "thankYouPage": { "headline": "...", "body": "...", "cta": {...} },
  "emails": [],
  "seo": { "title": "...", "description": "..." },
  "design": { "primaryColor": "#hex", "secondaryColor": "#hex", "accentColor": "#hex", "style": "premium" }
}`,
      en: `EXPECTED JSON STRUCTURE (respond ONLY with this JSON, no markdown, no surrounding text):
{
  "funnelName": "string",
  "language": "fr" | "en" | "es",
  "sections": [
    {
      "id": "optional-string",
      "type": "hero" | "about" | "problem" | "solution" | "benefits" | "proof" | "testimonials" | "offer" | "bonus" | "guarantee" | "pricing" | "process" | "program" | "video" | "faq" | "cta" | "form",
      "eyebrow": "optional",
      "headline": "required",
      "subheadline": "optional",
      "body": "optional (forbidden if items[] present)",
      "bullets": ["string"] /* forbidden if items[] present */,
      "items": [ /* REQUIRED for faq/testimonials/proof/pricing/offer/bonus/guarantee */
        { "kind": "faq" | "testimonial" | "pricing" | "bonus" | "guarantee", "data": { ... } }
      ],
      "cta": { "label": "...", "mode": "anchor" | "redirect", "url": "...", "anchorId": "lead-form", "target": "_self" | "_blank" },
      "image": { "mode": "none" | "upload" | "ai-suggested", "mediaRef": "optional-id", "alt": "optional" },
      "visible": true
    }
  ],
  "thankYouPage": { "headline": "...", "body": "...", "cta": {...} },
  "emails": [],
  "seo": { "title": "...", "description": "..." },
  "design": { "primaryColor": "#hex", "secondaryColor": "#hex", "accentColor": "#hex", "style": "premium" }
}`,
      es: `ESTRUCTURA JSON ESPERADA (responde SOLO con este JSON, sin markdown, sin texto alrededor):
{
  "funnelName": "string",
  "language": "fr" | "en" | "es",
  "sections": [
    {
      "id": "opcional",
      "type": "hero" | "about" | "problem" | "solution" | "benefits" | "proof" | "testimonials" | "offer" | "bonus" | "guarantee" | "pricing" | "process" | "program" | "video" | "faq" | "cta" | "form",
      "headline": "obligatorio",
      "subheadline": "opcional",
      "body": "opcional (prohibido si items[] presente)",
      "bullets": ["string"] /* prohibido si items[] presente */,
      "items": [
        { "kind": "faq" | "testimonial" | "pricing" | "bonus" | "guarantee", "data": { ... } }
      ],
      "cta": { "label": "...", "mode": "anchor" | "redirect", "anchorId": "lead-form", "target": "_self" | "_blank" },
      "image": { "mode": "none" | "upload" | "ai-suggested", "mediaRef": "opcional", "alt": "opcional" },
      "visible": true
    }
  ],
  "thankYouPage": { "headline": "...", "body": "...", "cta": {...} },
  "emails": [],
  "seo": { "title": "...", "description": "..." },
  "design": { "primaryColor": "#hex", "secondaryColor": "#hex", "accentColor": "#hex", "style": "premium" }
}`,
    },
    lang,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Whitelist de sections
// ─────────────────────────────────────────────────────────────────────────────

function whitelistBlock(blueprint: PageBlueprint, lang: Language): string {
  const types = blueprint.defaultSectionTypes;
  const header = tr(
    {
      fr: `WHITELIST DE SECTIONS POUR CETTE PAGE (role="${blueprint.role}") :`,
      en: `SECTION WHITELIST FOR THIS PAGE (role="${blueprint.role}"):`,
      es: `WHITELIST DE SECCIONES PARA ESTA PÁGINA (role="${blueprint.role}"):`,
    },
    lang,
  );
  const list = types.map((t, i) => `  ${i + 1}. "${t}"`).join("\n");
  const rule = tr(
    {
      fr: [
        "",
        "RÈGLES IMPORTANTES :",
        "- Génère EXACTEMENT ces sections, dans cet ordre.",
        "- N'AJOUTE AUCUNE autre section (pas de problem/solution/offer si elles ne sont pas listées).",
        "- N'OMETS AUCUNE section listée.",
      ].join("\n"),
      en: [
        "",
        "IMPORTANT RULES:",
        "- Generate EXACTLY these sections, in this order.",
        "- Do NOT ADD any other section (no problem/solution/offer if not listed).",
        "- Do NOT OMIT any listed section.",
      ].join("\n"),
      es: [
        "",
        "REGLAS IMPORTANTES:",
        "- Genera EXACTAMENTE estas secciones, en este orden.",
        "- NO AÑADAS otra sección (sin problem/solution/offer si no están listadas).",
        "- NO OMITAS ninguna sección listada.",
      ].join("\n"),
    },
    lang,
  );
  return [header, list, rule].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Anti-hype / pas d'emoji
// ─────────────────────────────────────────────────────────────────────────────

function antiHypeBlock(lang: Language): string {
  return tr(
    {
      fr: [
        "STYLE D'ÉCRITURE :",
        "- Écris en " + langName(lang) + " uniquement (fr).",
        "- Pas d'emoji, sans emoji, aucun emoji.",
        "- Pas de hype (\"révolutionnaire\", \"incroyable\", \"magique\"). Reste concret et crédible.",
        "- Phrases courtes et claires. Bénéfices concrets.",
        "- Cible le lecteur en \"vous\" (ou \"tu\" si le ton l'exige).",
      ].join("\n"),
      en: [
        "WRITING STYLE:",
        "- Write in " + langName(lang) + " only (en).",
        "- No emoji, no emoji, no emoji.",
        "- No hype (\"revolutionary\", \"incredible\", \"magical\"). Stay concrete and credible.",
        "- Short, clear sentences. Concrete benefits.",
        "- Address the reader directly.",
      ].join("\n"),
      es: [
        "ESTILO DE ESCRITURA:",
        "- Escribe en " + langName(lang) + " solamente (es).",
        "- Sin emoji, sin emoji, sin emoji.",
        "- Sin hype (\"revolucionario\", \"increíble\", \"mágico\"). Sé concreto y creíble.",
        "- Frases cortas y claras. Beneficios concretos.",
        "- Dirígete al lector directamente.",
      ].join("\n"),
    },
    lang,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloc export systeme.io
// ─────────────────────────────────────────────────────────────────────────────

function systemeIoBlock(lang: Language): string {
  return tr(
    {
      fr: "CIBLE D'EXPORT PRIORITAIRE : systeme.io (le tunnel doit être exportable en HTML compatible systeme.io).",
      en: "PRIORITY EXPORT TARGET: systeme.io (the funnel must be exportable as HTML compatible with systeme.io).",
      es: "OBJETIVO DE EXPORTACIÓN PRIORITARIO: systeme.io (el embudo debe ser exportable como HTML compatible con systeme.io).",
    },
    lang,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 1 : Funnel complet (legacy single-page)
// ─────────────────────────────────────────────────────────────────────────────

export function completeFunnelPrompt(brief: FunnelBrief): string {
  const lang = brief.language;

  return [
    tr(
      {
        fr: `Tu es un expert copywriter de tunnels de vente. Génère un funnel complet de A à Z, en ${langName(lang)}.`,
        en: `You are an expert sales funnel copywriter. Generate a complete funnel from A to Z, in ${langName(lang)}.`,
        es: `Eres un copywriter experto en embudos. Genera un embudo completo de A a Z, en ${langName(lang)}.`,
      },
      lang,
    ),
    "",
    productRuleBlock(brief),
    "",
    copywritingPrefsBlock(brief.copywritingPrefs, lang),
    "",
    mediasBlock(brief.medias, lang),
    "",
    strictSectionRequirementsBlock(lang),
    "",
    richSectionsBlock(brief),
    "",
    antiHypeBlock(lang),
    "",
    systemeIoBlock(lang),
    "",
    commonJsonSchemaBlock(lang),
  ]
    .filter(Boolean)
    .join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 2 : Régénération d'une section
// ─────────────────────────────────────────────────────────────────────────────

export function regenerateSectionPrompt(args: {
  brief: FunnelBrief;
  section: Pick<FunnelSection, "type" | "headline" | "subheadline" | "body" | "bullets" | "cta">;
  instruction?: string;
}): string {
  const { brief, section, instruction } = args;
  const lang = brief.language;

  return [
    tr(
      {
        fr: `Tu es un expert copywriter. Régénère la section de type "${section.type}" en ${langName(lang)}.`,
        en: `You are an expert copywriter. Regenerate the section of type "${section.type}" in ${langName(lang)}.`,
        es: `Eres un copywriter experto. Regenera la sección de tipo "${section.type}" en ${langName(lang)}.`,
      },
      lang,
    ),
    "",
    productRuleBlock(brief),
    "",
    copywritingPrefsBlock(brief.copywritingPrefs, lang),
    "",
    instruction ? `INSTRUCTION SPÉCIFIQUE : ${instruction}` : "",
    "",
    `SECTION ACTUELLE (à améliorer) :`,
    JSON.stringify(section, null, 2),
    "",
    strictSectionRequirementsBlock(lang),
    "",
    richSectionsBlock(brief),
    "",
    antiHypeBlock(lang),
    "",
    tr(
      {
        fr: `Réponds avec un JSON unique : { "section": { ...la section régénérée... } }`,
        en: `Reply with a single JSON: { "section": { ...the regenerated section... } }`,
        es: `Responde con un único JSON: { "section": { ...la sección regenerada... } }`,
      },
      lang,
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 3 : Import inspiration
// ─────────────────────────────────────────────────────────────────────────────

export function importInspirationPrompt(args: {
  brief: FunnelBrief;
  extractedContent: string;
}): string {
  const { brief, extractedContent } = args;
  const lang = brief.language;

  return [
    tr(
      {
        fr: `Tu es un expert copywriter. Inspire-toi UNIQUEMENT de la STRUCTURE de la page ci-dessous (pas du contenu) pour générer un funnel ORIGINAL en ${langName(lang)} pour la marque ${brief.brandName}.`,
        en: `You are an expert copywriter. Take inspiration ONLY from the STRUCTURE of the page below (not the content) to generate an ORIGINAL funnel in ${langName(lang)} for the brand ${brief.brandName}.`,
        es: `Eres un copywriter experto. Inspírate SOLO en la ESTRUCTURA de la página de abajo (no el contenido) para generar un embudo ORIGINAL en ${langName(lang)} para la marca ${brief.brandName}.`,
      },
      lang,
    ),
    "",
    tr(
      {
        fr: "INTERDICTIONS :",
        en: "FORBIDDEN:",
        es: "PROHIBIDO:",
      },
      lang,
    ),
    tr(
      {
        fr: "- Sans copier de texte exact. Reformule TOUT, écris du contenu ORIGINAL.",
        en: "- Do not copy any phrase verbatim. Rewrite EVERYTHING, write ORIGINAL content.",
        es: "- No copies ninguna frase. Reformula TODO, escribe contenido ORIGINAL.",
      },
      lang,
    ),
    "",
    productRuleBlock(brief),
    "",
    `CONTENU STRUCTUREL EXTRAIT (à utiliser comme INSPIRATION uniquement) :`,
    "```",
    extractedContent.slice(0, 8000),
    "```",
    "",
    strictSectionRequirementsBlock(lang),
    "",
    richSectionsBlock(brief),
    "",
    antiHypeBlock(lang),
    "",
    systemeIoBlock(lang),
    "",
    commonJsonSchemaBlock(lang),
  ]
    .filter(Boolean)
    .join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 4 : Séquence d'emails
// ─────────────────────────────────────────────────────────────────────────────

export function emailSequencePrompt(brief: FunnelBrief): string {
  const lang = brief.language;

  return [
    tr(
      {
        fr: `Tu es un expert email marketing. Génère une séquence de 3 (trois) emails de nurturing en ${langName(lang)} pour l'offre ${brief.offerName}.`,
        en: `You are an email marketing expert. Generate a sequence of 3 (three) nurturing emails in ${langName(lang)} for the offer ${brief.offerName}.`,
        es: `Eres un experto en email marketing. Genera una secuencia de 3 (tres) emails de nurturing en ${langName(lang)} para la oferta ${brief.offerName}.`,
      },
      lang,
    ),
    "",
    productRuleBlock(brief),
    "",
    tr(
      {
        fr: [
          "STRUCTURE DES 3 EMAILS :",
          "1. Email J+0 : remerciement + livraison de la ressource + amorce de la suite.",
          "2. Email J+2 : storytelling, contexte du problème, autorité.",
          "3. Email J+5 : présentation de l'offre payante avec CTA clair.",
        ].join("\n"),
        en: [
          "STRUCTURE OF THE 3 EMAILS:",
          "1. Email Day 0: thank you + resource delivery + teaser for next.",
          "2. Email Day 2: storytelling, problem context, authority.",
          "3. Email Day 5: paid offer presentation with clear CTA.",
        ].join("\n"),
        es: [
          "ESTRUCTURA DE LOS 3 EMAILS:",
          "1. Email Día 0: agradecimiento + entrega del recurso + adelanto.",
          "2. Email Día 2: storytelling, contexto del problema, autoridad.",
          "3. Email Día 5: presentación de la oferta de pago con CTA claro.",
        ].join("\n"),
      },
      lang,
    ),
    "",
    antiHypeBlock(lang),
    "",
    tr(
      {
        fr: `Réponds avec un JSON : { "emails": [ {"subject":"...","html":"...","text":"...","cta":{"label":"...","mode":"redirect","url":"..."}}, ... ] }`,
        en: `Reply with a JSON: { "emails": [ {"subject":"...","html":"...","text":"...","cta":{...}}, ... ] }`,
        es: `Responde con un JSON: { "emails": [ {"subject":"...","html":"...","text":"...","cta":{...}}, ... ] }`,
      },
      lang,
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 5 : Export systeme.io
// ─────────────────────────────────────────────────────────────────────────────

export function exportSystemePrompt(args: { funnelName: string; lang: Language }): string {
  const { funnelName, lang } = args;
  return tr(
    {
      fr: `Génère un mapping d'export systeme.io pour le tunnel "${funnelName}". Retourne un JSON avec la structure attendue par l'API systeme.io.`,
      en: `Generate a systeme.io export mapping for the funnel "${funnelName}". Return a JSON with the structure expected by the systeme.io API.`,
      es: `Genera un mapeo de exportación systeme.io para el embudo "${funnelName}". Devuelve un JSON con la estructura esperada por la API systeme.io.`,
    },
    lang,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 PROMPT 6 : Page principale (multi-pages) — avec règles sémantiques
// ─────────────────────────────────────────────────────────────────────────────

export function mainPagePrompt(args: {
  brief: FunnelBrief;
  blueprint: PageBlueprint;
}): string {
  const { brief, blueprint } = args;
  const lang = brief.language;

  return [
    tr(
      {
        fr: `Tu es un expert copywriter de tunnels de vente. Génère la PAGE PRINCIPALE (role="${blueprint.role}") en ${langName(lang)}.`,
        en: `You are an expert sales funnel copywriter. Generate the MAIN PAGE (role="${blueprint.role}") in ${langName(lang)}.`,
        es: `Eres un copywriter experto. Genera la PÁGINA PRINCIPAL (role="${blueprint.role}") en ${langName(lang)}.`,
      },
      lang,
    ),
    "",
    productRuleBlock(brief),
    "",
    copywritingPrefsBlock(brief.copywritingPrefs, lang),
    "",
    mediasBlock(brief.medias, lang),
    "",
    whitelistBlock(blueprint, lang),
    "",
    // 🆕 Règles sémantiques par rôle (CTA cohérents)
    roleSemanticsBlock([blueprint.role], lang),
    "",
    strictSectionRequirementsBlock(lang),
    "",
    richSectionsBlock(brief),
    "",
    antiHypeBlock(lang),
    "",
    systemeIoBlock(lang),
    "",
    commonJsonSchemaBlock(lang),
  ]
    .filter(Boolean)
    .join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 PROMPT 7 : Pages secondaires — avec règles sémantiques par rôle
// ─────────────────────────────────────────────────────────────────────────────

export function secondaryPagesPrompt(args: {
  brief: FunnelBrief;
  mainPageHeadline: string;
  mainPagePromise: string;
  blueprints: PageBlueprint[];
}): string {
  const { brief, mainPageHeadline, mainPagePromise, blueprints } = args;
  const lang = brief.language;

  const pagesBlocks = blueprints
    .map((bp) => {
      const list = bp.defaultSectionTypes.map((t, i) => `      ${i + 1}. "${t}"`).join("\n");
      return [
        `  ─── Page role="${bp.role}" (slug="${bp.slug}") ───`,
        `    Whitelist:`,
        list,
        `    Description: ${bp.description[lang] ?? bp.description.fr}`,
      ].join("\n");
    })
    .join("\n\n");

  // 🆕 Collecte des rôles uniques pour le bloc sémantique
  const roles = Array.from(new Set(blueprints.map((bp) => bp.role)));

  return [
    tr(
      {
        fr: `Tu es un expert copywriter. Génère les PAGES SECONDAIRES d'un tunnel en ${langName(lang)}, dans la continuité de la page principale.`,
        en: `You are an expert copywriter. Generate the SECONDARY PAGES of a funnel in ${langName(lang)}, in line with the main page.`,
        es: `Eres un copywriter experto. Genera las PÁGINAS SECUNDARIAS de un embudo en ${langName(lang)}, en línea con la página principal.`,
      },
      lang,
    ),
    "",
    productRuleBlock(brief),
    "",
    tr(
      {
        fr: `CONTEXTE DE LA PAGE PRINCIPALE :\n- Headline : "${mainPageHeadline}"\n- Promesse : "${mainPagePromise}"`,
        en: `MAIN PAGE CONTEXT:\n- Headline: "${mainPageHeadline}"\n- Promise: "${mainPagePromise}"`,
        es: `CONTEXTO DE LA PÁGINA PRINCIPAL:\n- Titular: "${mainPageHeadline}"\n- Promesa: "${mainPagePromise}"`,
      },
      lang,
    ),
    "",
    tr(
      {
        fr: "PAGES À GÉNÉRER (whitelist STRICTE par page) :",
        en: "PAGES TO GENERATE (STRICT whitelist per page):",
        es: "PÁGINAS A GENERAR (whitelist ESTRICTA por página):",
      },
      lang,
    ),
    pagesBlocks,
    "",
    // 🆕 Règles sémantiques par rôle pour TOUTES les pages secondaires demandées
    roleSemanticsBlock(roles, lang),
    "",
    strictSectionRequirementsBlock(lang),
    "",
    richSectionsBlock(brief),
    "",
    antiHypeBlock(lang),
    "",
    tr(
      {
        fr: `STRUCTURE JSON ATTENDUE (réponds UNIQUEMENT avec ce JSON, sans markdown) :
{
  "pages": [
    {
      "role": "thankyou" /* ou autre rôle listé */,
      "sections": [ /* sections respectant la whitelist de cette page */ ]
    }
  ]
}`,
        en: `EXPECTED JSON STRUCTURE (respond ONLY with this JSON, no markdown):
{
  "pages": [
    {
      "role": "thankyou" /* or other listed role */,
      "sections": [ /* sections matching this page's whitelist */ ]
    }
  ]
}`,
        es: `ESTRUCTURA JSON ESPERADA (responde SOLO con este JSON, sin markdown):
{
  "pages": [
    {
      "role": "thankyou" /* u otro rol listado */,
      "sections": [ /* secciones respetando la whitelist de esta página */ ]
    }
  ]
}`,
      },
      lang,
    ),
  ]
    .filter(Boolean)
    .join("\n");
}
