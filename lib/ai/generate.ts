import { z } from "zod";
import type { Funnel, FunnelBrief, FunnelSection } from "@/lib/funnels/types";
import { completeFunnelPrompt } from "./prompts";

const funnelSchema = z.object({
  funnelName: z.string(),
  language: z.enum(["fr", "en"]),
  sections: z.array(
    z.object({
      id: z.string().optional(),
      type: z.string(),
      eyebrow: z.string().optional(),
      headline: z.string(),
      subheadline: z.string().optional(),
      body: z.string().optional(),
      bullets: z.array(z.string()).optional(),
      cta: z.string().optional(),
      visualDirection: z.string().optional()
    })
  ),
  thankYouPage: z.object({
    headline: z.string(),
    body: z.string(),
    cta: z.string().optional()
  }),
  emails: z.array(
    z.object({
      subject: z.string(),
      html: z.string(),
      text: z.string(),
      cta: z.string()
    })
  ),
  seo: z.object({
    title: z.string(),
    description: z.string()
  }),
  design: z.object({
    primaryColor: z.string(),
    secondaryColor: z.string(),
    accentColor: z.string(),
    style: z.string()
  })
});

export function parseFunnelJson(raw: string): Funnel {
  const clean = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  const parsed = funnelSchema.parse(JSON.parse(clean));
  return {
    ...parsed,
    sections: parsed.sections.map((section, index) => ({
      ...section,
      id: section.id ?? `${section.type}-${index + 1}`
    })) as FunnelSection[]
  };
}

export async function generateFunnelWithAI(brief: FunnelBrief): Promise<Funnel> {
  if (!process.env.OPENAI_API_KEY) {
    return createDemoFunnel(brief);
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: completeFunnelPrompt(brief),
      text: { format: { type: "text" } }
    });

    return parseFunnelJson(response.output_text);
  } catch (error) {
    console.error("OpenAI generation failed, using demo funnel fallback.", error);
    return createDemoFunnel(brief);
  }
}

export function createDemoFunnel(brief: FunnelBrief): Funnel {
  const isFr = brief.language === "fr";
  const cta = isFr ? "Obtenir l’accès maintenant" : "Get access now";
  const sections: FunnelSection[] = [
    {
      id: "hero",
      type: "hero",
      eyebrow: brief.funnelType,
      headline: isFr
        ? `${brief.offerName} : ${brief.promise}`
        : `${brief.offerName}: ${brief.promise}`,
      subheadline: isFr
        ? `Un tunnel premium pensé pour ${brief.targetAudience}. Message clair, preuve visible, CTA fort et parcours mobile-first prêt à exporter vers Systeme.io.`
        : `A premium funnel for ${brief.targetAudience}. Clear message, visible proof, strong CTA and a mobile-first path ready for Systeme.io.`,
      cta,
      visualDirection: "Mockup premium avec carte offre, preuve sociale et CTA visible."
    },
    {
      id: "problem",
      type: "problem",
      eyebrow: isFr ? "Le blocage" : "The bottleneck",
      headline: isFr ? "Votre audience n’achète pas ce qu’elle ne comprend pas vite" : "People do not buy what they cannot understand fast",
      body: isFr
        ? `${brief.mainPain}. Le tunnel doit donc expliquer la valeur, créer la confiance et faire avancer le prospect sans friction.`
        : `${brief.mainPain}. The funnel must explain value, build trust and move the prospect forward without friction.`,
      bullets: [
        isFr ? "Une promesse lisible en moins de 5 secondes" : "A promise understood in under 5 seconds",
        isFr ? "Une objection traitée avant qu’elle bloque l’action" : "Objections handled before they block action",
        isFr ? "Une suite logique : problème, solution, preuve, offre" : "A logical path: problem, solution, proof, offer"
      ]
    },
    {
      id: "method",
      type: "solution",
      eyebrow: isFr ? "La méthode" : "The method",
      headline: isFr ? "Un parcours de vente complet, pas une simple page" : "A complete sales journey, not just a page",
      body: isFr
        ? `${brief.offerName} est présenté avec une structure conversion : accroche, douleur, transformation, bénéfices, preuves, offre et relance email.`
        : `${brief.offerName} is presented with a conversion structure: hook, pain, transformation, benefits, proof, offer and email follow-up.`,
      bullets: [
        isFr ? "Page de capture ou vente" : "Capture or sales page",
        isFr ? "Page de remerciement" : "Thank-you page",
        isFr ? "Séquence email 3 messages" : "3-email sequence"
      ]
    },
    {
      id: "benefits",
      type: "benefits",
      eyebrow: isFr ? "Transformation" : "Transformation",
      headline: isFr ? "Ce que votre client idéal obtient concrètement" : "What your ideal customer gets",
      bullets: [
        isFr ? "Une prochaine étape simple, rassurante et immédiate" : "A simple, reassuring and immediate next step",
        isFr ? "Une vision claire du résultat attendu" : "A clear view of the expected result",
        isFr ? "Des arguments adaptés à son niveau de conscience" : "Arguments adapted to their awareness level",
        isFr ? "Un tunnel lisible sur mobile et cohérent avec votre marque" : "A mobile-friendly funnel aligned with your brand"
      ],
      cta
    },
    {
      id: "proof",
      type: "proof",
      eyebrow: isFr ? "Crédibilité" : "Credibility",
      headline: isFr ? "Des signaux de confiance placés au bon endroit" : "Trust signals in the right places",
      body: isFr
        ? "Le tunnel prévoit témoignages, résultats, chiffres ou garanties selon ce que vous pouvez prouver réellement."
        : "The funnel uses testimonials, outcomes, metrics or guarantees based on what you can truthfully prove.",
      bullets: [
        isFr ? "Témoignage court et spécifique" : "Short and specific testimonial",
        isFr ? "Bénéfice mesurable" : "Measurable benefit",
        isFr ? "Réduction du risque avant le CTA" : "Risk reduction before the CTA"
      ]
    },
    {
      id: "offer",
      type: "offer",
      eyebrow: isFr ? "Offre" : "Offer",
      headline: isFr ? `${brief.offerName} pour ${brief.price}` : `${brief.offerName} for ${brief.price}`,
      body: isFr
        ? `Une offre présentée avec un positionnement ${brief.tone}, un design ${brief.designStyle}, et une promesse centrale : ${brief.promise}.`
        : `An offer presented with a ${brief.tone} positioning, ${brief.designStyle} design, and core promise: ${brief.promise}.`,
      bullets: [
        isFr ? "Accès immédiat ou prise de contact guidée" : "Immediate access or guided contact",
        isFr ? "Bonus et garantie clairement visibles" : "Clear bonus and guarantee",
        isFr ? "CTA principal répété aux moments clés" : "Main CTA repeated at key moments"
      ],
      cta
    },
    {
      id: "bonus",
      type: "bonus",
      eyebrow: isFr ? "Bonus" : "Bonus",
      headline: isFr ? "Des bonus qui renforcent la décision" : "Bonuses that strengthen the decision",
      bullets: [
        isFr ? "Checklist de mise en action" : "Implementation checklist",
        isFr ? "Template prêt à adapter" : "Ready-to-adapt template",
        isFr ? "Email de suivi pour garder l’élan" : "Follow-up email to keep momentum"
      ]
    },
    {
      id: "guarantee",
      type: "guarantee",
      eyebrow: isFr ? "Risque réduit" : "Risk reversal",
      headline: isFr ? "Une décision plus facile à prendre" : "An easier decision to make",
      body: isFr
        ? "Ajoutez une garantie, une promesse d’accompagnement ou une preuve de sérieux pour sécuriser le passage à l’action."
        : "Add a guarantee, support promise or credibility proof to make action feel safer.",
      cta
    },
    {
      id: "form",
      type: "form",
      eyebrow: isFr ? "Action" : "Action",
      headline: isFr ? "Recevoir les détails et passer à l’étape suivante" : "Get the details and take the next step",
      subheadline: isFr ? "Nom, email, téléphone et source du tunnel sont prêts pour le CRM." : "Name, email, phone and funnel source are ready for the CRM.",
      cta
    },
    {
      id: "faq",
      type: "faq",
      headline: isFr ? "Questions fréquentes" : "Frequently asked questions",
      bullets: [
        isFr ? "Est-ce adapté aux débutants ? Oui, le parcours est guidé étape par étape." : "Is it beginner-friendly? Yes, the journey is guided step by step.",
        isFr ? "Puis-je l’utiliser avec Systeme.io ? Oui, les blocs HTML/CSS sont prévus pour le collage." : "Can I use it with Systeme.io? Yes, HTML/CSS blocks are prepared for copy-paste.",
        isFr ? "Puis-je modifier le résultat ? Oui, chaque section peut être éditée ou régénérée." : "Can I edit the result? Yes, every section can be edited or regenerated."
      ]
    }
  ];

  return {
    funnelName: `${brief.brandName} - ${brief.offerName}`,
    language: brief.language,
    sections,
    thankYouPage: {
      headline: isFr ? "Merci, votre demande est confirmée" : "Thank you, your request is confirmed",
      body: isFr ? "Consultez votre email et gardez cette page ouverte pour la prochaine étape." : "Check your inbox and keep this page open for the next step.",
      cta: isFr ? "Retour au site" : "Back to site"
    },
    emails: [
      {
        subject: isFr ? `Votre accès à ${brief.offerName}` : `Your access to ${brief.offerName}`,
        html: `<p>${isFr ? "Merci pour votre intérêt." : "Thanks for your interest."}</p>`,
        text: isFr ? "Merci pour votre intérêt." : "Thanks for your interest.",
        cta
      },
      {
        subject: isFr ? "Une preuve simple avant de décider" : "A simple proof before you decide",
        html: `<p>${isFr ? "Voici pourquoi cette méthode fonctionne." : "Here is why this method works."}</p>`,
        text: isFr ? "Voici pourquoi cette méthode fonctionne." : "Here is why this method works.",
        cta
      },
      {
        subject: isFr ? "Prêt à passer à l’action ?" : "Ready to take action?",
        html: `<p>${isFr ? "C’est le bon moment pour avancer." : "Now is a good time to move forward."}</p>`,
        text: isFr ? "C’est le bon moment pour avancer." : "Now is a good time to move forward.",
        cta
      }
    ],
    seo: {
      title: `${brief.offerName} | ${brief.brandName}`,
      description: brief.promise
    },
    design: {
      primaryColor: "#05070B",
      secondaryColor: "#FFD84D",
      accentColor: "#1ECB83",
      style: brief.designStyle
    }
  };
}
