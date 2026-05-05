// lib/ai/generate.ts
import { z } from "zod";
import type {
  Funnel,
  FunnelBrief,
  FunnelSection,
  CtaConfig,
} from "@/lib/funnels/types";
import { makeAnchorCta } from "@/lib/funnels/types";
import { completeFunnelPrompt } from "./prompts";
import { getMood } from "@/lib/funnels/moods";
import {
  PREMIUM_TEMPLATES,
  DEFAULT_PREMIUM_TEMPLATE_ID,
  getPremiumTemplate,
} from "@/lib/funnels/templates";
import {
  applyTemplateToFunnel,
  getTemplateSectionTypes,
} from "@/lib/funnels/applyTemplate";

// ─────────────────────────────────────────────────────────────────────────────
// Erreur typée pour distinguer les modes d'échec côté API route
// ─────────────────────────────────────────────────────────────────────────────
export type AiErrorReason =
  | "missing-key"
  | "invalid-key"
  | "rate-limit"
  | "insufficient-quota"
  | "network-error"
  | "empty-response"
  | "invalid-json"
  | "schema-mismatch"
  | "unknown";

export class AiGenerationError extends Error {
  reason: AiErrorReason;
  details?: string;

  constructor(reason: AiErrorReason, message: string, details?: string) {
    super(message);
    this.name = "AiGenerationError";
    this.reason = reason;
    this.details = details;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Schémas zod
// ─────────────────────────────────────────────────────────────────────────────
const ctaSchema = z.union([
  z.string(),
  z.object({
    label: z.string(),
    mode: z.enum(["redirect", "anchor", "popup"]).optional(),
    url: z.string().optional(),
    target: z.enum(["_self", "_blank"]).optional(),
    anchorId: z.string().optional(),
    popupId: z.string().optional(),
  }),
]);

const imageSchema = z
  .object({
    mode: z.enum(["none", "upload", "ai-suggested"]),
    url: z.string().optional(),
    alt: z.string().optional(),
    credit: z.string().optional(),
    sourceUrl: z.string().optional(),
    suggestionQuery: z.string().optional(),
  })
  .optional();

const styleSchema = z
  .object({
    textColor: z.string().optional(),
    accentColor: z.string().optional(),
    spacing: z.enum(["compact", "default", "large"]).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    layout: z.enum(["text-only", "image-only", "text-image", "image-text"]).optional(),
  })
  .optional();

const videoSchema = z
  .object({
    provider: z.enum(["youtube", "vimeo", "url", "upload"]).optional(),
    url: z.string().optional(),
    posterUrl: z.string().optional(),
  })
  .optional();

const funnelSchema = z.object({
  funnelName: z.string(),
  language: z.enum(["fr", "en", "es"]),
  sections: z.array(
    z.object({
      id: z.string().optional(),
      type: z.string(),
      eyebrow: z.string().optional(),
      headline: z.string(),
      subheadline: z.string().optional(),
      body: z.string().optional(),
      bullets: z.array(z.string()).optional(),
      cta: ctaSchema.optional(),
      image: imageSchema,
      video: videoSchema,
      visible: z.boolean().optional(),
      style: styleSchema,
      visualDirection: z.string().optional(),
    })
  ),
  thankYouPage: z.object({
    headline: z.string(),
    body: z.string(),
    cta: ctaSchema.optional(),
  }),
  emails: z.array(
    z.object({
      subject: z.string(),
      html: z.string(),
      text: z.string(),
      cta: ctaSchema,
    })
  ),
  seo: z.object({
    title: z.string(),
    description: z.string(),
  }),
  design: z.object({
    primaryColor: z.string(),
    secondaryColor: z.string(),
    accentColor: z.string(),
    style: z.string(),
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Compatibilité : si l'IA renvoie un CTA en string, on le normalise
// ─────────────────────────────────────────────────────────────────────────────
function normalizeCta(raw: unknown, fallback: CtaConfig): CtaConfig {
  if (!raw) return fallback;
  if (typeof raw === "string") {
    return { ...fallback, label: raw };
  }
  const obj = raw as Partial<CtaConfig>;
  return {
    label: obj.label ?? fallback.label,
    mode: obj.mode ?? fallback.mode ?? "anchor",
    url: obj.url,
    target: obj.target ?? "_self",
    anchorId: obj.anchorId ?? (obj.mode === "anchor" ? "lead-form" : undefined),
    popupId: obj.popupId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction tolérante du JSON dans la réponse IA
// (parfois le modèle entoure le JSON de markdown ou de texte explicatif)
// ─────────────────────────────────────────────────────────────────────────────
function extractJsonPayload(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();

  // Supprime balises markdown de code
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();

  // Si le texte contient autre chose, isole le premier objet JSON équilibré
  if (!s.startsWith("{")) {
    const start = s.indexOf("{");
    if (start === -1) return s;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return s.slice(start, i + 1);
      }
    }
    return s.slice(start);
  }

  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parseur principal
// ─────────────────────────────────────────────────────────────────────────────
export function parseFunnelJson(raw: string, brief: FunnelBrief): Funnel {
  const clean = extractJsonPayload(raw);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(clean);
  } catch (err) {
    throw new AiGenerationError(
      "invalid-json",
      "La réponse de l'IA n'est pas un JSON valide",
      err instanceof Error ? err.message : String(err)
    );
  }

  const result = funnelSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new AiGenerationError(
      "schema-mismatch",
      "La réponse de l'IA ne respecte pas la structure attendue",
      JSON.stringify(result.error.flatten().fieldErrors).slice(0, 500)
    );
  }
  const parsed = result.data;

  const fallbackCta: CtaConfig =
    brief.primaryCta ?? makeAnchorCta(
      brief.language === "fr" ? "Recevoir les détails" :
        brief.language === "es" ? "Recibir los detalles" :
          "Get the details",
      "lead-form"
    );

  const sections: FunnelSection[] = parsed.sections.map((section, index) => ({
    id: section.id ?? `${section.type}-${index + 1}`,
    type: section.type as FunnelSection["type"],
    eyebrow: section.eyebrow,
    headline: section.headline,
    subheadline: section.subheadline,
    body: section.body,
    bullets: section.bullets,
    cta: section.cta ? normalizeCta(section.cta, fallbackCta) : undefined,
    image: section.image ?? { mode: brief.defaultImageMode ?? "none" },
    video: section.video as FunnelSection["video"],
    visible: section.visible ?? true,
    style: section.style as FunnelSection["style"],
    visualDirection: section.visualDirection,
  }));

  return {
    funnelName: parsed.funnelName,
    language: parsed.language,
    sections,
    thankYouPage: {
      headline: parsed.thankYouPage.headline,
      body: parsed.thankYouPage.body,
      cta: parsed.thankYouPage.cta
        ? normalizeCta(parsed.thankYouPage.cta, fallbackCta)
        : undefined,
    },
    emails: parsed.emails.map((email) => ({
      subject: email.subject,
      html: email.html,
      text: email.text,
      cta: normalizeCta(email.cta, fallbackCta),
    })),
    seo: parsed.seo,
    design: parsed.design,
    defaultCta: fallbackCta,
    meta: {
      funnelKind: brief.funnelKind,
      moodId: brief.moodId,
      creationMode: brief.creationMode,
      templateId: brief.templateId,
      logoUrl: brief.logoUrl,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper : construit une instruction additionnelle au prompt qui force l'IA
// à respecter exactement les sections attendues par le template choisi.
// ─────────────────────────────────────────────────────────────────────────────
function buildTemplateInstruction(
  template: ReturnType<typeof getPremiumTemplate>,
  brief: FunnelBrief
): string {
  if (!template) return "";

  const lang = brief.language ?? "fr";
  const personality =
    template.personality[lang] ?? template.personality.fr;

  const expectedSections = getTemplateSectionTypes(template, brief);

  const header =
    lang === "fr"
      ? "CONTRAINTES DE TEMPLATE (à respecter strictement) :"
      : lang === "es"
        ? "RESTRICCIONES DE PLANTILLA (a respetar estrictamente):"
        : "TEMPLATE CONSTRAINTS (must be strictly respected):";

  const lines = [
    header,
    `- Template: "${template.name}" — ${personality}`,
    `- Densité: ${template.density} (airy = textes courts/aérés, balanced = équilibré, dense = textes plus riches)`,
    lang === "fr"
      ? `- Génère EXACTEMENT ces sections, dans cet ordre, en utilisant ces "type" dans le JSON :`
      : lang === "es"
        ? `- Genera EXACTAMENTE estas secciones, en este orden, usando estos "type" en el JSON:`
        : `- Generate EXACTLY these sections, in this order, using these "type" values in the JSON:`,
    ...expectedSections.map((t, i) => `  ${i + 1}. "${t}"`),
    lang === "fr"
      ? `- N'ajoute pas d'autres sections. N'omet aucune section listée.`
      : lang === "es"
        ? `- No añadas otras secciones. No omitas ninguna sección listada.`
        : `- Do not add other sections. Do not omit any listed section.`,
  ];

  return "\n\n" + lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Génération via OpenAI Chat Completions API
// ─────────────────────────────────────────────────────────────────────────────
export async function generateFunnelWithAI(brief: FunnelBrief): Promise<Funnel> {
  if (!process.env.OPENAI_API_KEY) {
    throw new AiGenerationError(
      "missing-key",
      "Aucune clé OpenAI détectée côté serveur. Ajoutez OPENAI_API_KEY dans .env.local puis redémarrez"
    );
  }

  // 1) Sélection du template premium (story-sell par défaut)
  const template =
    getPremiumTemplate(brief.templateId) ??
    getPremiumTemplate(DEFAULT_PREMIUM_TEMPLATE_ID) ??
    PREMIUM_TEMPLATES[0];

  // 2) Construction du prompt enrichi (prompt existant + contrainte de template)
  const basePrompt = completeFunnelPrompt(brief);
  const templateInstruction = buildTemplateInstruction(template, brief);
  const finalPrompt = basePrompt + templateInstruction;

  // 3) Appel OpenAI
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  let rawText: string;
  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are an expert funnel copywriter and conversion specialist. " +
            "You MUST respond with a single JSON object that strictly matches the requested schema. " +
            "Do not wrap the JSON in markdown code fences. Do not add any prose before or after the JSON. " +
            "Write all copy in the language specified in the brief, with the requested tone and target audience in mind.",
        },
        {
          role: "user",
          content: finalPrompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
      max_tokens: 8000,
    });

    rawText = response.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = (error as { status?: number; code?: string })?.status;
    const code = (error as { status?: number; code?: string })?.code;

    if (status === 401 || status === 403 || code === "invalid_api_key") {
      throw new AiGenerationError(
        "invalid-key",
        "La clé OpenAI a été refusée. Vérifiez sa validité sur platform.openai.com",
        message
      );
    }
    if (status === 429 || code === "insufficient_quota") {
      const insufficient = /insufficient_quota|exceeded your current quota/i.test(message);
      throw new AiGenerationError(
        insufficient ? "insufficient-quota" : "rate-limit",
        insufficient
          ? "Quota OpenAI épuisé. Ajoutez du crédit sur platform.openai.com/account/billing"
          : "Trop de requêtes en peu de temps. Réessayez dans une minute",
        message
      );
    }

    throw new AiGenerationError(
      "network-error",
      "Impossible de joindre OpenAI. Vérifiez votre connexion ou réessayez dans un instant",
      message
    );
  }

  if (!rawText || rawText.length < 20) {
    throw new AiGenerationError(
      "empty-response",
      "L'IA a retourné une réponse vide. Réessayez la génération"
    );
  }

  // 4) Parsing strict du JSON retourné par l'IA
  const aiFunnel = parseFunnelJson(rawText, brief);

  // 5) Application du template : layouts, animations, injection user data
  const finalFunnel = applyTemplateToFunnel(template, aiFunnel, brief);

  // 6) On s'assure que meta.templateId reflète le template effectivement appliqué
  return {
    ...finalFunnel,
    meta: {
      ...(finalFunnel.meta ?? {}),
      templateId: template.id,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tunnel de démo (utilisé UNIQUEMENT pour /tunnel/demo, /api/export/systeme
// quand l'utilisateur demande explicitement la démo, et lib/funnels/demo.ts)
// JAMAIS utilisé comme fallback caché de generateFunnelWithAI
// ─────────────────────────────────────────────────────────────────────────────
export function createDemoFunnel(brief: FunnelBrief): Funnel {
  const isFr = brief.language === "fr";
  const isEs = brief.language === "es";

  const ctaLabel = isFr
    ? "Obtenir l'accès"
    : isEs
      ? "Obtener el acceso"
      : "Get access";

  const primaryCta: CtaConfig = brief.primaryCta ?? makeAnchorCta(ctaLabel, "lead-form");

  const t = (fr: string, en: string, es: string) =>
    isFr ? fr : isEs ? es : en;

  const mood = getMood(brief.moodId);
  const primaryColor = brief.mainColor ?? mood?.primary ?? "#080E1A";
  const secondaryColor = brief.secondaryColor ?? mood?.secondary ?? "#C7A436";
  const accentColor = mood?.accent ?? "#31845C";

  const sections: FunnelSection[] = [
    {
      id: "hero",
      type: "hero",
      eyebrow: brief.funnelType,
      headline: t(
        `${brief.offerName} : ${brief.promise}`,
        `${brief.offerName}: ${brief.promise}`,
        `${brief.offerName}: ${brief.promise}`
      ),
      subheadline: t(
        `Un tunnel pensé pour ${brief.targetAudience}, avec un message clair, une preuve visible et un parcours mobile-first prêt à exporter vers systeme.io`,
        `A funnel built for ${brief.targetAudience}, with a clear message, visible proof and a mobile-first path ready for systeme.io`,
        `Un embudo pensado para ${brief.targetAudience}, con un mensaje claro, prueba visible y un recorrido mobile-first listo para systeme.io`
      ),
      cta: primaryCta,
      image: { mode: brief.defaultImageMode ?? "none" },
      visible: true,
      visualDirection: "Aperçu produit avec carte d'offre, preuve sociale et CTA visible",
    },
  ];

  if (brief.aboutText && brief.aboutText.trim().length > 0) {
    sections.push({
      id: "about",
      type: "about",
      eyebrow: t("À propos", "About", "Acerca de"),
      headline: t(
        `Pourquoi nous accompagnons ${brief.targetAudience}`,
        `Why we work with ${brief.targetAudience}`,
        `Por qué acompañamos a ${brief.targetAudience}`
      ),
      body: brief.aboutText.trim(),
      image: { mode: "none" },
      visible: true,
    });
  }

  if (brief.videoUrl) {
    sections.push({
      id: "video",
      type: "video",
      eyebrow: t("Présentation", "Walkthrough", "Presentación"),
      headline: t(
        "Découvrez la méthode en quelques minutes",
        "See the method in a few minutes",
        "Descubre el método en pocos minutos"
      ),
      body: t(
        "Une vidéo courte pour comprendre l'approche, les résultats attendus et la prochaine étape",
        "A short video to grasp the approach, expected outcomes and the next step",
        "Un video corto para entender el enfoque, los resultados esperados y el siguiente paso"
      ),
      video: { provider: "url", url: brief.videoUrl },
      image: { mode: "none" },
      visible: true,
    });
  }

  sections.push(
    {
      id: "problem",
      type: "problem",
      eyebrow: t("Le blocage", "The bottleneck", "El bloqueo"),
      headline: t(
        "On n'achète pas ce qu'on ne comprend pas vite",
        "People do not buy what they cannot understand fast",
        "No se compra lo que no se entiende rápido"
      ),
      body: t(
        `${brief.mainPain}. Le tunnel doit expliquer la valeur, créer la confiance et faire avancer le prospect sans friction`,
        `${brief.mainPain}. The funnel must explain value, build trust and move the prospect forward without friction`,
        `${brief.mainPain}. El embudo debe explicar el valor, crear confianza y hacer avanzar al prospecto sin fricción`
      ),
      bullets: [
        t("Une promesse lisible en moins de 5 secondes", "A promise understood in under 5 seconds", "Una promesa comprensible en menos de 5 segundos"),
        t("Une objection traitée avant qu'elle bloque l'action", "An objection handled before it blocks action", "Una objeción tratada antes de bloquear la acción"),
        t("Une suite logique : problème, solution, preuve, offre", "A logical path: problem, solution, proof, offer", "Una secuencia lógica: problema, solución, prueba, oferta"),
      ],
      image: { mode: "none" },
      visible: true,
    },
    {
      id: "method",
      type: "solution",
      eyebrow: t("La méthode", "The method", "El método"),
      headline: t(
        "Un parcours de vente complet, pas une simple page",
        "A complete sales journey, not just a page",
        "Un recorrido de venta completo, no solo una página"
      ),
      body: t(
        `${brief.offerName} est présenté avec une structure orientée conversion : accroche, douleur, transformation, bénéfices, preuves, offre et relance email`,
        `${brief.offerName} is presented with a conversion structure: hook, pain, transformation, benefits, proof, offer and email follow-up`,
        `${brief.offerName} se presenta con una estructura de conversión: gancho, dolor, transformación, beneficios, pruebas, oferta y secuencia de emails`
      ),
      bullets: [
        t("Page de capture ou de vente", "Capture or sales page", "Página de captura o venta"),
        t("Page de remerciement", "Thank-you page", "Página de gracias"),
        t("Séquence email 3 messages", "3-email sequence", "Secuencia de 3 emails"),
      ],
      image: { mode: "none" },
      visible: true,
    },
    {
      id: "benefits",
      type: "benefits",
      eyebrow: t("Transformation", "Transformation", "Transformación"),
      headline: t(
        "Ce que votre client idéal obtient concrètement",
        "What your ideal customer actually gets",
        "Lo que obtiene tu cliente ideal de verdad"
      ),
      bullets: [
        t("Une prochaine étape simple, rassurante et immédiate", "A simple, reassuring and immediate next step", "Un siguiente paso simple, tranquilizador e inmediato"),
        t("Une vision claire du résultat attendu", "A clear view of the expected result", "Una visión clara del resultado esperado"),
        t("Des arguments adaptés à son niveau de conscience", "Arguments adapted to their awareness level", "Argumentos adaptados a su nivel de conciencia"),
        t("Un tunnel lisible sur mobile et cohérent avec votre marque", "A mobile-friendly funnel aligned with your brand", "Un embudo legible en móvil y alineado con tu marca"),
      ],
      cta: primaryCta,
      image: { mode: "none" },
      visible: true,
    },
    {
      id: "proof",
      type: "proof",
      eyebrow: t("Crédibilité", "Credibility", "Credibilidad"),
      headline: t(
        "Des signaux de confiance placés au bon endroit",
        "Trust signals in the right places",
        "Señales de confianza en el lugar correcto"
      ),
      body: t(
        "Le tunnel prévoit témoignages, résultats, chiffres ou garanties selon ce que vous pouvez prouver réellement",
        "The funnel uses testimonials, outcomes, metrics or guarantees based on what you can truthfully prove",
        "El embudo utiliza testimonios, resultados, cifras o garantías según lo que realmente puedas probar"
      ),
      bullets: [
        t("Témoignage court et spécifique", "Short and specific testimonial", "Testimonio corto y específico"),
        t("Bénéfice mesurable", "Measurable benefit", "Beneficio medible"),
        t("Réduction du risque avant le CTA", "Risk reduction before the CTA", "Reducción del riesgo antes del CTA"),
      ],
      image: { mode: "none" },
      visible: true,
    },
    {
      id: "offer",
      type: "offer",
      eyebrow: t("Offre", "Offer", "Oferta"),
      headline: t(
        `${brief.offerName} pour ${brief.price}`,
        `${brief.offerName} for ${brief.price}`,
        `${brief.offerName} por ${brief.price}`
      ),
      body: t(
        `Une offre présentée avec un positionnement ${brief.tone}, un design ${brief.designStyle} et une promesse centrale : ${brief.promise}`,
        `An offer with ${brief.tone} positioning, ${brief.designStyle} design and a core promise: ${brief.promise}`,
        `Una oferta con posicionamiento ${brief.tone}, diseño ${brief.designStyle} y una promesa central: ${brief.promise}`
      ),
      bullets: [
        t("Accès immédiat ou prise de contact guidée", "Immediate access or guided contact", "Acceso inmediato o contacto guiado"),
        t("Bonus et garantie clairement visibles", "Clear bonus and guarantee", "Bonus y garantía claramente visibles"),
        t("CTA principal répété aux moments clés", "Main CTA repeated at key moments", "CTA principal repetido en momentos clave"),
      ],
      cta: primaryCta,
      image: { mode: "none" },
      visible: true,
    },
    {
      id: "bonus",
      type: "bonus",
      eyebrow: t("Bonus", "Bonus", "Bonus"),
      headline: t(
        "Des bonus qui renforcent la décision",
        "Bonuses that strengthen the decision",
        "Bonus que refuerzan la decisión"
      ),
      bullets: [
        t("Checklist de mise en action", "Implementation checklist", "Checklist de puesta en acción"),
        t("Template prêt à adapter", "Ready-to-adapt template", "Plantilla lista para adaptar"),
        t("Email de suivi pour garder l'élan", "Follow-up email to keep momentum", "Email de seguimiento para mantener el impulso"),
      ],
      image: { mode: "none" },
      visible: true,
    },
    {
      id: "guarantee",
      type: "guarantee",
      eyebrow: t("Risque réduit", "Risk reversal", "Riesgo reducido"),
      headline: t(
        "Une décision plus facile à prendre",
        "An easier decision to make",
        "Una decisión más fácil de tomar"
      ),
      body: t(
        "Ajoutez une garantie, une promesse d'accompagnement ou une preuve de sérieux pour sécuriser le passage à l'action",
        "Add a guarantee, a support promise or a credibility proof to make taking action feel safer",
        "Añade una garantía, una promesa de acompañamiento o una prueba de seriedad para asegurar la decisión"
      ),
      cta: primaryCta,
      image: { mode: "none" },
      visible: true,
    },
    {
      id: "form",
      type: "form",
      eyebrow: t("Action", "Action", "Acción"),
      headline: t(
        "Recevoir les détails et passer à l'étape suivante",
        "Get the details and take the next step",
        "Recibe los detalles y da el siguiente paso"
      ),
      subheadline: t(
        "Nom, email, téléphone et source du tunnel sont prêts pour le CRM",
        "Name, email, phone and funnel source are ready for the CRM",
        "Nombre, email, teléfono y fuente del embudo listos para el CRM"
      ),
      cta: primaryCta,
      image: { mode: "none" },
      visible: true,
    },
    {
      id: "faq",
      type: "faq",
      headline: t("Questions fréquentes", "Frequently asked questions", "Preguntas frecuentes"),
      bullets: [
        t(
          "Est-ce adapté aux débutants ? Oui, le parcours est guidé étape par étape",
          "Is it beginner-friendly? Yes, the journey is guided step by step",
          "¿Es apto para principiantes? Sí, el recorrido está guiado paso a paso"
        ),
        t(
          "Puis-je l'utiliser avec systeme.io ? Oui, les blocs HTML sont prévus pour être collés directement",
          "Can I use it with systeme.io? Yes, HTML blocks are designed to be pasted directly",
          "¿Puedo usarlo con systeme.io? Sí, los bloques HTML están pensados para pegarse directamente"
        ),
        t(
          "Puis-je modifier le résultat ? Oui, chaque section peut être éditée ou régénérée",
          "Can I edit the result? Yes, every section can be edited or regenerated",
          "¿Puedo editar el resultado? Sí, cada sección se puede editar o regenerar"
        ),
      ],
      image: { mode: "none" },
      visible: true,
    }
  );

  return {
    funnelName: `${brief.brandName} — ${brief.offerName}`,
    language: brief.language,
    sections,
    thankYouPage: {
      headline: t(
        "Merci, votre demande est confirmée",
        "Thank you, your request is confirmed",
        "Gracias, tu solicitud está confirmada"
      ),
      body: t(
        "Consultez votre email et gardez cette page ouverte pour la prochaine étape",
        "Check your inbox and keep this page open for the next step",
        "Revisa tu email y mantén esta página abierta para el siguiente paso"
      ),
      cta: makeAnchorCta(
        t("Retour au site", "Back to site", "Volver al sitio"),
        "top"
      ),
    },
    emails: [
      {
        subject: t(
          `Votre accès à ${brief.offerName}`,
          `Your access to ${brief.offerName}`,
          `Tu acceso a ${brief.offerName}`
        ),
        html: `<p>${t("Merci pour votre intérêt", "Thanks for your interest", "Gracias por tu interés")}</p>`,
        text: t("Merci pour votre intérêt", "Thanks for your interest", "Gracias por tu interés"),
        cta: primaryCta,
      },
      {
        subject: t(
          "Une preuve simple avant de décider",
          "A simple proof before you decide",
          "Una prueba simple antes de decidir"
        ),
        html: `<p>${t("Voici pourquoi cette méthode fonctionne", "Here is why this method works", "Por esto funciona este método")}</p>`,
        text: t("Voici pourquoi cette méthode fonctionne", "Here is why this method works", "Por esto funciona este método"),
        cta: primaryCta,
      },
      {
        subject: t(
          "Prêt à passer à l'action ?",
          "Ready to take action?",
          "¿Listo para pasar a la acción?"
        ),
        html: `<p>${t("C'est le bon moment pour avancer", "Now is a good time to move forward", "Es el momento de avanzar")}</p>`,
        text: t("C'est le bon moment pour avancer", "Now is a good time to move forward", "Es el momento de avanzar"),
        cta: primaryCta,
      },
    ],
    seo: {
      title: `${brief.offerName} | ${brief.brandName}`,
      description: brief.promise,
    },
    design: {
      primaryColor,
      secondaryColor,
      accentColor,
      style: brief.designStyle,
    },
    defaultCta: primaryCta,
    meta: {
      funnelKind: brief.funnelKind,
      moodId: brief.moodId,
      creationMode: brief.creationMode,
      templateId: brief.templateId,
      logoUrl: brief.logoUrl,
    },
  };
}
