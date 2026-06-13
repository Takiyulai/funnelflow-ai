// lib/funnels/sectionFillers.ts
import type {
  Funnel,
  FunnelBrief,
  FunnelKind,
  FunnelPage,
  FunnelSection,
  FunnelSectionType,
  PageRole,
  SectionItem,
} from "@/lib/funnels/types";


/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

/**
 * Compte le nombre d'items "informatifs" d'une section :
 * un item est informatif si son titre/quote/question fait ≥ 5 chars
 * ET sa description/answer/body fait ≥ 15 chars.
 *
 * Les sections bonus/program/guarantee/benefits/process avec uniquement
 * des titres courts ne comptent PAS comme informatives.
 */
function countInformativeItems(section: FunnelSection): number {
  if (!Array.isArray(section.items)) return 0;
  let count = 0;
  for (const item of section.items) {
    if (!item || !item.kind || !item.data) continue;
    const d = item.data as Record<string, unknown>;

    const title =
      String(d.title ?? d.question ?? d.quote ?? d.name ?? "").trim();
    const desc =
      String(d.description ?? d.answer ?? d.body ?? "").trim();

    if (item.kind === "faq") {
      // Une FAQ valide a question ET answer
      if (title.length >= 5 && desc.length >= 15) count++;
    } else if (item.kind === "testimonial") {
      // Un testimonial valide a quote (≥ 20 chars) ET authorName
      const author = String(d.authorName ?? "").trim();
      if (title.length >= 20 && author.length >= 2) count++;
    } else if (item.kind === "pricing") {
      // Un pricing valide a name + price + features
      const price = String(d.price ?? "").trim();
      const features = Array.isArray(d.features) ? d.features.length : 0;
      if (title.length >= 3 && price.length >= 1 && features >= 1) count++;
    } else if (item.kind === "formField") {
      // Un formField est toujours valide s'il a un name
      const name = String(d.name ?? "").trim();
      if (name.length >= 1) count++;
    } else {
      // bonus, guarantee, et tout item générique
      // → titre ≥ 5 chars ET description ≥ 15 chars
      if (title.length >= 5 && desc.length >= 15) count++;
    }
  }
  return count;
}

/**
 * Compte les bullets "riches" : un bullet est riche s'il contient un séparateur
 * "|" (format "Titre court | Description longue") avec description ≥ 10 chars,
 * OU s'il fait à lui seul ≥ 25 chars (phrase descriptive complète).
 */
function countRichBullets(section: FunnelSection): number {
  if (!Array.isArray(section.bullets)) return 0;
  let count = 0;
  for (const raw of section.bullets) {
    if (typeof raw !== "string") continue;
    const b = raw.trim();
    if (b.length === 0) continue;
    const pipeIdx = b.indexOf("|");
    if (pipeIdx > 0) {
      const left = b.slice(0, pipeIdx).trim();
      const right = b.slice(pipeIdx + 1).trim();
      if (left.length >= 3 && right.length >= 10) count++;
    } else if (b.length >= 25) {
      count++;
    }
  }
  return count;
}

/**
 * Types de sections qui contiennent des items typés (et qui doivent être
 * vérifiés pour items pauvres).
 */
const ITEM_BASED_SECTION_TYPES: ReadonlySet<FunnelSectionType> = new Set<FunnelSectionType>([
  "bonus",
  "guarantee",
  "faq",
  "pricing",
  "offer",
  "program",
  "testimonials",
]);

/**
 * Types de sections "à bullets riches" : leur contenu principal arrive
 * normalement dans section.bullets (pas section.items). On vérifie alors
 * que les bullets sont substantiels (pas juste 2-3 mots).
 */
const BULLET_BASED_SECTION_TYPES: ReadonlySet<FunnelSectionType> = new Set<FunnelSectionType>([
  "benefits",
  "process",
  "problem",
  "solution",
]);

/**
 * Types de sections "narratives" pour lesquelles l'image SEULE ne suffit pas.
 */
const NARRATIVE_SECTION_TYPES: ReadonlySet<FunnelSectionType> = new Set<FunnelSectionType>([
  "about",
  "problem",
  "solution",
  "proof",
]);

/**
 * Détermine si une section est vide ou malformée.
 *
 * Règles durcies :
 * - hero/cta/thank_you : valides dès qu'ils ont un headline fort
 * - form : valide dès qu'il a un headline
 * - video : valide si vidéo présente OU body informatif
 * - sections à items : si elles ont des items mais aucun informatif → VIDE
 * - sections à bullets (benefits/process) : bullets pauvres + pas de body → VIDE
 * - sections narratives : image SEULE sans texte → VIDE
 */
export function isSectionEmpty(section: FunnelSection): boolean {
  const hasHeadline = (section.headline?.trim().length ?? 0) >= 5;
  const hasSubheadline = (section.subheadline?.trim().length ?? 0) >= 10;
  const hasBody = (section.body?.trim().length ?? 0) >= 30;
  const hasBullets = Array.isArray(section.bullets) && section.bullets.length > 0;
  const hasImage = !!section.image?.url;
  const hasVideo = !!section.video?.url;
  const informativeItemsCount = countInformativeItems(section);
  const hasInformativeItems = informativeItemsCount > 0;
  const richBulletsCount = countRichBullets(section);
  const hasRichBullets = richBulletsCount > 0;

  // hero / cta / thank_you : valides dès qu'ils ont un headline fort
  if (
    section.type === "hero" ||
    section.type === "cta" ||
    section.type === "thank_you"
  ) {
    return !hasHeadline && !hasBody && !hasImage && !hasVideo;
  }

  // form : valide dès qu'il a un headline
  if (section.type === "form") {
    return !hasHeadline;
  }

  // Section "video" : valide si vidéo présente OU body informatif
  if (section.type === "video") {
    return !hasVideo && !hasBody;
  }

  // Sections à bullets riches (benefits/process) : on exige bullets riches
  // OU items informatifs OU body riche. Bullets pauvres seuls → VIDE.
  if (BULLET_BASED_SECTION_TYPES.has(section.type)) {
    // Cas spécial problem/solution : aussi narratifs → image-seule = vide
    if (NARRATIVE_SECTION_TYPES.has(section.type)) {
      const hasTextContent = hasBody || hasRichBullets || hasInformativeItems;
      const hasMedia = hasImage || hasVideo;
      if (hasMedia && !hasTextContent && !hasHeadline) return true;
      return !hasTextContent && !hasMedia && !hasHeadline;
    }
    // benefits / process purs : bullets pauvres sans body → VIDE
    if (hasBullets && !hasRichBullets && !hasBody && !hasInformativeItems) {
      return true;
    }
    return !hasRichBullets && !hasInformativeItems && !hasBody;
  }

  // Sections à items : si déjà déclarés mais aucun informatif → VIDE
  if (ITEM_BASED_SECTION_TYPES.has(section.type)) {
    const hasAnyItems = Array.isArray(section.items) && section.items.length > 0;
    if (hasAnyItems && !hasInformativeItems) {
      return true;
    }
    // Pour testimonials : OK si items informatifs
    if (section.type === "testimonials") {
      return !hasInformativeItems && !hasBody;
    }
    // Pour les autres : OK si items informatifs OU body riche OU bullets riches
    return !hasInformativeItems && !hasBody && !hasRichBullets;
  }

  // Sections "narratives" pures (about, proof) : image SEULE sans texte → VIDE
  if (NARRATIVE_SECTION_TYPES.has(section.type)) {
    const hasTextContent = hasBody || (hasSubheadline && hasHeadline) || hasRichBullets;
    const hasMedia = hasImage || hasVideo;
    if (hasMedia && !hasTextContent) {
      return true;
    }
    return !hasTextContent && !hasMedia && !hasInformativeItems;
  }

  // Cas par défaut (webinar, qualification, etc.) : valide si du contenu existe
  return (
    !hasBody &&
    !hasBullets &&
    !hasInformativeItems &&
    !hasImage &&
    !hasVideo &&
    !hasSubheadline &&
    !hasHeadline
  );
}

/* ================================================================== */
/*  Fallback builders pour sections sans items déclarés                 */
/* ================================================================== */

type GenericItemTemplate = { title: string; desc: string };

/**
 * Génère 3-4 items génériques pour une section "bonus", "program",
 * "benefits" ou "process" à partir du brief.
 */
function buildGenericItemsFromBrief(
  type: FunnelSectionType,
  brief: FunnelBrief,
): SectionItem[] {
  const lang = brief.language ?? "fr";
  const offer = brief.offerName || (lang === "fr" ? "cette offre" : lang === "es" ? "esta oferta" : "this offer");
  const promise = brief.promise || (lang === "fr" ? "atteindre vos objectifs" : lang === "es" ? "alcanzar tus objetivos" : "reach your goals");

  // Bonus / Benefits : 4 items "bénéfices clés"
  if (type === "bonus" || type === "benefits") {
    const items: GenericItemTemplate[] = lang === "fr" ? [
      { title: "Gagnez en clarté immédiatement", desc: `Comprenez les étapes essentielles pour ${promise} sans perdre de temps en théorie inutile.` },
      { title: "Des résultats concrets, pas des promesses", desc: `${offer} vous donne des outils directement applicables qui produisent des résultats mesurables.` },
      { title: "Une méthode éprouvée et structurée", desc: "Suivez un cadre clair, testé et validé, qui élimine les essais-erreurs coûteux." },
      { title: "Un accompagnement personnalisé", desc: "Bénéficiez de conseils adaptés à votre situation pour avancer avec confiance." },
    ] : lang === "es" ? [
      { title: "Gana claridad de inmediato", desc: `Comprende los pasos esenciales para ${promise} sin perder tiempo en teoría inútil.` },
      { title: "Resultados concretos, no promesas", desc: `${offer} te da herramientas directamente aplicables que producen resultados medibles.` },
      { title: "Un método probado y estructurado", desc: "Sigue un marco claro, probado y validado, que elimina los ensayos costosos." },
      { title: "Acompañamiento personalizado", desc: "Recibe consejos adaptados a tu situación para avanzar con confianza." },
    ] : [
      { title: "Get clarity right away", desc: `Understand the essential steps to ${promise} without wasting time on useless theory.` },
      { title: "Real results, not promises", desc: `${offer} gives you directly applicable tools that produce measurable results.` },
      { title: "A proven, structured method", desc: "Follow a clear, tested and validated framework that eliminates costly trial and error." },
      { title: "Personalized support", desc: "Receive advice tailored to your situation to move forward with confidence." },
    ];
    return items.map((it) => ({
      kind: "bonus" as const,
      data: { title: it.title, description: it.desc},
    }));
  }

  // Program : 3 modules
  if (type === "program") {
    const items: GenericItemTemplate[] = lang === "fr" ? [
      { title: "Module 1 — Les fondamentaux", desc: `Les bases indispensables pour bien démarrer avec ${offer} et poser des fondations solides.` },
      { title: "Module 2 — La méthode en action", desc: "Apprenez à appliquer concrètement la méthode à travers des exercices guidés." },
      { title: "Module 3 — Aller plus loin", desc: `Approfondissez et personnalisez votre approche pour ${promise} de manière durable.` },
    ] : lang === "es" ? [
      { title: "Módulo 1 — Los fundamentos", desc: `Las bases indispensables para empezar bien con ${offer} y sentar bases sólidas.` },
      { title: "Módulo 2 — El método en acción", desc: "Aprende a aplicar concretamente el método a través de ejercicios guiados." },
      { title: "Módulo 3 — Ir más allá", desc: `Profundiza y personaliza tu enfoque para ${promise} de manera duradera.` },
    ] : [
      { title: "Module 1 — The fundamentals", desc: `The essential basics to get started with ${offer} and lay solid foundations.` },
      { title: "Module 2 — The method in action", desc: "Learn to concretely apply the method through guided exercises." },
      { title: "Module 3 — Going further", desc: `Deepen and personalize your approach to ${promise} sustainably.` },
    ];
    return items.map((it) => ({
      kind: "bonus" as const,
      data: { title: it.title, description: it.desc},
    }));
  }

  // Process / Steps : 4 étapes
  if (type === "process") {
    const items: GenericItemTemplate[] = lang === "fr" ? [
      { title: "Étape 1 — Diagnostic", desc: `Nous analysons votre situation pour identifier les leviers prioritaires vers ${promise}.` },
      { title: "Étape 2 — Plan d'action", desc: `Vous recevez une feuille de route claire et personnalisée adaptée à votre contexte.` },
      { title: "Étape 3 — Mise en œuvre", desc: "Vous appliquez la méthode pas à pas avec un accompagnement régulier et des retours concrets." },
      { title: "Étape 4 — Résultats durables", desc: `Vous consolidez vos acquis et obtenez des résultats mesurables avec ${offer}.` },
    ] : lang === "es" ? [
      { title: "Paso 1 — Diagnóstico", desc: `Analizamos tu situación para identificar las palancas prioritarias hacia ${promise}.` },
      { title: "Paso 2 — Plan de acción", desc: `Recibes una hoja de ruta clara y personalizada adaptada a tu contexto.` },
      { title: "Paso 3 — Implementación", desc: "Aplicas el método paso a paso con un acompañamiento regular y retornos concretos." },
      { title: "Paso 4 — Resultados duraderos", desc: `Consolidas tus logros y obtienes resultados medibles con ${offer}.` },
    ] : [
      { title: "Step 1 — Diagnosis", desc: `We analyze your situation to identify priority levers towards ${promise}.` },
      { title: "Step 2 — Action plan", desc: `You receive a clear, personalized roadmap tailored to your context.` },
      { title: "Step 3 — Implementation", desc: "You apply the method step by step with regular support and concrete feedback." },
      { title: "Step 4 — Lasting results", desc: `You consolidate your gains and achieve measurable results with ${offer}.` },
    ];
    return items.map((it) => ({
      kind: "bonus" as const,
      data: { title: it.title, description: it.desc},
    }));
  }

  // Guarantee : 1 item garantie standard
  if (type === "guarantee") {
    const item: GenericItemTemplate = lang === "fr" ? {
      title: "Garantie satisfait ou remboursé 14 jours",
      desc: `Testez ${offer} sans risque. Si vous n'êtes pas pleinement satisfait dans les 14 premiers jours, nous vous remboursons intégralement, sans question.`,
    } : lang === "es" ? {
      title: "Garantía satisfecho o reembolsado 14 días",
      desc: `Prueba ${offer} sin riesgo. Si no estás plenamente satisfecho en los primeros 14 días, te reembolsamos íntegramente, sin preguntas.`,
    } : {
      title: "14-day satisfaction guarantee",
      desc: `Try ${offer} risk-free. If you're not fully satisfied within the first 14 days, we'll refund you in full, no questions asked.`,
    };
    return [{
      kind: "guarantee" as const,
      data: { title: item.title, description: item.desc},
    } as SectionItem];
  }

  return [];
}

/**
 * Enrichit en place les items "pauvres" (titre seul, pas de description)
 * en générant une description depuis le brief.
 * Retourne true si au moins un item a été enrichi.
 */
function enrichPoorItems(
  section: FunnelSection,
  brief: FunnelBrief,
): boolean {
  if (!Array.isArray(section.items) || section.items.length === 0) return false;
  const lang = brief.language ?? "fr";
  const offer = brief.offerName || "";
  const promise = brief.promise || "";

  let enrichedCount = 0;
  for (const item of section.items) {
    if (!item || !item.data) continue;
    // Ne pas toucher aux faq/testimonial/pricing/formField (gérés ailleurs)
    if (
      item.kind === "faq" ||
      item.kind === "testimonial" ||
      item.kind === "pricing" ||
      item.kind === "formField"
    ) {
      continue;
    }

    const d = item.data as Record<string, unknown>;
    const title = String(d.title ?? "").trim();
    const desc = String(d.description ?? "").trim();

    // Si titre existe mais description manque ou trop courte
    if (title.length >= 3 && desc.length < 15) {
      const generated = lang === "fr"
        ? `${title} — un atout clé pour ${promise || `tirer le meilleur de ${offer}`}.`
        : lang === "es"
          ? `${title} — un activo clave para ${promise || `aprovechar al máximo ${offer}`}.`
          : `${title} — a key asset to ${promise || `make the most of ${offer}`}.`;
      d.description = generated;
      enrichedCount++;
    }
  }

  return enrichedCount > 0;
}

/**
 * Enrichit en place les bullets "pauvres" (juste un titre court sans description)
 * en les transformant au format "Titre | Description générée".
 * Retourne true si au moins un bullet a été enrichi.
 */
function enrichPoorBullets(
  section: FunnelSection,
  brief: FunnelBrief,
): boolean {
  if (!Array.isArray(section.bullets) || section.bullets.length === 0) return false;
  const lang = brief.language ?? "fr";
  const offer = brief.offerName || "";
  const promise = brief.promise || "";

  let enrichedCount = 0;
  const next: string[] = [];
  for (const raw of section.bullets) {
    if (typeof raw !== "string") { next.push(raw as unknown as string); continue; }
    const b = raw.trim();
    if (b.length === 0) { next.push(b); continue; }
    const pipeIdx = b.indexOf("|");
    // Déjà au format "titre | description" avec description suffisante : on garde
    if (pipeIdx > 0) {
      const right = b.slice(pipeIdx + 1).trim();
      if (right.length >= 10) { next.push(b); continue; }
      // Sinon on enrichit la partie droite
      const left = b.slice(0, pipeIdx).trim();
      const desc = lang === "fr"
        ? `${left} — un point essentiel pour ${promise || `réussir avec ${offer}`}.`
        : lang === "es"
          ? `${left} — un punto esencial para ${promise || `tener éxito con ${offer}`}.`
          : `${left} — an essential point to ${promise || `succeed with ${offer}`}.`;
      next.push(`${left} | ${desc}`);
      enrichedCount++;
      continue;
    }
    // Bullet déjà assez long pour être descriptif : on garde
    if (b.length >= 25) { next.push(b); continue; }
    // Bullet court → on génère une description
    const desc = lang === "fr"
      ? `un point essentiel pour ${promise || `réussir avec ${offer}`}.`
      : lang === "es"
        ? `un punto esencial para ${promise || `tener éxito con ${offer}`}.`
        : `an essential point to ${promise || `succeed with ${offer}`}.`;
    next.push(`${b} | ${desc}`);
    enrichedCount++;
  }

  section.bullets = next;
  return enrichedCount > 0;
}

/* ================================================================== */
/*  tryFillSectionFromBrief                                            */
/* ================================================================== */

export function tryFillSectionFromBrief(
  section: FunnelSection,
  brief: FunnelBrief,
): boolean {
  const lang = brief.language ?? "fr";

  switch (section.type) {
    case "hero":
      if (!section.headline?.trim()) {
        section.headline = brief.promise || brief.brandName;
      }
      if (!section.subheadline?.trim() && brief.mainPain) {
        section.subheadline = brief.mainPain;
      }
      return true;

    case "about": {
      // Priorité 1 : aboutText du brief
      if (brief.aboutText && brief.aboutText.trim().length >= 30) {
        section.body = brief.aboutText;
        if (!section.headline?.trim()) {
          section.headline = lang === "fr"
            ? `À propos de ${brief.brandName}`
            : lang === "es"
              ? `Acerca de ${brief.brandName}`
              : `About ${brief.brandName}`;
        }
        return true;
      }
      // Priorité 2 : générer depuis brandName + promise + targetAudience
      const generated = lang === "fr"
        ? `${brief.brandName} accompagne ${brief.targetAudience || "ses clients"} pour ${brief.promise || "atteindre leurs objectifs"}. Notre approche combine méthode éprouvée et accompagnement personnalisé pour des résultats concrets et durables.`
        : lang === "es"
          ? `${brief.brandName} acompaña a ${brief.targetAudience || "sus clientes"} para ${brief.promise || "alcanzar sus objetivos"}. Nuestro enfoque combina un método probado y un acompañamiento personalizado para resultados concretos y duraderos.`
          : `${brief.brandName} helps ${brief.targetAudience || "its clients"} ${brief.promise || "reach their goals"}. Our approach combines a proven method with personalized support for concrete, lasting results.`;
      section.body = generated;
      if (!section.headline?.trim()) {
        section.headline = lang === "fr"
          ? `À propos de ${brief.brandName}`
          : lang === "es"
            ? `Acerca de ${brief.brandName}`
            : `About ${brief.brandName}`;
      }
      return true;
    }

    case "cta":
      if (!section.headline?.trim()) {
        section.headline =
          brief.ctaLabel ||
          brief.primaryCta?.label ||
          brief.promise ||
          "Passez à l'action";
      }
      return true;

    case "thank_you":
      if (!section.headline?.trim()) {
        section.headline = "Merci !";
      }
      if (!section.body?.trim()) {
        section.body = `Votre inscription à ${brief.offerName} est bien enregistrée.`;
      }
      return true;

    case "bonus":
    case "program":
    case "benefits":
    case "process": {
      // Cas 1 : items existent mais pauvres → enrichir
      if (Array.isArray(section.items) && section.items.length > 0) {
        const enriched = enrichPoorItems(section, brief);
        if (enriched) return true;
        const inform = countInformativeItems(section);
        if (inform > 0) return true;
      }
      // Cas 2 : bullets pauvres → enrichir au format "Titre | Description"
      if (Array.isArray(section.bullets) && section.bullets.length > 0) {
        const enriched = enrichPoorBullets(section, brief);
        if (enriched || countRichBullets(section) > 0) {
          if (!section.headline?.trim()) {
            section.headline = defaultSectionHeadline(section.type, lang);
          }
          return true;
        }
      }
      // Cas 3 : ni items ni bullets → générer des items depuis le brief
      const generated = buildGenericItemsFromBrief(section.type, brief);
      if (generated.length > 0) {
        section.items = generated;
        if (!section.headline?.trim()) {
          section.headline = defaultSectionHeadline(section.type, lang);
        }
        return true;
      }
      return false;
    }

    case "guarantee": {
      // Si items existent mais pauvres → enrichir
      if (Array.isArray(section.items) && section.items.length > 0) {
        const enriched = enrichPoorItems(section, brief);
        if (enriched) return true;
        if (countInformativeItems(section) > 0) return true;
      }
      // Sinon générer une garantie standard
      const generated = buildGenericItemsFromBrief("guarantee", brief);
      if (generated.length > 0) {
        section.items = generated;
        if (!section.headline?.trim()) {
          section.headline = lang === "fr"
            ? "Notre garantie"
            : lang === "es"
              ? "Nuestra garantía"
              : "Our guarantee";
        }
        return true;
      }
      return false;
    }

    case "webinar": {
      if (!section.headline?.trim()) {
        section.headline = lang === "fr"
          ? `Rejoignez le webinaire : ${brief.offerName}`
          : lang === "es"
            ? `Únete al webinar: ${brief.offerName}`
            : `Join the webinar: ${brief.offerName}`;
      }
      if (!section.body?.trim()) {
        section.body = lang === "fr"
          ? `Découvrez comment ${brief.promise || "atteindre vos objectifs"} grâce à une session en direct exclusive.`
          : lang === "es"
            ? `Descubre cómo ${brief.promise || "alcanzar tus objetivos"} gracias a una sesión en vivo exclusiva.`
            : `Discover how to ${brief.promise || "reach your goals"} through an exclusive live session.`;
      }
      return true;
    }

    case "video":
      // Une section vidéo sans vidéo est intrinsèquement inutile
      return false;

    case "problem":
    case "solution":
    case "proof": {
      if (!section.body?.trim()) {
        if (section.type === "problem" && brief.mainPain) {
          section.body = brief.mainPain;
        } else if (section.type === "solution") {
          section.body = lang === "fr"
            ? `${brief.offerName} apporte une réponse concrète : ${brief.promise}.`
            : lang === "es"
              ? `${brief.offerName} ofrece una respuesta concreta: ${brief.promise}.`
              : `${brief.offerName} provides a concrete answer: ${brief.promise}.`;
        } else if (section.type === "proof") {
          section.body = lang === "fr"
            ? `Des résultats concrets pour ${brief.targetAudience || "nos clients"} grâce à ${brief.offerName}.`
            : lang === "es"
              ? `Resultados concretos para ${brief.targetAudience || "nuestros clientes"} gracias a ${brief.offerName}.`
              : `Concrete results for ${brief.targetAudience || "our clients"} thanks to ${brief.offerName}.`;
        } else {
          return false;
        }
        return true;
      }
      return false;
    }

    default:
      // faq, testimonials, pricing, offer, form, qualification
      // → couverts ailleurs (enrichSectionsWithDefaults dans generate.ts) ou non remplissables
      return false;
  }
}

/**
 * Headline par défaut pour bonus/program/benefits/process selon la langue.
 */
function defaultSectionHeadline(
  type: FunnelSectionType,
  lang: "fr" | "en" | "es",
): string {
  const titles: Partial<Record<FunnelSectionType, Record<string, string>>> = {
    bonus: { fr: "Les bénéfices clés", en: "Key benefits", es: "Beneficios clave" },
    program: { fr: "Le programme", en: "The program", es: "El programa" },
    benefits: { fr: "Ce que vous allez gagner", en: "What you'll gain", es: "Lo que vas a ganar" },
    process: { fr: "Comment ça marche", en: "How it works", es: "Cómo funciona" },
  };
  return titles[type]?.[lang] ?? "Section";
}

/* ================================================================== */
/*  removeOrFillEmptySections                                          */
/* ================================================================== */

export function removeOrFillEmptySections(
  page: { sections: FunnelSection[] },
  allowedTypes: FunnelSectionType[] | undefined,
  brief: FunnelBrief,
): { kept: number; removed: number; filled: number } {
  const allowedSet = allowedTypes
    ? new Set<FunnelSectionType>(allowedTypes)
    : null;
  let removed = 0;
  let filled = 0;

  const next: FunnelSection[] = [];
  for (const section of page.sections) {
    // Règle 1 : type non autorisé pour cette page → suppression
    if (allowedSet && !allowedSet.has(section.type)) {
      removed++;
      continue;
    }
    // Règle 2 : section vide/malformée → tenter de remplir, sinon supprimer
    if (isSectionEmpty(section)) {
      const wasFilled = tryFillSectionFromBrief(section, brief);
      if (wasFilled && !isSectionEmpty(section)) {
        filled++;
        next.push(section);
      } else {
        removed++;
      }
      continue;
    }
    // Règle 3 : section non vide mais items pauvres → enrichir si possible
    if (
      (section.type === "bonus" ||
       section.type === "program" ||
       section.type === "benefits" ||
       section.type === "process" ||
       section.type === "guarantee") &&
      Array.isArray(section.items) &&
      section.items.length > 0
    ) {
      const inform = countInformativeItems(section);
      if (inform < section.items.length) {
        const enriched = enrichPoorItems(section, brief);
        if (enriched) filled++;
      }
    }
    // Règle 4 : section non vide mais bullets pauvres → enrichir au format pipe
    if (
      (section.type === "benefits" ||
       section.type === "process" ||
       section.type === "problem" ||
       section.type === "solution") &&
      Array.isArray(section.bullets) &&
      section.bullets.length > 0
    ) {
      const rich = countRichBullets(section);
      if (rich < section.bullets.length) {
        const enriched = enrichPoorBullets(section, brief);
        if (enriched) filled++;
      }
    }
    next.push(section);
  }

  page.sections = next;
  return { kept: next.length, removed, filled };
}
/* ================================================================== */
/*  Dédoublonnage inter-pages + garantie pricing                       */
/* ================================================================== */

/**
 * Quelle page doit obligatoirement porter le pricing, selon le type de tunnel.
 * Si la page n'existe pas dans le funnel généré, on fallback sur la home.
 */
const CONVERSION_PAGE_BY_KIND: Partial<Record<FunnelKind, PageRole[]>> = {
  "lead-magnet": ["optin"],
  "webinar": ["sales", "replay"],
  "digital-product": ["sales", "checkout"],
  "coaching-high-ticket": ["application", "sales"],
  "booking": ["booking", "landing"],
  "challenge": ["sales", "challenge-landing"],
  "saas": ["sales", "landing"],
  "formation": ["sales", "landing"],
  "vsl": ["sales"],
  "service": ["landing"],
  "thank-you": [],
};

/**
 * Pages où le pricing est INTERDIT (job unique : capter / livrer / qualifier).
 * Exception : si le kind cible explicitement une de ces pages (ex: replay
 * pour un webinar), elle est autorisée.
 */
const PRICING_FORBIDDEN_ROLES: ReadonlySet<PageRole> = new Set<PageRole>([
  "thankyou",
  "access",
  "delivery",
  "confirmation",
  "replay",
  "registration",
  "qualification",
]);

/**
 * Types de sections qui peuvent légitimement apparaître sur PLUSIEURS pages
 * sans être considérés comme des doublons (outils contextuels à chaque page).
 */
const REPEATABLE_SECTION_TYPES: ReadonlySet<FunnelSectionType> =
  new Set<FunnelSectionType>(["hero", "cta", "form", "thank_you"]);

/**
 * Supprime les occurrences N+1 des sections narratives à travers toutes les
 * pages du funnel. La PREMIÈRE page (dans l'ordre du tableau funnel.pages)
 * garde la section ; les suivantes la perdent.
 */
export function dedupeSectionsAcrossPages(funnel: Funnel): {
  removedByPage: Record<string, number>;
} {
  if (!funnel.pages || funnel.pages.length <= 1) {
    return { removedByPage: {} };
  }

  const seenTypes = new Set<FunnelSectionType>();
  const removedByPage: Record<string, number> = {};

  for (const page of funnel.pages) {
    if (!Array.isArray(page.sections) || page.sections.length === 0) continue;
    let removedHere = 0;
    const kept: FunnelSection[] = [];

    for (const section of page.sections) {
      if (REPEATABLE_SECTION_TYPES.has(section.type)) {
        kept.push(section);
        continue;
      }
      if (!seenTypes.has(section.type)) {
        seenTypes.add(section.type);
        kept.push(section);
        continue;
      }
      removedHere++;
    }

    page.sections = kept;
    if (removedHere > 0) {
      removedByPage[page.role] = removedHere;
    }
  }

  return { removedByPage };
}

/**
 * Garantit qu'une section "pricing" valide existe sur la page de conversion
 * du funnel, en respectant le type de tunnel.
 *
 * 1. Détermine la page cible via CONVERSION_PAGE_BY_KIND
 * 2. Supprime tout pricing présent sur les pages "interdites"
 * 3. Si la page cible existe et n'a PAS de pricing valide → en injecte un
 */
export function ensurePricingOnConversionPage(
  funnel: Funnel,
  brief: FunnelBrief,
  buildPricing: (b: FunnelBrief) => SectionItem[],
): {
  injected: boolean;
  cleanedFromForbidden: number;
  targetRole: PageRole | null;
} {
  const kind: FunnelKind =
    (funnel.meta?.funnelKind as FunnelKind | undefined) ??
    brief.funnelKind ??
    "lead-magnet";
  const candidateRoles = CONVERSION_PAGE_BY_KIND[kind] ?? [];


  // 1. Nettoyer le pricing sur les pages où il est INTERDIT
  let cleanedFromForbidden = 0;
  if (funnel.pages) {
    for (const page of funnel.pages) {
      const isExplicitTarget = candidateRoles.includes(page.role);
      if (PRICING_FORBIDDEN_ROLES.has(page.role) && !isExplicitTarget) {
        const before = page.sections.length;
        page.sections = page.sections.filter(
          (s) => s.type !== "pricing" && s.type !== "offer",
        );
        cleanedFromForbidden += before - page.sections.length;
      }
    }
  }

  // 2. Trouver la page cible : 1er candidat existant, sinon home
  let targetPage: FunnelPage | undefined;
  if (funnel.pages) {
    for (const role of candidateRoles) {
      const found = funnel.pages.find((p) => p.role === role);
      if (found) {
        targetPage = found;
        break;
      }
    }
    if (!targetPage) {
      targetPage = funnel.pages.find((p) => p.isHome) ?? funnel.pages[0];
    }
  }

  if (!targetPage) {
    return { injected: false, cleanedFromForbidden, targetRole: null };
  }

  // 3. Vérifier si un pricing valide existe déjà sur cette page
  const existingPricing = targetPage.sections.find(
    (s) =>
      (s.type === "pricing" || s.type === "offer") &&
      Array.isArray(s.items) &&
      s.items.some(
        (it) =>
          it.kind === "pricing" &&
          typeof it.data?.price === "string" &&
          it.data.price.trim().length > 0,
      ),
  );

  if (existingPricing && Array.isArray(existingPricing.items)) {
    const items = existingPricing.items;
    const hasHighlighted = items.some(
      (it) => it.kind === "pricing" && it.data?.highlighted === true,
    );
    if (!hasHighlighted) {
      const first = items.find((it) => it.kind === "pricing");
      if (first && first.kind === "pricing") {
        first.data.highlighted = true;
      }
    }
    return {
      injected: false,
      cleanedFromForbidden,
      targetRole: targetPage.role,
    };
  }

  // 4. Injecter une section pricing
  const lang = brief.language ?? "fr";
  const headline =
    lang === "fr" ? "Votre offre" : lang === "es" ? "Tu oferta" : "Your offer";

  const newPricingSection: FunnelSection = {
    id: `sec_pricing_${Date.now().toString(36)}`,
    type: "pricing",
    headline,
    items: buildPricing(brief),
    visible: true,
  };

  // Position : juste avant la DERNIÈRE cta, sinon en avant-dernier, sinon à la fin
  let lastCtaIdx = -1;
  for (let i = targetPage.sections.length - 1; i >= 0; i--) {
    if (targetPage.sections[i].type === "cta") {
      lastCtaIdx = i;
      break;
    }
  }

  if (lastCtaIdx >= 0) {
    targetPage.sections.splice(lastCtaIdx, 0, newPricingSection);
  } else if (targetPage.sections.length >= 2) {
    targetPage.sections.splice(
      targetPage.sections.length - 1,
      0,
      newPricingSection,
    );
  } else {
    targetPage.sections.push(newPricingSection);
  }

  return {
    injected: true,
    cleanedFromForbidden,
    targetRole: targetPage.role,
  };
}
