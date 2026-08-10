// lib/ai/prompts.ts
import type {
  FunnelBrief,
  FunnelSection,
  Language,
  CopywritingPrefs,
  FunnelKind,
  PageRole,
} from "@/lib/funnels/types";
import type { SequenceType, SequenceRole, TunnelContext } from "@/lib/crm/types";
import type { PageBlueprint } from "@/lib/funnels/pageCatalogs";
import {
  getPageBlueprint,
  getCopywritingFrameworks,
  getHeroMediaPolicy,
  type CopywritingFramework,
} from "@/lib/funnels/pageCatalogs";
// 🆕 Défaut de durée du challenge, PARTAGÉ avec le générateur : le copywriting
// doit annoncer exactement le nombre de pages « Jour N » réellement produites.
import { resolveChallengeDays } from "@/lib/funnels/challenge";

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

  // 🆕 R4 — Durée du challenge dans le copywriting.
  //
  // `challengeDays` pilotait la GÉNÉRATION des pages (une par jour) mais
  // n'était jamais transmis au rédactionnel : la landing d'un challenge de
  // 7 jours ne mentionnait nulle part « 7 jours », alors que la durée est
  // justement l'argument de vente central de ce format.
  //
  // 🆕 D — La condition testait `brief.challengeDays` en truthy : un brief sans
  // durée explicite (parcours Express IA, ou champ jamais affiché) ne poussait
  // AUCUNE ligne de durée, pendant que le générateur produisait quand même
  // `DEFAULT_CHALLENGE_DAYS` pages « Jour N ». La landing annonçait donc autre
  // chose que le tunnel livré. On résout la durée avec la MÊME fonction que le
  // générateur : les deux ne peuvent plus diverger.
  if (brief.funnelKind === "challenge") {
    const challengeDays = resolveChallengeDays(brief.challengeDays);
    if (challengeDays > 1) {
      lines.push(
        tr(
          {
            fr: `- Durée du challenge : ${challengeDays} jours. MENTIONNE explicitement cette durée dans le titre principal et les bénéfices (ex. « en ${challengeDays} jours »). C'est l'argument central de ce format.`,
            en: `- Challenge duration: ${challengeDays} days. EXPLICITLY mention this duration in the headline and benefits (e.g. "in ${challengeDays} days"). It is the core selling point of this format.`,
            es: `- Duración del reto: ${challengeDays} días. MENCIONA explícitamente esta duración en el titular y los beneficios (ej. «en ${challengeDays} días»). Es el argumento central de este formato.`,
          },
          lang,
        ),
      );
    }
  }

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
        "   - ACCENT COULEUR : entoure 1 à 2 mots/groupes les plus FORTS de la headline (et au besoin de la subheadline) avec [[ ]], ex. \"Doublez vos [[résultats]] en [[30 jours]]\". N'utilise PAS de couleur (#hex) : la syntaxe [[mot]] reprend automatiquement la couleur du template. Maximum 2 par champ, jamais sur toute la phrase.",
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
        "   - COLOR ACCENT: wrap the 1-2 STRONGEST words/phrases of the headline (and subheadline if useful) with [[ ]], e.g. \"Double your [[results]] in [[30 days]]\". Do NOT add a color (#hex): the [[word]] syntax automatically inherits the template color. Max 2 per field, never the whole sentence.",
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
        "   - ACENTO DE COLOR: envuelve 1-2 palabras/grupos más FUERTES del headline (y del subheadline si conviene) con [[ ]], ej. \"Duplica tus [[resultados]] en [[30 días]]\". NO uses color (#hex): la sintaxis [[palabra]] hereda automáticamente el color de la plantilla. Máx 2 por campo, nunca toda la frase.",
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

/**
 * 🆕 Types de tunnels dont la page « merci » suit un ACHAT (et non un opt-in
 * gratuit). La règle sémantique du rôle `thankyou` doit alors parler de
 * commande et d'accès produit, jamais de « lead magnet envoyé par email ».
 */
const PAID_FUNNEL_KINDS: ReadonlySet<string> = new Set([
  "digital-product",
  "coaching-high-ticket",
  "vsl",
  "formation",
  "saas",
]);

function roleSemanticsBlock(
  roles: string[],
  lang: Language,
  funnelKind?: FunnelKind,
): string {
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
      "- C'est la DERNIÈRE page du tunnel : il n'existe AUCUNE page de téléchargement après. La ressource arrive par email (ou via un lien externe ajouté par le créateur).",
      "- INTERDIT ABSOLU : CTA \"Télécharger maintenant\" (le guide arrive par email, pas via la page).",
      "- CTA principal RECOMMANDÉ : { \"label\": \"Ouvrir ma boîte Gmail\", \"mode\": \"redirect\", \"url\": \"https://mail.google.com\", \"target\": \"_blank\" }",
      "- UN SEUL bouton sur la page : ne répète pas la même action dans le hero ET dans la section CTA.",
      "- Body doit expliquer : (1) l'email arrive dans les 2 minutes, (2) vérifier les spams, (3) ajouter l'expéditeur aux contacts.",
    ],
    delivery: [
      "Rôle \"delivery\" : page de livraison DIRECTE du produit/ressource (rôle LEGACY, conservé pour les anciens tunnels).",
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

  // 🆕 Tunnel PAYANT : la page « merci » suit un achat, pas un opt-in gratuit.
  // Sans cette variante, une vente de produit digital héritait de la règle du
  // lead magnet (« le lead magnet est ENVOYÉ PAR EMAIL », « Ouvrir ma boîte
  // Gmail ») — copy incohérent avec une commande payée.
  if (funnelKind && PAID_FUNNEL_KINDS.has(funnelKind)) {
    rulesFr.thankyou = [
      "Rôle \"thankyou\" : page de remerciement APRÈS ACHAT. C'est la DERNIÈRE page du tunnel.",
      "- Il n'existe AUCUNE page d'accès/téléchargement après : l'accès au produit arrive par email, ou via un lien que le créateur ajoute lui-même sur CETTE page.",
      "- INTERDIT : reproposer l'achat, reproduire un formulaire de commande, ou promettre une page de téléchargement.",
      "- Body doit expliquer : (1) la commande est confirmée, (2) l'email d'accès arrive dans les minutes qui suivent, (3) vérifier les spams.",
      "- UN SEUL bouton sur la page : ne répète pas la même action dans le hero ET dans la section CTA.",
    ];
  }

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

/**
 * 🆕 LOT 6 — Guidage prix pour la page "oto" en contexte lead-magnet
 * (tripwire) : le prix doit rester dans la fourchette 7-27€, cohérent avec un
 * achat impulsif juste après une inscription gratuite (pas le prix de l'offre
 * principale). Vide pour tout autre kind/role.
 */
function otoPricingGuidanceBlock(
  funnelKind: FunnelKind,
  role: PageRole,
  lang: Language,
): string {
  if (role !== "oto" || funnelKind !== "lead-magnet") return "";
  return (
    "\n\n" +
    tr(
      {
        fr: "⚠️ TRIPWIRE : cette page propose une PETITE offre complémentaire à prix réduit (entre 7€ et 27€), pensée pour un achat impulsif juste après l'inscription gratuite — ce n'est PAS l'offre principale. N'invente jamais un prix hors de cette fourchette.",
        en: "⚠️ TRIPWIRE: this page offers a SMALL complementary offer at a low price (between $7 and $27), designed for an impulse buy right after the free opt-in — this is NOT the main offer. Never invent a price outside this range.",
        es: "⚠️ TRIPWIRE: esta página ofrece una PEQUEÑA oferta complementaria a precio reducido (entre 7€ y 27€), pensada para una compra impulsiva justo después de la inscripción gratuita — NO es la oferta principal. Nunca inventes un precio fuera de este rango.",
      },
      lang,
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloc : TON & VOCABULAIRE par type de tunnel
// Le framework fixe la STRUCTURE ; ce bloc fixe le REGISTRE, les verbes d'action
// autorisés/interdits, le niveau de pression commerciale et les mots-clés de CTA.
// Empêche qu'un lead magnet gratuit reçoive le même ton qu'une offre payante.
// ─────────────────────────────────────────────────────────────────────────────

const TONE_RULES: Partial<Record<FunnelKind, { fr: string; en: string; es: string }>> = {
  "lead-magnet": {
    fr: "Registre : chaleureux, généreux, ZÉRO pression commerciale (c'est GRATUIT). Verbes autorisés : recevez, téléchargez, accédez, obtenez gratuitement. INTERDITS : achetez, investissez, commandez, payez, réservez. Pression commerciale : NULLE — aucun prix, aucune fausse urgence agressive. CTA type : « Recevoir le guide gratuit », « Télécharger maintenant », « Je veux mon accès gratuit ».",
    en: "Register: warm, generous, ZERO sales pressure (it's FREE). Allowed verbs: get, download, access, grab for free. FORBIDDEN: buy, invest, order, pay, book. Sales pressure: NONE — no price, no aggressive fake urgency. CTA style: “Get the free guide”, “Download now”, “I want my free access”.",
    es: "Registro: cálido, generoso, CERO presión comercial (es GRATIS). Verbos permitidos: recibe, descarga, accede, obtén gratis. PROHIBIDOS: compra, invierte, paga, reserva. Presión comercial: NULA — sin precio ni urgencia falsa. CTA: «Recibir la guía gratis», «Descargar ahora», «Quiero mi acceso gratis».",
  },
  "digital-product": {
    fr: "Registre : orienté valeur et transformation, vente ASSUMÉE mais honnête. Verbes : obtenez, accédez, débloquez, procurez-vous, rejoignez. Pression commerciale : MODÉRÉE — prix visible, garantie, bonus, valeur perçue. CTA type : « Obtenir l'accès », « Je veux la formation », « Débloquer maintenant ».",
    en: "Register: value- and transformation-driven, sales OWNED but honest. Verbs: get, access, unlock, grab, join. Sales pressure: MODERATE — visible price, guarantee, bonuses, perceived value. CTA style: “Get access”, “I want the course”, “Unlock now”.",
    es: "Registro: orientado a valor y transformación, venta ASUMIDA pero honesta. Verbos: obtén, accede, desbloquea, únete. Presión comercial: MODERADA — precio visible, garantía, bonos. CTA: «Obtener acceso», «Quiero la formación», «Desbloquear ahora».",
  },
  webinar: {
    fr: "Registre : crédibilité, anticipation, exclusivité de la session. Verbes : inscrivez-vous, réservez votre place, rejoignez. Pression commerciale : rareté RÉELLE (places/horaire), jamais de vente dure. CTA type : « Réserver ma place », « Je m'inscris », « Garder ma place ».",
    en: "Register: credibility, anticipation, session exclusivity. Verbs: register, save your seat, join. Sales pressure: REAL scarcity (seats/time), never hard-sell. CTA style: “Save my seat”, “Register now”, “Hold my spot”.",
    es: "Registro: credibilidad, anticipación, exclusividad de la sesión. Verbos: regístrate, reserva tu plaza, únete. Presión: escasez REAL (plazas/horario), nunca venta dura. CTA: «Reservar mi plaza», «Me inscribo», «Guardar mi lugar».",
  },
  booking: {
    fr: "Registre : autorité, simplicité, posture de conseil — JAMAIS de hard-sell. Verbes : réservez, planifiez, prenez rendez-vous, échangeons. Pression commerciale : FAIBLE — valoriser l'appel découverte sans engagement. CTA type : « Réserver mon appel », « Planifier un échange », « Prendre rendez-vous ».",
    en: "Register: authority, simplicity, advisory stance — NEVER hard-sell. Verbs: book, schedule, set up a call, let's talk. Sales pressure: LOW — highlight the no-commitment discovery call. CTA style: “Book my call”, “Schedule a chat”, “Get on a call”.",
    es: "Registro: autoridad, simplicidad, postura de asesor — NUNCA venta dura. Verbos: reserva, agenda, hablemos. Presión: BAJA — destacar la llamada sin compromiso. CTA: «Reservar mi llamada», «Agendar una charla», «Pedir cita».",
  },
  "coaching-high-ticket": {
    fr: "Registre : statut, exclusivité, transformation profonde, SÉLECTIF. Verbes : candidatez, postulez, réservez un appel de qualification, rejoignez le programme. ÉVITER tout langage promo/discount. Pression commerciale : exclusivité et qualification (places limitées RÉELLES), jamais de rabais. CTA type : « Candidater », « Postuler au programme », « Réserver mon appel de qualification ».",
    en: "Register: status, exclusivity, deep transformation, SELECTIVE. Verbs: apply, request a qualification call, join the program. AVOID promo/discount language. Sales pressure: exclusivity and qualification (REAL limited spots), never discounts. CTA style: “Apply now”, “Apply to the program”, “Book my qualification call”.",
    es: "Registro: estatus, exclusividad, transformación profunda, SELECTIVO. Verbos: postula, solicita una llamada de calificación, únete al programa. EVITAR lenguaje promo/descuento. Presión: exclusividad y calificación (plazas REALMENTE limitadas). CTA: «Postular», «Aplicar al programa», «Reservar mi llamada».",
  },
  challenge: {
    fr: "Registre : énergique, motivant, communauté et momentum. Verbes : rejoignez, relevez le défi, participez, inscrivez-vous. Pression commerciale : urgence RÉELLE de la date de lancement, enthousiasme collectif. CTA type : « Je relève le défi », « Rejoindre le challenge », « Je m'inscris ».",
    en: "Register: energetic, motivating, community and momentum. Verbs: join, take the challenge, participate, sign up. Sales pressure: REAL launch-date urgency, collective enthusiasm. CTA style: “I'm in”, “Join the challenge”, “Sign me up”.",
    es: "Registro: enérgico, motivador, comunidad y momentum. Verbos: únete, acepta el reto, participa, inscríbete. Presión: urgencia REAL de la fecha de lanzamiento. CTA: «Acepto el reto», «Unirme al reto», «Me inscribo».",
  },
};

export function toneAndVocabularyBlock(kind: FunnelKind | undefined, lang: Language): string {
  if (!kind) return "";
  const rules = TONE_RULES[kind];
  if (!rules) return ""; // kind legacy/inconnu → on laisse le framework décider
  const header = tr(
    {
      fr: "TON & VOCABULAIRE (impératif — adapter le registre au type de tunnel) :",
      en: "TONE & VOCABULARY (mandatory — match the register to the funnel type):",
      es: "TONO Y VOCABULARIO (obligatorio — adapta el registro al tipo de embudo):",
    },
    lang,
  );
  return `${header}\n${tr(rules, lang)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 1 : Funnel complet (legacy single-page)
// ─────────────────────────────────────────────────────────────────────────────

export function completeFunnelPrompt(brief: FunnelBrief): string {
  const lang = brief.language;
  const kind = brief.funnelKind;
  const homeRole = kind ? getHomeRoleForKind(kind) : undefined;

  const frameworkBlock = kind && homeRole ? copywritingFrameworkBlock(kind, homeRole, lang) : "";
  const toneBlock = toneAndVocabularyBlock(kind, lang);
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
    toneBlock,
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
// 🆕 PROMPT — Génération de séquence email (Étape 4), alignée sur un tunnel
// publié quand il est rattaché. Multilingue FR/EN/ES.
// ─────────────────────────────────────────────────────────────────────────────

const SEQUENCE_TYPE_GUIDANCE: Record<SequenceType, Record<Language, string>> = {
  bienvenue: {
    fr: "Séquence de BIENVENUE : accueillir, livrer la ressource/promesse, instaurer la confiance, poser le décor du problème.",
    en: "WELCOME sequence: greet, deliver the resource/promise, build trust, set up the problem.",
    es: "Secuencia de BIENVENIDA: saludar, entregar el recurso/promesa, generar confianza, plantear el problema.",
  },
  nurturing: {
    fr: "Séquence de NURTURING : apporter de la valeur, éduquer sur le problème, prouver l'expertise, amener doucement vers l'offre.",
    en: "NURTURING sequence: give value, educate on the problem, prove expertise, gently lead to the offer.",
    es: "Secuencia de NURTURING: aportar valor, educar sobre el problema, demostrar experiencia, guiar hacia la oferta.",
  },
  relance: {
    fr: "Séquence de RELANCE : réactiver l'intérêt, lever les objections, créer l'urgence, pousser un CTA clair vers la page de vente.",
    en: "FOLLOW-UP sequence: reactivate interest, handle objections, create urgency, push a clear CTA to the sales page.",
    es: "Secuencia de SEGUIMIENTO: reactivar interés, superar objeciones, crear urgencia, CTA claro a la página de venta.",
  },
  offre: {
    fr: "Mail d'OFFRE/CONVERSION : présente l'offre clairement (quoi, pour qui, prix), lève une objection majeure, CTA direct et unique vers l'achat.",
    en: "OFFER/CONVERSION email: present the offer clearly (what, for whom, price), handle one major objection, single direct CTA to purchase.",
    es: "Email de OFERTA/CONVERSIÓN: presenta la oferta claramente (qué, para quién, precio), supera una objeción clave, CTA directo a la compra.",
  },
  temoignage: {
    fr: "Mail de TÉMOIGNAGE/PREUVE SOCIALE : met en avant un ou plusieurs résultats/retours concrets (uniquement ceux fournis dans le contexte, jamais inventés) pour renforcer la crédibilité avant le CTA.",
    en: "TESTIMONIAL/SOCIAL PROOF email: highlight one or more concrete results/reviews (only those provided in context, never invented) to build credibility before the CTA.",
    es: "Email de TESTIMONIO/PRUEBA SOCIAL: destaca resultados/reseñas concretos (solo los proporcionados, nunca inventados) para reforzar la credibilidad antes del CTA.",
  },
  lancement: {
    fr: "Séquence de LANCEMENT produit : teasing, ouverture des inscriptions, preuves, rareté/échéance, fermeture.",
    en: "Product LAUNCH sequence: teasing, cart open, proof, scarcity/deadline, cart close.",
    es: "Secuencia de LANZAMIENTO: teasing, apertura, pruebas, escasez/fecha límite, cierre.",
  },
  reengagement: {
    fr: "Séquence de RÉENGAGEMENT : reconquérir un contact inactif, rappeler la valeur, proposer un nouveau point de départ.",
    en: "RE-ENGAGEMENT sequence: win back an inactive contact, remind the value, offer a fresh start.",
    es: "Secuencia de REACTIVACIÓN: recuperar un contacto inactivo, recordar el valor, ofrecer un nuevo comienzo.",
  },
  autre: {
    fr: "Séquence sur-mesure : suis fidèlement le contexte fourni par l'utilisateur.",
    en: "Custom sequence: follow the user's provided context faithfully.",
    es: "Secuencia personalizada: sigue fielmente el contexto del usuario.",
  },
};

function tunnelContextBlock(tunnel: TunnelContext, lang: Language): string {
  const lines = [
    tr(
      {
        fr: "CONTEXTE DU TUNNEL RATTACHÉ (aligne-toi DESSUS : même offre, même promesse, même problème, même prix, même ton, même langue) :",
        en: "ATTACHED FUNNEL CONTEXT (ALIGN with it: same offer, promise, problem, price, tone, language):",
        es: "CONTEXTO DEL EMBUDO (ALINÉATE: misma oferta, promesa, problema, precio, tono, idioma):",
      },
      lang,
    ),
    `- Offre / Offer: ${tunnel.offerName || "—"}`,
    `- Promesse / Promise: ${tunnel.promise || "—"}`,
    `- Problème / Pain: ${tunnel.mainPain || "—"}`,
    `- Cible / Audience: ${tunnel.targetAudience || "—"}`,
    `- Ton / Tone: ${tunnel.tone || "—"}`,
    `- Prix / Price: ${tunnel.price || "—"}`,
    tunnel.benefits.length ? `- Bénéfices / Benefits: ${tunnel.benefits.join(" · ")}` : "",
    tunnel.bonuses.length ? `- Bonus: ${tunnel.bonuses.join(" · ")}` : "",
    tunnel.guarantee ? `- Garantie / Guarantee: ${tunnel.guarantee}` : "",
    // 🆕 LOT 4 — Contexte webinaire : permet aux emails générés (rappels,
    // relance post-webinaire) de citer la bonne date et le bon lien.
    tunnel.webinarDate
      ? tr(
          {
            fr: `- Date du webinaire : ${tunnel.webinarDate} → utilise-la pour les rappels ("dans 24h", "demain à 19h"...).`,
            en: `- Webinar date: ${tunnel.webinarDate} → use it for reminders ("in 24h", "tomorrow at 7pm"...).`,
            es: `- Fecha del webinar: ${tunnel.webinarDate} → úsala para los recordatorios.`,
          },
          lang,
        )
      : "",
    tunnel.webinarExternalLink
      ? tr(
          {
            fr: `- Lien de connexion au webinaire : ${tunnel.webinarExternalLink} → insère-le dans l'email de rappel juste avant le direct.`,
            en: `- Webinar connection link: ${tunnel.webinarExternalLink} → include it in the reminder email right before the live session.`,
            es: `- Enlace de conexión al webinar: ${tunnel.webinarExternalLink} → inclúyelo en el recordatorio justo antes del directo.`,
          },
          lang,
        )
      : "",
    // 🆕 LOT 5 — Webinaire Evergreen : pas de date commune, chaque email doit
    // parler de manière RELATIVE à l'inscription du destinataire.
    tunnel.webinarMode === "evergreen"
      ? tr(
          {
            fr: `- Ce webinaire est en mode AUTOMATISÉ (Evergreen) : chaque prospect choisit son propre créneau et vit sa propre session. N'invente et ne cite JAMAIS de date fixe. Parle de manière RELATIVE à SON inscription ("juste après ton inscription", "ta session débute bientôt", "ton accès expire dans quelques heures"...).`,
            en: `- This webinar is AUTOMATED (Evergreen): each prospect picks their own time slot and gets their own session. NEVER invent or mention a fixed date. Speak RELATIVE to THEIR registration ("right after you signed up", "your session starts soon", "your access expires in a few hours"...).`,
            es: `- Este webinar es AUTOMATIZADO (Evergreen): cada prospecto elige su propio horario y vive su propia sesión. NUNCA inventes ni menciones una fecha fija. Habla de forma RELATIVA a SU inscripción ("justo después de tu inscripción", "tu sesión empieza pronto", "tu acceso expira en unas horas"...).`,
          },
          lang,
        )
      : "",
    // 🆕 Webinaire — offre vendue APRÈS le webinaire, distincte de l'offre
    // ci-dessus (qui décrit le webinaire lui-même). Permet à l'email de
    // relance/vente post-webinaire de parler du BON produit/prix/promesse.
    tunnel.postWebinarOfferName
      ? tr(
          {
            fr: `- Offre vendue APRÈS le webinaire (DIFFÉRENTE du webinaire ci-dessus, qui est terminé) : "${tunnel.postWebinarOfferName}"${tunnel.postWebinarPrice ? ` — Prix : ${tunnel.postWebinarPrice}` : ""}${tunnel.postWebinarPromise ? ` — Promesse : ${tunnel.postWebinarPromise}` : ""}. Pour l'email de vente/relance post-webinaire, parle de CETTE offre, jamais du webinaire comme s'il restait à vendre.`,
            en: `- Offer sold AFTER the webinar (DIFFERENT from the webinar above, which is over): "${tunnel.postWebinarOfferName}"${tunnel.postWebinarPrice ? ` — Price: ${tunnel.postWebinarPrice}` : ""}${tunnel.postWebinarPromise ? ` — Promise: ${tunnel.postWebinarPromise}` : ""}. For the post-webinar sales/follow-up email, talk about THIS offer, never the webinar as if it were still for sale.`,
            es: `- Oferta vendida DESPUÉS del webinar (DISTINTA del webinar anterior, que ya terminó): "${tunnel.postWebinarOfferName}"${tunnel.postWebinarPrice ? ` — Precio: ${tunnel.postWebinarPrice}` : ""}${tunnel.postWebinarPromise ? ` — Promesa: ${tunnel.postWebinarPromise}` : ""}. Para el email de venta/seguimiento post-webinar, habla de ESTA oferta, nunca del webinar como si aún estuviera en venta.`,
          },
          lang,
        )
      : "",
    // 🆕 LOT 9 — Contexte challenge multi-jours : demande explicitement UNE
    // séquence quotidienne (1 email par jour, Jour 1 à Jour N), plutôt qu'une
    // séquence générique, quand le tunnel a plusieurs pages "jour".
    tunnel.challengeTotalDays && tunnel.challengeTotalDays > 1
      ? tr(
          {
            fr: `- Ce challenge dure ${tunnel.challengeTotalDays} jours (pages "jour-1" à "jour-${tunnel.challengeTotalDays}"). Génère UNE séquence quotidienne : un email par jour (Jour 1, Jour 2, ..., Jour ${tunnel.challengeTotalDays}), qui annonce/rappelle le contenu du jour correspondant, PUIS un dernier email vers le pitch final (offre de clôture).`,
            en: `- This challenge lasts ${tunnel.challengeTotalDays} days (pages "jour-1" to "jour-${tunnel.challengeTotalDays}"). Generate ONE daily sequence: one email per day (Day 1, Day 2, ..., Day ${tunnel.challengeTotalDays}) announcing/recapping that day's content, THEN a final email toward the closing pitch offer.`,
            es: `- Este reto dura ${tunnel.challengeTotalDays} días (páginas "jour-1" a "jour-${tunnel.challengeTotalDays}"). Genera UNA secuencia diaria: un email por día (Día 1, Día 2, ..., Día ${tunnel.challengeTotalDays}) que anuncie/recuerde el contenido de ese día, y LUEGO un último email hacia el pitch final (oferta de cierre).`,
          },
          lang,
        )
      : "",
    tunnel.url
      ? tr(
          {
            fr: `- URL du tunnel : ${tunnel.url} → insère ce lien dans les CTA quand c'est pertinent (ex. relance vers la page de vente).`,
            en: `- Funnel URL: ${tunnel.url} → insert this link in CTAs when relevant (e.g. follow-up to the sales page).`,
            es: `- URL del embudo: ${tunnel.url} → inserta este enlace en los CTA cuando sea pertinente.`,
          },
          lang,
        )
      : tr(
          {
            fr: "- (Tunnel non publié : pas d'URL — n'invente AUCUN lien.)",
            en: "- (Funnel not published: no URL — do NOT invent any link.)",
            es: "- (Embudo no publicado: sin URL — NO inventes ningún enlace.)",
          },
          lang,
        ),
  ];
  return lines.filter(Boolean).join("\n");
}

export function sequenceGenerationPrompt(args: {
  roles: SequenceRole[];
  context: string;
  language: Language;
  tunnel: TunnelContext | null;
}): string {
  const { roles, context, language: lang, tunnel } = args;
  // 🆕 LOT 1 : 1 rôle ajouté par l'utilisateur = 1 mail, DANS L'ORDRE donné.
  // Plus de champ "nombre de mails" séparé : n = roles.length.
  const list = roles.length > 0 ? roles : [{ id: "autre" as SequenceType }];
  const n = Math.max(1, Math.min(10, list.length));

  const roleLine = (r: SequenceRole, i: number): string => {
    const guidance =
      r.id === "autre" && r.label?.trim()
        ? tr(
            {
              fr: `Type personnalisé "${r.label.trim()}" : suis fidèlement cette intention, en cohérence avec le reste de la séquence.`,
              en: `Custom type "${r.label.trim()}": follow this intent faithfully, consistent with the rest of the sequence.`,
              es: `Tipo personalizado "${r.label.trim()}": sigue fielmente esta intención, coherente con el resto de la secuencia.`,
            },
            lang,
          )
        : SEQUENCE_TYPE_GUIDANCE[r.id][lang];
    return `${i + 1}. ${guidance}`;
  };

  return [
    tr(
      {
        fr: `Tu es un expert en email marketing direct-response. Génère une séquence de ${n} email(s) en ${langName(lang)}, COMPOSÉE des rôles suivants, DANS CET ORDRE EXACT (chaque rôle = un email) :`,
        en: `You are a direct-response email marketing expert. Generate a sequence of ${n} email(s) in ${langName(lang)}, MADE of the following roles, IN THIS EXACT ORDER (each role = one email):`,
        es: `Eres un experto en email marketing de respuesta directa. Genera una secuencia de ${n} email(s) en ${langName(lang)}, COMPUESTA por los siguientes roles, EN ESTE ORDEN EXACTO (cada rol = un email):`,
      },
      lang,
    ),
    "",
    list.map(roleLine).join("\n"),
    "",
    tr(
      {
        fr: "Les emails doivent former une PROGRESSION LOGIQUE et cohérente de la relation avec le prospect (chaque email s'appuie sur le précédent, pas de répétition), en respectant STRICTEMENT l'ordre des rôles ci-dessus.",
        en: "The emails must form a LOGICAL, coherent progression of the relationship with the prospect (each email builds on the previous one, no repetition), STRICTLY following the role order above.",
        es: "Los emails deben formar una PROGRESIÓN LÓGICA y coherente de la relación con el prospecto (cada email se apoya en el anterior, sin repetición), respetando ESTRICTAMENTE el orden de roles anterior.",
      },
      lang,
    ),
    "",
    tr(
      {
        fr: `CONTEXTE FOURNI PAR L'UTILISATEUR :\n${context || "(aucun)"}`,
        en: `USER-PROVIDED CONTEXT:\n${context || "(none)"}`,
        es: `CONTEXTO DEL USUARIO:\n${context || "(ninguno)"}`,
      },
      lang,
    ),
    "",
    tunnel ? tunnelContextBlock(tunnel, lang) : "",
    "",
    tr(
      {
        fr: [
          "RÈGLES :",
          "- Parle de la DOULEUR/du problème AVANT la solution.",
          "- N'invente AUCUN chiffre, résultat, témoignage ou promesse non fourni.",
          "- Reste cohérent avec l'offre, le prix, le ton et la langue du tunnel ci-dessus.",
          `- Échelonne les délais : le 1er email à J+0, puis des délais croissants réalistes (ex. J+0, J+2, J+4…), un délai par email.`,
          "- Chaque email : un objet court et accrocheur + un corps clair et orienté action (texte simple, sauts de ligne autorisés).",
        ].join("\n"),
        en: [
          "RULES:",
          "- Address the PAIN/problem BEFORE the solution.",
          "- Do NOT invent any number, result, testimonial or promise not provided.",
          "- Stay consistent with the funnel's offer, price, tone and language above.",
          "- Stagger delays: 1st email at Day 0, then realistic increasing delays (e.g. 0, 2, 4…), one per email.",
          "- Each email: a short catchy subject + a clear action-oriented body (plain text, line breaks allowed).",
        ].join("\n"),
        es: [
          "REGLAS:",
          "- Habla del DOLOR/problema ANTES de la solución.",
          "- NO inventes cifras, resultados, testimonios ni promesas no proporcionados.",
          "- Mantén coherencia con la oferta, precio, tono e idioma del embudo.",
          "- Escalona los retrasos: 1er email en Día 0, luego retrasos crecientes (0, 2, 4…), uno por email.",
          "- Cada email: asunto corto y atractivo + cuerpo claro orientado a la acción.",
        ].join("\n"),
      },
      lang,
    ),
    "",
    antiHypeBlock(lang),
    "",
    tr(
      {
        fr: `Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, de la forme :\n{ "emails": [ { "subject": "...", "body": "...", "delayDays": 0 } ] }\nLe tableau "emails" doit contenir EXACTEMENT ${n} élément(s), "delayDays" est un entier (jours), et le 1er email a delayDays = 0.`,
        en: `Reply ONLY with a valid JSON object, no surrounding text, of the form:\n{ "emails": [ { "subject": "...", "body": "...", "delayDays": 0 } ] }\nThe "emails" array MUST contain EXACTLY ${n} item(s), "delayDays" is an integer (days), and the 1st email has delayDays = 0.`,
        es: `Responde SOLO con un objeto JSON válido, sin texto alrededor:\n{ "emails": [ { "subject": "...", "body": "...", "delayDays": 0 } ] }\nEl array "emails" debe contener EXACTAMENTE ${n} elemento(s), "delayDays" es un entero (días), y el 1.º tiene delayDays = 0.`,
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
// 🆕 Sous-étape B : bloc « À propos » — injecte le texte saisi par l'utilisateur
// dans le prompt pour que l'IA l'EXPLOITE dans la section about (Présentation/
// Autorité). Auparavant aboutText n'était jamais transmis à l'IA.
// ─────────────────────────────────────────────────────────────────────────────
export function authorAboutBlock(brief?: FunnelBrief): string {
  const txt = brief?.aboutText?.trim();
  if (!txt) return "";
  const lang: Language = brief?.language ?? "fr";
  const name = brief?.authorName?.trim();
  const intro =
    lang === "en"
      ? 'AUTHOR / "ABOUT ME" TEXT provided by the user — you MUST use it to write the "about" section (Presentation/Authority), placed AFTER the benefits. Rephrase it as persuasive copy that builds authority (who they are, experience, why they do it, who they help). Never ignore it and never invent a different identity. If an author photo is provided, the "about" section carries it.'
      : lang === "es"
        ? 'TEXTO DEL AUTOR / "SOBRE MÍ" proporcionado por el usuario — DEBES usarlo para redactar la sección "about" (Presentación/Autoridad), ubicada DESPUÉS de los beneficios. Reformúlalo como copy persuasivo que construya autoridad (quién es, experiencia, por qué lo hace, a quién ayuda). Nunca lo ignores ni inventes otra identidad. Si hay una foto del autor, la sección "about" la lleva.'
        : "TEXTE AUTEUR / « À PROPOS DE MOI » fourni par l'utilisateur — tu DOIS l'utiliser pour rédiger la section \"about\" (Présentation/Autorité), placée APRÈS les bénéfices. Reformule-le en copywriting persuasif qui installe l'autorité (qui il est, son expérience, pourquoi il le fait, qui il aide). Ne l'ignore JAMAIS et n'invente pas une autre identité. Si une photo de l'auteur est fournie, la section \"about\" la porte.";
  // 🆕 Nom et prénom saisis séparément dans le wizard : on le transmet pour
  // que l'IA utilise le VRAI nom dans le titre/texte de la section, au lieu
  // de retomber sur le nom de marque ou d'en inventer un.
  const nameLine = name
    ? lang === "en"
      ? `\nThe author's real name is "${name}" — use it (e.g. as the section headline), never invent another name.`
      : lang === "es"
        ? `\nEl nombre real del autor es "${name}" — úsalo (p. ej. como título de la sección), nunca inventes otro nombre.`
        : `\nLe vrai nom de l'auteur est « ${name} » — utilise-le (par ex. comme titre de la section), n'invente jamais un autre nom.`
    : "";
  return `\n\n## À propos (source utilisateur — à exploiter)\n${intro}${nameLine}\n"""\n${txt}\n"""\n`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 Bénéfices clés / urgence / garantie saisis manuellement dans le wizard
// (Bloc "Bénéfices, urgence & garantie" de l'étape "Ton offre") — mêmes
// principes que authorAboutBlock : si l'utilisateur a rempli ces champs,
// l'IA DOIT les exploiter tels quels plutôt que d'inventer un contenu
// générique. Chaque bloc est vide (pas de section injectée) si le brief ne
// contient rien pour lui — rétro-compatible avec les tunnels existants.
// ─────────────────────────────────────────────────────────────────────────────
export function keyContentBlocks(brief?: FunnelBrief): string {
  if (!brief) return "";
  const lang: Language = brief.language ?? "fr";
  const parts: string[] = [];

  const benefits = (brief.keyBenefits ?? []).map((b) => b.trim()).filter(Boolean);
  if (benefits.length > 0) {
    const label = tr(
      {
        fr: 'BÉNÉFICES CLÉS fournis par l\'utilisateur — utilise-les TELS QUELS (reformulation légère autorisée) comme items de la section "benefits", au lieu d\'en inventer d\'autres :',
        en: 'KEY BENEFITS provided by the user — use them AS-IS (light rephrasing allowed) as the "benefits" section items, instead of inventing others:',
        es: 'BENEFICIOS CLAVE proporcionados por el usuario — úsalos TAL CUAL (se permite una reformulación ligera) como items de la sección "benefits", en lugar de inventar otros:',
      },
      lang,
    );
    parts.push(`\n\n## Bénéfices clés (source utilisateur)\n${label}\n${benefits.map((b) => `- ${b}`).join("\n")}\n`);
  }

  const urgency = brief.urgencyText?.trim();
  if (urgency) {
    const label = tr(
      {
        fr: 'RAISON D\'URGENCE fournie par l\'utilisateur — tu DOIS l\'utiliser (reformulée en copy persuasif) pour le corps de la section "urgency". N\'invente jamais une autre raison (stock, délai...) :',
        en: 'URGENCY REASON provided by the user — you MUST use it (rephrased as persuasive copy) for the "urgency" section body. Never invent a different reason:',
        es: 'RAZÓN DE URGENCIA proporcionada por el usuario — DEBES usarla (reformulada como copy persuasivo) para el cuerpo de la sección "urgency". Nunca inventes otra razón:',
      },
      lang,
    );
    parts.push(`\n\n## Urgence (source utilisateur)\n${label}\n"""\n${urgency}\n"""\n`);
  }

  const gTitle = brief.guaranteeTitle?.trim();
  const gDesc = brief.guaranteeDescription?.trim();
  const gDuration = brief.guaranteeDuration?.trim();
  if (gTitle || gDesc) {
    const label = tr(
      {
        fr: 'GARANTIE fournie par l\'utilisateur — utilise EXACTEMENT ces informations pour l\'unique item de la section "guarantee" (data.title/description/duration). N\'invente pas d\'autres conditions :',
        en: 'GUARANTEE provided by the user — use EXACTLY this information for the single "guarantee" section item (data.title/description/duration). Do not invent other terms:',
        es: 'GARANTÍA proporcionada por el usuario — usa EXACTAMENTE esta información para el único item de la sección "guarantee" (data.title/description/duration). No inventes otras condiciones:',
      },
      lang,
    );
    const lines = [
      gTitle ? `- title: ${gTitle}` : null,
      gDesc ? `- description: ${gDesc}` : null,
      gDuration ? `- duration: ${gDuration}` : null,
    ].filter(Boolean);
    parts.push(`\n\n## Garantie (source utilisateur)\n${label}\n${lines.join("\n")}\n`);
  }

  return parts.join("");
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

${toneAndVocabularyBlock(args.funnelKind, lang)}

${heroSingleMediaBlock(args.funnelKind, homeRole, lang)}

${roleSemanticsBlock([homeRole], lang, args.funnelKind)}

${mediasBlock(args.medias, lang)}

${noInventedFilenamesBlock(lang)}

${briefVideoBlock(args.videoUrl, lang, false)}

${briefDrivenBlocks}
${authorAboutBlock(args.brief)}
${keyContentBlocks(args.brief)}

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
      const otoHint = otoPricingGuidanceBlock(args.funnelKind, p.role, lang);
      return `\n---\n### Instructions pour la page \`${p.role}\`\n\n${block}\n\n${heroRule}${otoHint}`;
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

${roleSemanticsBlock(roles, lang, args.funnelKind)}

${toneAndVocabularyBlock(args.funnelKind, lang)}

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
