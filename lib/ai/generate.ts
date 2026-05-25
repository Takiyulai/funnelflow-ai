// lib/ai/generate.ts
import { z } from "zod";
import type {
  Funnel,
  FunnelBrief,
  FunnelSection,
  FunnelPage,
  PageRole,
  BonusItem,
  GuaranteeItem,
  CtaConfig,
  SectionItem,
  Language,
  IconName,
} from "@/lib/funnels/types";
import { makeAnchorCta, normalizeIconName } from "@/lib/funnels/types";
import {
  completeFunnelPrompt,
  mainPagePrompt,
  secondaryPagesPrompt,
} from "./prompts";
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
import {
  getDefaultPagesForKind,
  getBlueprintForRole,
} from "@/lib/funnels/pageCatalogs";
import {
  buildPagesFromBlueprints,
  chainPagesNavigation,
  filterSectionsByBlueprint,
} from "@/lib/funnels/pageGenerator";
import { normalizeFunnelKind } from "@/lib/funnels/kinds";

// ─────────────────────────────────────────────────────────────────────────────
// Erreur typée
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

// ✅ FIX : CTA ultra-tolérant. On accepte string, objet partiel, ou null.
// La normalisation se fait dans `normalizeCta`, qui garantit un `label` valide.
const ctaSchema = z
  .union([
    z.string(),
    z
      .object({
        // Aliases courants utilisés par l'IA
        label: z.string().optional(),
        text: z.string().optional(),
        title: z.string().optional(),
        // Cibles
        url: z.string().optional(),
        href: z.string().optional(),
        link: z.string().optional(),
        action: z.string().optional(),
        // Comportement
        mode: z.enum(["redirect", "anchor", "popup"]).optional(),
        target: z.enum(["_self", "_blank"]).optional(),
        anchorId: z.string().optional(),
        popupId: z.string().optional(),
      })
      .passthrough(),
    z.null(),
  ])
  .optional();

const imageSchema = z
  .object({
    mode: z.enum(["none", "upload", "ai-suggested"]).optional().default("none"),
    url: z.string().optional(),
    alt: z.string().optional(),
    credit: z.string().optional(),
    sourceUrl: z.string().optional(),
    suggestionQuery: z.string().optional(),
    mediaRef: z.string().optional(),
  })
  .optional()
  .default({ mode: "none" });

const styleSchema = z
  .object({
    textColor: z.string().optional(),
    accentColor: z.string().optional(),
    spacing: z.enum(["compact", "default", "large"]).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    layout: z.enum(["text-only", "image-only", "text-image", "image-text"]).optional(),
  })
  .optional()
  .default({});

const videoSchema = z
  .object({
    provider: z.enum(["youtube", "vimeo", "url", "upload"]).optional(),
    url: z.string().optional(),
    posterUrl: z.string().optional(),
  })
  .optional();

const sectionItemSchema = z.union([
  z.object({
    kind: z.literal("faq"),
    data: z
      .object({
        question: z.string().optional().default(""),
        answer: z.string().optional().default(""),
      })
      .passthrough(),
  }),
  z.object({
    kind: z.literal("testimonial"),
    data: z
      .object({
        quote: z.string().optional().default(""),
        authorName: z.string().optional().default(""),
        authorRole: z.string().optional(),
        avatarUrl: z.string().optional(),
        rating: z.number().optional(),
        sourceUrl: z.string().optional(),
      })
      .passthrough(),
  }),
  z.object({
    kind: z.literal("pricing"),
    data: z
      .object({
        name: z.string().optional().default("Plan"),
        price: z.string().optional().default("0€"),
        period: z.string().optional(),
        description: z.string().optional(),
        features: z.array(z.string()).optional().default([]),
        highlighted: z.boolean().optional(),
        badge: z.string().optional(),
        // ✅ FIX : même tolérance pour le CTA de pricing
        cta: ctaSchema,
      })
      .passthrough(),
  }),
  z.object({
    kind: z.literal("bonus"),
    data: z
      .object({
        title: z.string().optional().default(""),
        description: z.string().optional(),
        value: z.string().optional(),
        iconName: z.string().optional(),
      })
      .passthrough(),
  }),
  z.object({
    kind: z.literal("guarantee"),
    data: z
      .object({
        title: z.string().optional().default(""),
        description: z.string().optional(),
        duration: z.string().optional(),
        iconName: z.string().optional(),
      })
      .passthrough(),
  }),
  z.object({
    kind: z.literal("formField"),
    data: z
      .object({
        name: z.string().optional().default("field"),
        label: z.string().optional(),
        placeholder: z.string().optional(),
        type: z
          .enum(["text", "email", "tel", "number", "textarea", "select", "checkbox"])
          .optional()
          .default("text"),
        required: z.boolean().optional(),
        options: z.array(z.string()).optional(),
        width: z.enum(["full", "half"]).optional(),
      })
      .passthrough(),
  }),
]);

const sectionSchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  eyebrow: z.string().optional(),
  headline: z.string().optional().default(""),
  subheadline: z.string().optional(),
  body: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  cta: ctaSchema,
  image: imageSchema,
  video: videoSchema,
  visible: z.boolean().optional().default(true),
  style: styleSchema,
  visualDirection: z.string().optional(),
  items: z.array(sectionItemSchema).optional(),
});

const funnelSchema = z.object({
  funnelName: z.string().optional().default("Mon Tunnel"),
  language: z.enum(["fr", "en", "es"]).optional().default("fr"),
  sections: z.array(sectionSchema).optional().default([]),
  thankYouPage: z
    .object({
      headline: z.string().optional().default("Merci !"),
      body: z.string().optional().default("Votre demande a été prise en compte."),
      cta: ctaSchema,
    })
    .optional()
    .default({}),
  emails: z
    .array(
      z.object({
        subject: z.string().optional().default(""),
        html: z.string().optional().default(""),
        text: z.string().optional().default(""),
        cta: ctaSchema,
      })
    )
    .optional()
    .default([]),
  seo: z
    .object({
      title: z.string().optional().default(""),
      description: z.string().optional().default(""),
    })
    .optional()
    .default({}),
  design: z
    .object({
      primaryColor: z.string().optional().default("#000000"),
      secondaryColor: z.string().optional().default("#ffffff"),
      accentColor: z.string().optional().default("#3b82f6"),
      style: z.string().optional().default("modern"),
    })
    .optional()
    .default({}),
});

const secondaryPagesSchema = z.object({
  pages: z.array(
    z.object({
      role: z.string(),
      sections: z.array(sectionSchema),
    })
  ),
});

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation CTA — tolère tous les formats IA
// ─────────────────────────────────────────────────────────────────────────────
function pickString(...candidates: unknown[]): string | undefined {
  for (const c of candidates) {
    if (typeof c === "string") {
      const trimmed = c.trim();
      if (trimmed) return trimmed;
    }
  }
  return undefined;
}

function normalizeCta(raw: unknown, fallback: CtaConfig): CtaConfig {
  // null / undefined → fallback complet
  if (raw == null) return { ...fallback };

  // string simple → on l'utilise comme label
  if (typeof raw === "string") {
    const label = raw.trim();
    return label ? { ...fallback, label } : { ...fallback };
  }

  // Objet (potentiellement incomplet / avec alias)
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;

    const label =
      pickString(obj.label, obj.text, obj.title) ?? fallback.label;

    const url = pickString(obj.url, obj.href, obj.link, obj.action);

    const mode =
      (obj.mode === "redirect" || obj.mode === "anchor" || obj.mode === "popup"
        ? (obj.mode as CtaConfig["mode"])
        : undefined) ??
      fallback.mode ??
      "anchor";

    const target =
      obj.target === "_blank" || obj.target === "_self"
        ? (obj.target as CtaConfig["target"])
        : "_self";

    const anchorId =
      pickString(obj.anchorId) ??
      (mode === "anchor" ? fallback.anchorId ?? "lead-form" : undefined);

    const popupId = pickString(obj.popupId);

    return {
      label,
      mode,
      url,
      target,
      anchorId,
      popupId,
    };
  }

  // Tout autre type inattendu → fallback
  return { ...fallback };
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction JSON tolérante
// ─────────────────────────────────────────────────────────────────────────────
function extractJsonPayload(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();

  if (!s.startsWith("{") && !s.startsWith("[")) {
    const start = s.indexOf("{");
    if (start === -1) return s;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
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
// Normalisation des SectionItem issus du parsing Zod
// ─────────────────────────────────────────────────────────────────────────────
function normalizeSectionItems(
  rawItems: z.infer<typeof sectionItemSchema>[],
  fallbackCta: CtaConfig
): SectionItem[] {
  return rawItems.map((item): SectionItem => {
    switch (item.kind) {
      case "bonus":
        return {
          kind: "bonus",
          data: {
            title: item.data.title ?? "",
            description: item.data.description,
            value: item.data.value,
            iconName: item.data.iconName
              ? normalizeIconName(item.data.iconName)
              : "gift",
          },
        };
      case "guarantee":
        return {
          kind: "guarantee",
          data: {
            title: item.data.title ?? "",
            description: item.data.description,
            duration: item.data.duration,
            iconName: item.data.iconName
              ? normalizeIconName(item.data.iconName)
              : "shield",
          },
        };
      case "faq":
        return {
          kind: "faq",
          data: {
            question: item.data.question ?? "",
            answer: item.data.answer ?? "",
          },
        };
      case "testimonial":
        return {
          kind: "testimonial",
          data: {
            quote: item.data.quote ?? "",
            authorName: item.data.authorName ?? "",
            authorRole: item.data.authorRole,
            avatarUrl: item.data.avatarUrl,
            rating: item.data.rating,
            sourceUrl: item.data.sourceUrl,
          },
        };
      case "pricing": {
        // ✅ FIX : CTA de pricing également normalisé via normalizeCta
        const pricingFallbackCta: CtaConfig = {
          ...fallbackCta,
          label: fallbackCta.label || "Choisir",
        };
        return {
          kind: "pricing",
          data: {
            name: item.data.name ?? "Plan",
            price: item.data.price ?? "0€",
            period: item.data.period,
            description: item.data.description,
            features: item.data.features ?? [],
            highlighted: item.data.highlighted,
            badge: item.data.badge,
            cta: item.data.cta
              ? normalizeCta(item.data.cta, pricingFallbackCta)
              : undefined,
          },
        };
      }
      case "formField":
        return {
          kind: "formField",
          data: {
            name: item.data.name ?? "field",
            label: item.data.label,
            placeholder: item.data.placeholder,
            type: item.data.type ?? "text",
            required: item.data.required,
            options: item.data.options,
            width: item.data.width,
          },
        };
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Label CTA contextualisé selon le type de section
// ─────────────────────────────────────────────────────────────────────────────
function getCtaLabelForSection(sectionType: string, lang: Language): string {
  const labels: Record<string, Record<Language, string>> = {
    hero: { fr: "Je veux y accéder", en: "I want access", es: "Quiero acceder" },
    cta: { fr: "Je veux y accéder", en: "I want access", es: "Quiero acceder" },
    offer: { fr: "Je veux l'offre", en: "I want this offer", es: "Quiero la oferta" },
    pricing: { fr: "Je commande", en: "Order now", es: "Lo quiero" },
    bonus: { fr: "Je veux mes bonus", en: "Get my bonuses", es: "Quiero mis bonos" },
    faq: { fr: "Continuer", en: "Continue", es: "Continuar" },
    proof: { fr: "Rejoindre", en: "Join now", es: "Unirme" },
    testimonials: { fr: "Rejoindre", en: "Join now", es: "Unirme" },
    guarantee: { fr: "C'est parti", en: "Let's go", es: "Vamos" },
  };
  const map = labels[sectionType];
  if (!map) {
    return lang === "fr" ? "Continuer" : lang === "es" ? "Continuar" : "Continue";
  }
  return map[lang] ?? map.fr;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser : sections IA → FunnelSection[]
// ─────────────────────────────────────────────────────────────────────────────
function parseSectionsArray(
  rawSections: z.infer<typeof sectionSchema>[],
  fallbackCta: CtaConfig,
  brief: FunnelBrief
): FunnelSection[] {
  return rawSections.map((section, index) => {
    // ✅ FIX : on construit un fallback CTA spécifique à chaque section pour
    // garantir qu'aucun label vide ne soit jamais affiché à l'utilisateur.
    const sectionFallbackCta: CtaConfig = {
      ...fallbackCta,
      label:
        fallbackCta.label ||
        getCtaLabelForSection(section.type, brief.language),
    };

    return {
      id: section.id ?? `${section.type}-${index + 1}`,
      type: section.type as FunnelSection["type"],
      eyebrow: section.eyebrow,
      headline: section.headline,
      subheadline: section.subheadline,
      body: section.body,
      bullets: section.bullets,
      // ✅ FIX : on normalise TOUJOURS via normalizeCta même si l'IA renvoie
      // un objet incomplet (sans label) ou une string brute.
      cta:
        section.cta !== undefined
          ? normalizeCta(section.cta, sectionFallbackCta)
          : undefined,
      image: section.image ?? { mode: brief.defaultImageMode ?? "none" },
      video: section.video as FunnelSection["video"],
      visible: section.visible ?? true,
      style: section.style as FunnelSection["style"],
      visualDirection: section.visualDirection,
      items: section.items
        ? normalizeSectionItems(section.items, sectionFallbackCta)
        : undefined,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Bibliothèque média
// ─────────────────────────────────────────────────────────────────────────────
function buildMediaLibraryFromBrief(brief: FunnelBrief): Funnel["media"] {
  if (!brief.medias || brief.medias.length === 0) return undefined;
  const cleaned = brief.medias.filter(
    (m) => typeof m.url === "string" && m.url.length > 0
  );
  return cleaned.length > 0 ? cleaned : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Application du style de template
// ─────────────────────────────────────────────────────────────────────────────
function buildStyleMapByType(
  styledSections: FunnelSection[] | undefined
): Map<string, Partial<FunnelSection>> {
  const map = new Map<string, Partial<FunnelSection>>();
  if (!styledSections || styledSections.length === 0) return map;
  for (const s of styledSections) {
    if (map.has(s.type)) continue;
    map.set(s.type, {
      style: s.style,
      image: s.image,
      video: s.video,
      visualDirection: s.visualDirection,
    });
  }
  return map;
}

function applyStyleMapToSections(
  sections: FunnelSection[],
  styleMap: Map<string, Partial<FunnelSection>>
): FunnelSection[] {
  if (styleMap.size === 0) return sections;
  return sections.map((sec) => {
    const styling = styleMap.get(sec.type);
    if (!styling) return sec;

    const hasMedia = !!(sec.image && (sec.image.mediaRef || sec.image.url));

    return {
      ...sec,
      style: sec.style ?? styling.style,
      visualDirection: sec.visualDirection ?? styling.visualDirection,
      image: hasMedia ? sec.image : styling.image ?? sec.image,
      video: sec.video ?? styling.video,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Lot B3 — Enrichissement des sections riches (anti-FAQ-vide, etc.)
// ─────────────────────────────────────────────────────────────────────────────

const RICH_SECTION_TYPES = new Set<string>([
  "faq",
  "testimonials",
  "proof",
  "pricing",
  "offer",
  "bonus",
  "guarantee",
]);

function tLang<T extends Record<Language, string>>(map: T, lang: Language): string {
  return map[lang] ?? map.fr;
}

function generateFaqAnswer(question: string, brief: FunnelBrief): string {
  const lang = brief.language;
  const q = question.toLowerCase();

  if (/combien|temps|délai|quand|durée/i.test(q)) {
    return tLang(
      {
        fr: `L'accès est envoyé immédiatement par email après votre inscription. Vous pouvez consulter ${brief.offerName} à votre rythme, sans limite de temps.`,
        en: `Access is sent immediately by email after sign-up. You can go through ${brief.offerName} at your own pace, with no time limit.`,
        es: `El acceso se envía de inmediato por email tras la inscripción. Puedes consultar ${brief.offerName} a tu ritmo, sin límite de tiempo.`,
      },
      lang
    );
  }
  if (/mobile|téléphone|smartphone|tablette|appareil/i.test(q)) {
    return tLang(
      {
        fr: `Oui, tous les contenus sont 100% compatibles mobile, tablette et ordinateur. Vous pouvez les consulter sur n'importe quel appareil.`,
        en: `Yes, all content is 100% compatible with mobile, tablet and desktop. You can access it on any device.`,
        es: `Sí, todo el contenido es 100% compatible con móvil, tableta y escritorio. Puedes acceder desde cualquier dispositivo.`,
      },
      lang
    );
  }
  if (/remboursement|garantie|satisfait/i.test(q)) {
    return tLang(
      {
        fr: `Nous offrons une garantie satisfait ou remboursé de 30 jours. Si vous n'êtes pas satisfait, écrivez-nous et vous serez remboursé sans justification.`,
        en: `We offer a 30-day money-back guarantee. If you're not satisfied, just email us and you'll be refunded, no questions asked.`,
        es: `Ofrecemos una garantía de devolución de 30 días. Si no estás satisfecho, escríbenos y serás reembolsado sin preguntas.`,
      },
      lang
    );
  }
  if (/débutant|niveau|expérience|connaissance/i.test(q)) {
    return tLang(
      {
        fr: `Aucune connaissance préalable n'est nécessaire. Le contenu de ${brief.offerName} est pensé pour ${brief.targetAudience}, à partir de zéro.`,
        en: `No prior knowledge is required. The content of ${brief.offerName} is designed for ${brief.targetAudience}, from scratch.`,
        es: `No se requiere conocimiento previo. El contenido de ${brief.offerName} está pensado para ${brief.targetAudience}, desde cero.`,
      },
      lang
    );
  }
  if (/prix|coût|payer|gratuit/i.test(q)) {
    return tLang(
      {
        fr: `Le tarif est de ${brief.price}. Aucun frais caché. Vous bénéficiez d'un accès complet et illimité.`,
        en: `The price is ${brief.price}. No hidden fees. You get full unlimited access.`,
        es: `El precio es ${brief.price}. Sin tarifas ocultas. Obtienes acceso completo e ilimitado.`,
      },
      lang
    );
  }
  if (/contact|support|aide|question/i.test(q)) {
    return tLang(
      {
        fr: `Notre équipe est joignable par email et répond sous 24 à 48 heures ouvrées. Nous sommes là pour vous accompagner.`,
        en: `Our team is reachable by email and answers within 24 to 48 business hours. We're here to help.`,
        es: `Nuestro equipo está disponible por email y responde en 24 a 48 horas hábiles. Estamos aquí para ayudarte.`,
      },
      lang
    );
  }

  return tLang(
    {
      fr: `Excellente question. ${brief.offerName} a été conçu spécifiquement pour répondre à ce point : ${brief.promise}. Si vous avez besoin de précisions, contactez-nous.`,
      en: `Great question. ${brief.offerName} was designed specifically to address this: ${brief.promise}. Contact us if you need more details.`,
      es: `Excelente pregunta. ${brief.offerName} fue diseñado específicamente para abordar este punto: ${brief.promise}. Contáctanos si necesitas más detalles.`,
    },
    lang
  );
}

function buildFallbackFaqItems(brief: FunnelBrief): SectionItem[] {
  const lang = brief.language;
  const questions = tLang(
    {
      fr: [
        `Comment vais-je recevoir ${brief.offerName} ?`,
        `Combien de temps faut-il pour voir des résultats ?`,
        `Est-ce que ça fonctionne pour les débutants ?`,
        `Y a-t-il une garantie satisfait ou remboursé ?`,
        `Comment vous contacter si j'ai une question ?`,
      ].join("|"),
      en: [
        `How will I receive ${brief.offerName}?`,
        `How long does it take to see results?`,
        `Does it work for beginners?`,
        `Is there a money-back guarantee?`,
        `How can I contact you if I have a question?`,
      ].join("|"),
      es: [
        `¿Cómo recibiré ${brief.offerName}?`,
        `¿Cuánto tiempo para ver resultados?`,
        `¿Funciona para principiantes?`,
        `¿Hay garantía de devolución?`,
        `¿Cómo contactarles si tengo dudas?`,
      ].join("|"),
    },
    lang
  ).split("|");

  return questions.map((q) => ({
    kind: "faq" as const,
    data: { question: q, answer: generateFaqAnswer(q, brief) },
  }));
}

function buildFallbackTestimonialItems(brief: FunnelBrief): SectionItem[] {
  const lang = brief.language;
  const exampleTag = tLang(
    { fr: "Exemple — à personnaliser :", en: "Example — to customize:", es: "Ejemplo — a personalizar:" },
    lang
  );

  const personasByLang: Record<Language, { name: string; role: string }[]> = {
    fr: [
      { name: "Claire D.", role: "Maman de 2 enfants" },
      { name: "Marc L.", role: "Entrepreneur" },
      { name: "Sophie M.", role: "Coach indépendante" },
    ],
    en: [
      { name: "Claire D.", role: "Mother of two" },
      { name: "Mark L.", role: "Entrepreneur" },
      { name: "Sophie M.", role: "Independent coach" },
    ],
    es: [
      { name: "Clara D.", role: "Madre de dos hijos" },
      { name: "Marco L.", role: "Emprendedor" },
      { name: "Sofía M.", role: "Coach independiente" },
    ],
  };
  const personas = personasByLang[lang] ?? personasByLang.fr;

  const quotes = tLang(
    {
      fr: [
        `${exampleTag} ${brief.offerName} m'a vraiment aidé à avancer concrètement, je le recommande sans hésiter.`,
        `${exampleTag} Enfin un contenu clair et actionnable sur ${brief.promise}. Bravo !`,
        `${exampleTag} J'ai vu des résultats en quelques semaines, contenu très bien structuré.`,
      ].join("|"),
      en: [
        `${exampleTag} ${brief.offerName} really helped me move forward. I recommend it without hesitation.`,
        `${exampleTag} Finally clear, actionable content on ${brief.promise}. Well done!`,
        `${exampleTag} I saw results in just a few weeks. Very well-structured content.`,
      ].join("|"),
      es: [
        `${exampleTag} ${brief.offerName} realmente me ayudó a avanzar. Lo recomiendo sin dudar.`,
        `${exampleTag} Por fin contenido claro y accionable sobre ${brief.promise}. ¡Genial!`,
        `${exampleTag} Vi resultados en pocas semanas. Contenido muy bien estructurado.`,
      ].join("|"),
    },
    lang
  ).split("|");

  return personas.map((p, i) => ({
    kind: "testimonial" as const,
    data: {
      quote: quotes[i] ?? quotes[0],
      authorName: p.name,
      authorRole: p.role,
      rating: 5,
    },
  }));
}

function convertBulletsToTestimonialItems(
  bullets: string[],
  brief: FunnelBrief
): SectionItem[] {
  const lang = brief.language;
  const exampleTag = tLang(
    { fr: "Exemple — à personnaliser :", en: "Example — to customize:", es: "Ejemplo — a personalizar:" },
    lang
  );
  const namesByLang: Record<Language, string[]> = {
    fr: ["Claire D.", "Marc L.", "Sophie M."],
    en: ["Claire D.", "Mark L.", "Sophie M."],
    es: ["Clara D.", "Marco L.", "Sofía M."],
  };
  const names = namesByLang[lang] ?? namesByLang.fr;

  return bullets.slice(0, 3).map((b, i) => ({
    kind: "testimonial" as const,
    data: {
      quote: `${exampleTag} ${b}`,
      authorName: names[i] ?? names[0],
      authorRole: undefined,
      rating: 5,
    },
  }));
}

function buildFallbackPricingItems(brief: FunnelBrief): SectionItem[] {
  const lang = brief.language;
  const features = tLang(
    {
      fr: [
        `Accès complet à ${brief.offerName}`,
        `Compatible mobile, tablette et ordinateur`,
        `Mises à jour à vie incluses`,
        `Garantie satisfait ou remboursé 30 jours`,
      ].join("|"),
      en: [
        `Full access to ${brief.offerName}`,
        `Mobile, tablet and desktop compatible`,
        `Lifetime updates included`,
        `30-day money-back guarantee`,
      ].join("|"),
      es: [
        `Acceso completo a ${brief.offerName}`,
        `Compatible con móvil, tableta y escritorio`,
        `Actualizaciones de por vida incluidas`,
        `Garantía de devolución de 30 días`,
      ].join("|"),
    },
    lang
  ).split("|");

  return [
    {
      kind: "pricing" as const,
      data: {
        name: brief.offerName,
        price: brief.price,
        period: tLang({ fr: "paiement unique", en: "one-time payment", es: "pago único" }, lang),
        description: brief.promise,
        features,
        highlighted: true,
        badge: tLang({ fr: "Recommandé", en: "Recommended", es: "Recomendado" }, lang),
        cta: {
          label: tLang({ fr: "Je veux l'accès", en: "I want access", es: "Quiero el acceso" }, lang),
          mode: "anchor",
          anchorId: "lead-form",
        },
      },
    },
  ];
}

function buildFallbackBonusItems(brief: FunnelBrief): SectionItem[] {
  const offerName = brief.offerName || "votre offre";

  const bonuses: BonusItem[] = [
    {
      title: "Guide de démarrage rapide",
      description: `Démarrez immédiatement avec ${offerName} grâce à ce guide pas à pas.`,
      iconName: "gift",
    },
    {
      title: "Checklist exclusive",
      description: "Une checklist complète pour ne rien oublier et progresser sereinement.",
      iconName: "checkCircle",
    },
    {
      title: "Accès communauté privée",
      description: "Rejoignez une communauté de membres motivés et bénéficiez d'un soutien continu.",
      iconName: "star",
    },
  ];

  return bonuses.map<SectionItem>((data) => ({ kind: "bonus", data }));
}

function convertBulletsToBonusItems(bullets: string[]): SectionItem[] {
  const iconCycle: IconName[] = ["checkCircle", "play", "download", "gift", "star"];
  return bullets.map<SectionItem>((b, i) => {
    const bonusData: BonusItem = {
      title: b,
      iconName: iconCycle[i % iconCycle.length],
    };
    return { kind: "bonus", data: bonusData };
  });
}

function buildFallbackGuaranteeItems(brief: FunnelBrief): SectionItem[] {
  const lang = brief.language;
  const guarantees: GuaranteeItem[] = [
    {
      title: tLang({ fr: "Satisfait ou remboursé", en: "Money-back guarantee", es: "Satisfecho o reembolsado" }, lang),
      description: tLang(
        {
          fr: `Si dans les 30 jours vous n'êtes pas satisfait de ${brief.offerName}, demandez votre remboursement intégral, sans avoir à vous justifier.`,
          en: `If you're not satisfied with ${brief.offerName} within 30 days, request a full refund — no questions asked.`,
          es: `Si en 30 días no estás satisfecho con ${brief.offerName}, pide tu reembolso completo, sin justificaciones.`,
        },
        lang
      ),
      duration: tLang({ fr: "30 jours", en: "30 days", es: "30 días" }, lang),
      iconName: "shield",
    },
  ];
  return guarantees.map<SectionItem>((data) => ({ kind: "guarantee", data }));
}

function enrichSectionsWithDefaults(
  sections: FunnelSection[],
  brief: FunnelBrief
): FunnelSection[] {
  return sections.map((section) => {
    const type = section.type as string;

    if (!RICH_SECTION_TYPES.has(type)) return section;

    const existingItems = Array.isArray(section.items) ? section.items : [];

    // ─── FAQ ─────────────────────────────────────────────────────────
    if (type === "faq") {
      const validFaqItems = existingItems.filter(
        (it) => it.kind === "faq" && it.data?.question && it.data?.answer
      );
      if (validFaqItems.length >= 3) {
        return { ...section, items: validFaqItems, body: undefined, bullets: undefined };
      }
      if (Array.isArray(section.bullets) && section.bullets.length > 0) {
        const items: SectionItem[] = section.bullets.map((q) => ({
          kind: "faq" as const,
          data: { question: q, answer: generateFaqAnswer(q, brief) },
        }));
        const enriched =
          items.length >= 3 ? items : [...items, ...buildFallbackFaqItems(brief)].slice(0, 5);
        return { ...section, items: enriched, body: undefined, bullets: undefined };
      }
      return {
        ...section,
        items: buildFallbackFaqItems(brief),
        body: undefined,
        bullets: undefined,
      };
    }

    // ─── Testimonials / Proof ─────────────────────────────────────────
    if (type === "testimonials" || type === "proof") {
      const validTestimonials = existingItems.filter(
        (it) => it.kind === "testimonial" && it.data?.quote && it.data?.authorName
      );
      if (validTestimonials.length >= 1) {
        return { ...section, items: validTestimonials, body: section.body, bullets: undefined };
      }
      if (Array.isArray(section.bullets) && section.bullets.length > 0) {
        const items = convertBulletsToTestimonialItems(section.bullets, brief);
        return { ...section, items, bullets: undefined };
      }
      const hasInformativeContent =
        !!(section.body && section.body.length > 30) ||
        !!(section.subheadline && section.subheadline.length > 10);
      if (type === "proof" && hasInformativeContent && !section.image) {
        return section;
      }
      return {
        ...section,
        items: buildFallbackTestimonialItems(brief),
        bullets: undefined,
      };
    }

    // ─── Pricing / Offer ──────────────────────────────────────────────
    if (type === "pricing" || type === "offer") {
      const validPricing = existingItems.filter(
        (it) =>
          it.kind === "pricing" &&
          it.data?.name &&
          it.data?.price &&
          Array.isArray(it.data?.features)
      );
      if (validPricing.length >= 1) {
        return { ...section, items: validPricing, bullets: undefined };
      }
      if (Array.isArray(section.bullets) && section.bullets.length > 0) {
        const fallback = buildFallbackPricingItems(brief);
        const basePricing = (fallback[0] as Extract<SectionItem, { kind: "pricing" }>).data;
        const enriched: SectionItem[] = [
          {
            kind: "pricing" as const,
            data: {
              ...basePricing,
              features: section.bullets,
            },
          },
        ];
        return { ...section, items: enriched, bullets: undefined };
      }
      return { ...section, items: buildFallbackPricingItems(brief), bullets: undefined };
    }

    // ─── Bonus ────────────────────────────────────────────────────────
    if (type === "bonus") {
      const validBonus = existingItems.filter(
        (it) => it.kind === "bonus" && it.data?.title
      );
      if (validBonus.length >= 1) {
        return { ...section, items: validBonus, bullets: undefined };
      }
      if (Array.isArray(section.bullets) && section.bullets.length > 0) {
        const items = convertBulletsToBonusItems(section.bullets);
        return { ...section, items, bullets: undefined };
      }
      return { ...section, items: buildFallbackBonusItems(brief), bullets: undefined };
    }

    // ─── Guarantee ────────────────────────────────────────────────────
    if (type === "guarantee") {
      const validGuarantee = existingItems.filter(
        (it) => it.kind === "guarantee" && it.data?.title
      );
      if (validGuarantee.length >= 1) {
        return { ...section, items: validGuarantee.slice(0, 1), bullets: undefined };
      }
      return { ...section, items: buildFallbackGuaranteeItems(brief), bullets: undefined };
    }

    return section;
  });
}

function enrichFunnelPages(pages: FunnelPage[], brief: FunnelBrief): FunnelPage[] {
  return pages.map((page) => ({
    ...page,
    sections: enrichSectionsWithDefaults(page.sections, brief),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Parseur principal (legacy single-page, conservé pour rétrocompat)
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
    console.log("=== ZOD ERRORS (parseFunnelJson) — detailed ===");
    console.log(JSON.stringify(result.error.issues, null, 2));
    console.log("=== END ZOD ERRORS ===");
    throw new AiGenerationError(
      "schema-mismatch",
      "La réponse de l'IA ne respecte pas la structure attendue",
      JSON.stringify(result.error.flatten().fieldErrors).slice(0, 500)
    );
  }
  const parsed = result.data;

  const fallbackCta: CtaConfig =
    brief.primaryCta ??
    makeAnchorCta(
      brief.language === "fr"
        ? "Recevoir les détails"
        : brief.language === "es"
        ? "Recibir los detalles"
        : "Get the details",
      "lead-form"
    );

  const rawSections = parseSectionsArray(parsed.sections, fallbackCta, brief);
  const sections = enrichSectionsWithDefaults(rawSections, brief);

  const media = buildMediaLibraryFromBrief(brief);

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
    emails: (parsed.emails ?? []).map((email) => ({
      subject: email.subject,
      html: email.html,
      text: email.text,
      cta: normalizeCta(email.cta, fallbackCta),
    })),
    seo: parsed.seo,
    design: parsed.design,
    defaultCta: fallbackCta,
    media,
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
// Helper : instruction template
// ─────────────────────────────────────────────────────────────────────────────
function buildTemplateInstruction(
  template: ReturnType<typeof getPremiumTemplate>,
  brief: FunnelBrief
): string {
  if (!template) return "";

  const lang = brief.language ?? "fr";
  const personality = template.personality[lang] ?? template.personality.fr;
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
    `- Densité: ${template.density}`,
    lang === "fr"
      ? `- Génère EXACTEMENT ces sections, dans cet ordre, en utilisant ces "type" dans le JSON :`
      : lang === "es"
      ? `- Genera EXACTAMENTE estas secciones, en este orden:`
      : `- Generate EXACTLY these sections, in this order:`,
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
// ✅ FIX : Consigne CTA stricte injectée dans tous les prompts pour réduire
// la fréquence des réponses malformées de l'IA.
// ─────────────────────────────────────────────────────────────────────────────
function buildCtaInstruction(lang: Language): string {
  const fr = `

RÈGLE STRICTE POUR LE CHAMP "cta" (à respecter pour CHAQUE section) :
- Le champ "cta" doit être un OBJET JSON exactement de cette forme :
  { "label": "Texte du bouton", "mode": "anchor", "anchorId": "lead-form" }
- "label" est OBLIGATOIRE et doit être une chaîne non vide (5 à 30 caractères).
- N'utilise JAMAIS une simple chaîne de caractères pour "cta".
- N'omet JAMAIS le champ "label" dans l'objet "cta".
- Si tu hésites, utilise : { "label": "Je veux y accéder", "mode": "anchor", "anchorId": "lead-form" }
`;
  const en = `

STRICT RULE FOR THE "cta" FIELD (must apply to EVERY section):
- The "cta" field must be a JSON OBJECT with exactly this shape:
  { "label": "Button text", "mode": "anchor", "anchorId": "lead-form" }
- "label" is REQUIRED and must be a non-empty string (5 to 30 chars).
- NEVER use a plain string for "cta".
- NEVER omit the "label" field inside the "cta" object.
- When unsure, use: { "label": "I want access", "mode": "anchor", "anchorId": "lead-form" }
`;
  const es = `

REGLA ESTRICTA PARA EL CAMPO "cta" (aplica a CADA sección):
- El campo "cta" debe ser un OBJETO JSON con esta forma exacta:
  { "label": "Texto del botón", "mode": "anchor", "anchorId": "lead-form" }
- "label" es OBLIGATORIO y debe ser una cadena no vacía (5 a 30 caracteres).
- NUNCA uses una cadena simple para "cta".
- NUNCA omitas el campo "label" dentro del objeto "cta".
- En caso de duda, usa: { "label": "Quiero acceder", "mode": "anchor", "anchorId": "lead-form" }
`;
  return lang === "fr" ? fr : lang === "es" ? es : en;
}

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper appel OpenAI réutilisable
// ─────────────────────────────────────────────────────────────────────────────
async function callOpenAI(args: {
  systemMessage: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new AiGenerationError(
      "missing-key",
      "Aucune clé OpenAI détectée côté serveur. Ajoutez OPENAI_API_KEY dans .env.local puis redémarrez"
    );
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: args.systemMessage },
        { role: "user", content: args.userPrompt },
      ],
      temperature: args.temperature ?? 0.7,
      response_format: { type: "json_object" },
      max_tokens: args.maxTokens ?? 8000,
    });

    const rawText = response.choices?.[0]?.message?.content?.trim() ?? "";
    if (!rawText || rawText.length < 20) {
      throw new AiGenerationError(
        "empty-response",
        "L'IA a retourné une réponse vide. Réessayez la génération"
      );
    }
    return rawText;
  } catch (error) {
    if (error instanceof AiGenerationError) throw error;

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
}

const SYSTEM_MESSAGE_FUNNEL =
  "You are an expert funnel copywriter and conversion specialist. " +
  "You MUST respond with a single JSON object that strictly matches the requested schema. " +
  "Do not wrap the JSON in markdown code fences. Do not add any prose before or after the JSON. " +
  "Write all copy in the language specified in the brief, with the requested tone and target audience in mind. " +
  "Every section's \"cta\" field MUST be an object of the form { \"label\": \"...\", \"mode\": \"anchor\", \"anchorId\": \"lead-form\" }, " +
  "never a plain string, and \"label\" must always be a non-empty string.";

// ─────────────────────────────────────────────────────────────────────────────
// Génération multi-pages (Lot B2 — fonction principale)
// ─────────────────────────────────────────────────────────────────────────────
export async function generateMultiPageFunnelWithAI(brief: FunnelBrief): Promise<Funnel> {
  if (!process.env.OPENAI_API_KEY) {
    throw new AiGenerationError(
      "missing-key",
      "Aucune clé OpenAI détectée côté serveur. Ajoutez OPENAI_API_KEY dans .env.local puis redémarrez"
    );
  }

  const normalizedKind = normalizeFunnelKind(brief.funnelKind);
  const blueprints = getDefaultPagesForKind(normalizedKind);

  if (blueprints.length === 0) {
    console.warn(
      `[generateMultiPageFunnelWithAI] Pas de catalogue pour kind="${brief.funnelKind}", fallback monopage`
    );
    return generateFunnelWithAI(brief);
  }

  const mainBlueprint = blueprints.find((b) => b.isHome) ?? blueprints[0];
  const secondaryBlueprints = blueprints.filter((b) => b !== mainBlueprint);

  const template =
    getPremiumTemplate(brief.templateId) ??
    getPremiumTemplate(DEFAULT_PREMIUM_TEMPLATE_ID) ??
    PREMIUM_TEMPLATES[0];

  console.info(
    `[generateMultiPageFunnelWithAI] Lancement de la génération en parallèle (Main + ${secondaryBlueprints.length} pages secondaires)...`
  );

  // ✅ FIX : on injecte la consigne CTA stricte dans le prompt
  const ctaInstruction = buildCtaInstruction(brief.language);
  const mainPromptText =
    mainPagePrompt({ brief, blueprint: mainBlueprint }) + ctaInstruction;

  // On lance les deux appels en parallèle
  const mainPromise = callOpenAI({
    systemMessage: SYSTEM_MESSAGE_FUNNEL,
    userPrompt: mainPromptText,
    maxTokens: 4000,
  });

  let secondaryPromise: Promise<string | null> = Promise.resolve(null);
  if (secondaryBlueprints.length > 0) {
    const secondaryPromptText =
      secondaryPagesPrompt({
        brief,
        mainPageHeadline: brief.promise,
        mainPagePromise: brief.promise,
        blueprints: secondaryBlueprints,
      }) + ctaInstruction;
    secondaryPromise = callOpenAI({
      systemMessage: SYSTEM_MESSAGE_FUNNEL,
      userPrompt: secondaryPromptText,
      maxTokens: 3500,
    });
  }

  // Timeout de sécurité pour ne pas bloquer tout le processus
  const timeoutPromise = new Promise<null>((_, reject) =>
    setTimeout(() => reject(new Error("Timeout AI")), 45000)
  );

  let mainRawText: string;
  let secondaryRawText: string | null = null;

  try {
    // On attend d'abord la page principale qui est CRITIQUE
    mainRawText = (await Promise.race([mainPromise, timeoutPromise])) as string;

    // On essaie de récupérer les pages secondaires, mais sans bloquer si elles échouent
    try {
      secondaryRawText = await Promise.race([secondaryPromise, Promise.resolve(null)]);
    } catch (secErr) {
      console.warn(
        "[generateMultiPageFunnelWithAI] Échec non-bloquant des pages secondaires:",
        secErr
      );
    }
  } catch (err) {
    console.error(
      "[generateMultiPageFunnelWithAI] Échec critique de la page principale ou timeout global:",
      err
    );
    throw new AiGenerationError(
      "network-error",
      "Le serveur AI a mis trop de temps à répondre. Réessayez avec un brief plus court ou vérifiez votre connexion.",
      err instanceof Error ? err.message : String(err)
    );
  }

  const mainParsed = funnelSchema.safeParse(JSON.parse(extractJsonPayload(mainRawText)));
  if (!mainParsed.success) {
    // 🔍 DEBUG : log de la réponse brute pour diagnostiquer le schema mismatch
    console.log("=== RAW AI MAIN PAGE RESPONSE ===");
    console.log(mainRawText);
    console.log("=== END RAW MAIN ===");
    console.log("=== ZOD ERRORS (main page) — detailed ===");
    console.log(JSON.stringify(mainParsed.error.issues, null, 2));
    console.log("=== END ZOD ERRORS ===");
    console.error(
      "[generateMultiPageFunnelWithAI] Schema mismatch on main page:",
      mainParsed.error.flatten().fieldErrors
    );
    throw new AiGenerationError(
      "schema-mismatch",
      "La page principale générée ne respecte pas la structure attendue",
      JSON.stringify(mainParsed.error.flatten().fieldErrors).slice(0, 500)
    );
  }

  const mainData = mainParsed.data;

  console.info("[generateMultiPageFunnelWithAI] Page principale générée avec succès.");

  const fallbackCta: CtaConfig =
    brief.primaryCta ??
    makeAnchorCta(
      brief.language === "fr"
        ? "Recevoir les détails"
        : brief.language === "es"
        ? "Recibir los detalles"
        : "Get the details",
      "lead-form"
    );

  const mainSections = parseSectionsArray(mainData.sections, fallbackCta, brief);

  const sectionsByRole = new Map<PageRole, FunnelSection[]>();
  sectionsByRole.set(mainBlueprint.role, mainSections);

  if (secondaryRawText) {
    try {
      console.log("=== RAW AI SECONDARY PAGES RESPONSE ===");
      console.log(secondaryRawText);
      console.log("=== END RAW SECONDARY ===");

      const secondaryParsed = secondaryPagesSchema.safeParse(
        JSON.parse(extractJsonPayload(secondaryRawText))
      );

      if (secondaryParsed.success) {
        for (const page of secondaryParsed.data.pages) {
          const role = page.role as PageRole;
          const sections = parseSectionsArray(page.sections, fallbackCta, brief);
          sectionsByRole.set(role, sections);
          console.info(
            `[generateMultiPageFunnelWithAI] Page secondaire "${role}" : ${sections.length} sections OK.`
          );
        }
        console.info(
          "[generateMultiPageFunnelWithAI] Pages secondaires intégrées avec succès."
        );
      } else {
        console.warn(
          "[generateMultiPageFunnelWithAI] Schema mismatch sur pages secondaires, utilisation des placeholders."
        );
        console.warn("=== ZOD ERRORS (secondary pages) — detailed ===");
        console.warn(JSON.stringify(secondaryParsed.error.issues, null, 2));
        console.warn("=== END ZOD ERRORS ===");
      }
    } catch (err) {
      console.warn(
        "[generateMultiPageFunnelWithAI] Erreur de parsing des pages secondaires:",
        err
      );
    }
  }

  const pages = buildPagesFromBlueprints({
    blueprints,
    sectionsByRole,
    brief,
  });

  const homePage = pages.find((p) => p.isHome) ?? pages[0];
  const homeSections = homePage?.sections ?? mainSections;

  const media = buildMediaLibraryFromBrief(brief);

  const aiFunnel: Funnel = {
    funnelName: mainData.funnelName,
    language: mainData.language,
    pages,
    sections: homeSections,
    thankYouPage: {
      headline: mainData.thankYouPage.headline,
      body: mainData.thankYouPage.body,
      cta: mainData.thankYouPage.cta
        ? normalizeCta(mainData.thankYouPage.cta, fallbackCta)
        : undefined,
    },
    emails: (mainData.emails ?? []).map((email) => ({
      subject: email.subject,
      html: email.html,
      text: email.text,
      cta: normalizeCta(email.cta, fallbackCta),
    })),
    seo: mainData.seo,
    design: mainData.design,
    defaultCta: fallbackCta,
    media,
    meta: {
      funnelKind: normalizedKind ?? brief.funnelKind,
      moodId: brief.moodId,
      creationMode: brief.creationMode,
      templateId: brief.templateId,
      logoUrl: brief.logoUrl,
      schemaVersion: 2,
    },
  };

  const filteredPages = aiFunnel.pages ?? pages;
  const styledFunnel = applyTemplateToFunnel(template, aiFunnel, brief);

  const styleMap = buildStyleMapByType(styledFunnel.sections);

  const finalPages: FunnelPage[] = filteredPages.map((page) => {
    const blueprint = getBlueprintForRole(normalizedKind, page.role);
    let sections = blueprint
      ? filterSectionsByBlueprint(page.sections, blueprint)
      : page.sections;
    sections = applyStyleMapToSections(sections, styleMap);
    return { ...page, sections };
  });

  const enrichedPages = enrichFunnelPages(finalPages, brief);

  const rechainedPages = chainPagesNavigation(enrichedPages);
  const rechainedHome = rechainedPages.find((p) => p.isHome) ?? rechainedPages[0];

  return {
    ...styledFunnel,
    pages: rechainedPages,
    sections: rechainedHome?.sections ?? homeSections,
    media: styledFunnel.media ?? media,
    meta: {
      ...(styledFunnel.meta ?? {}),
      templateId: template.id,
      schemaVersion: 2,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Génération legacy single-page
// ─────────────────────────────────────────────────────────────────────────────
export async function generateFunnelWithAI(brief: FunnelBrief): Promise<Funnel> {
  if (!process.env.OPENAI_API_KEY) {
    throw new AiGenerationError(
      "missing-key",
      "Aucune clé OpenAI détectée côté serveur. Ajoutez OPENAI_API_KEY dans .env.local puis redémarrez"
    );
  }

  const template =
    getPremiumTemplate(brief.templateId) ??
    getPremiumTemplate(DEFAULT_PREMIUM_TEMPLATE_ID) ??
    PREMIUM_TEMPLATES[0];

  const basePrompt = completeFunnelPrompt(brief);
  const templateInstruction = buildTemplateInstruction(template, brief);
  const ctaInstruction = buildCtaInstruction(brief.language);
  const finalPrompt = basePrompt + templateInstruction + ctaInstruction;

  const rawText = await callOpenAI({
    systemMessage: SYSTEM_MESSAGE_FUNNEL,
    userPrompt: finalPrompt,
    maxTokens: 8000,
  });

  const aiFunnel = parseFunnelJson(rawText, brief);
  const finalFunnel = applyTemplateToFunnel(template, aiFunnel, brief);

  const enrichedSections = enrichSectionsWithDefaults(finalFunnel.sections, brief);

  return {
    ...finalFunnel,
    sections: enrichedSections,
    media: finalFunnel.media ?? aiFunnel.media,
    meta: {
      ...(finalFunnel.meta ?? {}),
      templateId: template.id,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tunnel de démo
// ─────────────────────────────────────────────────────────────────────────────
export function createDemoFunnel(brief: FunnelBrief): Funnel {
  const isFr = brief.language === "fr";
  const isEs = brief.language === "es";

  const ctaLabel = isFr ? "Obtenir l'accès" : isEs ? "Obtener el acceso" : "Get access";
  const primaryCta: CtaConfig = brief.primaryCta ?? makeAnchorCta(ctaLabel, "lead-form");

  const mood = getMood(brief.moodId);
  const primaryColor = brief.mainColor ?? mood?.primary ?? "#080E1A";
  const secondaryColor = brief.secondaryColor ?? mood?.secondary ?? "#C7A436";
  const accentColor = mood?.accent ?? "#31845C";

  const t = (fr: string, en: string, es: string) => (isFr ? fr : isEs ? es : en);

  const sections: FunnelSection[] = [
    {
      id: "hero",
      type: "hero",
      eyebrow: brief.funnelType,
      headline: `${brief.offerName} : ${brief.promise}`,
      subheadline: t(
        `Un tunnel pensé pour ${brief.targetAudience}`,
        `A funnel built for ${brief.targetAudience}`,
        `Un embudo pensado para ${brief.targetAudience}`
      ),
      cta: primaryCta,
      image: { mode: brief.defaultImageMode ?? "none" },
      visible: true,
    },
  ];

  return {
    funnelName: `${brief.brandName} — ${brief.offerName}`,
    language: brief.language,
    sections,
    thankYouPage: {
      headline: t("Merci", "Thank you", "Gracias"),
      body: t(
        "Votre demande est confirmée",
        "Your request is confirmed",
        "Tu solicitud está confirmada"
      ),
      cta: makeAnchorCta(t("Retour", "Back", "Volver"), "top"),
    },
    emails: [],
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
