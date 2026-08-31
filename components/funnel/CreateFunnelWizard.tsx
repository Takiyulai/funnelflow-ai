"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, CheckCircle2,
  Sparkles, Target, Upload, Link as LinkIcon, AnchorIcon,
  ImageOff, Image as ImageIcon, Wand2, AlertCircle, Eye, Pencil,
  Building2, Package, User, Database,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { LoaderIA } from "@/components/ui/LoaderIA";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";
import { LogoUploader } from "@/components/funnel/LogoUploader";
import { FunnelKindStep, WebinarDetailsFields } from "@/components/funnel/wizard/FunnelKindStep";
// 🆕 B6 — Quels blocs du wizard afficher selon le type de tunnel.
import {
  hasFormatStepFields,
  PRICING_BLOCK_FIELDS,
  showsOtoOption,
  showsPricingBlock,
} from "@/lib/funnels/wizardFields";
// 🆕 Validation du calendrier externe — MÊME règle que le générateur.
import { bookingExternalUrlMissing } from "@/lib/booking/mode";
import { MoodStep } from "@/components/funnel/wizard/MoodStep";
import { VideoStep } from "@/components/funnel/wizard/VideoStep";
import TemplateGalleryStep from "@/components/funnel/TemplateGalleryStep";
import {
  funnelTemplates,
  PREMIUM_TEMPLATES,
  DEFAULT_PREMIUM_TEMPLATE_ID,
  getPremiumTemplate,
} from "@/lib/funnels/templates";
import { getFunnelKind, FUNNEL_KINDS } from "@/lib/funnels/kinds";
import { getRequiredPageBlueprints, getOptionalPageBlueprints } from "@/lib/funnels/pageCatalogs";
import type {
  Funnel, FunnelBrief, FunnelSection, Language, CtaConfig, CtaMode, ImageMode, FunnelKind, MediaItem, CopywritingPrefs, PageRole,
} from "@/lib/funnels/types";
import { makeAnchorCta, makeRedirectCta } from "@/lib/funnels/types";
import type { AiHealth } from "@/lib/ai/health";
import { useRouter } from "next/navigation";
import {
  createFunnelFromAi,
  FunnelStorageQuotaError,
  getStorageUsage,
} from "@/lib/store/funnelStore";
import { MediasStep } from "@/components/funnel/wizard/MediasStep";
import { CopywritingStep } from "@/components/funnel/wizard/CopywritingStep";
import { queueCelebration } from "@/components/ui/Celebration";
import {
  prepareWizardBriefForGeneration,
  WizardMediaUploadError,
} from "@/lib/media/prepareWizardBrief";

// 11 étapes (fusion Marque + Offre + À propos = "Ton offre")
const ALL_STEPS = [
  "Format", "Template", "Objectif", "Ton offre", "Audience",
  "Copywriting", "Vidéo", "Médias", "CTA", "Visuels",
  "Ambiance", "Génération",
] as const;
type StepLabel = typeof ALL_STEPS[number];

const initialBrief: FunnelBrief = {
  brandName: "Votre marque",
  offerName: "Ebook premium",
  price: "49€",
  targetAudience: "créateurs de produits digitaux",
  mainPain: "leur offre est utile mais leur page ne crée pas assez de confiance",
  promise: "transformer une expertise en tunnel prêt à vendre",
  tone: "premium",
  funnelType: "Vente ebook premium",
  designStyle: "premium",
  language: "fr",
  // 🆕 Défaut = lien de redirection (l'utilisateur colle l'URL de destination).
  primaryCta: makeRedirectCta("Recevoir l'offre", ""),
  defaultImageMode: "none",
  funnelKind: undefined,
  creationMode: "guided",
  templateId: "coaching-premium",
  moodId: "premium-calm",
  mainColor: "#080E1A",
  secondaryColor: "#C7A436",
};

const FUNNEL_GOALS = [
  { label: "Capturer des leads", value: "Ebook gratuit lead magnet", hint: "Page de capture, page merci, séquence email" },
  { label: "Vendre un produit", value: "Vente ebook premium", hint: "Page de vente, offre, garantie" },
  { label: "Vendre un service", value: "Service de création d'ebook", hint: "Process, preuve, prise de contact" },
  { label: "Réserver des appels", value: "Consultation gratuite", hint: "Qualification, CTA calendrier" },
];

type ApiError = {
  reason?: string;
  message?: string;
  /** Message français déjà neutralisé côté serveur pour les erreurs de validation. */
  userMessage?: string;
  fieldErrors?: Array<{ field: string; reason: string }>;
  /** Code d'erreur applicatif (ex : "subscription_required", "funnel_quota_reached"). */
  error?: string;
};

const GENERATION_SYSTEM_ERROR_MESSAGE =
  "Une erreur technique est survenue pendant la génération. Réessaie dans un instant.";

const HIDDEN_AI_ERROR_CODES = new Set([
  "missing-key",
  "invalid-key",
  "rate-limit",
  "insufficient-quota",
  "network-error",
  "empty-response",
  "invalid-json",
  "schema-mismatch",
  "invalid-model",
  "invalid-brief",
  "payload-too-large",
  "media-upload-failed",
  "unknown",
]);

/**
 * 🆕 Un libellé de prix désigne-t-il la gratuité ?
 *
 * Le champ `price` est du texte libre saisi par l'utilisateur : « Gratuit »,
 * « gratuit », « 0€ », « free », « 0 »… Cette tolérance existe côté serveur
 * (`isFreeOffer`), le sélecteur Gratuit/Payant doit la partager pour ne pas
 * afficher « Payant » alors que l'utilisateur a tapé « gratuit » en minuscules.
 *
 * Un champ VIDE n'est pas « gratuit » : c'est un prix pas encore renseigné.
 */
function isFreePriceLabel(price: string | undefined): boolean {
  const p = (price ?? "").trim().toLowerCase();
  if (!p) return false;
  return (
    p === "0" ||
    p === "0€" ||
    p === "0 €" ||
    p.startsWith("gratuit") ||
    p.startsWith("free") ||
    p.startsWith("gratis")
  );
}

function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 🆕 Contenu de démonstration du panneau "Live preview" du wizard.
//
// Avant : la preview n'affichait qu'une "coquille structurelle" de 3-4
// sections avec un texte annonçant explicitement "l'aperçu actuel est une
// coquille" — ça ne donnait AUCUNE idée réaliste du rendu final. Ici, on
// construit un funnel COMPLET (problème, bénéfices, témoignages, tarif,
// bonus, garantie, FAQ, CTA final) avec un copy plausible dans les 3 langues
// supportées, personnalisé avec les quelques champs déjà saisis par
// l'utilisateur (marque, promesse, audience, prix). Ce n'est PAS le copy réel
// généré par l'IA (qui reste propre à l'offre) : c'est un GABARIT de
// démonstration pour que le choix de template/ambiance soit visuellement
// parlant dès l'étape 2, avant même de lancer la génération.
// ─────────────────────────────────────────────────────────────────────────────

const SHOWCASE_COPY: Record<
  Language,
  {
    problemEyebrow: string;
    problemHeadline: (audience: string) => string;
    problemBullets: string[];
    benefitsEyebrow: string;
    benefitsHeadline: (promise: string) => string;
    benefitsBullets: string[];
    proofEyebrow: string;
    proofHeadline: string;
    testimonials: { quote: string; authorName: string; authorRole: string }[];
    pricingEyebrow: string;
    pricingHeadline: string;
    pricingPlanName: string;
    pricingPeriod: string;
    pricingDescription: string;
    pricingFeatures: string[];
    pricingBadge: string;
    pricingCta: string;
    bonusEyebrow: string;
    bonusHeadline: string;
    bonuses: { title: string; description: string; value: string }[];
    guaranteeTitle: string;
    guaranteeDescription: string;
    guaranteeDuration: string;
    faqEyebrow: string;
    faqHeadline: string;
    faqs: { question: string; answer: string }[];
    ctaEyebrow: string;
    ctaHeadline: string;
    ctaSubheadline: string;
    ctaLabel: string;
  }
> = {
  fr: {
    problemEyebrow: "Le vrai problème",
    problemHeadline: (audience) =>
      `Pourquoi ${audience || "la plupart des gens"} n'y arrivent pas seul·e·s`,
    problemBullets: [
      "Trop d'informations contradictoires, aucune méthode claire à suivre",
      "Des heures perdues à tout tester sans résultat concret",
      "Le sentiment de stagner alors que d'autres avancent plus vite",
    ],
    benefitsEyebrow: "Ce que vous obtenez",
    benefitsHeadline: (promise) =>
      `Tout ce qu'il faut pour ${promise || "atteindre votre objectif"}`,
    benefitsBullets: [
      "Une méthode claire, étape par étape, sans jargon inutile",
      "Des outils prêts à l'emploi pour gagner du temps immédiatement",
      "Un accompagnement pensé pour des résultats visibles rapidement",
      "Une communauté pour ne plus jamais avancer seul·e",
    ],
    proofEyebrow: "Ils l'ont fait",
    proofHeadline: "Ce qu'en disent celles et ceux qui ont déjà commencé",
    testimonials: [
      {
        quote:
          "Résultat dès les 2 premières semaines. Simple, concret, sans blabla inutile.",
        authorName: "Camille D.",
        authorRole: "Cliente depuis 2025",
      },
      {
        quote:
          "J'ai enfin une méthode claire à suivre au lieu de tout improviser. Ça change tout.",
        authorName: "Karim B.",
        authorRole: "Client depuis 2025",
      },
      {
        quote: "Le meilleur investissement que j'ai fait cette année, sans hésiter.",
        authorName: "Léa M.",
        authorRole: "Cliente depuis 2026",
      },
    ],
    pricingEyebrow: "L'offre",
    pricingHeadline: "Un tarif simple, sans surprise",
    pricingPlanName: "Accès complet",
    pricingPeriod: "paiement unique",
    pricingDescription: "Tout ce qu'il faut pour démarrer et obtenir des résultats",
    pricingFeatures: [
      "Accès immédiat à l'intégralité du contenu",
      "Mises à jour gratuites à vie",
      "Support par email sous 24h",
      "Garantie satisfait ou remboursé",
    ],
    pricingBadge: "Le plus populaire",
    pricingCta: "Je commence maintenant",
    bonusEyebrow: "En plus, offert",
    bonusHeadline: "Des bonus exclusifs pour aller plus vite",
    bonuses: [
      {
        title: "Guide de démarrage rapide",
        description: "Les 3 premières actions à faire dès aujourd'hui",
        value: "47€",
      },
      {
        title: "Séance de questions/réponses",
        description: "Un accès direct pour poser vos questions",
        value: "97€",
      },
    ],
    guaranteeTitle: "Satisfait ou remboursé",
    guaranteeDescription:
      "Testez sans risque : si ça ne vous convient pas, on vous rembourse intégralement, sans question.",
    guaranteeDuration: "30 jours",
    faqEyebrow: "Questions fréquentes",
    faqHeadline: "Tout ce que vous devez savoir",
    faqs: [
      {
        question: "Combien de temps avant de voir des résultats ?",
        answer:
          "La majorité des utilisateurs constatent des premiers résultats dès les 2 à 3 premières semaines en appliquant la méthode.",
      },
      {
        question: "Est-ce adapté si je débute complètement ?",
        answer:
          "Oui, tout est expliqué étape par étape, sans prérequis. Vous partez de zéro et progressez à votre rythme.",
      },
      {
        question: "Que se passe-t-il si ça ne me convient pas ?",
        answer:
          "Vous êtes couvert·e par la garantie : un remboursement intégral, sans justification à fournir.",
      },
    ],
    ctaEyebrow: "Dernière étape",
    ctaHeadline: "Prêt·e à passer à l'action ?",
    ctaSubheadline: "Rejoignez celles et ceux qui ont déjà fait le premier pas.",
    ctaLabel: "Je me lance maintenant",
  },
  en: {
    problemEyebrow: "The real problem",
    problemHeadline: (audience) =>
      `Why ${audience || "most people"} can't do it alone`,
    problemBullets: [
      "Too much conflicting information, no clear method to follow",
      "Hours wasted testing things with no real result",
      "The feeling of standing still while others move faster",
    ],
    benefitsEyebrow: "What you get",
    benefitsHeadline: (promise) =>
      `Everything you need to ${promise || "reach your goal"}`,
    benefitsBullets: [
      "A clear, step-by-step method with no unnecessary jargon",
      "Ready-to-use tools that save you time immediately",
      "Guidance designed for visible results, fast",
      "A community so you're never figuring it out alone",
    ],
    proofEyebrow: "Real results",
    proofHeadline: "What people who already started are saying",
    testimonials: [
      {
        quote: "Results within the first 2 weeks. Simple, concrete, no fluff.",
        authorName: "Camille D.",
        authorRole: "Customer since 2025",
      },
      {
        quote:
          "I finally have a clear method to follow instead of improvising everything. Total game changer.",
        authorName: "Karim B.",
        authorRole: "Customer since 2025",
      },
      {
        quote: "Best investment I've made this year, hands down.",
        authorName: "Léa M.",
        authorRole: "Customer since 2026",
      },
    ],
    pricingEyebrow: "The offer",
    pricingHeadline: "Simple pricing, no surprises",
    pricingPlanName: "Full access",
    pricingPeriod: "one-time payment",
    pricingDescription: "Everything you need to get started and see results",
    pricingFeatures: [
      "Instant access to the full content",
      "Free updates for life",
      "Email support within 24h",
      "Money-back guarantee",
    ],
    pricingBadge: "Most popular",
    pricingCta: "I'm starting now",
    bonusEyebrow: "Also included",
    bonusHeadline: "Exclusive bonuses to move faster",
    bonuses: [
      {
        title: "Quick-start guide",
        description: "The first 3 actions to take today",
        value: "$47",
      },
      {
        title: "Live Q&A session",
        description: "Direct access to ask your questions",
        value: "$97",
      },
    ],
    guaranteeTitle: "Money-back guarantee",
    guaranteeDescription:
      "Try it risk-free: if it's not for you, get a full refund, no questions asked.",
    guaranteeDuration: "30 days",
    faqEyebrow: "Frequently asked questions",
    faqHeadline: "Everything you need to know",
    faqs: [
      {
        question: "How long before I see results?",
        answer:
          "Most users see their first results within 2 to 3 weeks of applying the method.",
      },
      {
        question: "Is this suitable for complete beginners?",
        answer:
          "Yes, everything is explained step by step, no prerequisites. Start from zero and go at your own pace.",
      },
      {
        question: "What if it's not for me?",
        answer: "You're covered by the guarantee: a full refund, no justification needed.",
      },
    ],
    ctaEyebrow: "Last step",
    ctaHeadline: "Ready to take action?",
    ctaSubheadline: "Join the people who already took the first step.",
    ctaLabel: "I'm starting now",
  },
  es: {
    problemEyebrow: "El verdadero problema",
    problemHeadline: (audience) =>
      `Por qué ${audience || "la mayoría"} no lo logra sola`,
    problemBullets: [
      "Demasiada información contradictoria, ningún método claro a seguir",
      "Horas perdidas probando de todo sin resultados reales",
      "La sensación de estancarte mientras otros avanzan más rápido",
    ],
    benefitsEyebrow: "Lo que obtienes",
    benefitsHeadline: (promise) => `Todo lo necesario para ${promise || "lograr tu objetivo"}`,
    benefitsBullets: [
      "Un método claro, paso a paso, sin jerga innecesaria",
      "Herramientas listas para usar que ahorran tiempo de inmediato",
      "Acompañamiento pensado para resultados visibles y rápidos",
      "Una comunidad para no avanzar nunca más en solitario",
    ],
    proofEyebrow: "Ya lo lograron",
    proofHeadline: "Lo que dicen quienes ya empezaron",
    testimonials: [
      {
        quote: "Resultados desde las 2 primeras semanas. Simple, concreto, sin relleno.",
        authorName: "Camille D.",
        authorRole: "Cliente desde 2025",
      },
      {
        quote: "Por fin tengo un método claro a seguir en vez de improvisar todo. Cambia todo.",
        authorName: "Karim B.",
        authorRole: "Cliente desde 2025",
      },
      {
        quote: "La mejor inversión que hice este año, sin dudarlo.",
        authorName: "Léa M.",
        authorRole: "Cliente desde 2026",
      },
    ],
    pricingEyebrow: "La oferta",
    pricingHeadline: "Un precio simple, sin sorpresas",
    pricingPlanName: "Acceso completo",
    pricingPeriod: "pago único",
    pricingDescription: "Todo lo necesario para empezar y obtener resultados",
    pricingFeatures: [
      "Acceso inmediato a todo el contenido",
      "Actualizaciones gratuitas de por vida",
      "Soporte por email en 24h",
      "Garantía de devolución de dinero",
    ],
    pricingBadge: "El más popular",
    pricingCta: "Empiezo ahora",
    bonusEyebrow: "Además, de regalo",
    bonusHeadline: "Bonos exclusivos para avanzar más rápido",
    bonuses: [
      {
        title: "Guía de inicio rápido",
        description: "Las 3 primeras acciones a hacer hoy mismo",
        value: "47€",
      },
      {
        title: "Sesión de preguntas y respuestas",
        description: "Acceso directo para hacer tus preguntas",
        value: "97€",
      },
    ],
    guaranteeTitle: "Satisfacción garantizada",
    guaranteeDescription:
      "Pruébalo sin riesgo: si no te convence, te devolvemos el 100%, sin preguntas.",
    guaranteeDuration: "30 días",
    faqEyebrow: "Preguntas frecuentes",
    faqHeadline: "Todo lo que necesitas saber",
    faqs: [
      {
        question: "¿Cuánto tiempo antes de ver resultados?",
        answer:
          "La mayoría de los usuarios ven sus primeros resultados entre 2 y 3 semanas aplicando el método.",
      },
      {
        question: "¿Es apto si soy principiante total?",
        answer:
          "Sí, todo se explica paso a paso, sin requisitos previos. Empiezas desde cero y avanzas a tu ritmo.",
      },
      {
        question: "¿Qué pasa si no me convence?",
        answer: "Estás cubierto por la garantía: devolución completa, sin justificar nada.",
      },
    ],
    ctaEyebrow: "Último paso",
    ctaHeadline: "¿List·a para pasar a la acción?",
    ctaSubheadline: "Únete a quienes ya dieron el primer paso.",
    ctaLabel: "Empiezo ahora",
  },
};

/** Construit les sections de démonstration (preview wizard uniquement). */
function buildShowcaseSections(brief: FunnelBrief): FunnelSection[] {
  const copy = SHOWCASE_COPY[brief.language] ?? SHOWCASE_COPY.fr;
  const price = brief.price?.trim() || "97€";

  const sections: FunnelSection[] = [
    {
      id: "preview-hero",
      type: "hero",
      eyebrow: brief.funnelType,
      headline: capitalize(brief.promise) || copy.benefitsHeadline(""),
      subheadline: `Un tunnel pensé pour ${brief.targetAudience || "votre audience"}`,
      cta: brief.primaryCta,
      image: { mode: brief.defaultImageMode ?? "none" },
      visible: true,
    },
  ];

  if (brief.aboutText) {
    sections.push({
      id: "preview-about",
      type: "about",
      eyebrow: "À propos",
      headline: brief.authorName || brief.brandName,
      body: brief.aboutText,
      image: { mode: "none" },
      visible: true,
    });
  }

  if (brief.videoUrl) {
    sections.push({
      id: "preview-video",
      type: "video",
      eyebrow: "Présentation",
      headline: "Découvrez la méthode en quelques minutes",
      video: { provider: "url", url: brief.videoUrl },
      image: { mode: "none" },
      visible: true,
    });
  }

  sections.push(
    {
      id: "preview-problem",
      type: "problem",
      eyebrow: copy.problemEyebrow,
      headline: copy.problemHeadline(brief.targetAudience),
      bullets: copy.problemBullets,
      image: { mode: "none" },
      visible: true,
    },
    {
      id: "preview-benefits",
      type: "benefits",
      eyebrow: copy.benefitsEyebrow,
      headline: copy.benefitsHeadline(brief.promise),
      bullets: copy.benefitsBullets,
      image: { mode: "none" },
      visible: true,
    },
    {
      id: "preview-testimonials",
      type: "testimonials",
      eyebrow: copy.proofEyebrow,
      headline: copy.proofHeadline,
      image: { mode: "none" },
      visible: true,
      items: copy.testimonials.map((t) => ({
        kind: "testimonial" as const,
        data: {
          quote: t.quote,
          authorName: t.authorName,
          authorRole: t.authorRole,
          rating: 5,
        },
      })),
    },
    {
      id: "preview-pricing",
      type: "pricing",
      eyebrow: copy.pricingEyebrow,
      headline: copy.pricingHeadline,
      image: { mode: "none" },
      visible: true,
      items: [
        {
          kind: "pricing" as const,
          data: {
            name: copy.pricingPlanName,
            price,
            period: copy.pricingPeriod,
            description: copy.pricingDescription,
            features: copy.pricingFeatures,
            highlighted: true,
            badge: copy.pricingBadge,
            cta: brief.primaryCta ?? { mode: "anchor", label: copy.pricingCta, anchorId: "lead-form" },
          },
        },
      ],
    },
    {
      id: "preview-bonus",
      type: "bonus",
      eyebrow: copy.bonusEyebrow,
      headline: copy.bonusHeadline,
      image: { mode: "none" },
      visible: true,
      items: copy.bonuses.map((b) => ({
        kind: "bonus" as const,
        data: { title: b.title, description: b.description, value: b.value },
      })),
    },
    {
      id: "preview-guarantee",
      type: "guarantee",
      headline: copy.guaranteeTitle,
      image: { mode: "none" },
      visible: true,
      items: [
        {
          kind: "guarantee" as const,
          data: {
            title: copy.guaranteeTitle,
            description: copy.guaranteeDescription,
            duration: copy.guaranteeDuration,
          },
        },
      ],
    },
    {
      id: "preview-faq",
      type: "faq",
      eyebrow: copy.faqEyebrow,
      headline: copy.faqHeadline,
      image: { mode: "none" },
      visible: true,
      items: copy.faqs.map((f) => ({
        kind: "faq" as const,
        data: { question: f.question, answer: f.answer },
      })),
    },
    {
      id: "preview-cta-final",
      type: "cta",
      eyebrow: copy.ctaEyebrow,
      headline: copy.ctaHeadline,
      subheadline: copy.ctaSubheadline,
      cta: brief.primaryCta ?? { mode: "anchor", label: copy.ctaLabel, anchorId: "lead-form" },
      image: { mode: "none" },
      visible: true,
    },
  );

  return sections;
}

export function CreateFunnelWizard() {
  const [step, setStep] = useState(0);
  const [mobileTab, setMobileTab] = useState<"form" | "preview">("form");
  // 🆕 Sous-onglet actif + message de validation de l'étape « Ton offre » (levés
  // ici pour pouvoir sauter sur l'onglet incomplet quand on bloque « Suivant »).
  const [offerSubTab, setOfferSubTab] = useState<OfferSubTab>("marque");
  const [offerStepError, setOfferStepError] = useState("");
  // 🆕 Message de validation de l'étape « Format » (aujourd'hui : URL de
  // calendrier externe manquante). Même mécanique que `offerStepError`.
  const [formatStepError, setFormatStepError] = useState("");
  const stepperRef = useRef<HTMLDivElement>(null);
  const [brief, setBrief] = useState<FunnelBrief>(initialBrief);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorReason, setErrorReason] = useState<string>("");
  const [aiHealth, setAiHealth] = useState<AiHealth | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  // Écran de choix initial : "choice" (défaut) → "express" ou "wizard" (parcours classique).
  const [entryMode, setEntryMode] = useState<"choice" | "express" | "wizard">("choice");
  const [expressPrompt, setExpressPrompt] = useState("");
  const router = useRouter();

  const steps = useMemo<StepLabel[]>(() => {
    const kind = getFunnelKind(brief.funnelKind);
    const includeVideo = kind?.needsVideo === true;
    // Express IA : parcours allégé (le copy vient du prompt, le type est choisi
    // dans l'écran express) → on ne garde que thème, médias et finalisation.
    if (brief.creationMode === "express") {
      const express: StepLabel[] = ["Template", "Médias", "Ambiance", "Génération"];
      // Tunnel qui a besoin d'une vidéo (ex. webinaire) → on insère l'étape Vidéo.
      if (includeVideo) express.splice(1, 0, "Vidéo");
      return express;
    }
    // 🆕 Step « Visuels » retiré du parcours (jugé redondant avec « Médias »).
    return ALL_STEPS.filter(
      (label) => (label !== "Vidéo" || includeVideo) && label !== "Visuels",
    );
  }, [brief.funnelKind, brief.creationMode]);

  useEffect(() => {
    if (step >= steps.length) setStep(steps.length - 1);
  }, [steps.length, step]);

  const currentPremiumTemplate = useMemo(
    () =>
      getPremiumTemplate(brief.templateId) ??
      getPremiumTemplate(DEFAULT_PREMIUM_TEMPLATE_ID) ??
      PREMIUM_TEMPLATES[0],
    [brief.templateId]
  );

  const currentLegacyTemplate = useMemo(
    () =>
      funnelTemplates.find((t) => t.id === brief.templateId) ??
      funnelTemplates.find((t) => t.name === brief.funnelType) ??
      funnelTemplates[1],
    [brief.funnelType, brief.templateId]
  );

  useEffect(() => {
    const container = stepperRef.current;
    if (!container) return;
    const activeBtn = container.querySelector<HTMLElement>(`[data-step-index="${step}"]`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [step]);

  useEffect(() => {
    setMobileTab("form");
  }, [step]);

  function update<K extends keyof FunnelBrief>(key: K, value: FunnelBrief[K]) {
    setBrief((current) => ({ ...current, [key]: value }));
  }

  function updateMany(patch: Partial<FunnelBrief>) {
    setBrief((current) => ({ ...current, ...patch }));
  }

  function updateCta(patch: Partial<CtaConfig>) {
    setBrief((current) => ({
      ...current,
      primaryCta: {
        ...(current.primaryCta ?? makeAnchorCta("Recevoir l'offre", "lead-form")),
        ...patch,
      } as CtaConfig,
    }));
  }

  // 🆕 LOT 3 — Coche/décoche une page optionnelle dans l'aperçu "pages générées".
  function toggleOptionalPage(role: PageRole) {
    setBrief((current) => {
      const selected = current.selectedOptionalPages ?? [];
      const next = selected.includes(role)
        ? selected.filter((r) => r !== role)
        : [...selected, role];
      return { ...current, selectedOptionalPages: next };
    });
  }

  function selectKind(kind: FunnelKind) {
    const k = getFunnelKind(kind);

    // 🆕 B6 — NETTOYAGE À LA BASCULE DE TYPE.
    //
    // Masquer un champ ne suffit pas : une valeur saisie avant le changement de
    // type reste dans le brief et continue d'alimenter la génération. Un
    // utilisateur qui renseigne « 297€ » puis bascule sur « prise de RDV »
    // obtiendrait un tunnel de réservation avec une page de commande fantôme
    // et un prix collé sur le bouton. On remet donc les champs devenus
    // invisibles à `undefined`.
    const cleared: Record<string, undefined> = {};
    if (!showsPricingBlock(kind)) {
      for (const field of PRICING_BLOCK_FIELDS) cleared[field] = undefined;
    }

    updateMany({
      funnelKind: kind,
      funnelType:
        funnelTemplates.find((t) => t.id === k?.suggestedTemplateId)?.name ??
        brief.funnelType,
      ...cleared,
      // La page OTO n'a plus de raison d'être si le bloc commercial disparaît.
      ...(showsOtoOption(kind)
        ? {}
        : {
            selectedOptionalPages: (brief.selectedOptionalPages ?? []).filter(
              (r) => r !== "oto",
            ),
          }),
    });
    // 🆕 BUG CORRIGÉ : l'avance automatique au step suivant masquait
    // instantanément le bloc date/heure + urgence du webinaire (affiché sur ce
    // MÊME step, juste sous les cartes de type) — l'utilisateur n'avait donc
    // jamais l'occasion de le voir ni de le remplir.
    //
    // 🆕 La même exception vaut pour TOUT type qui affiche des champs sous les
    // cartes : « challenge » (durée + titres des jours) et « booking » (mode
    // natif/externe + page de confirmation) souffraient exactement du même
    // symptôme. La règle est désormais nommée dans lib/funnels/wizardFields.ts
    // au lieu d'être une exception en dur, pour que le prochain type qui ajoute
    // des champs ici ne réintroduise pas le bug.
    if (hasFormatStepFields(kind)) return;
    setStep((v) => Math.min(v + 1, steps.length - 1));
  }

  function selectTemplate(templateId: string) {
    update("templateId", templateId);
  }

  function setLogo(dataUrl: string | undefined) {
    setLogoPreview(dataUrl ?? "");
    update("logoUrl", dataUrl);
  }

  async function checkHealth() {
    setCheckingHealth(true);
    try {
      const res = await fetch("/api/ai/health", { cache: "no-store" });
      const data = (await res.json()) as AiHealth;
      setAiHealth(data);
      return data;
    } catch {
      const fallback: AiHealth = {
        ok: false,
        reason: "network-error",
        message: "Impossible de vérifier la connexion IA. Vérifiez votre réseau",
      };
      setAiHealth(fallback);
      return fallback;
    } finally {
      setCheckingHealth(false);
    }
  }

  async function generate() {
    setIsGenerating(true);
    setSuccessMessage("");
    setErrorMessage("");
    setErrorReason("");

    try {
      const health = aiHealth ?? (await checkHealth());
      if (!health.ok) {
        setErrorReason(health.reason);
        setErrorMessage(health.message);
        setIsGenerating(false);
        return;
      }

      // Les imports du wizard sont initialement des data-URL. Avec 5 médias de
      // 2 Mo + un logo, envoyer `brief` tel quel dépasse la limite Vercel et
      // provoque un 413 avant même l'entrée dans la route. On externalise donc
      // chaque fichier séparément, puis l'IA ne reçoit plus que des URL.
      const generationBrief = await prepareWizardBriefForGeneration(brief);
      if (generationBrief !== brief) {
        setBrief(generationBrief);
        setLogoPreview(generationBrief.logoUrl ?? "");
      }

      const response = await fetch("/api/ai/generate-funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generationBrief),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const apiErr = data as ApiError;
        // 🆕 Gating abonnement : notifier clairement (pas de forfait actif /
        // limite du forfait) avec une invite à s'abonner, plutôt qu'une erreur
        // technique générique.
        const gate =
          apiErr.error === "subscription_required"
            ? "subscription-required"
            : apiErr.error === "funnel_quota_reached" ||
                apiErr.error === "quota_exceeded"
              ? "plan-limit"
              : response.status === 401 || apiErr.error === "unauthorized"
                ? "session-expired"
                : undefined;
        const payloadTooLarge = response.status === 413;
        setErrorReason(
          gate ?? (payloadTooLarge ? "payload-too-large" : apiErr.reason ?? "unknown"),
        );
        const validationMessage =
          apiErr.reason === "schema-mismatch" || apiErr.reason === "invalid-brief"
            ? apiErr.userMessage
            : undefined;
        setErrorMessage(
          validationMessage ??
            (gate === "subscription-required"
              ? apiErr.message ?? "Aucun forfait actif. Choisis un forfait pour générer ton tunnel."
              : gate === "plan-limit"
                ? apiErr.message ?? "Tu as atteint la limite de ton forfait."
                : gate === "session-expired"
                  ? "Ta session a expiré. Reconnecte-toi, puis réessaie."
                  : payloadTooLarge
                    ? "Les médias sélectionnés sont encore trop volumineux. Retire le fichier le plus lourd, puis relance la génération."
                    : GENERATION_SYSTEM_ERROR_MESSAGE)
        );
        setFunnel(null);
        return;
      }

      if (!data?.funnel) {
        setErrorReason("empty-response");
        setErrorMessage(GENERATION_SYSTEM_ERROR_MESSAGE);
        setFunnel(null);
        return;
      }

      // 🆕 FIX RÉGRESSION : `brief.mainColor` a une valeur PAR DÉFAUT
      // ("#080E1A", posée dès l'ouverture du wizard, cf. état initial du
      // brief) — donc TOUJOURS présente, même si l'utilisateur n'a jamais
      // touché l'étape « Ambiance » ni activé le branding. L'ancien code
      // écrasait `design.primaryColor` avec cette valeur pour TOUS les
      // tunnels, quel que soit le template choisi → tous les templates
      // convergeaient vers ce quasi-noir. On ne recolore désormais QUE si
      // l'utilisateur a explicitement activé « Utiliser les couleurs de ma
      // marque » (étape Template) — sinon le design retourné par l'IA (donc
      // l'identité par défaut du template) est conservé tel quel.
      const enrichedFunnel = {
        ...data.funnel,
        design: {
          ...data.funnel.design,
          ...(generationBrief.brandColorsEnabled
            ? {
                primaryColor: generationBrief.mainColor ?? data.funnel.design.primaryColor,
                secondaryColor: generationBrief.secondaryColor ?? data.funnel.design.secondaryColor,
              }
            : {}),
          brandColorsEnabled: generationBrief.brandColorsEnabled === true,
          style: generationBrief.designStyle,
        },
      };

      setFunnel(enrichedFunnel);

      // ✅ FIX : on isole la persistance localStorage pour différencier
      // un échec de quota d'un échec réseau côté API.
      try {
        const stored = createFunnelFromAi(enrichedFunnel, generationBrief);
        setSuccessMessage("Tunnel généré : redirection vers l'éditeur...");
        // 🆕 Micro-victoire : 1er tunnel généré (déclenchée après l'arrivée sur
        // l'éditeur — la modale se perdrait sinon à la navigation).
        queueCelebration({
          level: "l",
          once: "first_funnel",
          emoji: "✨",
          title: "Ton premier tunnel est né !",
          message:
            "Nos agents IA viennent de te générer un tunnel complet. Personnalise-le à ton goût, puis publie-le pour le mettre en ligne.",
        });
        setTimeout(() => {
          router.push(`/editor/${stored.id}`);
        }, 600);
      } catch (storageErr) {
        console.error("[wizard] storage error:", storageErr);

        if (storageErr instanceof FunnelStorageQuotaError) {
          const usage = getStorageUsage();
          setErrorReason("storage-full");
          setErrorMessage(
            `Le stockage du navigateur est saturé (${usage.totalMB} Mo utilisés sur ~5 Mo). ` +
              `La purge automatique des anciens tunnels n'a pas suffi. ` +
              `Supprimez d'anciens tunnels depuis le tableau de bord, ou videz le cache du site, puis réessayez.`
          );
        } else {
          setErrorReason("storage-error");
          setErrorMessage(
            storageErr instanceof Error
              ? `Impossible d'enregistrer le tunnel localement : ${storageErr.message}`
              : "Impossible d'enregistrer le tunnel localement"
          );
        }
        return;
      }

    } catch (err) {
      console.error("[wizard] generate fetch error:", err);

      // ✅ FIX : on intercepte aussi le quota au cas où il fuit jusqu'ici
      if (err instanceof FunnelStorageQuotaError) {
        const usage = getStorageUsage();
        setErrorReason("storage-full");
        setErrorMessage(
          `Le stockage du navigateur est saturé (${usage.totalMB} Mo utilisés sur ~5 Mo). ` +
            `Supprimez d'anciens tunnels depuis le tableau de bord, puis réessayez.`
        );
        setFunnel(null);
        return;
      }

      if (err instanceof WizardMediaUploadError) {
        setErrorReason("media-upload-failed");
        setErrorMessage(
          "Impossible de préparer un média pour la génération. Vérifie ta connexion, puis relance. Aucun fichier n'a été perdu.",
        );
      } else {
        setErrorReason("network-error");
        setErrorMessage(GENERATION_SYSTEM_ERROR_MESSAGE);
      }
      setFunnel(null);
    } finally {
      setIsGenerating(false);
    }
  }

  const previewFunnelBase: Funnel = funnel ?? {
    funnelName: `${brief.brandName} — ${brief.offerName}`,
    language: brief.language,
    // 🆕 Funnel de démonstration complet (hero → problème → bénéfices →
    // témoignages → tarif → bonus → garantie → FAQ → CTA) tant que l'IA n'a
    // pas encore généré le vrai copy — voir buildShowcaseSections ci-dessus.
    sections: buildShowcaseSections(brief),
    thankYouPage: { headline: "Merci", body: "Votre demande est confirmée" },
    emails: [],
    seo: { title: brief.offerName, description: brief.promise },
    design: {
      primaryColor: brief.mainColor ?? "#080E1A",
      secondaryColor: brief.secondaryColor ?? "#C7A436",
      accentColor: "#31845C",
      style: brief.designStyle,
    },
    defaultCta: brief.primaryCta,
  };

  const previewFunnel: Funnel = {
    ...previewFunnelBase,
    meta: {
      ...(previewFunnelBase.meta ?? {}),
      templateId: brief.templateId,
      moodId: brief.moodId,
      funnelKind: brief.funnelKind,
      logoUrl: logoPreview || brief.logoUrl,
    },
  };

  const stepLabel = steps[step];

  // 🆕 Passage à l'étape suivante AVEC garde de validation sur « Ton offre » :
  // si un champ obligatoire (nom de marque, nom de l'offre) est vide, on NE passe
  // PAS, on affiche un message et on saute sur le sous-onglet incomplet.
  const goNext = () => {
    // 🆕 Étape « Format » : en mode calendrier EXTERNE, l'URL est obligatoire.
    // Sans elle, aucune destination de réservation n'existe et le garde
    // anti-ancre-morte retire les CTA — l'utilisateur obtiendrait un tunnel de
    // prise de RDV sans le moindre bouton, sans comprendre pourquoi.
    if (stepLabel === "Format") {
      if (bookingExternalUrlMissing(brief)) {
        setFormatStepError(
          "Colle le lien de ton calendrier externe (Calendly, Cal.com…) pour que le " +
            "bouton de réservation fonctionne.",
        );
        return;
      }
      setFormatStepError("");
    }
    if (stepLabel === "Ton offre") {
      const missing = getOfferMissingRequired(brief);
      if (missing.length > 0) {
        setOfferSubTab(missing[0].tab);
        setOfferStepError(
          `Il manque ${missing.map((m) => m.label).join(" et ")} avant de continuer.`,
        );
        return;
      }
      setOfferStepError("");
    }
    setStep((v) => Math.min(steps.length - 1, v + 1));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Écran de choix initial (Part B) — n'altère PAS la machine d'étapes classique.
  // ─────────────────────────────────────────────────────────────────────────
  if (entryMode === "choice") {
    return (
      <div className="grid gap-6 animate-[fadeIn_0.4s_ease-out] max-w-3xl mx-auto">
        <div className="text-center">
          <h2 className="text-2xl font-black text-ink">Comment veux-tu créer ton tunnel&nbsp;?</h2>
          <p className="mt-2 text-muted">Choisis ton point de départ. Tu pourras tout ajuster ensuite dans l'éditeur.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => { update("creationMode", "guided"); setEntryMode("wizard"); }}
            className="group text-left rounded-2xl border-2 border-line bg-white p-6 transition-all duration-200 hover:border-[#31845C] hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#31845C]/40"
          >
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#31845C]/15 text-[#31845C]">
              <Target className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-black text-ink">Pas à pas</h3>
            <p className="mt-1.5 text-sm text-muted">Le parcours guidé classique&nbsp;: format, offre, audience, copywriting… Tu contrôles chaque détail, étape par étape.</p>
          </button>
          <button
            type="button"
            onClick={() => { update("creationMode", "express"); setEntryMode("express"); }}
            className="group text-left rounded-2xl border-2 border-line bg-white p-6 transition-all duration-200 hover:border-[#C7A436] hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#C7A436]/50"
          >
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#C7A436]/15 text-[#C7A436]">
              <Wand2 className="h-6 w-6" />
            </div>
            <h3 className="flex items-center gap-2 text-lg font-black text-ink">
              Express IA
              <span className="rounded-full bg-[#C7A436] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#080E1A]">Rapide</span>
            </h3>
            <p className="mt-1.5 text-sm text-muted">Décris ton activité en quelques phrases et choisis le type de tunnel (les pages générées sont indiquées). L'IA pré-remplit tout, puis tu ajustes thème, visuels et médias.</p>
          </button>
        </div>
      </div>
    );
  }

  if (entryMode === "express") {
    const canGo = expressPrompt.trim().length >= 20;
    return (
      <div className="grid gap-5 animate-[fadeIn_0.4s_ease-out] max-w-2xl mx-auto">
        <button
          type="button"
          onClick={() => setEntryMode("choice")}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
        <div>
          <h2 className="text-2xl font-black text-ink">Décris ton activité</h2>
          <p className="mt-2 text-muted">Plus c'est précis, meilleur sera le tunnel. Mentionne ton offre, ton audience, ton prix et ta promesse.</p>
        </div>
        <Field label="Ton activité, ton offre, ta cible…">
          <Textarea
            rows={7}
            value={expressPrompt}
            onChange={(e) => setExpressPrompt(e.target.value)}
            placeholder="Ex : Je suis coach en nutrition pour femmes actives. Je vends un programme de 8 semaines à 297€ qui aide à retrouver de l'énergie sans régime restrictif. Mon audience : femmes 30-45 ans débordées qui ont déjà essayé plusieurs régimes…"
          />
        </Field>
        <Field label="Type de tunnel (les pages générées sont indiquées)">
          <Select
            value={brief.funnelKind ?? "lead-magnet"}
            onChange={(e) => update("funnelKind", e.target.value as FunnelKind)}
          >
            {FUNNEL_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label[brief.language]} — {k.pages[brief.language]}
              </option>
            ))}
          </Select>
        </Field>
        {(brief.funnelKind ?? "lead-magnet") === "webinar" && (
          <WebinarDetailsFields
            language={brief.language}
            webinarDate={brief.webinarDate}
            webinarUrgency={brief.webinarUrgency}
            onChange={(patch) => updateMany(patch)}
          />
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted">{canGo ? "Tu pourras générer tout de suite — thème et visuels restent ajustables via les onglets." : "Ajoute encore quelques détails (20 caractères min.)."}</span>
          <Button
            disabled={!canGo}
            onClick={() => {
              updateMany({
                creationMode: "express",
                businessPrompt: expressPrompt.trim(),
                // 🆕 Type explicite obligatoire (plus de « laisser l'IA décider »)
                funnelKind: brief.funnelKind ?? "lead-magnet",
              });
              setEntryMode("wizard");
              // Parcours express réduit → on démarre sur sa 1re étape (Template).
              setStep(0);
            }}
          >
            Continuer <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 animate-[fadeIn_0.4s_ease-out] min-w-0 max-w-full">
      {/* ─── Stepper ─── */}
      <Card className="p-2 sm:p-3 min-w-0 overflow-hidden">
        {/* Mobile / tablette : scroll horizontal */}
        <div
          ref={stepperRef}
          className="flex gap-1.5 overflow-x-auto pb-1 xl:hidden -mx-1 px-1 snap-x snap-mandatory min-w-0 scroll-smooth"
        >
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              data-step-index={index}
              onClick={() => setStep(index)}
              title={label}
              className={`shrink-0 snap-start rounded-lg px-2.5 py-2 text-left text-[11px] font-bold transition-all duration-200 min-w-[88px] max-w-[110px] ${
                index === step
                  ? "bg-[#080E1A] text-white shadow-sm"
                  : index < step
                  ? "bg-[#31845C]/10 text-[#31845C]"
                  : "bg-canvas text-muted hover:bg-line/40"
              }`}
            >
              <span className="mb-0.5 block text-[9px] opacity-80">
                {String(index + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
              </span>
              <span className="block truncate">{label}</span>
            </button>
          ))}
        </div>

        {/* Desktop : grille 12 colonnes */}
        <div className="hidden xl:grid grid-cols-12 gap-2">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(index)}
              title={label}
              className={`min-w-0 rounded-lg px-2.5 py-2.5 text-left text-xs font-bold transition-all duration-200 ${
                index === step
                  ? "bg-[#080E1A] text-white shadow-sm"
                  : index < step
                  ? "bg-[#31845C]/10 text-[#31845C]"
                  : "bg-canvas text-muted hover:bg-line/40"
              }`}
            >
              <span className="mb-1 block text-[10px] opacity-80">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="block truncate">{label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* ─── Onglets mobile/tablette (cachés sur xl+) ─── */}
      <div className="xl:hidden">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-canvas p-1">
          <button
            type="button"
            onClick={() => setMobileTab("form")}
            className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold transition ${
              mobileTab === "form"
                ? "bg-white text-ink shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            <Pencil size={13} />
            Formulaire
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("preview")}
            className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold transition ${
              mobileTab === "preview"
                ? "bg-white text-ink shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            <Eye size={13} />
            Aperçu
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,38%)_minmax(0,62%)] items-start min-w-0">
        {/* ─── Panneau Formulaire ─── */}
        <Card
          className={`p-3 sm:p-5 min-w-0 ${
            mobileTab === "preview" ? "hidden xl:block" : ""
          }`}
        >
          <NavBar
            step={step}
            total={steps.length}
            onPrev={() => setStep((v) => Math.max(0, v - 1))}
            onNext={goNext}
          />

          <div className="mt-5 animate-[slideIn_0.25s_ease-out] min-w-0" key={`${step}-${stepLabel}`}>
            {stepLabel === "Format" && (
              <FunnelKindStep
                language={brief.language}
                value={brief.funnelKind}
                onSelect={selectKind}
                webinarDate={brief.webinarDate}
                webinarUrgency={brief.webinarUrgency}
                webinarExternalLink={brief.webinarExternalLink}
                replayExpiryHours={brief.replayExpiryHours}
                webinarMode={brief.webinarMode}
                evergreenVideoUrl={brief.evergreenVideoUrl}
                evergreenOfferHours={brief.evergreenOfferHours}
                onWebinarChange={(patch) => updateMany(patch)}
                calendarEmbedUrl={brief.calendarEmbedUrl}
                bookingMode={brief.bookingMode}
                bookingConfirmationPage={brief.bookingConfirmationPage}
                bookingError={formatStepError}
                onBookingChange={(patch) => {
                  updateMany(patch);
                  // L'erreur disparaît dès que l'utilisateur corrige — y compris
                  // en revenant au mode natif, où le champ n'est plus requis.
                  if (formatStepError) setFormatStepError("");
                }}
                challengeDays={brief.challengeDays}
                challengeDayTitles={brief.challengeDayTitles}
                onChallengeChange={(patch) => updateMany(patch)}
              />
            )}
            {stepLabel === "Template" && (
              <TemplateGalleryStep
                funnelKind={brief.funnelKind}
                language={brief.language}
                selectedTemplateId={brief.templateId}
                onSelect={selectTemplate}
                brandColors={{
                  enabled: brief.brandColorsEnabled,
                  colors:
                    brief.brandColors ??
                    (brief.secondaryColor || brief.mainColor
                      ? [brief.secondaryColor ?? "#31845C", brief.mainColor ?? "#080E1A"]
                      : undefined),
                }}
                onBrandColorsChange={(patch) =>
                  updateMany({
                    ...(patch.enabled !== undefined
                      ? { brandColorsEnabled: patch.enabled }
                      : {}),
                    ...(patch.colors !== undefined ? { brandColors: patch.colors } : {}),
                  })
                }
              />

            )}
            {stepLabel === "Objectif" && (
              <ObjectiveStep
                value={brief.funnelType}
                onSelect={(v: string) => {
                  update("funnelType", v);
                  setStep((s) => Math.min(s + 1, steps.length - 1));
                }}
              />
            )}
            {stepLabel === "Ton offre" && (
              <OfferStep
                brief={brief}
                update={update}
                logoPreview={logoPreview}
                setLogo={setLogo}
                subTab={offerSubTab}
                setSubTab={setOfferSubTab}
                error={
                  offerStepError && getOfferMissingRequired(brief).length > 0
                    ? offerStepError
                    : ""
                }
              />
            )}
            {stepLabel === "Audience" && <AudienceStep brief={brief} update={update} />}
            {stepLabel === "Copywriting" && (
              <CopywritingStep
                language={brief.language}
                prefs={brief.copywritingPrefs}
                onChange={(next: CopywritingPrefs) => update("copywritingPrefs", next)}
              />
            )}
            {stepLabel === "Vidéo" && (
              <VideoStep
                language={brief.language}
                videoUrl={brief.videoUrl}
                onChange={(url: string) => update("videoUrl", url)}
              />
            )}
            {stepLabel === "Médias" && (
              <MediasStep
                language={brief.language}
                medias={brief.medias}
                onChange={(next: MediaItem[]) => update("medias", next)}
              />
            )}
            {stepLabel === "CTA" && <CtaStep brief={brief} updateCta={updateCta} />}
            {stepLabel === "Visuels" && <ImagesStep brief={brief} update={update} />}
            {stepLabel === "Ambiance" && (
              <MoodStep
                language={brief.language}
                moodId={brief.moodId}
                mainColor={brief.mainColor}
                secondaryColor={brief.secondaryColor}
                onChange={(patch: Partial<FunnelBrief>) => updateMany(patch)}
              />
            )}
            {stepLabel === "Génération" && (
              <div className="grid gap-4">
                <CommunityChannelsFields brief={brief} update={update} />
                <GenerationStep
                templateName={currentPremiumTemplate.name}
                templateObjective={
                  currentPremiumTemplate.personality[brief.language] ??
                  currentPremiumTemplate.personality.fr
                }
                isGenerating={isGenerating}
                onGenerate={generate}
                onCheckHealth={checkHealth}
                checkingHealth={checkingHealth}
                health={aiHealth}
                successMessage={successMessage}
                errorMessage={errorMessage}
                errorReason={errorReason}
                funnelKind={brief.funnelKind}
                language={brief.language}
                selectedOptionalPages={brief.selectedOptionalPages ?? []}
                onToggleOptionalPage={toggleOptionalPage}
                webinarMode={brief.webinarMode}
                webinarDate={brief.webinarDate}
                evergreenVideoUrl={brief.evergreenVideoUrl}
                bookingMode={brief.bookingMode}
                calendarEmbedUrl={brief.calendarEmbedUrl}
                otoOfferName={brief.otoOfferName}
                otoPrice={brief.otoPrice}
                otoPromise={brief.otoPromise}
                onOtoOfferChange={(patch) => updateMany(patch)}
                />
              </div>
            )}
          </div>

          <div className="mt-6 sticky bottom-0 -mx-3 -mb-3 sm:static sm:mx-0 sm:mb-0 bg-white/95 backdrop-blur-sm border-t border-line sm:border-0 px-3 py-2 sm:px-0 sm:py-0 sm:bg-transparent xl:static z-10">
            <NavBar
              step={step}
              total={steps.length}
              onPrev={() => setStep((v) => Math.max(0, v - 1))}
              onNext={goNext}
            />
          </div>
        </Card>

        {/* ─── Panneau Aperçu ─── */}
        <div
          className={`grid gap-3 min-w-0 ${
            mobileTab === "form" ? "hidden xl:grid" : ""
          }`}
        >
          <Card className="p-3 sm:p-4 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-3 flex-nowrap min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#C7A436]">Live preview</p>
                <h2 className="mt-1 truncate text-base sm:text-lg font-black text-ink">{brief.brandName}</h2>
                <p className="mt-0.5 truncate text-[11px] sm:text-xs text-muted">
                  {brief.funnelType} · {currentLegacyTemplate.sections.length} sections · {brief.language.toUpperCase()}
                  {funnel ? " · IA" : " · structure"} · {currentPremiumTemplate.name}
                </p>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* 🆕 FIX : « Démo » ouvrait /funnels/demo (route inexistante →
                    « Tunnel introuvable »). Il ouvre désormais l'aperçu PLEIN
                    NAVIGATEUR du tunnel en cours (template/ambiance actuels)
                    dans un nouvel onglet, via /create/demo qui lit la clé
                    ff:wizard-demo déposée ici. */}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    try {
                      const payload = JSON.stringify(previewFunnel);
                      try {
                        window.localStorage.setItem("ff:wizard-demo", payload);
                      } catch {
                        window.sessionStorage.setItem("ff:wizard-demo", payload);
                      }
                    } catch {
                      /* storage plein : la démo retombera sur l'exemple générique */
                    }
                    window.open("/create/demo", "_blank", "noopener");
                  }}
                >
                  Démo
                </Button>
                <Button href="/export-systeme" variant="secondary">
                  <Upload size={14} /> Export
                </Button>
              </div>
            </div>
          </Card>

          <div className="xl:sticky xl:top-4 ff-preview-wrapper min-w-0 max-w-full overflow-hidden">
            <FunnelPreview
              funnel={previewFunnel}
              logoSrc={logoPreview}
              viewportHeight={680}
              autoScrollDemoKey={brief.templateId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function NavBar({ step, total, onPrev, onNext }: { step: number; total: number; onPrev: () => void; onNext: () => void; }) {
  return (
    <div className="flex justify-between gap-3 rounded-lg bg-canvas p-2">
      <Button type="button" variant="secondary" disabled={step === 0} onClick={onPrev}>
        <ArrowLeft size={16} /> Retour
      </Button>
      <Button type="button" disabled={step === total - 1} onClick={onNext}>
        Suivant <ArrowRight size={16} />
      </Button>
    </div>
  );
}

function ObjectiveStep({ value, onSelect }: { value: string; onSelect: (v: string) => void; }) {
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2.5">
        <Target className="text-[#31845C]" size={20} />
        <h2 className="text-xl font-black">Objectif du tunnel</h2>
      </div>
      <div className="grid gap-2.5">
        {FUNNEL_GOALS.map((goal) => (
          <button
            key={goal.value}
            type="button"
            onClick={() => onSelect(goal.value)}
            className={`rounded-lg border p-4 text-left transition-all duration-200 ${value === goal.value
                ? "border-[#31845C] bg-[#31845C]/10 shadow-sm"
                : "border-line bg-white hover:border-[#080E1A]/30"
              }`}
          >
            <span className="flex items-center justify-between gap-3 font-bold text-ink">
              {goal.label}
              {value === goal.value && <CheckCircle2 className="text-[#31845C]" size={16} />}
            </span>
            <span className="mt-1 block text-xs text-muted">{goal.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// 🆕 Sous-onglets de l'étape "Ton offre" — avant, les 4 blocs (Marque / Offre
// / Bénéfices-urgence-garantie / À propos) s'empilaient en une seule colonne
// très haute, obligeant à défiler énormément pour trouver un champ (signalé
// par l'utilisateur, capture à l'appui). On garde UN SEUL step dans le
// stepper global (ALL_STEPS, navigation "Suivant/Retour" inchangée), mais on
// segmente le CONTENU du step en sous-onglets internes : un seul bloc visible
// à la fois, scroll interne réduit au strict nécessaire. Les données restent
// dans le même `brief` (rien ne change côté state/validation).
const OFFER_SUBTABS = [
  { id: "marque", label: "Marque", icon: Building2 },
  { id: "offre", label: "Offre", icon: Package },
  { id: "benefices", label: "Bénéfices & garantie", icon: CheckCircle2 },
  { id: "apropos", label: "À propos", icon: User },
] as const;
type OfferSubTab = (typeof OFFER_SUBTABS)[number]["id"];

// 🆕 Complétude de chaque sous-onglet « Ton offre ».
//  - required : true si un champ OBLIGATOIRE de l'onglet est vide (bloque « Suivant »).
//  - filled   : true si l'onglet a du contenu (indicateur ✓ vert / point ambre).
// Obligatoires : marque = nom de marque, offre = nom de l'offre. Le reste est
// recommandé (l'IA peut compléter) → indiqué mais non bloquant.
function getOfferTabStatus(
  brief: FunnelBrief,
): Record<OfferSubTab, { required: boolean; filled: boolean }> {
  const benefits = (brief.keyBenefits ?? []).filter((b) => b.trim());
  const brand = !!brief.brandName?.trim();
  const offer = !!brief.offerName?.trim();
  return {
    marque: { required: !brand, filled: brand },
    offre: { required: !offer, filled: offer },
    benefices: { required: false, filled: benefits.length > 0 },
    apropos: { required: false, filled: !!(brief.aboutText?.trim() || brief.authorName?.trim()) },
  };
}

/** 🆕 Champs OBLIGATOIRES manquants de l'étape « Ton offre » (pour bloquer Suivant). */
function getOfferMissingRequired(
  brief: FunnelBrief,
): { tab: OfferSubTab; label: string }[] {
  const miss: { tab: OfferSubTab; label: string }[] = [];
  if (!brief.brandName?.trim()) miss.push({ tab: "marque", label: "le nom de marque" });
  if (!brief.offerName?.trim()) miss.push({ tab: "offre", label: "le nom de l'offre/produit" });
  return miss;
}

// ─── ÉTAPE FUSIONNÉE : Marque + Offre + À propos ───
function OfferStep({
  brief, update, logoPreview, setLogo, subTab, setSubTab, error,
}: {
  brief: FunnelBrief;
  update: <K extends keyof FunnelBrief>(k: K, v: FunnelBrief[K]) => void;
  logoPreview: string;
  setLogo: (dataUrl: string | undefined) => void;
  subTab: OfferSubTab;
  setSubTab: (t: OfferSubTab) => void;
  error?: string;
}) {
  const status = getOfferTabStatus(brief);

  // 🆕 Liste dynamique des bénéfices clés (boutons + / ✕).
  const benefits = brief.keyBenefits ?? [];
  function addBenefit() {
    update("keyBenefits", [...benefits, ""]);
  }
  function updateBenefit(idx: number, val: string) {
    update("keyBenefits", benefits.map((b, i) => (i === idx ? val : b)));
  }
  function removeBenefit(idx: number) {
    update("keyBenefits", benefits.filter((_, i) => i !== idx));
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-xl font-black text-ink">Ton offre</h2>
        <p className="mt-1 text-xs text-muted">
          Présente ta marque, ton produit et qui tu es. Ces infos guideront tout le copywriting du tunnel.
        </p>
      </div>

      {/* 🆕 Barre de sous-onglets avec INDICATEUR de complétude par onglet :
          point rouge = champ obligatoire manquant · ✓ vert = rempli · point
          ambre = recommandé/vide. L'utilisateur voit d'un coup d'œil ce qui
          reste à remplir avant de cliquer « Suivant ». */}
      <div className="-mx-0.5 flex gap-1 overflow-x-auto p-0.5 sm:flex-wrap">
        {OFFER_SUBTABS.map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          const st = status[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
                active
                  ? "border-[#08498D] bg-[#08498D] text-white shadow-sm"
                  : st.required
                    ? "border-red-400/60 bg-white text-ink/70 hover:text-ink"
                    : "border-line bg-white text-ink/70 hover:border-[#08498D]/40 hover:text-ink"
              }`}
            >
              <Icon size={13} />
              {tab.label}
              {/* Pastille d'état */}
              <span
                aria-hidden
                className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-black"
                style={
                  st.required
                    ? { background: "#EF4444", color: "#fff" }
                    : st.filled
                      ? { background: "#22C55E", color: "#fff" }
                      : { background: "rgba(199,164,54,0.25)", color: "#A9821E" }
                }
              >
                {st.required ? "!" : st.filled ? "✓" : "•"}
              </span>
            </button>
          );
        })}
      </div>

      {/* 🆕 Message si l'utilisateur a cliqué « Suivant » avec un champ obligatoire vide. */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600">
          <span aria-hidden>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* ── Bloc 1 : Marque ── */}
      {subTab === "marque" && (
      <section className="grid gap-3 rounded-lg border border-line bg-white p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#08498D]/10 text-[#08498D]">
            <Building2 size={14} />
          </span>
          <h3 className="text-sm font-black uppercase tracking-wider text-ink">Marque</h3>
        </div>

        <Field label="Nom de marque">
          <Input value={brief.brandName} onChange={(e) => update("brandName", e.target.value)} />
        </Field>

        <Field label="Logo">
          <LogoUploader
            value={logoPreview || brief.logoUrl}
            brandName={brief.brandName}
            onChange={setLogo}
          />
        </Field>

        <Field label="Langue de génération">
          <Select value={brief.language} onChange={(e) => update("language", e.target.value as Language)}>
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="es">Español</option>
          </Select>
        </Field>
      </section>
      )}

      {/* ── Bloc 2 : Offre (générique, tous types SAUF webinaire).
             ⚠️ Le bloc RESTE affiché pour « booking » : il porte le nom du RDV
             et la promesse, indispensables. Seuls les champs COMMERCIAUX à
             l'intérieur sont masqués (cf. showsPricingBlock). ── */}
      {subTab === "offre" && brief.funnelKind !== "webinar" && (
      <section className="grid gap-3 rounded-lg border border-line bg-white p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#C7A436]/15 text-[#C7A436]">
            <Package size={14} />
          </span>
          <h3 className="text-sm font-black uppercase tracking-wider text-ink">Offre</h3>
        </div>

        <Field
          label={
            brief.funnelKind === "booking"
              ? "Objet du rendez-vous"
              : "Nom du produit ou service"
          }
        >
          <Input
            value={brief.offerName}
            onChange={(e) => update("offerName", e.target.value)}
            placeholder={
              brief.funnelKind === "booking" ? "Appel découverte, audit gratuit…" : undefined
            }
          />
        </Field>

        {/* 🆕 B6 — Tout le bloc commercial ci-dessous est masqué pour les types
            dont la conversion n'est pas un achat (cf. lib/funnels/wizardFields.ts).
            Les champs correspondants sont NETTOYÉS à la bascule de type, sinon
            une saisie antérieure continuerait d'alimenter la génération. */}
        {showsPricingBlock(brief.funnelKind) && (
        <>

        {/* 🆕 CHALLENGE — sélecteur Gratuit / Payant.
            La saisie libre laissait passer « gratuit », « 0€ », « free »… que
            la porte payante interprétait diversement. Le sélecteur pose une
            valeur canonique et rend le comportement déterministe (cf. N2). */}
        {brief.funnelKind === "challenge" ? (
          <Field
            label="Participation au challenge"
            hint="La plupart des challenges sont gratuits : ce qui se vend, c'est l'offre de clôture plus bas."
          >
            <div className="grid gap-2">
              <div className="flex gap-1.5">
                {[
                  { id: "free" as const, label: "Gratuit" },
                  { id: "paid" as const, label: "Payant" },
                ].map((opt) => {
                  const isFree = isFreePriceLabel(brief.price);
                  const active = opt.id === "free" ? isFree : !isFree;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        update("price", opt.id === "free" ? "Gratuit" : "")
                      }
                      className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? "border-[#C7A436] bg-[#C7A436]/15 text-ink"
                          : "border-line text-muted hover:border-[#C7A436]/50 hover:text-ink"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {!isFreePriceLabel(brief.price) && (
                <Input
                  value={brief.price}
                  onChange={(e) => update("price", e.target.value)}
                  placeholder="27€, 47€..."
                />
              )}
            </div>
          </Field>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Prix">
              <Input value={brief.price} onChange={(e) => update("price", e.target.value)} placeholder="49€, 297€, Gratuit..." />
            </Field>
            {/* 🆕 Prix d'ancrage : cosmétique, jamais encaissé. */}
            <Field
              label="Prix barré (optionnel)"
              hint="Affiché rayé au-dessus du prix. Purement visuel : le montant encaissé reste le prix ci-contre."
            >
              <Input value={brief.anchorPrice ?? ""} onChange={(e) => update("anchorPrice", e.target.value)} placeholder="97€..." />
            </Field>
          </div>
        )}

        <div className="rounded-xl border border-line/60 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/60">
            Upsell (optionnel) — proposé après l'achat
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
            <Field label="Offre upsell" hint="Décris CE QUE c'est. Laisse vide pour ne PAS générer de page upsell.">
              <Input value={brief.upsellOffer ?? ""} onChange={(e) => update("upsellOffer", e.target.value)} placeholder="Pack modèles + coaching de groupe..." />
            </Field>
            <Field label="Prix upsell">
              <Input value={brief.upsellPrice ?? ""} onChange={(e) => update("upsellPrice", e.target.value)} placeholder="27€..." />
            </Field>
          </div>
        </div>

        <div className="rounded-xl border border-line/60 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/60">
            Downsell (optionnel) — repli si l'upsell est refusé
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
            <Field label="Offre downsell" hint="Version réduite/moins chère. Laisse vide pour ne PAS générer de page downsell.">
              <Input value={brief.downsellOffer ?? ""} onChange={(e) => update("downsellOffer", e.target.value)} placeholder="Les modèles seuls, sans le coaching..." />
            </Field>
            <Field label="Prix downsell">
              <Input value={brief.downsellPrice ?? ""} onChange={(e) => update("downsellPrice", e.target.value)} placeholder="17€..." />
            </Field>
          </div>
        </div>

        <div className="rounded-xl border border-line/60 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/60">
            Order bump (optionnel) — case à cocher sur la page de commande
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
            <Field label="Produit complémentaire" hint="Laisse vide pour ne PAS afficher d'order bump.">
              <Input value={brief.orderBumpName ?? ""} onChange={(e) => update("orderBumpName", e.target.value)} placeholder="Guide PDF bonus..." />
            </Field>
            <Field label="Prix">
              <Input value={brief.orderBumpPrice ?? ""} onChange={(e) => update("orderBumpPrice", e.target.value)} placeholder="9€..." />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Description courte (optionnel)">
              <Input value={brief.orderBumpDescription ?? ""} onChange={(e) => update("orderBumpDescription", e.target.value)} placeholder="Ajoute ce bonus à ta commande en un clic" />
            </Field>
          </div>
        </div>

        <Field label="Lien de paiement (optionnel)" hint="Stripe Payment Link, page de paiement systeme.io, etc. Si renseigné, le bouton de l'offre redirige vers ce lien pour encaisser.">
          <Input value={brief.paymentUrl ?? ""} onChange={(e) => update("paymentUrl", e.target.value)} placeholder="https://buy.stripe.com/..." />
        </Field>
        </>
        )}

        <Field label="Promesse principale">
          <Textarea
            value={brief.promise}
            onChange={(e) => update("promise", e.target.value)}
            placeholder="Le bénéfice n°1 que ton client obtient grâce à ton offre"
            rows={3}
          />
        </Field>
      </section>
      )}

      {/* ── Bloc 2bis : Webinaire — DEUX offres distinctes ──
          (a) le webinaire lui-même (offerName/price/promise réutilisés :
              titre + promesse + prix, généralement "Gratuit") → page
              d'inscription ; (b) l'offre vendue APRÈS le webinaire
              (postWebinarOfferName/Price/Promise) → page de vente. */}
      {subTab === "offre" && brief.funnelKind === "webinar" && (
        <>
          <section className="grid gap-3 rounded-lg border border-line bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#C7A436]/15 text-[#C7A436]">
                <Package size={14} />
              </span>
              <h3 className="text-sm font-black uppercase tracking-wider text-ink">Ton webinaire</h3>
            </div>
            <p className="-mt-1 text-xs text-muted">
              Ce que voit le prospect sur la page d'inscription : le sujet et la promesse du webinaire (pas l'offre finale).
            </p>

            <Field label="Titre / sujet du webinaire">
              <Input value={brief.offerName} onChange={(e) => update("offerName", e.target.value)} placeholder="Ex. Comment doubler tes ventes en 30 jours" />
            </Field>

            <Field label="Prix du webinaire" hint="Laisse « Gratuit » si c'est l'appât — le prix ci-dessous concerne l'offre vendue après.">
              <Input value={brief.price} onChange={(e) => update("price", e.target.value)} placeholder="Gratuit" />
            </Field>

            <Field label="Promesse du webinaire">
              <Textarea
                value={brief.promise}
                onChange={(e) => update("promise", e.target.value)}
                placeholder="Ce que le prospect va apprendre/obtenir en assistant au webinaire"
                rows={3}
              />
            </Field>
          </section>

          <section className="grid gap-3 rounded-lg border border-line bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#08498D]/10 text-[#08498D]">
                <Package size={14} />
              </span>
              <h3 className="text-sm font-black uppercase tracking-wider text-ink">Offre vendue après le webinaire</h3>
            </div>
            <p className="-mt-1 text-xs text-muted">
              Ce qui alimente la page de vente affichée après le live/replay. Distinct du webinaire ci-dessus.
            </p>

            <Field label="Nom du produit ou service">
              <Input value={brief.postWebinarOfferName ?? ""} onChange={(e) => update("postWebinarOfferName", e.target.value)} placeholder="Ex. Programme d'accompagnement 90 jours" />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Prix">
                <Input value={brief.postWebinarPrice ?? ""} onChange={(e) => update("postWebinarPrice", e.target.value)} placeholder="497€..." />
              </Field>
              {/* 🆕 Prix d'ancrage : cosmétique, jamais encaissé. */}
              <Field
                label="Prix barré (optionnel)"
                hint="Affiché rayé au-dessus du prix. Purement visuel : le montant encaissé reste le prix ci-contre."
              >
                <Input value={brief.postWebinarAnchorPrice ?? ""} onChange={(e) => update("postWebinarAnchorPrice", e.target.value)} placeholder="997€..." />
              </Field>
            </div>

            <Field label="Promesse de l'offre">
              <Textarea
                value={brief.postWebinarPromise ?? ""}
                onChange={(e) => update("postWebinarPromise", e.target.value)}
                placeholder="Le bénéfice n°1 que le client obtient en achetant cette offre"
                rows={3}
              />
            </Field>

            <div className="rounded-xl border border-line/60 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/60">
                Upsell (optionnel) — proposé après l'achat
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
                <Field label="Offre upsell" hint="Décris CE QUE c'est. Laisse vide pour ne PAS générer de page upsell.">
                  <Input value={brief.upsellOffer ?? ""} onChange={(e) => update("upsellOffer", e.target.value)} placeholder="Pack modèles + coaching de groupe..." />
                </Field>
                <Field label="Prix upsell">
                  <Input value={brief.upsellPrice ?? ""} onChange={(e) => update("upsellPrice", e.target.value)} placeholder="27€..." />
                </Field>
              </div>
            </div>

            <div className="rounded-xl border border-line/60 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/60">
                Downsell (optionnel) — repli si l'upsell est refusé
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
                <Field label="Offre downsell" hint="Version réduite/moins chère. Laisse vide pour ne PAS générer de page downsell.">
                  <Input value={brief.downsellOffer ?? ""} onChange={(e) => update("downsellOffer", e.target.value)} placeholder="Les modèles seuls, sans le coaching..." />
                </Field>
                <Field label="Prix downsell">
                  <Input value={brief.downsellPrice ?? ""} onChange={(e) => update("downsellPrice", e.target.value)} placeholder="17€..." />
                </Field>
              </div>
            </div>

            <div className="rounded-xl border border-line/60 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/60">
                Order bump (optionnel) — case à cocher sur la page de commande
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
                <Field label="Produit complémentaire" hint="Laisse vide pour ne PAS afficher d'order bump.">
                  <Input value={brief.orderBumpName ?? ""} onChange={(e) => update("orderBumpName", e.target.value)} placeholder="Guide PDF bonus..." />
                </Field>
                <Field label="Prix">
                  <Input value={brief.orderBumpPrice ?? ""} onChange={(e) => update("orderBumpPrice", e.target.value)} placeholder="9€..." />
                </Field>
              </div>
              <div className="mt-3">
                <Field label="Description courte (optionnel)">
                  <Input value={brief.orderBumpDescription ?? ""} onChange={(e) => update("orderBumpDescription", e.target.value)} placeholder="Ajoute ce bonus à ta commande en un clic" />
                </Field>
              </div>
            </div>

            <Field label="Lien de paiement (optionnel)" hint="Stripe Payment Link, page de paiement systeme.io, etc. Si renseigné, le bouton de l'offre redirige vers ce lien pour encaisser.">
              <Input value={brief.paymentUrl ?? ""} onChange={(e) => update("paymentUrl", e.target.value)} placeholder="https://buy.stripe.com/..." />
            </Field>
          </section>
        </>
      )}

      {/* ── Bloc 2quater : Challenge — offre vendue à la CLÔTURE ──
          Symétrique du bloc webinaire : offerName/price/promise décrivent LE
          CHALLENGE (souvent gratuit) ; ces champs alimentent la page « Pitch
          final ». Vides → la page n'est PAS générée (sans offre réelle, l'IA
          fabriquait une page de vente factice). */}
      {subTab === "offre" && brief.funnelKind === "challenge" && (
        <section className="grid gap-3 rounded-lg border border-line bg-white p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#08498D]/10 text-[#08498D]">
              <Package size={14} />
            </span>
            <h3 className="text-sm font-black uppercase tracking-wider text-ink">
              Offre vendue à la fin du challenge
            </h3>
          </div>
          <p className="-mt-1 text-xs text-muted">
            Ce qui alimente la page « Pitch final », affichée après le dernier jour.
            Distinct du challenge lui-même. <strong>Laisse vide pour ne pas générer
            de page de vente.</strong>
          </p>

          <Field label="Nom du produit ou service">
            <Input
              value={brief.challengeOfferName ?? ""}
              onChange={(e) => update("challengeOfferName", e.target.value)}
              placeholder="Ex. Programme d'accompagnement 90 jours"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Prix">
              <Input
                value={brief.challengeOfferPrice ?? ""}
                onChange={(e) => update("challengeOfferPrice", e.target.value)}
                placeholder="497€..."
              />
            </Field>
            {/* 🆕 Prix d'ancrage : cosmétique, jamais encaissé. */}
            <Field
              label="Prix barré (optionnel)"
              hint="Affiché rayé au-dessus du prix. Purement visuel : le montant encaissé reste le prix ci-contre."
            >
              <Input
                value={brief.challengeOfferAnchorPrice ?? ""}
                onChange={(e) => update("challengeOfferAnchorPrice", e.target.value)}
                placeholder="997€..."
              />
            </Field>
          </div>

          <Field label="Promesse de l'offre">
            <Textarea
              rows={3}
              value={brief.challengeOfferPromise ?? ""}
              onChange={(e) => update("challengeOfferPromise", e.target.value)}
              placeholder="Le bénéfice n°1 que le participant obtient en achetant cette offre après le challenge"
            />
          </Field>
        </section>
      )}

      {/* ── Bloc 2ter : Bénéfices clés, urgence & garantie (commun à tous les types) ── */}
      {subTab === "benefices" && (
      <section className="grid gap-3 rounded-lg border border-line bg-white p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#31845C]/10 text-[#31845C]">
            <CheckCircle2 size={14} />
          </span>
          <h3 className="text-sm font-black uppercase tracking-wider text-ink">Bénéfices, urgence & garantie</h3>
        </div>
        <p className="-mt-1 text-xs text-muted">
          Facultatif : si tu remplis ces champs, l'IA utilise TON contenu au lieu d'en générer un générique.
        </p>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold text-ink">Bénéfices clés</p>
            <button
              type="button"
              onClick={addBenefit}
              className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink/70 hover:bg-canvas"
            >
              + Ajouter un bénéfice
            </button>
          </div>
          {benefits.length === 0 ? (
            <p className="text-xs italic text-muted">
              Aucun bénéfice saisi — l&apos;IA en générera automatiquement.
            </p>
          ) : (
            <div className="grid gap-2">
              {benefits.map((b, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={b}
                    onChange={(e) => updateBenefit(idx, e.target.value)}
                    placeholder="Ex. Gagnez 5h par semaine dès la 1ère utilisation"
                  />
                  <button
                    type="button"
                    onClick={() => removeBenefit(idx)}
                    aria-label="Retirer ce bénéfice"
                    className="shrink-0 rounded-lg border border-line px-2 py-1.5 text-xs text-muted hover:bg-canvas hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Field label="Urgence (optionnel)" hint="La raison concrète d'agir maintenant : places limitées, prix qui augmente, bonus qui expire...">
          <Textarea
            rows={2}
            value={brief.urgencyText ?? ""}
            onChange={(e) => update("urgencyText", e.target.value)}
            placeholder="Ex. Cette offre de lancement se termine dans 48h, ensuite le prix repasse à 97€"
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
          <Field label="Garantie — titre (optionnel)">
            <Input
              value={brief.guaranteeTitle ?? ""}
              onChange={(e) => update("guaranteeTitle", e.target.value)}
              placeholder="Satisfait ou remboursé"
            />
          </Field>
          <Field label="Durée">
            <Input
              value={brief.guaranteeDuration ?? ""}
              onChange={(e) => update("guaranteeDuration", e.target.value)}
              placeholder="30 jours"
            />
          </Field>
        </div>
        <Field label="Garantie — description (optionnel)">
          <Textarea
            rows={2}
            value={brief.guaranteeDescription ?? ""}
            onChange={(e) => update("guaranteeDescription", e.target.value)}
            placeholder="Décris précisément les conditions du remboursement"
          />
        </Field>
      </section>
      )}

      {/* ── Bloc 3 : À propos ── */}
      {subTab === "apropos" && (
      <section className="grid gap-3 rounded-lg border border-line bg-white p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#31845C]/10 text-[#31845C]">
            <User size={14} />
          </span>
          <h3 className="text-sm font-black uppercase tracking-wider text-ink">À propos de toi</h3>
        </div>

        <Field label="Nom et prénom (optionnel)">
          <Input
            value={brief.authorName ?? ""}
            placeholder="Ex. Marie Dubois"
            onChange={(e) => update("authorName", e.target.value)}
          />
        </Field>

        <Field label="Biographie (optionnel)">
          <Textarea
            rows={5}
            value={brief.aboutText ?? ""}
            placeholder="Ex. Coach business depuis 8 ans, j'ai accompagné 200+ entrepreneurs à structurer leur offre..."
            onChange={(e) => update("aboutText", e.target.value)}
          />
        </Field>

        <p className="rounded-lg bg-canvas p-3 text-xs text-muted">
          💡 Astuce : 3 à 5 lignes suffisent. Mentionne ton métier, ton expérience et un résultat marquant.
        </p>
      </section>
      )}
    </div>
  );
}

function AudienceStep({ brief, update }: { brief: FunnelBrief; update: <K extends keyof FunnelBrief>(k: K, v: FunnelBrief[K]) => void; }) {
  return (
    <div className="grid gap-4">
      <h2 className="text-xl font-black">Audience</h2>
      <Field label="Client idéal">
        <Textarea value={brief.targetAudience} onChange={(e) => update("targetAudience", e.target.value)} />
      </Field>
      <Field label="Problème principal">
        <Textarea value={brief.mainPain} onChange={(e) => update("mainPain", e.target.value)} />
      </Field>
      {/* Le ton est défini à l'étape Copywriting (suppression du doublon). */}
    </div>
  );
}

function CtaStep({ brief, updateCta }: { brief: FunnelBrief; updateCta: (patch: Partial<CtaConfig>) => void; }) {
  const cta = brief.primaryCta ?? makeAnchorCta("Recevoir l'offre", "lead-form");
  const modes: { value: CtaMode; label: string; hint: string; icon: typeof LinkIcon; available: boolean }[] = [
    { value: "redirect", label: "Lien de redirection", hint: "Checkout Stripe, Calendly, page externe, WhatsApp", icon: LinkIcon, available: true },
    { value: "anchor", label: "Ancre interne", hint: "Faire défiler vers une section, par exemple le formulaire", icon: AnchorIcon, available: true },
  ];

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-xl font-black">Comportement des CTA</h2>
        <p className="mt-1 text-xs text-muted">Définissez ce qui se passe quand un visiteur clique sur le bouton principal</p>
      </div>
      <Field label="Texte du bouton principal">
        <Input value={cta.label} onChange={(e) => updateCta({ label: e.target.value })} placeholder="Recevoir l'offre" />
      </Field>
      <div className="grid gap-2.5">
        {modes.map((m) => {
          const Icon = m.icon;
          const active = cta.mode === m.value;
          return (
            <button
              key={m.value}
              type="button"
              disabled={!m.available}
              onClick={() => {
                if (m.value === "redirect") updateCta({ mode: "redirect", target: "_blank", anchorId: undefined });
                else if (m.value === "anchor") updateCta({ mode: "anchor", anchorId: cta.anchorId ?? "lead-form", target: "_self", url: undefined });
                else updateCta({ mode: "popup", popupId: cta.popupId ?? "lead-popup" });
              }}
              className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition-all duration-200 ${active ? "border-[#31845C] bg-[#31845C]/10 shadow-sm" :
                  m.available ? "border-line bg-white hover:border-[#080E1A]/30" :
                    "border-line bg-canvas opacity-60 cursor-not-allowed"
                }`}
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink">
                <Icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-bold text-ink">
                  {m.label}
                  {!m.available && (
                    <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">À venir</span>
                  )}
                  {active && <CheckCircle2 size={14} className="text-[#31845C]" />}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{m.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {cta.mode === "redirect" && (
        <div className="grid gap-3 rounded-lg border border-line bg-canvas p-3 animate-[fadeIn_0.2s_ease-out]">
          <Field label="URL de redirection (Stripe Payment Link, Calendly, page externe...)">
            <Input value={cta.url ?? ""} onChange={(e) => updateCta({ url: e.target.value })} placeholder="https://buy.stripe.com/..." type="url" />
          </Field>
          <Field label="Ouverture du lien">
            <Select value={cta.target ?? "_blank"} onChange={(e) => updateCta({ target: e.target.value as "_self" | "_blank" })}>
              <option value="_blank">Nouvel onglet (recommandé)</option>
              <option value="_self">Même onglet</option>
            </Select>
          </Field>
        </div>
      )}

      {cta.mode === "anchor" && (
        <div className="grid gap-3 rounded-lg border border-line bg-canvas p-3 animate-[fadeIn_0.2s_ease-out]">
          <Field label="Identifiant de la section cible">
            <Input value={cta.anchorId ?? "lead-form"} onChange={(e) => updateCta({ anchorId: e.target.value.replace(/^#/, "") })} placeholder="lead-form" />
          </Field>
          <p className="text-xs text-muted">
            Le bouton fera défiler la page jusqu'à la section qui porte cet identifiant. Le formulaire généré utilise par défaut <code>lead-form</code>
          </p>
        </div>
      )}

    </div>
  );
}

/**
 * 🆕 Canaux communautaires : boutons « Rejoindre WhatsApp / Telegram » affichés
 * sur les pages de SUCCÈS (merci / confirmation / livraison). Ces liens
 * n'étaient jusqu'ici saisissables QUE dans l'éditeur (Style global →
 * meta.socialChannels) : demandés pendant la création, ils n'apparaissaient
 * jamais sur le tunnel généré. Affiché à l'étape « Génération », donc présent
 * dans le parcours guidé ET dans Express IA.
 */
function CommunityChannelsFields({ brief, update }: {
  brief: FunnelBrief;
  update: <K extends keyof FunnelBrief>(k: K, v: FunnelBrief[K]) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-line bg-white p-3.5">
      <div>
        <h3 className="text-sm font-bold text-ink">Rejoindre la communauté (optionnel)</h3>
        <p className="mt-0.5 text-xs text-muted">
          Ajoute un bouton WhatsApp et/ou Telegram sur la page de remerciement.
          Laisse vide pour ne rien afficher.
        </p>
      </div>
      <Field label="Lien du groupe / canal WhatsApp">
        <Input
          type="url"
          value={brief.communityWhatsappUrl ?? ""}
          onChange={(e) => update("communityWhatsappUrl", e.target.value)}
          placeholder="https://chat.whatsapp.com/..."
        />
      </Field>
      <Field label="Lien du groupe / canal Telegram">
        <Input
          type="url"
          value={brief.communityTelegramUrl ?? ""}
          onChange={(e) => update("communityTelegramUrl", e.target.value)}
          placeholder="https://t.me/..."
        />
      </Field>
    </div>
  );
}

function ImagesStep({ brief, update }: { brief: FunnelBrief; update: <K extends keyof FunnelBrief>(k: K, v: FunnelBrief[K]) => void; }) {
  const current = brief.defaultImageMode ?? "none";
  const modes: { value: ImageMode; label: string; hint: string; icon: typeof ImageOff; available: boolean }[] = [
    { value: "none", label: "Aucune image par défaut", hint: "Tunnel sobre et rapide, vous ajoutez les images section par section après génération", icon: ImageOff, available: true },
    { value: "upload", label: "Préparer des emplacements pour vos visuels", hint: "Le tunnel laisse des emplacements prêts à recevoir vos propres images", icon: ImageIcon, available: true },
  ];

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-xl font-black">Visuels du tunnel</h2>
        <p className="mt-1 text-xs text-muted">Choisissez la politique image par défaut. Modifiable section par section après génération</p>
      </div>
      <div className="grid gap-2.5">
        {modes.map((m) => {
          const Icon = m.icon;
          const active = current === m.value;
          return (
            <button
              key={m.value}
              type="button"
              disabled={!m.available}
              onClick={() => m.available && update("defaultImageMode", m.value)}
              className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition-all duration-200 ${active ? "border-[#31845C] bg-[#31845C]/10 shadow-sm" :
                  m.available ? "border-line bg-white hover:border-[#080E1A]/30" :
                    "border-line bg-canvas opacity-60 cursor-not-allowed"
                }`}
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink">
                <Icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-bold text-ink">
                  {m.label}
                  {active && <CheckCircle2 size={14} className="text-[#31845C]" />}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{m.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="rounded-lg bg-canvas p-3 text-xs text-muted">
        Après génération, chaque section permet de remplacer, ajouter ou supprimer une image individuellement
      </div>
    </div>
  );
}

function GenerationStep({
  templateName, templateObjective,
  isGenerating, onGenerate,
  onCheckHealth, checkingHealth, health,
  successMessage, errorMessage, errorReason,
  funnelKind, language, selectedOptionalPages, onToggleOptionalPage,
  webinarMode, webinarDate, evergreenVideoUrl,
  bookingMode, calendarEmbedUrl,
  otoOfferName, otoPrice, otoPromise, onOtoOfferChange,
}: {
  templateName: string; templateObjective: string;
  isGenerating: boolean; onGenerate: () => void;
  onCheckHealth: () => Promise<AiHealth>;
  checkingHealth: boolean;
  health: AiHealth | null;
  successMessage: string;
  errorMessage: string;
  errorReason: string;
  funnelKind?: FunnelKind;
  language: Language;
  selectedOptionalPages: PageRole[];
  onToggleOptionalPage: (role: PageRole) => void;
  /** 🆕 Webinaire Live : la date/heure est obligatoire avant de lancer la génération. */
  webinarMode?: "live" | "evergreen";
  webinarDate?: string;
  /** 🆕 Webinaire Evergreen : la vidéo pré-enregistrée est le cœur de l'expérience. */
  evergreenVideoUrl?: string;
  /** 🆕 Prise de RDV : en mode externe, l'URL du calendrier est obligatoire. */
  bookingMode?: "native" | "external";
  calendarEmbedUrl?: string;
  /** 🆕 Offre de la page OTO/tripwire générique (si cochée dans l'aperçu). */
  otoOfferName?: string;
  otoPrice?: string;
  otoPromise?: string;
  onOtoOfferChange?: (patch: Partial<FunnelBrief>) => void;
}) {
  useEffect(() => {
    if (!health && !checkingHealth) onCheckHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🆕 Webinaire Live : sans date réelle, applyWebinarSchedule ne fait RIEN
  // (no-op silencieux) → countdown/copywriting invente une date. En mode
  // Evergreen la date n'a pas de sens (créneaux par prospect) → pas de check.
  const webinarDateMissing =
    funnelKind === "webinar" &&
    webinarMode !== "evergreen" &&
    !(webinarDate && webinarDate.trim());

  // 🆕 Webinaire Evergreen : la vidéo pré-enregistrée EST le webinaire (pas de
  // session Zoom) — sans elle, EvergreenPlayerBlock n'a rien à lire. En mode
  // Live elle reste optionnelle (le live se déroule sur Zoom/Meet).
  const evergreenVideoMissing =
    funnelKind === "webinar" &&
    webinarMode === "evergreen" &&
    !(evergreenVideoUrl && evergreenVideoUrl.trim());

  // 🆕 Mode calendrier EXTERNE sans URL : sans destination de réservation, le
  // garde anti-ancre-morte retire les CTA — le tunnel serait généré sans aucun
  // bouton. On bloque la génération, comme pour la date de webinaire manquante.
  const bookingUrlMissing = bookingExternalUrlMissing({
    funnelKind,
    bookingMode,
    calendarEmbedUrl,
  });

  const blocked =
    health?.reason === "missing-key" ||
    health?.reason === "invalid-key" ||
    health?.reason === "header-error" ||
    webinarDateMissing ||
    evergreenVideoMissing ||
    bookingUrlMissing;

  // ✅ FIX : titre et icône adaptés au type d'erreur
  const isStorageIssue = errorReason === "storage-full" || errorReason === "storage-error";
  // 🆕 429 anti-burst : titre dédié « Trop de requêtes » (au lieu du générique
  // « La génération a échoué »).
  const isRateLimit = errorReason === "rate-limit";
  // 🆕 Gating abonnement : bloc dédié « Aucun forfait actif » + invite à s'abonner.
  const isPaywall = errorReason === "subscription-required" || errorReason === "plan-limit";
  // 🆕 Session Supabase expirée / refresh token invalide → 401 : proposer de se
  // reconnecter (au lieu du message trompeur « vérifiez votre clé OpenAI »).
  const isSessionExpired = errorReason === "session-expired";
  const isValidationIssue = errorReason === "schema-mismatch" || errorReason === "invalid-brief";
  const showTechnicalCode = !!errorReason && !HIDDEN_AI_ERROR_CODES.has(errorReason);

  return (
    <div className="grid gap-4">
      <h2 className="text-xl font-black">Génération</h2>
      <div className="rounded-lg bg-[#08498D]/5 border border-[#08498D]/20 p-4">
        <p className="font-bold text-[#08498D]">{templateName}</p>
        <p className="mt-1 text-xs leading-5 text-muted">{templateObjective}</p>
      </div>

      {funnelKind && (
        <PagesPreviewChecklist
          funnelKind={funnelKind}
          language={language}
          selectedOptionalPages={selectedOptionalPages}
          onToggle={onToggleOptionalPage}
          otoOfferName={otoOfferName}
          otoPrice={otoPrice}
          otoPromise={otoPromise}
          onOtoOfferChange={onOtoOfferChange}
        />
      )}

      {webinarDateMissing && (
        <div className="flex items-start gap-2 rounded-lg border border-red/30 bg-red/5 p-3 text-xs text-red">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">Date du webinaire manquante</p>
            <p className="mt-0.5 leading-relaxed">
              Retourne à l'étape « Format » pour renseigner la date et l'heure du webinaire (obligatoire en mode Live) — sinon le compte à rebours et le copywriting ne seront pas fiables.
            </p>
          </div>
        </div>
      )}

      {bookingUrlMissing && (
        <div className="flex items-start gap-2 rounded-lg border border-red/30 bg-red/5 p-3 text-xs text-red">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">Lien du calendrier externe manquant</p>
            <p className="mt-0.5 leading-relaxed">
              Retourne à l&apos;étape « Format » pour coller le lien de ton calendrier
              (Calendly, Cal.com…) — obligatoire en mode externe. Sans lui, la page
              d&apos;accueil serait générée sans bouton de réservation.
            </p>
          </div>
        </div>
      )}

      {evergreenVideoMissing && (
        <div className="flex items-start gap-2 rounded-lg border border-red/30 bg-red/5 p-3 text-xs text-red">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">Vidéo du webinaire manquante</p>
            <p className="mt-0.5 leading-relaxed">
              Retourne à l'étape « Format » pour renseigner l'URL de la vidéo pré-enregistrée (obligatoire en mode Evergreen — c'est elle que regardera chaque prospect après avoir choisi son créneau).
            </p>
          </div>
        </div>
      )}

      <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${health?.ok ? "border-[#31845C]/50 bg-[#31845C]/10 text-ink" :
          blocked ? "border-red/30 bg-red/5 text-red" :
            "border-line bg-canvas text-muted"
        }`}>
        {health?.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#31845C]" /> :
          <AlertCircle size={14} className="mt-0.5 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            {checkingHealth ? "Vérification de la clé IA..." : health?.ok ? "Clé IA opérationnelle" : "Diagnostic IA"}
          </p>
          <p className="mt-0.5 leading-relaxed">
            {checkingHealth ? "Patientez quelques secondes" : health?.message ?? "Cliquez pour vérifier"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onCheckHealth()}
          disabled={checkingHealth}
          className="ml-2 shrink-0 rounded-md border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-ink transition hover:border-[#08498D]/40 disabled:opacity-50"
        >
          Re-vérifier
        </button>
      </div>

      {isGenerating ? <LoaderIA /> : (
        <Button onClick={onGenerate} type="button" disabled={blocked}>
          <Sparkles size={16} /> {errorMessage ? "Relancer mes agents IA" : "Lancer mes agents IA"}
        </Button>
      )}

      {successMessage && !errorMessage && (
        <p className="rounded-lg bg-[#31845C]/10 p-3 text-xs font-semibold text-[#080E1A]">
          {successMessage}
        </p>
      )}

      {errorMessage && (
        <div className={`rounded-lg border p-3 ${isStorageIssue || isPaywall ? "border-amber-400/40 bg-amber-50" : "border-red/30 bg-red/5"}`}>
          <p className={`flex items-start gap-2 text-xs font-bold ${isStorageIssue || isPaywall ? "text-amber-700" : "text-red"}`}>
            {isStorageIssue ? <Database size={14} className="mt-0.5 shrink-0" /> : isPaywall ? <Sparkles size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
            <span>
              {isStorageIssue
                ? "Stockage du navigateur saturé"
                : isPaywall
                  ? errorReason === "plan-limit"
                    ? "Limite de ton forfait atteinte"
                    : "Aucun forfait actif"
                  : isSessionExpired
                    ? "Session expirée"
                    : isValidationIssue
                      ? errorReason === "invalid-brief"
                        ? "Informations à corriger"
                        : "Contenu généré invalide"
                      : isRateLimit
                        ? "Trop de requêtes"
                        : "La génération a échoué"}
            </span>
          </p>
          <p className={`mt-1 text-xs leading-relaxed ${isStorageIssue || isPaywall ? "text-amber-800" : "text-red/90"}`}>
            {errorMessage}
          </p>
          {isStorageIssue && (
            <p className="mt-2 text-xs leading-relaxed text-amber-800">
              👉 Allez dans <a href="/dashboard" className="underline font-bold">le tableau de bord</a> pour supprimer d'anciens tunnels, puis revenez sur cette page et cliquez sur <strong>Réessayer la génération</strong>.
            </p>
          )}
          {isPaywall && (
            <a
              href="/abonnement"
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-amber-300"
            >
              <Sparkles size={13} /> Voir les forfaits
            </a>
          )}
          {isSessionExpired && (
            <a
              href="/login"
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[#080E1A] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-black"
            >
              Se reconnecter
            </a>
          )}
          {showTechnicalCode && !isPaywall && !isSessionExpired && (
            <p className={`mt-2 text-[10px] uppercase tracking-wider font-bold ${isStorageIssue ? "text-amber-700/80" : "text-red/70"}`}>
              Code: {errorReason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// 🆕 LOT 3 — Aperçu cochable des pages qui seront générées : pages requises
// (verrouillées, toujours incluses) + pages optionnelles (OTO/tripwire, VSL,
// live…) à cocher explicitement avant de lancer la génération.
function PagesPreviewChecklist({
  funnelKind,
  language,
  selectedOptionalPages,
  onToggle,
  otoOfferName,
  otoPrice,
  otoPromise,
  onOtoOfferChange,
}: {
  funnelKind: FunnelKind;
  language: Language;
  selectedOptionalPages: PageRole[];
  onToggle: (role: PageRole) => void;
  /** 🆕 Offre de la page OTO/tripwire générique (si cochée ci-dessous). */
  otoOfferName?: string;
  otoPrice?: string;
  otoPromise?: string;
  onOtoOfferChange?: (patch: Partial<FunnelBrief>) => void;
}) {
  const required = getRequiredPageBlueprints(funnelKind);
  // 🆕 B6 — La page OTO/tripwire suppose une offre payante à greffer. Sur un
  // tunnel dont la conversion est une réservation, elle n'a rien à vendre :
  // la proposer produisait une page de vente sans produit.
  const optional = getOptionalPageBlueprints(funnelKind).filter(
    (bp) => bp.role !== "oto" || showsOtoOption(funnelKind),
  );

  if (required.length === 0 && optional.length === 0) return null;

  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">
        Pages qui seront générées
      </p>
      <div className="mt-2.5 grid gap-1.5">
        {required.map((bp) => (
          <div
            key={bp.role}
            className="flex items-center gap-2 rounded-md bg-canvas px-2.5 py-2 text-sm text-ink"
          >
            <CheckCircle2 size={15} className="shrink-0 text-[#31845C]" />
            <span className="min-w-0 flex-1 truncate">{bp.name}</span>
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted">
              Incluse
            </span>
          </div>
        ))}
        {optional.map((bp) => {
          const checked = selectedOptionalPages.includes(bp.role);
          const label = bp.toggleLabel?.[language] ?? bp.toggleLabel?.fr ?? bp.name;
          return (
            <div key={bp.role}>
              <label
                className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-sm transition ${
                  checked
                    ? "border-[#08498D]/40 bg-[#08498D]/5 text-ink"
                    : "border-line bg-white text-ink hover:border-[#08498D]/30"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(bp.role)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#08498D]"
                />
                <span className="min-w-0 flex-1 leading-snug">{label}</span>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#C7A436]">
                  Optionnelle
                </span>
              </label>

              {/* 🆕 Page OTO/tripwire cochée : demande l'offre au lieu de la
                  laisser inventer par l'IA (nom/prix obligatoires pour que le
                  checkout affiche un montant réel ; promesse optionnelle). */}
              {checked && bp.role === "oto" && onOtoOfferChange && (
                <div className="mt-1.5 ml-6 grid gap-2 rounded-md border border-[#C7A436]/30 bg-[#C7A436]/5 p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px]">
                    <Field label="Offre OTO" hint="Décris CE QUE c'est. Laisse vide et l'IA inventera une offre générique.">
                      <Input
                        value={otoOfferName ?? ""}
                        onChange={(e) => onOtoOfferChange({ otoOfferName: e.target.value })}
                        placeholder="Ex. Pack de templates additionnels"
                      />
                    </Field>
                    <Field label="Prix">
                      <Input
                        value={otoPrice ?? ""}
                        onChange={(e) => onOtoOfferChange({ otoPrice: e.target.value })}
                        placeholder="17€..."
                      />
                    </Field>
                  </div>
                  <Field label="Promesse (optionnel)">
                    <Input
                      value={otoPromise ?? ""}
                      onChange={(e) => onOtoOfferChange({ otoPromise: e.target.value })}
                      placeholder="Le bénéfice n°1 de cette offre complémentaire"
                    />
                  </Field>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
