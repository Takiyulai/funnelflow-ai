// lib/ai/prompts.ts
import type {
  FunnelBrief,
  FunnelSection,
  Language,
  CopywritingPrefs,
  FunnelKind,
  PageRole,
} from "@/lib/funnels/types";
import type { PageBlueprint } from "@/lib/funnels/pageCatalogs";
import {
  getPageBlueprint,
  getCopywritingFrameworks,
  getHeroMediaPolicy,
  type CopywritingFramework,
} from "@/lib/funnels/pageCatalogs";

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
// 🆕 Helper : résolution du rôle d'accueil selon le type de tunnel
// ─────────────────────────────────────────────────────────────────────────────

function getHomeRoleForKind(kind: FunnelKind): PageRole {
  switch (kind) {
    case "lead-magnet":
      return "optin";
    case "webinar":
      return "registration";
    case "digital-product":
    case "vsl":
    case "formation":
    case "saas":
      return "sales";
    case "booking":
    case "service":
      return "landing";
    case "coaching-high-ticket":
      return "application";
    case "challenge":
      return "challenge-landing";
    case "thank-you":
      return "thankyou";
    default:
      return "optin";
  }
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
// Bloc : médias fournis par l'utilisateur — placement déterministe via sectionHint
// ─────────────────────────────────────────────────────────────────────────────

export interface MediaInput {
  id?: string;
  url?: string;
  mediaRef?: string;
  kind?: "image" | "video";
  description?: string;
  alt?: string;
  filename?: string;
  /** Section cible explicite définie par l'utilisateur dans MediasStep */
  sectionHint?: string;
}

export function mediasBlock(
  medias: MediaInput[] | undefined,
  language: Language = "fr",
): string {
  if (!medias || medias.length === 0) return "";

  const lang: Language = language === "en" || language === "es" ? language : "fr";

  const heading =
    lang === "en" ? "USER-PROVIDED MEDIAS — strict placement rules"
    : lang === "es" ? "MEDIAS PROPORCIONADOS POR EL USUARIO — reglas estrictas de colocación"
    : "MÉDIAS FOURNIS PAR L'UTILISATEUR — règles strictes de placement";

  const intro =
    lang === "en"
      ? "Each media below MUST appear in the funnel. Use the `sectionHint` as the authoritative target when provided. Otherwise, infer placement from the `description` and `kind` field."
      : lang === "es"
        ? "Cada media debe aparecer en el funnel. Use `sectionHint` como destino autoritativo si está presente. Si no, inferir el destino del `description` y `kind`."
        : "Chaque média ci-dessous DOIT apparaître dans le tunnel. La `sectionHint` est l'instruction prioritaire quand elle est fournie. Sinon, déduisez le placement depuis la `description` et le `kind`.";

  const lines: string[] = [`## ${heading}`, "", intro, ""];

  medias.forEach((m, i) => {
    const ref = m.mediaRef || m.url || m.id || `media_${i + 1}`;
    const kind = m.kind || (m.url?.match(/\.(mp4|webm|mov)$/i) ? "video" : "image");
    lines.push(`### Média ${i + 1}`);
    lines.push(`- ref: \`${ref}\``);
    lines.push(`- type: ${kind}`);
    if (m.sectionHint) {
      lines.push(`- 🎯 **sectionHint (PRIORITAIRE) : \`${m.sectionHint}\`** — placez ce média dans une section de type \`${m.sectionHint}\`, sans exception.`);
    }
    if (m.description) lines.push(`- description : ${m.description}`);
    if (m.alt) lines.push(`- alt : ${m.alt}`);
    if (m.filename) lines.push(`- filename : ${m.filename}`);
    lines.push("");
  });

  lines.push(
    lang === "en"
      ? "**Mapping convention (when no sectionHint):** keywords like *coach, founder, about me, portrait* → `about` section; *testimonial, review, screenshot, customer* → `testimonials` section; *product, mockup, cover* → `pricing` or `bonus` section; *demo, walkthrough* → `video` section. A user portrait NEVER goes in the same hero as a video."
      : lang === "es"
        ? "**Convención (sin sectionHint):** palabras como *coach, fundador, retrato* → `about`; *testimonio, captura, cliente* → `testimonials`; *producto, mockup* → `pricing`/`bonus`; *demo* → `video`."
        : "**Convention de mapping (sans sectionHint) :** mots-clés comme *coach, fondateur, à propos, portrait, photo de moi* → section `about` ; *témoignage, avis, capture, client, screenshot* → section `testimonials` ; *produit, mockup, couverture* → section `pricing` ou `bonus` ; *démo, présentation* → section `video`. Un portrait du coach ne va JAMAIS dans le même hero qu'une vidéo.",
  );

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 Bloc : interdiction d'inventer des noms de fichier
// ─────────────────────────────────────────────────────────────────────────────

function noInventedFilenamesBlock(lang: Language): string {
  return tr(
    {
      fr: [
        "## ⚠️ NOMS DE FICHIERS — RÈGLE ABSOLUE",
        "",
        "N'INVENTE JAMAIS un nom de fichier image (ex: \"speaking.png\", \"hero.jpg\", \"photo-coach.webp\").",
        "Pour chaque média fourni dans `MÉDIAS FOURNIS`, utilise EXCLUSIVEMENT son `ref` exact (ex: `[uploaded-media-xxx]`) dans le champ `image.url` ou `video.url`.",
        "Si aucun média n'est fourni pour une section, laisse `image.mode = \"none\"` SANS URL.",
        "",
        "❌ INTERDIT : `image: { url: \"speaking.png\" }`, `image: { url: \"/images/coach.jpg\" }`",
        "✅ AUTORISÉ : `image: { url: \"[uploaded-media-1779906684809-zpnilq]\", alt: \"Coach\" }`",
        "✅ AUTORISÉ (aucun média) : `image: { mode: \"none\" }`",
      ].join("\n"),
      en: [
        "## ⚠️ FILENAMES — ABSOLUTE RULE",
        "",
        "NEVER invent an image filename (e.g., \"speaking.png\", \"hero.jpg\").",
        "For each provided media, use ONLY its exact `ref` (e.g., `[uploaded-media-xxx]`) in `image.url` or `video.url`.",
        "If no media is provided for a section, leave `image.mode = \"none\"` WITHOUT URL.",
      ].join("\n"),
      es: [
        "## ⚠️ NOMBRES DE ARCHIVO — REGLA ABSOLUTA",
        "",
        "NUNCA inventes un nombre de archivo de imagen.",
        "Usa SOLO el `ref` proporcionado (ej: `[uploaded-media-xxx]`).",
        "Si no hay media, deja `image.mode = \"none\"` SIN URL.",
      ].join("\n"),
    },
    lang,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 Bloc : injection de la vidéo principale du brief
// ─────────────────────────────────────────────────────────────────────────────

function briefVideoBlock(
  videoUrl: string | undefined,
  lang: Language,
  isSecondary = false,
): string {
  if (!videoUrl || !videoUrl.trim()) return "";

  const trimmed = videoUrl.trim();

  if (lang === "en") {
    return [
      "## 🎥 MAIN VIDEO PROVIDED (MANDATORY)",
      "",
      `URL: \`${trimmed}\``,
      "",
      isSecondary
        ? "If the page role is `replay`, `live`, `webinar`, or `confirmation`, you MUST create a `video` section with this URL as the central content."
        : "You MUST create a `video` section containing this URL. For funnels of type `webinar` or `vsl`, this video is the central element of the page.",
      "",
      "Required format:",
      "```json",
      `{ "type": "video", "video": { "url": "${trimmed}", "provider": "youtube" }, "headline": "...", "body": "..." }`,
      "```",
    ].join("\n");
  }

  if (lang === "es") {
    return [
      "## 🎥 VIDEO PRINCIPAL PROPORCIONADO (OBLIGATORIO)",
      "",
      `URL: \`${trimmed}\``,
      "",
      isSecondary
        ? "Si el rol de página es `replay`, `live`, `webinar` o `confirmation`, DEBES crear una sección `video` con esta URL."
        : "DEBES crear una sección `video` con esta URL. Para embudos `webinar` o `vsl`, este vídeo es el contenido central.",
      "",
      "Formato requerido :",
      "```json",
      `{ "type": "video", "video": { "url": "${trimmed}", "provider": "youtube" }, "headline": "...", "body": "..." }`,
      "```",
    ].join("\n");
  }

  return [
    "## 🎥 VIDÉO PRINCIPALE FOURNIE (OBLIGATOIRE)",
    "",
    `URL : \`${trimmed}\``,
    "",
    isSecondary
      ? "Si le rôle de la page est `replay`, `live`, `webinar` ou `confirmation`, tu DOIS créer une section `video` contenant cette URL comme contenu central."
      : "Tu DOIS créer une section de type `video` contenant cette URL. Pour les tunnels de type `webinar` ou `vsl`, cette vidéo est l'élément central de la page.",
    "",
    "Format requis :",
    "```json",
    `{ "type": "video", "video": { "url": "${trimmed}", "provider": "youtube" }, "headline": "Découvrez la méthode en vidéo", "body": "Une présentation claire de ce qui vous attend." }`,
    "```",
    "",
    "⚠️ Cette URL doit apparaître TELLE QUELLE dans le champ `video.url` — ne la modifie pas, ne la remplace pas par un placeholder.",
  ].join("\n");
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
        "7. SECTIONS À ITEMS TYPÉS (bonus, guarantee) — règle stricte :",
        "   - CHAQUE item DOIT avoir une \"description\" de 15 à 30 mots minimum, jamais juste un titre seul.",
        "   - Format obligatoire : { \"kind\": \"bonus\", \"data\": { \"title\": \"Titre concret de 4-8 mots\", \"description\": \"Phrase complète de 15-30 mots qui explique le bénéfice, en s'adressant directement au lecteur.\" } }",
        "   - ❌ INTERDIT : { \"data\": { \"title\": \"Stratégies éprouvées\" } } sans description.",
        "   - ✅ CORRECT : { \"data\": { \"title\": \"Stratégies éprouvées pour croître\", \"description\": \"Découvrez les méthodes testées qui ont déjà permis à des dizaines d'entrepreneurs de doubler leur chiffre d'affaires en moins d'un an.\" } }",
        "   - Génère TOUJOURS entre 3 et 6 items par section, jamais moins.",
        "",
        "8. SECTIONS À BULLETS RICHES (benefits, process, program, steps, problem, solution) — règle stricte :",
        "   - Ces sections utilisent le champ \"bullets\" (array de strings), PAS \"items\".",
        "   - CHAQUE bullet DOIT être au format \"Titre concret | Description complète\" séparés par \" | \" (espace pipe espace).",
        "   - Le titre fait 4-8 mots, la description fait 15-30 mots complètes en s'adressant au lecteur.",
        "   - ❌ INTERDIT : \"bullets\": [\"Stratégies éprouvées\", \"Conseils pratiques\"]",
        "   - ✅ CORRECT : \"bullets\": [",
        "       \"Stratégies éprouvées pour croître | Découvrez les méthodes testées qui ont permis à des dizaines d'entrepreneurs de doubler leur chiffre d'affaires en moins d'un an.\",",
        "       \"Conseils pratiques à appliquer | Recevez des actions concrètes que vous pouvez mettre en place dès demain matin, sans outil compliqué ni équipe technique.\",",
        "       \"Exemples réels de réussite | Plongez dans 3 études de cas détaillées avec chiffres, captures et erreurs à éviter pour reproduire les mêmes résultats.\"",
        "     ]",
        "   - Génère TOUJOURS entre 3 et 6 bullets par section, jamais moins.",
        "",
        "9. SECTIONS \"about\" — règle stricte :",
        "   - La section \"about\" DOIT avoir un \"body\" de 80 à 200 mots minimum qui présente la marque, le coach/fondateur ou l'entreprise.",
        "   - Le body ne peut JAMAIS être vide, même si une image est présente.",
        "   - Inclus : qui vous êtes, ce que vous faites, pour qui, et pourquoi vous le faites.",
      ].join("\n"),
      en: [
        "STRICT CONTENT REQUIREMENTS (NEVER produce empty sections):",
        "",
        "1. EYEBROW (REQUIRED for EVERY section):",
        "   - 2 to 5 words, preferably UPPERCASE.",
        "   - FORBIDDEN: empty, null, or missing eyebrow.",
        "",
        "2. HEADLINE (REQUIRED):",
        "   - At least 5 meaningful words. NEVER placeholders like \"BRAND — type\".",
        "",
        "3. SUBHEADLINE (recommended, ≥ 4 words).",
        "",
        "4. BODY:",
        "   - Short free text (1 to 3 sentences).",
        "   - FORBIDDEN: dashes, bullets, or lists inside body.",
        "",
        "5. BULLETS (when relevant):",
        "   - Array of 3 to 6 short strings (5 to 12 words each).",
        "",
        "6. MINIMUM CONTENT:",
        "   - body ≥ 30 words OR bullets ≥ 3 relevant entries.",
        "",
        "7. TYPED-ITEMS SECTIONS (bonus, guarantee) — strict rule:",
        "   - EVERY item MUST have a \"description\" of at least 15-30 words, never a title alone.",
        "   - Required format: { \"kind\": \"bonus\", \"data\": { \"title\": \"Concrete 4-8 word title\", \"description\": \"Full 15-30 word sentence speaking directly to the reader.\" } }",
        "   - ❌ FORBIDDEN: { \"data\": { \"title\": \"Proven strategies\" } } without description.",
        "   - ✅ CORRECT: { \"data\": { \"title\": \"Proven growth strategies\", \"description\": \"Discover the tested methods that have already helped dozens of entrepreneurs double their revenue in less than a year.\" } }",
        "   - Always generate between 3 and 6 items per section, never fewer.",
        "",
        "8. RICH-BULLET SECTIONS (benefits, process, program, steps, problem, solution) — strict rule:",
        "   - These sections use the \"bullets\" field (string array), NOT \"items\".",
        "   - EACH bullet MUST use the format \"Concrete title | Full description\" separated by \" | \" (space pipe space).",
        "   - Title is 4-8 words, description is 15-30 full words speaking to the reader.",
        "   - ❌ FORBIDDEN: \"bullets\": [\"Proven strategies\", \"Practical tips\"]",
        "   - ✅ CORRECT: \"bullets\": [",
        "       \"Proven growth strategies | Discover the tested methods that have already helped dozens of entrepreneurs double their revenue in less than a year.\",",
        "       \"Practical tips to apply | Get concrete actions you can implement tomorrow morning without complex tools or a technical team.\",",
        "       \"Real-world success stories | Dive into 3 detailed case studies with figures, screenshots and mistakes to avoid.\"",
        "     ]",
        "   - Always generate between 3 and 6 bullets per section, never fewer.",
        "",
        "9. \"about\" SECTIONS — strict rule:",
        "   - The \"about\" section MUST have a \"body\" of at least 80-200 words presenting the brand, coach/founder, or company.",
        "   - The body can NEVER be empty, even if an image is present.",
        "   - Include: who you are, what you do, for whom, and why you do it.",
      ].join("\n"),
      es: [
        "REQUISITOS ESTRICTOS DE CONTENIDO (NUNCA producir secciones vacías):",
        "",
        "1. EYEBROW (OBLIGATORIO para CADA sección): 2 a 5 palabras en MAYÚSCULAS.",
        "2. HEADLINE (OBLIGATORIO): al menos 5 palabras significativas.",
        "3. SUBHEADLINE (recomendado, ≥ 4 palabras).",
        "4. BODY: 1 a 3 frases, sin guiones ni listas.",
        "5. BULLETS: array de 3 a 6 strings cortas.",
        "6. CONTENIDO MÍNIMO: body ≥ 30 palabras O bullets ≥ 3 entradas.",
        "",
        "7. SECCIONES CON ITEMS TIPADOS (bonus, guarantee) — regla estricta:",
        "   - CADA item DEBE tener una \"description\" de 15 a 30 palabras mínimo.",
        "   - Formato: { \"kind\": \"bonus\", \"data\": { \"title\": \"Título concreto de 4-8 palabras\", \"description\": \"Frase completa de 15-30 palabras dirigida al lector.\" } }",
        "   - ❌ PROHIBIDO: { \"data\": { \"title\": \"Estrategias probadas\" } } sin description.",
        "   - ✅ CORRECTO: { \"data\": { \"title\": \"Estrategias probadas de crecimiento\", \"description\": \"Descubre los métodos validados que han ayudado a decenas de emprendedores a duplicar sus ingresos en menos de un año.\" } }",
        "   - Siempre 3 a 6 items por sección.",
        "",
        "8. SECCIONES CON BULLETS RICOS (benefits, process, program, steps, problem, solution) — regla estricta:",
        "   - Estas secciones usan el campo \"bullets\" (array de strings), NO \"items\".",
        "   - CADA bullet DEBE usar el formato \"Título concreto | Descripción completa\" separados por \" | \" (espacio pipe espacio).",
        "   - Título de 4-8 palabras, descripción de 15-30 palabras completas.",
        "   - ❌ PROHIBIDO: \"bullets\": [\"Estrategias probadas\", \"Consejos prácticos\"]",
        "   - ✅ CORRECTO: \"bullets\": [",
        "       \"Estrategias probadas de crecimiento | Descubre los métodos validados que han ayudado a decenas de emprendedores a duplicar sus ingresos en menos de un año.\",",
        "       \"Consejos prácticos aplicables | Recibe acciones concretas que puedes implementar mañana mismo, sin herramientas complejas ni equipo técnico.\",",
        "       \"Casos reales de éxito | Sumérgete en 3 estudios de caso detallados con cifras, capturas y errores a evitar.\"",
        "     ]",
        "   - Siempre 3 a 6 bullets por sección.",
        "",
        "9. SECCIONES \"about\" — regla estricta:",
        "   - La sección \"about\" DEBE tener un \"body\" de 80 a 200 palabras presentando la marca, el coach/fundador o la empresa.",
        "   - El body NUNCA puede estar vacío, incluso si hay una imagen.",
        "   - Incluye: quién eres, qué haces, para quién y por qué lo haces.",
      ].join("\n"),
    },
    lang,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloc : règles sémantiques de CTA par rôle de page
// ─────────────────────────────────────────────────────────────────────────────

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
      "- CTA principal : doit pointer vers le formulaire de la page (mode \"anchor\", anchorId=\"lead-form\"), label type \"Recevoir mon guide gratuit\".",
    ],
    thankyou: [
      "Rôle \"thankyou\" : page de remerciement APRÈS opt-in. Le lead magnet est ENVOYÉ PAR EMAIL.",
      "- INTERDIT ABSOLU : CTA \"Télécharger maintenant\" (le guide arrive par email, pas via la page).",
      "- CTA principal RECOMMANDÉ : { \"label\": \"Ouvrir ma boîte Gmail\", \"mode\": \"redirect\", \"url\": \"https://mail.google.com\", \"target\": \"_blank\" }",
      "- Body doit expliquer : (1) l'email arrive dans les 2 minutes, (2) vérifier les spams, (3) ajouter l'expéditeur aux contacts.",
    ],
    delivery: [
      "Rôle \"delivery\" : page de livraison DIRECTE du produit/ressource.",
      "- CTA principal AUTORISÉ : \"Télécharger mon guide\" avec URL réelle du fichier.",
    ],
    confirmation: [
      "Rôle \"confirmation\" : page de validation (inscription webinaire, réservation booking).",
      "- CTA principal : étape suivante du tunnel.",
      "- INTERDIT : reproduire un formulaire d'opt-in.",
    ],
    sales: [
      "Rôle \"sales\" : page de vente principale.",
      "- CTA principal : achat de l'offre.",
    ],
    checkout: [
      "Rôle \"checkout\" : page de paiement.",
      "- CTA principal : finalisation de l'achat.",
    ],
    registration: [
      "Rôle \"registration\" : inscription webinaire.",
      "- CTA principal : pointe vers le formulaire (anchor lead-form).",
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
      "Rôle \"booking\" : page de prise de RDV.",
      "- CTA principal : pointe vers le widget calendrier.",
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
      "- CTA principal : inscription (anchor lead-form).",
    ],
    "challenge-day": [
      "Rôle \"challenge-day\" : journée du challenge.",
      "- CTA principal : passer au jour suivant ou découvrir l'offre payante.",
    ],
  };

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
      en: "\n(Note: examples are in French — translate CTA labels to the output language, keep the intent.)",
      es: "\n(Nota: ejemplos en francés — traduce las etiquetas CTA al idioma de salida.)",
    },
    lang,
  );

  return [header, ...lines, localizedNote].filter(Boolean).join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloc — Sections riches (faq, testimonials, pricing, bonus, etc.)
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
        "",
        "📸 RÈGLE SPÉCIALE TESTIMONIALS : si un média avec sectionHint=\"testimonials\" est fourni, place son `ref` dans le champ `data.avatarUrl` du PREMIER testimonial — JAMAIS dans le champ `image` de la section.",
      ].join("\n"),
      en: [
        "For these sections, DO NOT put content in `body` or `bullets`. You MUST use the `items[]` array with the correct `kind` and `data` structure.",
        "",
        "📸 SPECIAL TESTIMONIALS RULE: if a media with sectionHint=\"testimonials\" is provided, place its `ref` in the `data.avatarUrl` field of the FIRST testimonial — NEVER in the section's `image` field.",
      ].join("\n"),
      es: [
        "Para estas secciones, NO pongas el contenido en `body` o `bullets`. DEBES usar el array `items[]`.",
        "",
        "📸 REGLA ESPECIAL TESTIMONIALS: coloca el `ref` del media en `data.avatarUrl` del PRIMER testimonio, NUNCA en el `image` de la sección.",
      ].join("\n"),
    },
    lang,
  );

  const examples = [
    "",
    "─── faq (minimum 5 items) ───",
    `"items": [`,
    `  {"kind":"faq","data":{"question":"Combien de temps avant de recevoir l'accès ?","answer":"Immédiatement après votre inscription, par email."}}`,
    `]`,
    "",
    "─── testimonials / proof (minimum 3 items) ───",
    `"items": [`,
    `  {"kind":"testimonial","data":{"quote":"Résultat visible en 2 semaines.","authorName":"Claire D.","authorRole":"Entrepreneure","avatarUrl":"[uploaded-media-xxx]","rating":5}}`,
    `]`,
    "",
    "─── pricing / offer (1 à 3 items) ───",
    `"items": [`,
    `  {"kind":"pricing","data":{"name":"Accès complet","price":"${brief.price}","period":"paiement unique","description":"L'ebook + les bonus","features":["Ebook PDF (60+ pages)","3 bonus exclusifs","Garantie 30 jours","Accès à vie aux mises à jour"],"highlighted":true,"badge":"Recommandé","cta":{"label":"Je veux l'accès","mode":"anchor","anchorId":"lead-form"}}}`,
    `]`,
    "",
    "─── bonus (minimum 3 items) ───",
    `"items": [`,
    `  {"kind":"bonus","data":{"title":"Checklist actionnable","description":"Une liste pas-à-pas pour appliquer dès aujourd'hui.","value":"Valeur 19€","iconName":"checkCircle"}}`,
    `]`,
    "",
    "─── guarantee (exactement 1 item) ───",
    `"items": [`,
    `  {"kind":"guarantee","data":{"title":"Satisfait ou remboursé","description":"Si dans les 30 jours vous n'êtes pas satisfait, demandez votre remboursement.","duration":"30 jours","iconName":"shield"}}`,
    `]`,
  ].join("\n");

  const rules = tr(
    {
      fr: [
        "",
        "RÈGLES :",
        "- faq : MINIMUM 5 paires question/réponse, chaque réponse 15+ mots.",
        "- testimonials / proof : MINIMUM 3 témoignages. authorName plausible. quote 12+ mots.",
        "- pricing / offer : features ≥ 4 éléments concrets.",
        "- bonus : MINIMUM 3 bonus avec icône (checkCircle, play, download, gift, star, sparkles, award, zap, rocket).",
        "- guarantee : exactement 1 item avec duration claire.",
        "- Tous les textes en " + langName(lang) + ".",
      ].join("\n"),
      en: [
        "",
        "RULES:",
        "- faq: MINIMUM 5 Q&A pairs, each answer 15+ words.",
        "- testimonials / proof: MINIMUM 3 testimonials, quote 12+ words.",
        "- pricing / offer: features ≥ 4 concrete items.",
        "- bonus: MINIMUM 3 bonuses with icon.",
        "- guarantee: exactly 1 item with clear duration.",
        "- All texts in " + langName(lang) + ".",
      ].join("\n"),
      es: [
        "",
        "REGLAS:",
        "- faq: MÍNIMO 5 pares pregunta/respuesta.",
        "- testimonials / proof: MÍNIMO 3 testimonios.",
        "- pricing / offer: features ≥ 4 elementos.",
        "- bonus: MÍNIMO 3 bonos con icono.",
        "- guarantee: exactamente 1 item.",
      ].join("\n"),
    },
    lang,
  );

  return [header, intro, examples, rules].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Schéma JSON attendu
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
      "eyebrow": "string-obligatoire (2-5 mots)",
      "headline": "string-obligatoire",
      "subheadline": "string-optionnel",
      "body": "string-optionnel (interdit si items[] présent)",
      "bullets": ["string"],
      "items": [{ "kind": "faq" | "testimonial" | "pricing" | "bonus" | "guarantee", "data": { ... } }],
      "cta": { "label": "string", "mode": "anchor" | "redirect", "url": "...", "anchorId": "lead-form", "target": "_self" | "_blank" },
      "image": { "mode": "none" | "upload" | "ai-suggested", "url": "[uploaded-media-xxx]", "alt": "string-optionnel" },
      "video": { "url": "https://youtu.be/xxx", "provider": "youtube" },
      "visible": true
    }
  ],
  "thankYouPage": { "headline": "...", "body": "...", "cta": {...} },
  "emails": [],
  "seo": { "title": "...", "description": "..." },
  "design": { "primaryColor": "#hex", "secondaryColor": "#hex", "accentColor": "#hex", "style": "premium" }
}`,
      en: `EXPECTED JSON STRUCTURE (respond ONLY with this JSON):
{
  "funnelName": "string",
  "language": "fr" | "en" | "es",
  "sections": [...],
  "thankYouPage": {...},
  "emails": [],
  "seo": {...},
  "design": {...}
}`,
      es: `ESTRUCTURA JSON ESPERADA (responde SOLO con este JSON):
{
  "funnelName": "string",
  "language": "fr" | "en" | "es",
  "sections": [...],
  "thankYouPage": {...},
  "emails": [],
  "seo": {...},
  "design": {...}
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
        "- N'AJOUTE AUCUNE autre section.",
        "- N'OMETS AUCUNE section listée.",
      ].join("\n"),
      en: [
        "",
        "IMPORTANT RULES:",
        "- Generate EXACTLY these sections, in this order.",
        "- Do NOT ADD any other section.",
        "- Do NOT OMIT any listed section.",
      ].join("\n"),
      es: [
        "",
        "REGLAS IMPORTANTES:",
        "- Genera EXACTAMENTE estas secciones en este orden.",
        "- NO AÑADAS otra sección.",
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
        "- Écris en " + langName(lang) + " uniquement.",
        "- Pas d'emoji.",
        "- Pas de hype. Reste concret et crédible.",
        "- Phrases courtes et claires. Bénéfices concrets.",
        "- Cible le lecteur en \"vous\".",
      ].join("\n"),
      en: [
        "WRITING STYLE:",
        "- Write in " + langName(lang) + " only.",
        "- No emoji.",
        "- No hype. Stay concrete and credible.",
        "- Short, clear sentences.",
      ].join("\n"),
      es: [
        "ESTILO DE ESCRITURA:",
        "- Escribe en " + langName(lang) + " solamente.",
        "- Sin emoji.",
        "- Sin hype. Sé concreto y creíble.",
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
      en: "PRIORITY EXPORT TARGET: systeme.io.",
      es: "OBJETIVO DE EXPORTACIÓN PRIORITARIO: systeme.io.",
    },
    lang,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FRAMEWORKS DE COPYWRITING
// ─────────────────────────────────────────────────────────────────────────────

const FRAMEWORK_DESCRIPTIONS: Record<CopywritingFramework, { fr: string; en: string; es: string }> = {
  AIDA: {
    fr: "AIDA (Attention → Intérêt → Désir → Action) : hero accrocheur qui capte l'attention en 3 secondes, sections suivantes qui développent l'intérêt par les bénéfices concrets, créent le désir via preuves sociales et résultats tangibles, puis CTA clair et unique.",
    en: "AIDA (Attention → Interest → Desire → Action): hook in 3 seconds in the hero, build interest via concrete benefits, create desire through social proof and tangible results, then end with one clear CTA.",
    es: "AIDA (Atención → Interés → Deseo → Acción): gancho en 3 segundos, beneficios concretos, deseo mediante prueba social, CTA único y claro.",
  },
  PAS: {
    fr: "PAS (Problème → Agitation → Solution) : commencer par nommer précisément le problème du prospect, amplifier la douleur et les conséquences de l'inaction, puis présenter la solution comme le chemin évident.",
    en: "PAS (Problem → Agitation → Solution): name the prospect's exact problem, agitate the pain and consequences of inaction, then introduce the solution as the obvious path.",
    es: "PAS (Problema → Agitación → Solución): nombrar el problema, amplificar el dolor, presentar la solución.",
  },
  "PAS-FOMO": {
    fr: "PAS + FOMO : structure PAS classique enrichie d'une urgence réelle (replay disponible 48h, places limitées, bonus expirant). Le ton doit créer la crainte de manquer l'opportunité sans tomber dans le mensonge.",
    en: "PAS + FOMO: classic PAS structure enhanced with real urgency (48h replay window, limited seats, expiring bonus). Create fear of missing out without lying.",
    es: "PAS + FOMO: estructura PAS con urgencia real (replay limitado, plazas limitadas).",
  },
  "4P": {
    fr: "4P (Picture → Promise → Proof → Push) : peindre une image vivante de la transformation, faire une promesse claire et mesurable, prouver par des résultats vérifiables, pousser à l'action.",
    en: "4P (Picture → Promise → Proof → Push): paint a vivid picture of the transformation, make a clear measurable promise, prove with verifiable results, push to action.",
    es: "4P (Imagen → Promesa → Prueba → Empuje): imagen vívida, promesa medible, prueba verificable, empuje a la acción.",
  },
  BAB: {
    fr: "BAB (Before → After → Bridge) : décrire la situation actuelle douloureuse du prospect (Before), montrer la situation rêvée après transformation (After), puis présenter la méthode/offre comme le pont entre les deux (Bridge).",
    en: "BAB (Before → After → Bridge): describe the painful current state, the dreamed future state, and present the offer as the bridge.",
    es: "BAB (Antes → Después → Puente): situación actual dolorosa, situación soñada, oferta como puente.",
  },
  FAB: {
    fr: "FAB (Features → Advantages → Benefits) : pour chaque caractéristique, expliquer l'avantage technique puis traduire en bénéfice émotionnel concret.",
    en: "FAB (Features → Advantages → Benefits): for each feature, explain the advantage and translate into a concrete emotional benefit.",
    es: "FAB (Características → Ventajas → Beneficios): para cada característica, ventaja técnica y beneficio emocional.",
  },
  REASSURANCE: {
    fr: "RASSURANCE : confirmer immédiatement que l'action est bien enregistrée, valoriser la décision prise, rappeler ce qui va se passer et lever toute anxiété résiduelle. Ton chaleureux, jamais commercial.",
    en: "REASSURANCE: immediately confirm the action is registered, validate the decision, recap what happens next, remove residual anxiety. Warm tone, never salesy.",
    es: "TRANQUILIDAD: confirmar la acción, validar la decisión, explicar los próximos pasos, tono cálido.",
  },
  "NEXT-STEPS": {
    fr: "NEXT-STEPS : liste numérotée et actionnable de ce que le prospect doit faire maintenant. Chaque étape doit être concrète, courte et orientée action.",
    en: "NEXT-STEPS: numbered actionable list of what the prospect must do now. Each step concrete, short, action-oriented.",
    es: "PRÓXIMOS PASOS: lista numerada accionable, cada paso corto y concreto.",
  },
  STAR: {
    fr: "STAR (Situation → Task → Action → Result) : idéal pour les études de cas et témoignages détaillés.",
    en: "STAR (Situation → Task → Action → Result): ideal for case studies and detailed testimonials.",
    es: "STAR (Situación → Tarea → Acción → Resultado): casos de estudio detallados.",
  },
  QUEST: {
    fr: "QUEST (Qualify → Understand → Educate → Stimulate → Transition) : qualifier l'audience dès le hero, comprendre sa douleur, éduquer, stimuler le désir, transitionner vers l'offre.",
    en: "QUEST (Qualify → Understand → Educate → Stimulate → Transition).",
    es: "QUEST (Calificar → Comprender → Educar → Estimular → Transicionar).",
  },
  "SCARCITY-URGENCY": {
    fr: "RARETÉ + URGENCE : intégrer des éléments d'urgence légitime (compte à rebours réel, places restantes, deadline de bonus). Toujours basé sur des faits vrais.",
    en: "SCARCITY + URGENCY: integrate legitimate urgency (real countdown, remaining seats, bonus deadline). Always fact-based.",
    es: "ESCASEZ + URGENCIA: urgencia legítima basada en hechos reales.",
  },
};

export function copywritingFrameworkBlock(
  funnelKind: FunnelKind,
  role: PageRole,
  language: Language = "fr",
): string {
  const frameworks = getCopywritingFrameworks(funnelKind, role);
  if (frameworks.length === 0) return "";

  const lang: Language = language === "en" || language === "es" ? language : "fr";

  const heading =
    lang === "en" ? "COPYWRITING FRAMEWORKS TO APPLY (mandatory)"
    : lang === "es" ? "FRAMEWORKS DE COPYWRITING A APLICAR (obligatorio)"
    : "FRAMEWORKS DE COPYWRITING À APPLIQUER (obligatoire)";

  const principal = frameworks[0];
  const secondary = frameworks.slice(1);

  const principalLabel =
    lang === "en" ? "PRIMARY framework"
    : lang === "es" ? "Framework PRINCIPAL"
    : "Framework PRINCIPAL";

  const secondaryLabel =
    lang === "en" ? "Secondary frameworks to layer in"
    : lang === "es" ? "Frameworks secundarios complementarios"
    : "Frameworks secondaires à combiner";

  const lines: string[] = [];
  lines.push(`## ${heading}`);
  lines.push("");
  lines.push(`**${principalLabel}: ${principal}**`);
  lines.push(FRAMEWORK_DESCRIPTIONS[principal][lang]);

  if (secondary.length > 0) {
    lines.push("");
    lines.push(`**${secondaryLabel}: ${secondary.join(", ")}**`);
    for (const f of secondary) {
      lines.push(`- ${f}: ${FRAMEWORK_DESCRIPTIONS[f][lang]}`);
    }
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// RÈGLE STRICTE : hero ≤ 1 média
// ─────────────────────────────────────────────────────────────────────────────

export function heroSingleMediaBlock(
  funnelKind: FunnelKind,
  role: PageRole,
  language: Language = "fr",
): string {
  const policy = getHeroMediaPolicy(funnelKind, role);
  const lang: Language = language === "en" || language === "es" ? language : "fr";

  const policyText: Record<typeof policy, { fr: string; en: string; es: string }> = {
    "prefer-video": {
      fr: "Si vous avez à la fois une vidéo et une image disponibles, placez UNIQUEMENT la vidéo dans le hero. L'image doit aller dans une section `about`, `proof` ou `testimonials` séparée.",
      en: "If both a video and an image are available, place ONLY the video in the hero. The image must go into a separate `about`, `proof` or `testimonials` section.",
      es: "Si hay vídeo e imagen, solo el vídeo va en el hero. La imagen en una sección `about`, `proof` o `testimonials`.",
    },
    "prefer-image": {
      fr: "Si vous avez à la fois une vidéo et une image disponibles, placez UNIQUEMENT l'image dans le hero. La vidéo doit aller dans une section `video` séparée placée juste après le hero.",
      en: "If both a video and an image are available, place ONLY the image in the hero. The video must go into a separate `video` section right after the hero.",
      es: "Si hay vídeo e imagen, solo la imagen va en el hero. El vídeo en una sección `video` separada.",
    },
    "single-only": {
      fr: "Le hero ne doit contenir qu'UN SEUL média maximum (image OU vidéo, jamais les deux). Si plusieurs médias sont disponibles, gardez le plus pertinent et placez les autres dans des sections appropriées.",
      en: "The hero must contain AT MOST ONE media (image OR video, never both). Place additional medias in appropriate sections.",
      es: "El hero contiene como máximo UN media. Otros medias van en secciones apropiadas.",
    },
  };

  const heading =
    lang === "en" ? "STRICT RULE — HERO MEDIA"
    : lang === "es" ? "REGLA ESTRICTA — MEDIA DEL HERO"
    : "RÈGLE STRICTE — MÉDIA DU HERO";

  return [
    `## ${heading}`,
    "",
    `⚠️ ${policyText[policy][lang]}`,
    "",
    lang === "en"
      ? "This rule is non-negotiable. A hero with both an image and a video creates visual overlap and is unprofessional."
      : lang === "es"
        ? "Esta regla no es negociable. Un hero con imagen y vídeo crea solapamiento visual y no es profesional."
        : "Cette règle est non-négociable. Un hero contenant à la fois une image et une vidéo crée un chevauchement visuel et n'est pas professionnel.",
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 1 : Funnel complet (legacy single-page)
// ─────────────────────────────────────────────────────────────────────────────

export function completeFunnelPrompt(brief: FunnelBrief): string {
  const lang = brief.language;
  const kind = brief.funnelKind;
  const homeRole = kind ? getHomeRoleForKind(kind) : undefined;

  const frameworkBlock = kind && homeRole ? copywritingFrameworkBlock(kind, homeRole, lang) : "";
  const heroRule = kind && homeRole ? heroSingleMediaBlock(kind, homeRole, lang) : "";

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
    frameworkBlock,
    "",
    heroRule,
    "",
    mediasBlock(brief.medias as MediaInput[] | undefined, lang),
    "",
    noInventedFilenamesBlock(lang),
    "",
    briefVideoBlock(brief.videoUrl, lang, false),
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
        es: `Eres un copywriter experto. Inspírate SOLO en la ESTRUCTURA de la página de abajo para generar un embudo ORIGINAL en ${langName(lang)} para la marca ${brief.brandName}.`,
      },
      lang,
    ),
    "",
    tr(
      {
        fr: "INTERDICTIONS : Ne copie aucun texte exact. Reformule TOUT.",
        en: "FORBIDDEN: Do not copy any phrase verbatim. Rewrite EVERYTHING.",
        es: "PROHIBIDO: No copies ninguna frase. Reformula TODO.",
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
        en: `You are an email marketing expert. Generate a sequence of 3 nurturing emails in ${langName(lang)} for the offer ${brief.offerName}.`,
        es: `Eres un experto en email marketing. Genera 3 emails de nurturing en ${langName(lang)} para la oferta ${brief.offerName}.`,
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
          "1. Email J+0 : remerciement + livraison de la ressource.",
          "2. Email J+2 : storytelling, contexte du problème.",
          "3. Email J+5 : présentation de l'offre payante avec CTA clair.",
        ].join("\n"),
        en: [
          "STRUCTURE OF THE 3 EMAILS:",
          "1. Day 0: thank you + resource delivery.",
          "2. Day 2: storytelling, problem context.",
          "3. Day 5: paid offer presentation with clear CTA.",
        ].join("\n"),
        es: [
          "ESTRUCTURA:",
          "1. Día 0: agradecimiento + entrega.",
          "2. Día 2: storytelling, contexto del problema.",
          "3. Día 5: presentación de la oferta de pago.",
        ].join("\n"),
      },
      lang,
    ),
    "",
    antiHypeBlock(lang),
    "",
    tr(
      {
        fr: `Réponds avec un JSON : { "emails": [ {"subject":"...","html":"...","text":"...","cta":{...}}, ... ] }`,
        en: `Reply with a JSON: { "emails": [ ... ] }`,
        es: `Responde con un JSON: { "emails": [ ... ] }`,
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
      fr: `Génère un mapping d'export systeme.io pour le tunnel "${funnelName}".`,
      en: `Generate a systeme.io export mapping for the funnel "${funnelName}".`,
      es: `Genera un mapeo de exportación systeme.io para el embudo "${funnelName}".`,
    },
    lang,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 6 : Page principale (multi-pages)
// ─────────────────────────────────────────────────────────────────────────────

export function mainPagePrompt(args: {
  brand: string;
  offer: string;
  audience?: string;
  funnelKind: FunnelKind;
  language?: Language;
  medias?: MediaInput[];
  cta?: { primary?: string; secondary?: string };
  extraContext?: string;
  /** 🆕 URL vidéo principale du brief (sera injectée comme section video) */
  videoUrl?: string;
  /** 🆕 Brief complet pour activer les blocs richSections + strictSectionRequirements */
  brief?: FunnelBrief;
}): string {
  const lang: Language = args.language || "fr";
  const langLabel =
    lang === "en" ? "English" : lang === "es" ? "Spanish" : "French";

  const homeRole = getHomeRoleForKind(args.funnelKind);
  const bp = getPageBlueprint(args.funnelKind, homeRole);
  const recommendedSections = bp?.defaultSectionTypes.join(", ") || "hero, benefits, testimonials, cta";
  const minSections = bp?.minSections ?? 5;

  const briefDrivenBlocks = args.brief
    ? "\n" + strictSectionRequirementsBlock(lang) + "\n\n" + richSectionsBlock(args.brief) + "\n"
    : "";

  return `# Génération de la page principale du tunnel

## Contexte
- Marque : ${args.brand}
- Offre : ${args.offer}
${args.audience ? `- Audience : ${args.audience}` : ""}
- Type de tunnel : ${args.funnelKind}
- Rôle de page : ${homeRole}
- Langue : ${langLabel}

## Sections recommandées
${recommendedSections} (minimum ${minSections} sections riches)

${copywritingFrameworkBlock(args.funnelKind, homeRole, lang)}

${heroSingleMediaBlock(args.funnelKind, homeRole, lang)}

${roleSemanticsBlock([homeRole], lang)}

${mediasBlock(args.medias, lang)}

${noInventedFilenamesBlock(lang)}

${briefVideoBlock(args.videoUrl, lang, false)}

${briefDrivenBlocks}

## Règle de titre
Le titre du hero doit être une **promesse claire et spécifique** orientée résultat pour l'audience. Pas de slogan vague. Maximum 12 mots.

${args.extraContext || ""}

## Format de sortie
Objet JSON strict avec la clé \`sections\`. Aucun texte hors JSON.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 7 : Pages secondaires
// ─────────────────────────────────────────────────────────────────────────────

export function secondaryPagesPrompt(args: {
  brand: string;
  offer: string;
  funnelKind: FunnelKind;
  language?: Language;
  pages: Array<{ role: PageRole; slug: string; name: string }>;
  medias?: MediaInput[];
  cta?: { primary?: string; secondary?: string };
  extraContext?: string;
  /** 🆕 URL vidéo principale du brief */
  videoUrl?: string;
  /** 🆕 Brief complet pour activer les blocs richSections + strictSectionRequirements */
  brief?: FunnelBrief;
}): string {
  const lang: Language = args.language || "fr";
  const langLabel =
    lang === "en" ? "English" : lang === "es" ? "Spanish" : "French";

  const pagesDescription = args.pages
    .map((p) => {
      const bp = getPageBlueprint(args.funnelKind, p.role);
      const sections = bp?.defaultSectionTypes.join(", ") || "hero, cta";
      const minSections = bp?.minSections ?? 3;
      return `- **${p.role}** (slug: \`${p.slug}\`) — sections recommandées : ${sections} — minimum ${minSections} sections`;
    })
    .join("\n");

  const frameworksByPage = args.pages
    .map((p) => {
      const block = copywritingFrameworkBlock(args.funnelKind, p.role, lang);
      const heroRule = heroSingleMediaBlock(args.funnelKind, p.role, lang);
      return `\n---\n### Instructions pour la page \`${p.role}\`\n\n${block}\n\n${heroRule}`;
    })
    .join("\n");

  const roles = args.pages.map((p) => p.role as string);

  const briefDrivenBlocks = args.brief
    ? "\n" + strictSectionRequirementsBlock(lang) + "\n\n" + richSectionsBlock(args.brief) + "\n"
    : "";

  return `# Génération des pages secondaires du tunnel

## Contexte
- Marque : ${args.brand}
- Offre : ${args.offer}
- Type de tunnel : ${args.funnelKind}
- Langue de rédaction : ${langLabel}

## Pages à générer
${pagesDescription}

## ⚠️ RÈGLE DE TITRES (CRITIQUE)
Les **titres de hero** des pages secondaires NE DOIVENT JAMAIS contenir le nom de la marque ni un format générique du type "${args.brand} — Page de X" ou "Page de X".

❌ INTERDIT : "${args.brand} — Page de replay", "Page de confirmation", "ABA — Merci"
✅ ATTENDU : "Votre place est réservée", "Le replay est disponible (48h)", "On a bien reçu votre candidature", "Votre ressource vous attend"

Le titre doit être **orienté bénéfice ou état du prospect**, écrit comme un message direct à la 2e personne, sans préfixe de marque.

${roleSemanticsBlock(roles, lang)}

${frameworksByPage}

${mediasBlock(args.medias, lang)}

${noInventedFilenamesBlock(lang)}

${briefVideoBlock(args.videoUrl, lang, true)}

${briefDrivenBlocks}

${args.extraContext || ""}

## Format de sortie
Retournez UNIQUEMENT un objet JSON valide :
\`\`\`json
{
  "pages": [
    {
      "role": "confirmation",
      "slug": "confirmation",
      "title": "Votre place est réservée",
      "sections": [ /* sections selon la whitelist */ ]
    }
  ]
}
\`\`\`

Aucun texte hors JSON. Pas de markdown autour. Pas de commentaires.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports utilitaires
// ─────────────────────────────────────────────────────────────────────────────

export { whitelistBlock };
