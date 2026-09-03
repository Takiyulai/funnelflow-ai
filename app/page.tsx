"use client";

import { useState, useRef, useEffect } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  ArrowRight, CheckCircle2, Download, Globe2, Sparkles, Upload,
  Clock, Smartphone, Shield, Mail, Users, Briefcase, Palette,
  MessageCircle, Star, Eye, Layers, Rocket, BarChart3,
  Target, Wand2, FileCode2, Gauge, MousePointerClick, Settings2,
  Send, LineChart, Menu, X, Search, PenTool, Handshake,
} from "lucide-react";
import { ChatWidget } from "@/components/chatbot/ChatWidget";
import { ProductDashboardPreview } from "@/components/marketing/ProductDashboardPreview";


// ── Scroll animation wrapper ──────────────────────────────────────────────────
function FadeInWhenVisible({
  children,
  delay = 0,
  direction = "up",
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  const initialMap = {
    up: { opacity: 0, y: 32 },
    down: { opacity: 0, y: -32 },
    left: { opacity: 0, x: -32 },
    right: { opacity: 0, x: 32 },
    none: { opacity: 0 },
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={initialMap[direction]}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : initialMap[direction]}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// I18N — FR / EN / ES
// ─────────────────────────────────────────────────────────────────────────────
type Lang = "fr" | "en" | "es";

const translations = {
  fr: {
    // Header
    nav: {
      features: "Fonctionnalités",
      templates: "Cas d'usage",
      pricing: "Tarifs",
      faq: "FAQ",
      login: "Se connecter",
    },
    ctaHeader: "Commencer",

    // Hero
    hero: {
      label: "Plus qu'un builder de pages",
      titleStart: "Le copilote IA",
      titleMid: "qui transforme votre offre en",
      titleEnd: "machine de vente",
      desc: "Tunnel, CRM, emails, automatisations, import intelligent, scoring leads et optimisation conversion : une équipe d'agents IA spécialisés construit toute ta machine de vente, à partir d'une simple description de ton offre.",
      ctaPrimary: "Créer mon tunnel",
      ctaSecondary: "Voir comment ça marche",
      proofBar: ["Tunnel premium généré", "CRM + scoring leads intégrés", "Emails & automatisations", "Tout dans l'app, export en bonus"],
      footnote: "Tout vit dans AutoFunnel AI : création, publication, leads, CRM et relances. L'export systeme.io reste un bonus de sortie.",
    },

    // Hero preview card
    preview: {
      badge: "Machine de vente active",
      title: "Ta machine de vente, créée par tes agents IA",
      desc: "Tunnel, CRM, emails et automatisations — prêts à convertir",
      modify: "Éditer",
      publish: "Publier",
      exportHtml: "CRM & leads",
      exportSysteme: "Automatisations",
      productTag: "Tunnel · Machine de vente",
      productName: "Une offre transformée en système de vente complet",
      productDesc: "Design, copy, CRM, emails et relances alignés sur ton offre",
      mainExportBtn: "Voir ma machine en action",
      planTitle: "Ce que tu obtiens",
      planItems: ["Tunnel premium", "Capture & scoring leads", "CRM intégré", "Emails automatiques", "Automatisations", "En ligne"],
      multiPlatformNote: "Export systeme.io disponible en bonus",
    },

    // Problem
    problem: {
      tag: "Le constat",
      title: "Créer un tunnel ne devrait pas vous ralentir.",
      items: [
        { title: "Trop de temps perdu", desc: "Structure, copywriting, mise en page : chaque étape consomme des heures avant d'obtenir une page exploitable." },
        { title: "Mobile fragile", desc: "Le rendu mobile est souvent négligé alors qu'il représente la majorité du trafic." },
        { title: "Offre peu claire", desc: "Une page peut sembler correcte visuellement tout en restant floue sur ce qu'elle vend." },
        { title: "Itérations sans fin", desc: "Trop d'allers-retours avant d'obtenir une version réellement prête à publier." },
      ],
    },

    // Solution
    solution: {
      tag: "La solution",
      title: "AutoFunnel AI transforme votre brief en tunnel prêt à lancer.",
      desc: "Décrivez votre offre, votre audience et votre objectif. AutoFunnel AI génère une structure cohérente, un copywriting plus clair, des sections mieux organisées et un rendu pensé pour publier plus vite.",
      pillars: [
        { title: "Rapidité", desc: "Une première version exploitable en quelques minutes, pas en plusieurs heures." },
        { title: "Clarté de l'offre", desc: "Une structure qui met en avant le bénéfice, la promesse et la preuve." },
        { title: "Copywriting calibré", desc: "Des accroches et CTA orientés conversion, pas des paragraphes décoratifs." },
        { title: "Export propre", desc: "Un code lisible, prêt à coller dans systeme.io ou à intégrer ailleurs." },
        { title: "Rendu mobile soigné", desc: "Une mise en page pensée mobile-first, pas adaptée après coup." },
      ],
    },

    // How it works
    howItWorks: {
      tag: "Fonctionnement",
      title: "Une génération simple, en quatre étapes.",
      steps: [
        { step: "01", title: "Décrivez votre offre", desc: "Produit, audience cible, promesse principale et objectif du tunnel." },
        { step: "02", title: "Choisissez votre angle", desc: "Ton, positionnement et type de tunnel adaptés à votre marché." },
        { step: "03", title: "Laissez l'IA structurer", desc: "Pages, sections, copywriting et séquence email générés en cohérence." },
        { step: "04", title: "Ajustez et publiez", desc: "Modifiez ce qui doit l'être, exportez vers systeme.io ou en HTML." },
      ],
    },

    // 🆕 Équipe IA — met en scène les expertises qui travaillent le tunnel,
    // avec un nom propre à chacune (pas de répétition du mot "agent").
    team: {
      tag: "Derrière le tunnel",
      title: "Une équipe IA, pas un simple générateur.",
      desc: "Chaque tunnel passe entre plusieurs expertises IA, chacune concentrée sur sa mission.",
      members: [
        { name: "L'Analyste", role: "Stratégie", desc: "Étudie votre offre et votre audience, puis choisit la structure de tunnel la plus adaptée à votre marché." },
        { name: "Le Rédacteur", role: "Copywriting", desc: "Rédige accroches, bénéfices et appels à l'action selon les principes du copywriting qui convertit." },
        { name: "Le Designer", role: "Mise en page", desc: "Habille le tunnel dans un rendu mobile-first, sobre et cohérent avec votre marque." },
        { name: "Le Closer", role: "Conversion & suivi", desc: "Branche la capture de leads, le CRM et les relances automatiques : le travail ne s'arrête pas à la page publiée." },
      ],
    },

    // Features
    features: {
      tag: "Fonctionnalités",
      title: "Tout ce qu'il faut pour passer du brief à la mise en ligne.",
      groups: [
        {
          name: "Création",
          items: [
            { title: "Structure orientée conversion", desc: "Hiérarchie, sections et CTA pensés pour guider la décision." },
            { title: "Copywriting clair", desc: "Accroches, bénéfices et objections traités avec un ton sobre." },
            { title: "Rendu mobile soigné", desc: "Mise en page lisible et propre sur tous les écrans." },
          ],
        },
        {
          name: "Publication",
          items: [
            { title: "Export systeme.io", desc: "Blocs prêts à coller dans votre espace systeme.io.", primary: true },
            { title: "Export HTML / CSS", desc: "Code propre, compatible avec la plupart des plateformes." },
            { title: "Multi-plateforme", desc: "Compatible Webflow, WordPress, Carrd et autres outils web." },
          ],
        },
        {
          name: "Évolution",
          items: [
            { title: "Édition libre", desc: "Modifiez les textes, sections et structures à votre rythme." },
            { title: "Régénération ciblée", desc: "Recalculez une section sans reprendre tout le tunnel." },
            { title: "Bibliothèque de cas d'usage", desc: "Modèles adaptés à plusieurs types d'offres et de marchés." },
          ],
        },
      ],
    },

    // Templates / use cases
    templates: {
      tag: "Cas d'usage",
      title: "Pensé pour les offres réelles.",
      desc: "AutoFunnel AI s'adapte aux types d'offres les plus courants chez les indépendants, créateurs et agences.",
      cases: [
        { name: "Lead magnet", desc: "Capturer des emails qualifiés avec une page claire et une promesse précise." },
        { name: "Produit digital", desc: "Vendre un ebook, un template ou une ressource avec une page directe." },
        { name: "Coaching", desc: "Présenter une offre d'accompagnement et qualifier les bons profils." },
        { name: "Service", desc: "Mettre en avant une prestation et obtenir des demandes qualifiées." },
        { name: "Formation", desc: "Vendre une formation avec une structure claire et orientée résultats." },
      ],
    },

    // Testimonials
    testimonials: {
      tag: "Retours utilisateurs",
      title: "Ce que les utilisateurs constatent.",
      items: [
        { quote: "La structure est plus propre dès la première version. Je passe beaucoup moins de temps à remettre en forme.", name: "Camille Roussel", role: "Coach business" },
        { quote: "Une meilleure base de départ que ce que je faisais à la main. Mes pages sont plus claires sur mobile.", name: "Julien Da Costa", role: "Formateur indépendant" },
        { quote: "Ce que j'apprécie, c'est la sobriété du rendu. Rien de criard, juste une page lisible et prête à publier.", name: "Inès Belkacem", role: "Consultante marketing" },
        { quote: "L'export systeme.io fonctionne vraiment. Je colle, j'ajuste deux ou trois détails, c'est en ligne.", name: "Marc Lefèvre", role: "Solopreneur" },
        { quote: "Gain de temps réel sur la structuration. Je sais où placer chaque section sans hésiter.", name: "Sara Moreno", role: "Créatrice de formations" },
        { quote: "On sent que la copy est pensée pour vendre, pas pour remplir. C'est un vrai écart par rapport aux générateurs classiques.", name: "Antoine Garnier", role: "Freelance growth" },
      ],
    },

    // Pricing
    pricing: {
      tag: "Tarifs",
      title: "Trois plans, une logique claire.",
      desc: "Un tunnel conçu par un pro coûte des centaines à des milliers d'euros. Ici tu en génères autant que ton plan le permet",
      popular: "Recommandé",
      guarantee: "Paiement sécurisé · Sans engagement · Annulation à tout moment",
      plans: [
        {
          name: "Starter",
          price: "29€",
          period: "/mois",
          desc: "Pour lancer tes premiers tunnels et capturer tes leads",
          features: [
            "5 tunnels générés par mois",
            "Éditeur visuel et régénération par section",
            "Publication en ligne en un clic",
            "Capture des leads et CRM intégré",
            "Export systeme.io et HTML",
          ],
          cta: "Choisir Starter",
        },
        {
          name: "Pro",
          price: "59€",
          period: "/mois",
          desc: "Pour automatiser tes relances et passer à l'échelle",
          features: [
            "15 tunnels générés par mois",
            "Éditeur visuel et régénération par section",
            "Publication en ligne en un clic",
            "Capture des leads et CRM intégré",
            "Workflows et séquences email automatiques",
            "Email de livraison automatique",
            "Clonage et import de tunnels",
            "Export systeme.io et HTML",
            "Support prioritaire",
          ],
          cta: "Choisir Pro",
        },
        {
          name: "Agency",
          price: "97€",
          period: "/mois",
          desc: "Pour gérer plusieurs clients et industrialiser ta production",
          features: [
            "Tunnels illimités",
            "Éditeur visuel et régénération par section",
            "Publication en ligne en un clic",
            "Capture des leads et CRM intégré",
            "Workflows et séquences email automatiques",
            "Email de livraison automatique",
            "Clonage et import de tunnels",
            "Espaces clients séparés (bientôt disponible)",
            "Branding personnalisable",
            "Export systeme.io et HTML",
            "Support dédié",
          ],
          cta: "Choisir Agency",
        },
      ],
    },

    // FAQ
    faq: {
      tag: "FAQ",
      title: "Les réponses aux questions les plus fréquentes.",
      cta: "Créer mon compte",
      items: [
        { q: "Pourquoi utiliser AutoFunnel AI si je travaille déjà avec systeme.io ?", a: "AutoFunnel AI complète systeme.io en générant la structure, le copywriting et la mise en page de votre tunnel. Vous récupérez une base déjà cohérente, prête à coller dans votre espace, plutôt que de tout construire bloc par bloc." },
        { q: "AutoFunnel AI génère-t-il uniquement du texte ou un vrai tunnel ?", a: "Vous obtenez un tunnel structuré : pages, sections, copywriting, séquence email et plan global. Le texte n'est qu'une partie du résultat ; la logique d'ensemble est pensée pour convertir." },
        { q: "Puis-je modifier le résultat avant publication ?", a: "Oui. Tous les contenus sont éditables. Vous pouvez ajuster les textes, modifier les sections, régénérer une partie spécifique ou exporter le tunnel pour le retravailler dans votre outil." },
        { q: "Le rendu est-il pensé pour mobile ?", a: "Oui. Les tunnels sont structurés en mobile-first afin de rester lisibles et propres sur petit écran, qui représente aujourd'hui la majorité du trafic." },
        { q: "Puis-je utiliser AutoFunnel AI si je ne publie pas uniquement sur systeme.io ?", a: "Oui. systeme.io est notre plateforme prioritaire, mais l'export HTML / CSS est compatible avec la plupart des outils du marché : Webflow, WordPress, Carrd et autres." },
        { q: "La page existe-t-elle en français, anglais et espagnol ?", a: "L'interface est disponible en français, anglais et espagnol. Vous pouvez générer vos tunnels dans la langue qui correspond à votre marché." },
        { q: "À qui s'adresse le plan Agency ?", a: "Aux freelances avancés et aux agences qui produisent des tunnels en volume pour plusieurs clients : tunnels et générations IA illimités, brief client structuré et options multi-plateforme étendues. Les espaces clients séparés arrivent bientôt." },
        { q: "Combien de temps faut-il pour obtenir une première version exploitable ?", a: "En général, quelques minutes entre la saisie du brief et l'obtention d'une première version structurée. Le temps restant dépend des ajustements que vous souhaitez apporter avant publication." },
      ],
    },

    // Final CTA
    finalCta: {
      title: "Passez du brief à la page publiée.",
      desc: "Une approche directe, sobre et orientée résultats pour créer vos tunnels sans y consacrer vos journées.",
      primary: "Créer mon premier tunnel",
      secondary: "Voir comment ça fonctionne",
      points: ["Mise en route rapide", "Sans engagement", "Pensé d'abord pour systeme.io"],
    },

    // Footer
    footer: { cgv: "CGV", privacy: "Confidentialité" },
  },

  en: {
    nav: {
      features: "Features",
      templates: "Use cases",
      pricing: "Pricing",
      faq: "FAQ",
      login: "Sign in",
    },
    ctaHeader: "Get started",

    hero: {
      label: "More than a page builder",
      titleStart: "The AI copilot",
      titleMid: "that turns your offer into a",
      titleEnd: "sales machine",
      desc: "Funnel, CRM, emails, automations, smart import, lead scoring and conversion optimization: a team of specialized AI agents builds your entire sales machine from a simple description of your offer.",
      ctaPrimary: "Build my funnel",
      ctaSecondary: "See how it works",
      proofBar: ["Premium funnel generated", "Built-in CRM + lead scoring", "Emails & automations", "All in-app, export as a bonus"],
      footnote: "Everything lives inside AutoFunnel AI: creation, publishing, leads, CRM and follow-ups. The systeme.io export stays a bonus.",
    },

    preview: {
      badge: "Sales machine active",
      title: "Your sales machine, built by your AI agents",
      desc: "Funnel, CRM, emails and automations — ready to convert.",
      modify: "Edit",
      publish: "Publish",
      exportHtml: "CRM & leads",
      exportSysteme: "Automations",
      productTag: "Funnel · Sales machine",
      productName: "An offer turned into a complete sales system",
      productDesc: "Design, copy, CRM, emails and follow-ups aligned with your offer.",
      mainExportBtn: "See my machine in action",
      planTitle: "What you get",
      planItems: ["Premium funnel", "Lead capture & scoring", "Built-in CRM", "Automated emails", "Automations", "Live"],
      multiPlatformNote: "systeme.io export available as a bonus",
    },

    problem: {
      tag: "The reality",
      title: "Building a funnel shouldn't slow you down.",
      items: [
        { title: "Too much time spent", desc: "Structure, copywriting, layout — every step burns hours before you get a usable page." },
        { title: "Fragile mobile rendering", desc: "Mobile is often left as an afterthought, even though it now drives most of the traffic." },
        { title: "Unclear offer", desc: "A page can look fine visually while remaining vague about what it actually sells." },
        { title: "Endless iterations", desc: "Too many back-and-forths before reaching a version that's actually ready to publish." },
      ],
    },

    solution: {
      tag: "The solution",
      title: "AutoFunnel AI turns your brief into a launch-ready funnel.",
      desc: "Describe your offer, your audience and your goal. AutoFunnel AI generates a coherent structure, clearer copy, well-organized sections and a layout designed to ship faster.",
      pillars: [
        { title: "Speed", desc: "A usable first version in minutes, not hours." },
        { title: "Clear offer", desc: "A structure that highlights the benefit, the promise and the proof." },
        { title: "Calibrated copy", desc: "Hooks and CTAs written to convert, not to fill the page." },
        { title: "Clean export", desc: "Readable code, ready to paste into systeme.io or to integrate elsewhere." },
        { title: "Polished mobile", desc: "A layout designed mobile-first, not patched afterwards." },
      ],
    },

    howItWorks: {
      tag: "How it works",
      title: "Simple generation, in four steps.",
      steps: [
        { step: "01", title: "Describe your offer", desc: "Product, target audience, main promise and funnel goal." },
        { step: "02", title: "Choose your angle", desc: "Tone, positioning and funnel type that fit your market." },
        { step: "03", title: "Let the AI structure", desc: "Pages, sections, copy and email sequence generated coherently." },
        { step: "04", title: "Adjust and publish", desc: "Edit what needs to be edited, export to systeme.io or as HTML." },
      ],
    },

    team: {
      tag: "Behind the funnel",
      title: "A team of AI specialists, not just a generator.",
      desc: "Every funnel passes through several AI specialists, each focused on a single mission.",
      members: [
        { name: "The Analyst", role: "Strategy", desc: "Studies your offer and audience, then picks the funnel structure best suited to your market." },
        { name: "The Writer", role: "Copywriting", desc: "Writes hooks, benefits and CTAs based on copy that's built to convert, not to fill space." },
        { name: "The Designer", role: "Layout", desc: "Dresses the funnel in a mobile-first, clean layout aligned with your brand." },
        { name: "The Closer", role: "Conversion & follow-up", desc: "Wires up lead capture, CRM and automated follow-ups: the work doesn't stop at the published page." },
      ],
    },

    features: {
      tag: "Features",
      title: "Everything you need to go from brief to live page.",
      groups: [
        {
          name: "Creation",
          items: [
            { title: "Conversion-oriented structure", desc: "Hierarchy, sections and CTAs designed to guide the decision." },
            { title: "Clear copywriting", desc: "Hooks, benefits and objections handled with a sober tone." },
            { title: "Polished mobile rendering", desc: "Readable, clean layout across all screen sizes." },
          ],
        },
        {
          name: "Publishing",
          items: [
            { title: "systeme.io export", desc: "Blocks ready to paste into your systeme.io workspace.", primary: true },
            { title: "HTML / CSS export", desc: "Clean code, compatible with most platforms." },
            { title: "Multi-platform", desc: "Works with Webflow, WordPress, Carrd and other web tools." },
          ],
        },
        {
          name: "Evolution",
          items: [
            { title: "Free editing", desc: "Modify text, sections and structure at your own pace." },
            { title: "Targeted regeneration", desc: "Re-run a single section without rebuilding the whole funnel." },
            { title: "Use case library", desc: "Templates adapted to a wide range of offers and markets." },
          ],
        },
      ],
    },

    templates: {
      tag: "Use cases",
      title: "Built for real offers.",
      desc: "AutoFunnel AI adapts to the most common offer types for solopreneurs, creators and agencies.",
      cases: [
        { name: "Lead magnet", desc: "Capture qualified emails with a clear page and a precise promise." },
        { name: "Digital product", desc: "Sell an ebook, a template or a resource with a direct sales page." },
        { name: "Coaching", desc: "Present a coaching offer and qualify the right profiles." },
        { name: "Service", desc: "Highlight a service and generate qualified inquiries." },
        { name: "Course", desc: "Sell a course with a clear, results-oriented structure." },
      ],
    },

    testimonials: {
      tag: "User feedback",
      title: "What users actually report.",
      items: [
        { quote: "The structure is cleaner from the first version. I spend much less time reformatting things.", name: "Camille Roussel", role: "Business coach" },
        { quote: "A better starting point than what I used to do by hand. My pages are clearer on mobile.", name: "Julien Da Costa", role: "Independent trainer" },
        { quote: "What I appreciate is how sober the output feels. Nothing flashy — just a readable, publishable page.", name: "Inès Belkacem", role: "Marketing consultant" },
        { quote: "The systeme.io export actually works. I paste it in, adjust a few details, and it's live.", name: "Marc Lefèvre", role: "Solopreneur" },
        { quote: "Real time saved on structuring. I know where to place each section without hesitation.", name: "Sara Moreno", role: "Course creator" },
        { quote: "You can feel the copy is built to sell, not to fill space. A real gap with classic generators.", name: "Antoine Garnier", role: "Growth freelancer" },
      ],
    },

    pricing: {
      tag: "Pricing",
      title: "Three plans, one clear logic.",
      desc: "No free plan. A direct offer, aligned with your level of usage.",
      popular: "Recommended",
      guarantee: "Secure payment · No commitment · Cancel anytime",
      plans: [
        {
          name: "Starter",
          price: "$29",
          period: "/mo",
          desc: "To launch your first funnels on systeme.io.",
          features: [
            "Up to 5 funnels per month",
            "systeme.io export",
            "HTML / CSS export",
            "Core templates",
            "Email support",
          ],
          cta: "Choose Starter",
        },
        {
          name: "Pro",
          price: "$59",
          period: "/mo",
          desc: "To build faster and go further.",
          features: [
            "Up to 15 funnels per month",
            "Priority systeme.io export",
            "Multi-platform compatibility",
            "Targeted section regeneration",
            "Full use case library",
            "Priority support",
          ],
          cta: "Choose Pro",
        },
        {
          name: "Agency",
          price: "$97",
          period: "/mo",
          desc: "To handle multiple clients and scale production.",
          features: [
            "Unlimited funnels",
            "systeme.io and multi-platform export",
            "Separate client workspaces (coming soon)",
            "Structured client brief",
            "Custom branding",
            "Dedicated support",
          ],
          cta: "Choose Agency",
        },
      ],
    },

    faq: {
      tag: "FAQ",
      title: "Answers to the most common questions.",
      cta: "Create my account",
      items: [
        { q: "Why use AutoFunnel AI if I already work with systeme.io?", a: "AutoFunnel AI complements systeme.io by generating the structure, copy and layout of your funnel. You get a coherent base, ready to paste into your workspace, instead of building everything block by block." },
        { q: "Does AutoFunnel AI generate just text, or a real funnel?", a: "You get a structured funnel: pages, sections, copy, email sequence and overall plan. The text is only one part — the broader logic is designed to convert." },
        { q: "Can I modify the result before publishing?", a: "Yes. Everything is editable. You can adjust text, change sections, regenerate a specific part or export the funnel to refine it in your own tool." },
        { q: "Is the rendering mobile-friendly?", a: "Yes. Funnels are structured mobile-first to remain clean and readable on small screens, which now drive most of the traffic." },
        { q: "Can I use AutoFunnel AI if I don't publish only on systeme.io?", a: "Yes. systeme.io is our priority platform, but the HTML / CSS export is compatible with most tools on the market: Webflow, WordPress, Carrd and others." },
        { q: "Is the page available in French, English and Spanish?", a: "The interface is available in French, English and Spanish. You can also generate funnels in the language that fits your market." },
        { q: "Who is the Agency plan for?", a: "For advanced freelancers and agencies producing funnels at scale for multiple clients: unlimited funnels and AI generations, a structured client brief and extended multi-platform options. Separate client workspaces are coming soon." },
        { q: "How long does it take to get a usable first version?", a: "Usually a few minutes between submitting your brief and getting a structured first draft. The remaining time depends on the adjustments you want to make before publishing." },
      ],
    },

    finalCta: {
      title: "From brief to a published page.",
      desc: "A direct, sober and results-oriented approach to building funnels without burning your days on them.",
      primary: "Create my first funnel",
      secondary: "See how it works",
      points: ["Quick setup", "No commitment", "Built first for systeme.io"],
    },

    footer: { cgv: "Terms", privacy: "Privacy" },
  },

  es: {
    nav: {
      features: "Funcionalidades",
      templates: "Casos de uso",
      pricing: "Precios",
      faq: "FAQ",
      login: "Iniciar sesión",
    },
    ctaHeader: "Empezar",

    hero: {
      label: "Más que un creador de páginas",
      titleStart: "El copiloto IA",
      titleMid: "que convierte tu oferta en una",
      titleEnd: "máquina de ventas",
      desc: "Embudo, CRM, emails, automatizaciones, importación inteligente, scoring de leads y optimización de conversión: un equipo de agentes IA especializados construye toda tu máquina de ventas a partir de una simple descripción de tu oferta.",
      ctaPrimary: "Crear mi embudo",
      ctaSecondary: "Ver cómo funciona",
      proofBar: ["Embudo premium generado", "CRM + scoring de leads", "Emails y automatizaciones", "Todo en la app, exportar es un extra"],
      footnote: "Todo vive dentro de AutoFunnel AI: creación, publicación, leads, CRM y seguimientos. La exportación a systeme.io es un extra.",
    },

    preview: {
      badge: "Máquina de ventas activa",
      title: "Tu máquina de ventas, creada por tus agentes IA",
      desc: "Embudo, CRM, emails y automatizaciones — listos para convertir.",
      modify: "Editar",
      publish: "Publicar",
      exportHtml: "CRM y leads",
      exportSysteme: "Automatizaciones",
      productTag: "Embudo · Máquina de ventas",
      productName: "Una oferta convertida en un sistema de ventas completo",
      productDesc: "Diseño, copy, CRM, emails y seguimientos alineados con tu oferta.",
      mainExportBtn: "Ver mi máquina en acción",
      planTitle: "Lo que obtienes",
      planItems: ["Embudo premium", "Captura y scoring de leads", "CRM integrado", "Emails automáticos", "Automatizaciones", "Online"],
      multiPlatformNote: "Exportación a systeme.io como extra",
    },

    problem: {
      tag: "El contexto",
      title: "Crear un embudo no debería frenarte.",
      items: [
        { title: "Demasiado tiempo perdido", desc: "Estructura, copy y maquetación: cada etapa consume horas antes de tener una página utilizable." },
        { title: "Móvil frágil", desc: "El renderizado móvil suele descuidarse, aunque concentra la mayor parte del tráfico." },
        { title: "Oferta poco clara", desc: "Una página puede verse correcta y, aun así, no dejar claro qué se vende." },
        { title: "Iteraciones interminables", desc: "Demasiadas idas y vueltas antes de tener una versión realmente lista para publicar." },
      ],
    },

    solution: {
      tag: "La solución",
      title: "AutoFunnel AI convierte tu brief en un embudo listo para lanzar.",
      desc: "Describe tu oferta, tu audiencia y tu objetivo. AutoFunnel AI genera una estructura coherente, un copy más claro, secciones mejor organizadas y un acabado pensado para publicar más rápido.",
      pillars: [
        { title: "Rapidez", desc: "Una primera versión utilizable en minutos, no en horas." },
        { title: "Oferta clara", desc: "Una estructura que destaca el beneficio, la promesa y la prueba." },
        { title: "Copy calibrado", desc: "Ganchos y CTAs escritos para convertir, no para rellenar." },
        { title: "Exportación limpia", desc: "Código legible, listo para pegar en systeme.io o integrar en otro lugar." },
        { title: "Móvil cuidado", desc: "Una maquetación pensada mobile-first, no adaptada a posteriori." },
      ],
    },

    howItWorks: {
      tag: "Cómo funciona",
      title: "Una generación sencilla, en cuatro pasos.",
      steps: [
        { step: "01", title: "Describe tu oferta", desc: "Producto, audiencia objetivo, promesa principal y objetivo del embudo." },
        { step: "02", title: "Elige tu ángulo", desc: "Tono, posicionamiento y tipo de embudo adaptados a tu mercado." },
        { step: "03", title: "Deja que la IA estructure", desc: "Páginas, secciones, copy y secuencia de emails generados con coherencia." },
        { step: "04", title: "Ajusta y publica", desc: "Modifica lo necesario y exporta a systeme.io o en HTML." },
      ],
    },

    team: {
      tag: "Detrás del embudo",
      title: "Un equipo de IA, no un simple generador.",
      desc: "Cada embudo pasa por varias especialidades de IA, cada una centrada en su misión.",
      members: [
        { name: "El Analista", role: "Estrategia", desc: "Estudia tu oferta y tu audiencia, y elige la estructura de embudo más adecuada para tu mercado." },
        { name: "El Redactor", role: "Copywriting", desc: "Redacta ganchos, beneficios y CTAs siguiendo los principios del copy que convierte." },
        { name: "El Diseñador", role: "Maquetación", desc: "Viste el embudo con un acabado mobile-first, sobrio y coherente con tu marca." },
        { name: "El Closer", role: "Conversión y seguimiento", desc: "Conecta la captura de leads, el CRM y los seguimientos automáticos: el trabajo no termina en la página publicada." },
      ],
    },

    features: {
      tag: "Funcionalidades",
      title: "Todo lo necesario para pasar del brief a la página publicada.",
      groups: [
        {
          name: "Creación",
          items: [
            { title: "Estructura orientada a conversión", desc: "Jerarquía, secciones y CTAs pensados para guiar la decisión." },
            { title: "Copy claro", desc: "Ganchos, beneficios y objeciones tratados con un tono sobrio." },
            { title: "Renderizado móvil cuidado", desc: "Maquetación legible y limpia en cualquier pantalla." },
          ],
        },
        {
          name: "Publicación",
          items: [
            { title: "Exportación a systeme.io", desc: "Bloques listos para pegar en tu espacio de systeme.io.", primary: true },
            { title: "Exportación HTML / CSS", desc: "Código limpio, compatible con la mayoría de plataformas." },
            { title: "Multiplataforma", desc: "Compatible con Webflow, WordPress, Carrd y otras herramientas web." },
          ],
        },
        {
          name: "Evolución",
          items: [
            { title: "Edición libre", desc: "Modifica textos, secciones y estructura a tu ritmo." },
            { title: "Regeneración dirigida", desc: "Recalcula una sección sin rehacer todo el embudo." },
            { title: "Biblioteca de casos de uso", desc: "Modelos adaptados a varios tipos de ofertas y mercados." },
          ],
        },
      ],
    },

    templates: {
      tag: "Casos de uso",
      title: "Pensado para ofertas reales.",
      desc: "AutoFunnel AI se adapta a los tipos de oferta más habituales entre profesionales, creadores y agencias.",
      cases: [
        { name: "Lead magnet", desc: "Capta emails cualificados con una página clara y una promesa precisa." },
        { name: "Producto digital", desc: "Vende un ebook, una plantilla o un recurso con una página directa." },
        { name: "Coaching", desc: "Presenta una oferta de acompañamiento y cualifica los perfiles adecuados." },
        { name: "Servicio", desc: "Destaca una prestación y genera solicitudes cualificadas." },
        { name: "Formación", desc: "Vende una formación con una estructura clara y orientada a resultados." },
      ],
    },

    testimonials: {
      tag: "Opiniones de usuarios",
      title: "Lo que reportan los usuarios.",
      items: [
        { quote: "La estructura es más limpia desde la primera versión. Pierdo mucho menos tiempo reformateando.", name: "Camille Roussel", role: "Coach de negocio" },
        { quote: "Un mejor punto de partida que lo que hacía a mano. Mis páginas se ven más claras en móvil.", name: "Julien Da Costa", role: "Formador independiente" },
        { quote: "Lo que me gusta es la sobriedad del resultado. Nada estridente, una página legible y lista para publicar.", name: "Inès Belkacem", role: "Consultora de marketing" },
        { quote: "La exportación a systeme.io funciona de verdad. Pego, ajusto un par de detalles y queda online.", name: "Marc Lefèvre", role: "Solopreneur" },
        { quote: "Ahorro real al estructurar. Sé dónde colocar cada sección sin dudar.", name: "Sara Moreno", role: "Creadora de formaciones" },
        { quote: "Se nota que el copy está pensado para vender, no para rellenar. Marca distancia con los generadores clásicos.", name: "Antoine Garnier", role: "Freelance growth" },
      ],
    },

    pricing: {
      tag: "Precios",
      title: "Tres planes, una lógica clara.",
      desc: "Sin plan gratuito. Una oferta directa, alineada con tu nivel de uso.",
      popular: "Recomendado",
      guarantee: "Pago seguro · Sin compromiso · Cancela cuando quieras",
      plans: [
        {
          name: "Starter",
          price: "29€",
          period: "/mes",
          desc: "Para lanzar tus primeros embudos en systeme.io.",
          features: [
            "Hasta 3 embudos al mes",
            "Exportación a systeme.io",
            "Exportación HTML / CSS",
            "Modelos básicos",
            "Soporte por email",
          ],
          cta: "Elegir Starter",
        },
        {
          name: "Pro",
          price: "59€",
          period: "/mes",
          desc: "Para crear más rápido e ir más lejos.",
          features: [
            "Hasta 15 embudos al mes",
            "Exportación prioritaria a systeme.io",
            "Compatibilidad multiplataforma",
            "Regeneración dirigida por sección",
            "Biblioteca completa de casos de uso",
            "Soporte prioritario",
          ],
          cta: "Elegir Pro",
        },
        {
          name: "Agency",
          price: "97€",
          period: "/mes",
          desc: "Para gestionar varios clientes e industrializar la producción.",
          features: [
            "Embudos ilimitados",
            "Exportación a systeme.io y multiplataforma",
            "Espacios de cliente separados (próximamente)",
            "Brief de cliente estructurado",
            "Branding personalizable",
            "Soporte dedicado",
          ],
          cta: "Elegir Agency",
        },
      ],
    },

    faq: {
      tag: "FAQ",
      title: "Respuestas a las preguntas más frecuentes.",
      cta: "Crear mi cuenta",
      items: [
        { q: "¿Por qué usar AutoFunnel AI si ya trabajo con systeme.io?", a: "AutoFunnel AI complementa systeme.io generando la estructura, el copy y la maquetación de tu embudo. Recibes una base coherente, lista para pegar en tu espacio, en lugar de construir todo bloque a bloque." },
        { q: "¿AutoFunnel AI genera solo texto o un embudo real?", a: "Obtienes un embudo estructurado: páginas, secciones, copy, secuencia de emails y plan general. El texto es solo una parte; la lógica global está pensada para convertir." },
        { q: "¿Puedo modificar el resultado antes de publicar?", a: "Sí. Todo es editable. Puedes ajustar textos, modificar secciones, regenerar una parte concreta o exportar el embudo para retrabajarlo en tu herramienta." },
        { q: "¿El renderizado está pensado para móvil?", a: "Sí. Los embudos están estructurados en mobile-first para mantenerse legibles y limpios en pantallas pequeñas, donde hoy se concentra la mayor parte del tráfico." },
        { q: "¿Puedo usar AutoFunnel AI si no publico solo en systeme.io?", a: "Sí. systeme.io es nuestra plataforma prioritaria, pero la exportación HTML / CSS es compatible con la mayoría de herramientas: Webflow, WordPress, Carrd y otras." },
        { q: "¿La página está disponible en francés, inglés y español?", a: "La interfaz está disponible en francés, inglés y español. También puedes generar tus embudos en el idioma que mejor encaje con tu mercado." },
        { q: "¿A quién va dirigido el plan Agency?", a: "A freelancers avanzados y agencias que producen embudos a gran escala para varios clientes: embudos y generaciones IA ilimitados, un brief estructurado y opciones multiplataforma ampliadas. Los espacios de cliente separados llegarán próximamente." },
        { q: "¿Cuánto se tarda en obtener una primera versión utilizable?", a: "Por lo general, unos minutos entre rellenar el brief y obtener una primera versión estructurada. El tiempo restante depende de los ajustes que quieras hacer antes de publicar." },
      ],
    },

    finalCta: {
      title: "Del brief a la página publicada.",
      desc: "Un enfoque directo, sobrio y orientado a resultados para crear tus embudos sin dedicarles los días enteros.",
      primary: "Crear mi primer embudo",
      secondary: "Ver cómo funciona",
      points: ["Puesta en marcha rápida", "Sin compromiso", "Pensado primero para systeme.io"],
    },

    footer: { cgv: "Términos", privacy: "Privacidad" },
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Icon mappings
// ─────────────────────────────────────────────────────────────────────────────
const PROBLEM_ICONS = [Clock, Smartphone, Target, Settings2];
const PILLAR_ICONS = [Gauge, Target, MousePointerClick, FileCode2, Smartphone];
const STEP_ICONS = [Wand2, Palette, Sparkles, Send];
const TEAM_ICONS = [Search, PenTool, Palette, Handshake];
const FEATURE_GROUP_ICONS = [Wand2, Send, LineChart];
const TEMPLATE_ICONS = [Mail, Download, Users, Briefcase, Layers];
const ACCENT = ["#08498D", "#31845C", "#C7A436"];
const PRICING_POPULAR = [false, true, false];
const PRICING_COLORS = ["#08498D", "#31845C", "#C7A436"];

// ─────────────────────────────────────────────────────────────────────────────
// Small UI atoms
// ─────────────────────────────────────────────────────────────────────────────
// 🆕 Compteur animé (count-up) déclenché à l'entrée en vue.
function CountUp({ to, duration = 1500, suffix = "" }: { to: number; duration?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (to <= 0) { setN(0); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setN(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);
  return <span ref={ref}>{n.toLocaleString("fr-FR")}{suffix}</span>;
}

// 🆕 Bande de PREUVE SOCIALE : compteurs réels (tunnels générés, leads
// capturés) + faits produit différenciants (< 5 min, 0 outil externe).
function StatsBand({ lang }: { lang: "fr" | "en" | "es" }) {
  const [stats, setStats] = useState<{ funnels: number; leads: number } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/stats/public")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setStats({ funnels: d.funnels ?? 0, leads: d.leads ?? 0 });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const L = {
    fr: { funnels: "Tunnels générés", leads: "Leads capturés", fast: "Pour un tunnel complet", ext: "Outil externe requis" },
    en: { funnels: "Funnels generated", leads: "Leads captured", fast: "For a full funnel", ext: "External tool needed" },
    es: { funnels: "Embudos generados", leads: "Leads capturados", fast: "Para un embudo completo", ext: "Herramienta externa" },
  }[lang];
  const items: { icon: React.ReactNode; node: React.ReactNode; label: string; c1: string; c2: string }[] = [
    { icon: <Rocket size={20} style={{ color: "#fff" }} />, node: <><CountUp to={stats?.funnels ?? 0} />{stats && stats.funnels > 0 ? "+" : ""}</>, label: L.funnels, c1: "#1E6644", c2: "#22C55E" },
    { icon: <Users size={20} style={{ color: "#fff" }} />, node: <><CountUp to={stats?.leads ?? 0} />{stats && stats.leads > 0 ? "+" : ""}</>, label: L.leads, c1: "#08498D", c2: "#3B82F6" },
    { icon: <Gauge size={20} style={{ color: "#fff" }} />, node: <>&lt; 5 min</>, label: L.fast, c1: "#A9821E", c2: "#E3C563" },
    { icon: <Shield size={20} style={{ color: "#fff" }} />, node: <>0</>, label: L.ext, c1: "#1E6644", c2: "#22C55E" },
  ];
  return (
    <section style={{ position: "relative", overflow: "hidden", background: "#080E1A", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Halo animé pour donner de la vie à la bande */}
      <motion.div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(600px 240px at 50% 0%, rgba(49,132,92,0.16), transparent 70%)" }}
        animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12 relative">
        <div className="stats-grid grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.map((it, i) => (
            <motion.div key={i} className="rounded-2xl px-4 py-6 text-center"
              style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.09)", boxShadow: `0 20px 50px -30px ${it.c2}` }}
              whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
              <div className="mx-auto mb-3.5 flex items-center justify-center rounded-2xl" style={{ width: 46, height: 46, background: `linear-gradient(135deg, ${it.c1}, ${it.c2})`, boxShadow: `0 8px 22px -6px ${it.c2}` }}>{it.icon}</div>
              <div className="ff-title" style={{ fontSize: "clamp(2rem,5.5vw,3.1rem)", fontWeight: 800, lineHeight: 1, backgroundImage: `linear-gradient(135deg, ${it.c2}, #ffffff)`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{it.node}</div>
              <div className="ff-body mt-2.5" style={{ fontSize: 13, color: "rgba(255,255,255,0.62)" }}>{it.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// 🆕 Comparatif « AutoFunnel AI vs générateurs de pages seuls » — argument
// massue : ce qu'ils N'ONT PAS (CRM, emails, automatisations, publication).
function ComparisonTable({ lang }: { lang: "fr" | "en" | "es" }) {
  const L = {
    fr: {
      title: "AutoFunnel AI vs générateurs de pages seuls",
      us: "AutoFunnel AI", them: "Générateurs de pages",
      rows: [
        { f: "Génération IA du tunnel", them: true },
        { f: "Copywriting orienté conversion", them: true },
        { f: "Rendu mobile-first + export propre", them: true },
        { f: "Édition & publication dans l'app", them: false },
        { f: "Capture de leads + CRM + scoring", them: false },
        { f: "Séquences email & automatisations", them: false },
        { f: "Export systeme.io / HTML", them: true },
      ],
    },
    en: {
      title: "AutoFunnel AI vs page-only generators",
      us: "AutoFunnel AI", them: "Page generators",
      rows: [
        { f: "AI funnel generation", them: true },
        { f: "Conversion-focused copywriting", them: true },
        { f: "Mobile-first render + clean export", them: true },
        { f: "Edit & publish inside the app", them: false },
        { f: "Lead capture + CRM + scoring", them: false },
        { f: "Email sequences & automations", them: false },
        { f: "systeme.io / HTML export", them: true },
      ],
    },
    es: {
      title: "AutoFunnel AI vs generadores de páginas",
      us: "AutoFunnel AI", them: "Generadores de páginas",
      rows: [
        { f: "Generación IA del embudo", them: true },
        { f: "Copywriting orientado a conversión", them: true },
        { f: "Render mobile-first + export limpio", them: true },
        { f: "Editar y publicar en la app", them: false },
        { f: "Captura de leads + CRM + scoring", them: false },
        { f: "Secuencias de email y automatizaciones", them: false },
        { f: "Exportar a systeme.io / HTML", them: true },
      ],
    },
  }[lang];
  return (
    <div className="mx-auto mt-14 max-w-3xl rounded-2xl overflow-hidden" style={{ background: "#0C1524", border: "1px solid rgba(255,255,255,0.08)" }}>
      <h3 className="ff-title text-center px-5 pt-6 pb-4" style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{L.title}</h3>
      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr 1fr" }}>
        <div className="px-4 py-2.5 ff-body" style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }} />
        <div className="px-3 py-2.5 text-center ff-title" style={{ fontSize: 13, fontWeight: 700, color: "#31845C", background: "rgba(49,132,92,0.08)" }}>{L.us}</div>
        <div className="px-3 py-2.5 text-center ff-body" style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.45)" }}>{L.them}</div>
        {L.rows.map((row, i) => (
          <div key={i} className="contents">
            <div className="px-4 py-3 ff-body" style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>{row.f}</div>
            <div className="px-3 py-3 flex items-center justify-center" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(49,132,92,0.05)" }}>
              <CheckCircle2 size={17} style={{ color: "#31845C" }} />
            </div>
            <div className="px-3 py-3 flex items-center justify-center" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {row.them ? <CheckCircle2 size={16} style={{ color: "rgba(255,255,255,0.3)" }} /> : <X size={16} style={{ color: "rgba(239,68,68,0.75)" }} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 🆕 Photos réelles pour les témoignages (portraits libres randomuser.me),
// mappées par index (les noms sont identiques dans les 3 langues).
const TESTIMONIAL_AVATARS = [
  "https://randomuser.me/api/portraits/women/68.jpg", // Camille
  "https://randomuser.me/api/portraits/men/32.jpg",   // Julien
  "https://randomuser.me/api/portraits/women/44.jpg", // Inès
  "https://randomuser.me/api/portraits/men/46.jpg",   // Marc
  "https://randomuser.me/api/portraits/women/65.jpg", // Sara
  "https://randomuser.me/api/portraits/men/75.jpg",   // Antoine
];

// 🆕 Carrousel de témoignages « hors du commun » : marquee INFINI (défilement
// continu), pause au survol, cartes qui se soulèvent, dégradés de bord, photos
// réelles. La liste est dupliquée pour une boucle sans couture (-50%).
function TestimonialsCarousel({ items }: { items: readonly { quote: string; name: string; role: string }[] }) {
  const loop = [...items, ...items];
  return (
    <div className="testi-marquee">
      <div className="testi-marquee__track">
        {loop.map((tItem, i) => (
          <article key={i} className="testi-card">
            <div className="testi-card__stars">
              {[...Array(5)].map((_, k) => <Star key={k} size={13} fill="#C7A436" style={{ color: "#C7A436" }} />)}
            </div>
            <p className="testi-card__quote">“{tItem.quote}”</p>
            <div className="testi-card__author">
              <img
                src={TESTIMONIAL_AVATARS[i % items.length]}
                alt={tItem.name}
                className="testi-card__avatar"
                loading="lazy"
                width={46}
                height={46}
              />
              <div style={{ textAlign: "left" }}>
                <div className="ff-body" style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{tItem.name}</div>
                <div className="ff-body" style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)" }}>{tItem.role}</div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function SectionTag({ children, color = "#31845C" }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="ff-body inline-flex items-center justify-center gap-2"
      style={{ color, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

function AccentLine() {
  return <div className="mx-auto mt-4 h-0.5 w-12 rounded-full" style={{ background: "linear-gradient(90deg,#31845C,#C7A436)" }} />;
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen(!open)}
      className="cursor-pointer rounded-xl px-3 transition-colors"
      style={{
        // 🆕 Le conteneur change de couleur une fois ouvert.
        background: open ? "rgba(199,164,54,0.09)" : "transparent",
        borderBottom: open ? "1px solid rgba(199,164,54,0.28)" : "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex items-center justify-between gap-4 py-5">
        <p style={{ fontSize: 15, fontWeight: 600, color: open ? "#E3C563" : "#fff", lineHeight: 1.4 }}>{q}</p>
        {/* 🆕 Symbole + qui pivote en × à l'ouverture */}
        <motion.div
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.22 }}
          className="shrink-0 flex items-center justify-center rounded-full"
          style={{
            width: 26, height: 26,
            background: open ? "#C7A436" : "rgba(199,164,54,0.14)",
            color: open ? "#08111F" : "#C7A436",
            fontSize: 22, fontWeight: 400, lineHeight: 1,
          }}
          aria-hidden
        >
          <span style={{ marginTop: -2 }}>+</span>
        </motion.div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            <p className="pb-5 leading-relaxed" style={{ fontSize: 15.5, color: "rgba(255,255,255,0.68)" }}>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
const LANG_CYCLE: Lang[] = ["fr", "en", "es"];

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>("fr");
  const t = translations[lang];
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const cycleLang = () => {
    const next = LANG_CYCLE[(LANG_CYCLE.indexOf(lang) + 1) % LANG_CYCLE.length];
    setLang(next);
  };

  const BG = "#080E1A";
  const ALT = "#0A1322";
  const CARD = "#0D1628";
  const BORDER = "rgba(255,255,255,0.07)";
  const MUTED = "#8a97ad";
  const MUTED2 = "#9fb0c4";

  return (
    <main style={{ background: BG, color: "#fff", scrollBehavior: "smooth" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800;900&family=Instrument+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root { --green:#31845C; --gold:#C7A436; --blue:#08498D; --bg:#080E1A; }
        .ff-title { font-family:'Archivo',sans-serif; letter-spacing:-0.02em; }
        .ff-body { font-family:'Instrument Sans',sans-serif; }
        html { font-family:'Instrument Sans',sans-serif; }
        .hero-title, .section-title { text-transform:uppercase; }
        ::selection { background:#C7A43640; }
        .glow-green { box-shadow:0 0 32px rgba(49,132,92,0.15); }
        .card-hover { transition:transform 0.22s ease,box-shadow 0.22s ease; }
        .card-hover:hover { transform:translateY(-3px); box-shadow:0 12px 40px rgba(0,0,0,0.35); }
        @keyframes af-cta { 0%,100% { transform:scale(1); box-shadow:0 12px 30px -12px rgba(199,164,54,.5); } 50% { transform:scale(1.045); box-shadow:0 22px 50px -10px rgba(199,164,54,.95); } }
        @keyframes af-shine { 0% { transform:translateX(-160%) skewX(-18deg); } 55%,100% { transform:translateX(360%) skewX(-18deg); } }
        @keyframes af-badge { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-7px); } }
        .af-cta-pulse { position:relative; overflow:hidden; isolation:isolate; will-change:transform; animation:af-cta 2.6s ease-in-out infinite; }
        .af-cta-pulse::after { content:""; position:absolute; top:0; left:0; width:34%; height:100%; z-index:-1; background:linear-gradient(100deg,transparent,rgba(255,255,255,.5),transparent); animation:af-shine 2.8s ease-in-out infinite; pointer-events:none; }
        .af-badge-float { animation:af-badge 5s ease-in-out infinite; }
        .tilt-card { transition:transform .25s ease-out; transform-style:preserve-3d; will-change:transform; }

        /* Phones + large phones + small tablets : tout s'empile proprement */
        @media (max-width:768px){
          .hero-grid { grid-template-columns:1fr !important; gap: 2rem !important; }
          .hero-title { font-size:clamp(2.1rem,8vw,3.2rem) !important; }
          .hero-promise { text-align:center !important; }
          .hero-sub { text-align:center !important; font-size: 14px !important; margin-left:auto !important; margin-right:auto !important; }
          .hero-ctas { justify-content:center !important; flex-wrap: wrap; }
          .hero-proof { justify-content: center !important; }
          .hero-card { width: 100% !important; max-width: 480px; margin-left:auto; margin-right:auto; }
          .preview-inner-grid { grid-template-columns: 1fr !important; }
          .preview-plan-col { display: none !important; }
          .preview-buttons { flex-wrap: wrap !important; gap: 6px !important; }
          .preview-btn { font-size: 11px !important; padding: 6px 10px !important; }
          .section-title { font-size:clamp(1.7rem,6.5vw,2.5rem) !important; }
          .pricing-grid { grid-template-columns:1fr !important; }
          .steps-grid { grid-template-columns:1fr !important; }
          .pillars-grid { grid-template-columns:1fr !important; }
          .features-grid { grid-template-columns:1fr !important; }
          .templates-grid { grid-template-columns:1fr !important; }
          .problems-grid { grid-template-columns:1fr !important; }
          .testi-grid { grid-template-columns:1fr !important; }
        }

        /* Petits écrans : checklist du hero alignée verticalement (puces alignées) */
        @media (max-width:640px){
          .hero-proof { display:grid !important; grid-template-columns:1fr; gap:8px !important; justify-items:start; width:max-content; max-width:100%; margin-left:auto; margin-right:auto; text-align:left; }
          /* 🆕 Badges du hero : plus compacts pour tenir sur une seule ligne */
          .hero-badges { gap:6px !important; }
          .hero-badges > span { font-size:11px !important; padding:3px 8px !important; gap:5px !important; }
        }
        @media (max-width:380px){
          .hero-badges > span { font-size:10px !important; padding:3px 7px !important; }
        }

        /* Tablettes : 2–3 colonnes au lieu de 4–5 (sinon ça paraît "desktop" et serré) */
        @media (min-width:769px) and (max-width:1024px){
          .section-title { font-size:clamp(1.9rem,4.6vw,2.8rem) !important; }
          .problems-grid { grid-template-columns:repeat(2,1fr) !important; }
          .pillars-grid { grid-template-columns:repeat(3,1fr) !important; }
          .templates-grid { grid-template-columns:repeat(3,1fr) !important; }
          .features-grid { grid-template-columns:repeat(2,1fr) !important; }
          .testi-grid { grid-template-columns:repeat(2,1fr) !important; }
          .steps-grid { grid-template-columns:repeat(2,1fr) !important; }
        }

        /* 🆕 Effets hover du header */
        .nav-link { position:relative; }
        .nav-link::after { content:''; position:absolute; left:0; right:0; bottom:-5px; height:2px; border-radius:2px; background:linear-gradient(90deg,#31845C,#C7A436); transform:scaleX(0); transform-origin:left center; transition:transform .26s cubic-bezier(0.4,0,0.2,1); }
        .nav-link:hover::after { transform:scaleX(1); }
        .header-logo { transition:transform .25s ease; }
        .header-logo:hover { transform:translateY(-1px); }
        .header-logo .logo-badge { transition:box-shadow .25s ease, transform .25s ease; }
        .header-logo:hover .logo-badge { box-shadow:0 0 0 3px rgba(199,164,54,0.28); transform:rotate(-4deg) scale(1.05); }
        .header-cta { transition:transform .2s ease, box-shadow .25s ease, filter .2s ease; }
        .header-cta:hover { transform:translateY(-2px); box-shadow:0 10px 24px -8px rgba(199,164,54,0.55); filter:brightness(1.05); }
        .header-lang { transition:transform .2s ease, background .2s ease; }
        .header-lang:hover { transform:translateY(-1px); background:rgba(199,164,54,0.2) !important; }

        /* 🆕 Carrousel témoignages — marquee infini premium, pause au survol */
        .testi-marquee { position:relative; overflow:hidden; padding:34px 0; -webkit-mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent); mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent); }
        .testi-marquee__track { display:flex; gap:20px; width:max-content; animation:testi-scroll 48s linear infinite; will-change:transform; }
        .testi-marquee:hover .testi-marquee__track { animation-play-state:paused; }
        @keyframes testi-scroll { from{ transform:translateX(0);} to{ transform:translateX(-50%);} }
        .testi-card { position:relative; flex:0 0 340px; width:340px; background:#0C1524; border:1px solid rgba(255,255,255,0.09); border-radius:20px; padding:24px 24px 22px; display:flex; flex-direction:column; box-shadow:0 30px 60px -42px rgba(0,0,0,0.85); transition:transform .35s cubic-bezier(0.2,0.8,0.2,1), border-color .3s ease, box-shadow .3s ease; overflow:hidden; }
        .testi-card::before { content:''; position:absolute; left:0; right:0; top:0; height:3px; background:linear-gradient(90deg,#31845C,#C7A436); opacity:0.65; }
        .testi-card:hover { transform:translateY(-10px) scale(1.025); border-color:rgba(199,164,54,0.45); box-shadow:0 46px 80px -34px rgba(199,164,54,0.28); }
        .testi-card__stars { display:flex; gap:2px; margin-bottom:14px; }
        .testi-card__quote { font-size:15px; line-height:1.6; color:rgba(255,255,255,0.78); margin:0 0 18px; flex:1; }
        .testi-card__author { display:flex; align-items:center; gap:12px; }
        .testi-card__avatar { width:46px; height:46px; border-radius:50%; object-fit:cover; border:2px solid rgba(199,164,54,0.55); box-shadow:0 6px 16px -6px rgba(199,164,54,0.5); }
        @media (max-width:640px){ .testi-card { flex-basis:280px; width:280px; } .testi-marquee__track { animation-duration:36s; } }
      `}</style>

      {/* HEADER */}
      <header style={{ background: "rgba(8,14,26,0.78)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: `1px solid ${BORDER}` }} className="sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-3 sm:px-6 lg:px-8" style={{ gap: 8 }}>
          {/* Logo */}
          <a href="/" className="header-logo flex items-center gap-2 ff-body shrink-0">
            <div className="logo-badge flex h-7 w-7 items-center justify-center rounded-lg ff-title" style={{ background: "linear-gradient(135deg,#31845C,#08498D)", fontSize: 12, color: "#fff", letterSpacing: 0, minWidth: 28 }}>
              AF
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#fff", fontFamily: "DM Sans, sans-serif" }}>
              AutoFunnel<span style={{ color: "#C7A436" }}> AI</span>
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-5">
            {[
              ["#features", t.nav.features],
              ["#templates", t.nav.templates],
              ["#pricing", t.nav.pricing],
              ["#faq", t.nav.faq],
              ["/login", t.nav.login],
            ].map(([href, label]) => (
              <a key={href} href={href} style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.6)" }} className="nav-link hover:text-white transition-colors ff-body whitespace-nowrap">
                {label}
              </a>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Language switcher — toujours visible */}
            <button onClick={cycleLang} className="header-lang flex items-center gap-1 rounded-full px-2.5 py-1.5 ff-body" style={{ background: "rgba(199,164,54,0.12)", border: "1px solid rgba(199,164,54,0.25)", color: "#C7A436", fontSize: 11, fontWeight: 700 }}>
              <Globe2 size={12} /> {lang.toUpperCase()}
            </button>

            {/* Desktop CTA */}
            <a
              href="#pricing"
              className="header-cta hidden md:inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 ff-body font-bold text-white active:scale-95"
              style={{ background: "linear-gradient(135deg,#31845C,#08498D)", fontSize: 12 }}
            >
              {t.ctaHeader}
              <ArrowRight size={13} />
            </a>

            {/* Mobile menu toggle — remplace l'ancien CTA flèche */}
            <button
              onClick={() => setMobileMenuOpen(o => !o)}
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
              className="md:hidden inline-flex items-center justify-center rounded-lg transition hover:opacity-80 active:scale-95"
              style={{
                width: 36,
                height: 36,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff",
              }}
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile menu panel */}
        <AnimatePresence initial={false}>
          {mobileMenuOpen && (
            <motion.div
              key="mobile-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="md:hidden overflow-hidden"
              style={{ borderTop: `1px solid ${BORDER}`, background: CARD }}
            >
              <nav className="flex flex-col px-4 py-3">
                {[
                  ["#features", t.nav.features],
                  ["#templates", t.nav.templates],
                  ["#pricing", t.nav.pricing],
                  ["#faq", t.nav.faq],
                  ["/login", t.nav.login],
                ].map(([href, label]) => (
                  <a
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="ff-body py-3 transition-colors hover:text-white"
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.7)",
                      borderBottom: `1px solid ${BORDER}`,
                    }}
                  >
                    {label}
                  </a>
                ))}

                <a
                  href="#pricing"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mt-4 mb-2 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-3 ff-body font-bold text-white transition hover:opacity-90 active:scale-95"
                  style={{ background: "linear-gradient(135deg,#31845C,#08498D)", fontSize: 13 }}
                >
                  {t.ctaHeader} <ArrowRight size={14} />
                </a>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>


      {/* HERO — promesse centrée, puis aperçu du produit en pleine largeur. */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(155deg,#080E1A 0%,#0A1826 55%,#080E1A 100%)" }}>
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute left-1/2 top-8 h-[540px] w-[900px] -translate-x-1/2 rounded-full opacity-15" style={{ background: "radial-gradient(ellipse,#31845C,transparent 65%)" }} />
          <div className="absolute -right-40 bottom-0 h-[520px] w-[520px] rounded-full opacity-10" style={{ background: "radial-gradient(circle,#C7A436,transparent 65%)" }} />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 lg:px-8 lg:pb-24 lg:pt-20">
          <div className="hero-promise mx-auto max-w-5xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1" style={{ background: "rgba(199,164,54,0.10)", border: "1px solid rgba(199,164,54,0.24)", color: "#C7A436", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              <Sparkles size={10} /> {t.hero.label}
            </div>
            <div className="hero-badges mt-4 flex flex-wrap justify-center gap-2">
              {[
                { icon: <Gauge size={13} />, label: ({ fr: "Ultra-rapide", en: "Ultra-fast", es: "Ultrarrápido" } as const)[lang] },
                { icon: <Smartphone size={13} />, label: "Mobile-first" },
                { icon: <Layers size={13} />, label: ({ fr: "Tout dans l'app", en: "All in the app", es: "Todo en la app" } as const)[lang] },
              ].map((badge) => (
                <span key={badge.label} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 ff-body whitespace-nowrap" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.78)", fontSize: 12, fontWeight: 600 }}>
                  <span style={{ color: "#69B58D" }}>{badge.icon}</span>{badge.label}
                </span>
              ))}
            </div>
            <h1 className="ff-title hero-title mt-6 leading-[1.06] text-white" style={{ fontSize: "clamp(2.1rem,4.7vw,3.7rem)", fontWeight: 700 }}>
              {t.hero.titleStart}{" "}{t.hero.titleMid}{" "}
              <span style={{ color: "#C7A436" }}>{t.hero.titleEnd}</span>
            </h1>
            <p className="hero-sub mx-auto mt-6 max-w-3xl ff-body" style={{ fontSize: 17, color: MUTED2, lineHeight: 1.7 }}>
              {t.hero.desc}
            </p>
            <div className="hero-ctas mt-8 flex flex-wrap justify-center gap-3.5">
              <a href="#pricing" className="af-cta-pulse group inline-flex items-center gap-2 rounded-xl px-7 py-3.5 ff-title" style={{ background: "#C7A436", color: "#080E1A", fontSize: 15, fontWeight: 700 }}>
                {t.hero.ctaPrimary} <ArrowRight size={15} />
              </a>
              <a href="#how" className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 ff-title transition hover:border-[#31845C]" style={{ background: "#152439", color: "#d7deea", border: "1px solid #34445a", fontSize: 15, fontWeight: 600 }}>
                {t.hero.ctaSecondary}
              </a>
            </div>
            <div className="hero-proof mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2" style={{ fontSize: 13, color: MUTED2 }}>
              {t.hero.proofBar.map((proof) => (
                <span key={proof} className="inline-flex items-center gap-1.5 ff-body">
                  <CheckCircle2 size={14} style={{ color: "#69B58D" }} />{proof}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-12 sm:mt-14 lg:mt-16">
            <ProductDashboardPreview language={lang} />
          </div>
          <p className="mx-auto mt-6 max-w-3xl text-center ff-body" style={{ fontSize: 12, color: "#8293a9", lineHeight: 1.6 }}>
            {t.hero.footnote}
          </p>
        </div>
      </section>

      {/* 🆕 PREUVE SOCIALE CHIFFRÉE — compteurs réels + faits différenciants */}
      <StatsBand lang={lang} />

      {/* PROBLEM */}
      <section className="py-20" style={{ background: BG }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeInWhenVisible direction="up">
            <SectionTag color="#C7A436"><Clock size={11} /> {t.problem.tag}</SectionTag>
            <h2 className="ff-title section-title mt-4" style={{ fontSize: "clamp(1.9rem,4.6vw,3.2rem)", color: "#fff" }}>
              {t.problem.title}
            </h2>
            <AccentLine />
          </FadeInWhenVisible>
        </div>
        <div className="mx-auto mt-12 max-w-6xl px-4 sm:px-6 lg:px-8 problems-grid grid gap-5" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
          {t.problem.items.map((p, i) => {
            const Icon = PROBLEM_ICONS[i] ?? Clock;
            return (
              <FadeInWhenVisible key={i} direction="up" delay={i * 0.08}>
                <div className="card-hover rounded-2xl p-6 h-full" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "rgba(199,164,54,0.10)" }}>
                    <Icon size={20} style={{ color: "#C7A436" }} />
                  </div>
                  <h3 className="ff-body font-bold mb-2" style={{ fontSize: 15, color: "#fff" }}>{p.title}</h3>
                  <p className="ff-body leading-relaxed" style={{ fontSize: 15.5, color: "rgba(255,255,255,0.55)" }}>{p.desc}</p>
                </div>
              </FadeInWhenVisible>
            );
          })}
        </div>
      </section>

      {/* SOLUTION */}
      <section className="py-20" style={{ background: ALT }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeInWhenVisible direction="up">
            <SectionTag color="#31845C"><Sparkles size={11} /> {t.solution.tag}</SectionTag>
            <h2 className="ff-title section-title mt-4" style={{ fontSize: "clamp(1.9rem,4.6vw,3.2rem)", color: "#fff" }}>
              {t.solution.title}
            </h2>
            <AccentLine />
            <p className="ff-body mt-5 max-w-2xl mx-auto" style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", lineHeight: 1.7 }}>
              {t.solution.desc}
            </p>
          </FadeInWhenVisible>
        </div>
        <div className="mx-auto mt-12 max-w-6xl px-4 sm:px-6 lg:px-8 pillars-grid grid gap-4" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
          {t.solution.pillars.map((p, i) => {
            const Icon = PILLAR_ICONS[i] ?? Gauge;
            return (
              <FadeInWhenVisible key={i} direction="up" delay={i * 0.08}>
                <div className="card-hover rounded-2xl p-5 h-full text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(49,132,92,0.12)" }}>
                    <Icon size={18} style={{ color: "#31845C" }} />
                  </div>
                  <h3 className="ff-body font-bold mb-1.5" style={{ fontSize: 14, color: "#fff" }}>{p.title}</h3>
                  <p className="ff-body leading-relaxed" style={{ fontSize: 15, color: "rgba(255,255,255,0.5)" }}>{p.desc}</p>
                </div>
              </FadeInWhenVisible>
            );
          })}
        </div>
      </section>

      {/* TEAM — met en scène les expertises IA, chacune avec son propre nom
          (pas de répétition du mot "agent" à chaque mention). */}
      <section className="py-20" style={{ background: BG }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeInWhenVisible direction="up">
            <SectionTag color="#C7A436"><Users size={11} /> {t.team.tag}</SectionTag>
            <h2 className="ff-title section-title mt-4" style={{ fontSize: "clamp(1.9rem,4.6vw,3.2rem)", color: "#fff" }}>
              {t.team.title}
            </h2>
            <AccentLine />
            <p className="ff-body mt-4 max-w-2xl mx-auto" style={{ fontSize: 15.5, color: "rgba(255,255,255,0.5)" }}>
              {t.team.desc}
            </p>
          </FadeInWhenVisible>
        </div>
        <div className="mx-auto mt-12 max-w-6xl px-4 sm:px-6 lg:px-8 problems-grid grid gap-5" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
          {t.team.members.map((m, i) => {
            const Icon = TEAM_ICONS[i] ?? Users;
            return (
              <FadeInWhenVisible key={i} direction="up" delay={i * 0.08}>
                <div className="card-hover rounded-2xl p-6 h-full" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "rgba(199,164,54,0.10)" }}>
                    <Icon size={20} style={{ color: "#C7A436" }} />
                  </div>
                  <p className="ff-body" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#31845C", marginBottom: 6 }}>
                    {m.role}
                  </p>
                  <h3 className="ff-body font-bold mb-2" style={{ fontSize: 16, color: "#fff" }}>{m.name}</h3>
                  <p className="ff-body leading-relaxed" style={{ fontSize: 15, color: "rgba(255,255,255,0.55)" }}>{m.desc}</p>
                </div>
              </FadeInWhenVisible>
            );
          })}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-20" style={{ background: BG }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeInWhenVisible direction="up">
            <SectionTag color="#08498D"><Wand2 size={11} /> {t.howItWorks.tag}</SectionTag>
            <h2 className="ff-title section-title mt-4" style={{ fontSize: "clamp(1.9rem,4.6vw,3.2rem)", color: "#fff" }}>
              {t.howItWorks.title}
            </h2>
            <AccentLine />
          </FadeInWhenVisible>
        </div>
        <div className="mx-auto mt-12 max-w-5xl px-4 sm:px-6 lg:px-8 steps-grid grid gap-4" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
          {t.howItWorks.steps.map((s, i) => {
            const Icon = STEP_ICONS[i] ?? Wand2;
            return (
              <FadeInWhenVisible key={i} direction="up" delay={i * 0.08}>
                <div className="card-hover rounded-2xl p-6 text-center h-full" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: "linear-gradient(135deg,rgba(8,73,141,0.2),rgba(49,132,92,0.2))", border: `1px solid ${BORDER}` }}>
                    <Icon size={22} style={{ color: "#C7A436" }} />
                  </div>
                  <p className="ff-title" style={{ fontSize: 13, color: "rgba(199,164,54,0.6)", letterSpacing: "0.05em" }}>{s.step}</p>
                  <h3 className="ff-body font-bold mt-1" style={{ fontSize: 15, color: "#fff" }}>{s.title}</h3>
                  <p className="ff-body mt-2 leading-relaxed" style={{ fontSize: 15, color: "rgba(255,255,255,0.5)" }}>{s.desc}</p>
                </div>
              </FadeInWhenVisible>
            );
          })}
        </div>
      </section>

      {/* FEATURES — 3 groups */}
      <section id="features" className="py-20" style={{ background: ALT }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeInWhenVisible direction="up">
            <SectionTag color="#31845C"><Layers size={11} /> {t.features.tag}</SectionTag>
            <h2 className="ff-title section-title mt-4" style={{ fontSize: "clamp(1.9rem,4.6vw,3.2rem)", color: "#fff" }}>
              {t.features.title}
            </h2>
            <AccentLine />
          </FadeInWhenVisible>
        </div>

        <div className="mx-auto mt-12 max-w-6xl px-4 sm:px-6 lg:px-8 features-grid grid gap-5" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          {t.features.groups.map((group, gi) => {
            const Icon = FEATURE_GROUP_ICONS[gi] ?? Wand2;
            const accent = ACCENT[gi] ?? "#31845C";
            return (
              <FadeInWhenVisible key={gi} direction="up" delay={gi * 0.1}>
                <div className="rounded-2xl p-6 h-full" style={{ background: CARD, border: `1px solid ${BORDER}`, borderTop: `2px solid ${accent}` }}>
                  <div className="mb-4 flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${accent}18` }}>
                      <Icon size={17} style={{ color: accent }} />
                    </div>
                    <h3 className="ff-body font-bold" style={{ fontSize: 15, color: "#fff", letterSpacing: "0.02em" }}>
                      {group.name}
                    </h3>
                  </div>

                  <ul className="space-y-3.5">
                    {group.items.map((item: any, ii: number) => (
                      <li key={ii} className="flex items-start gap-2.5">
                        <CheckCircle2 size={15} style={{ color: item.primary ? "#C7A436" : accent }} className="mt-0.5 shrink-0" />
                        <div>
                          <p className="ff-body font-bold" style={{ fontSize: 13, color: "#fff" }}>
                            {item.title}
                            {item.primary && (
                              <span className="ml-2 rounded-full px-2 py-0.5 align-middle" style={{ fontSize: 9, fontWeight: 700, background: "rgba(199,164,54,0.15)", color: "#C7A436", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                Bonus
                              </span>
                            )}
                          </p>
                          <p className="ff-body leading-relaxed mt-0.5" style={{ fontSize: 15, color: "rgba(255,255,255,0.5)" }}>
                            {item.desc}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeInWhenVisible>
            );
          })}
        </div>
      </section>

      {/* TEMPLATES / USE CASES */}
      <section id="templates" className="py-20" style={{ background: BG }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeInWhenVisible direction="up">
            <SectionTag color="#08498D"><Briefcase size={11} /> {t.templates.tag}</SectionTag>
            <h2 className="ff-title section-title mt-4" style={{ fontSize: "clamp(1.9rem,4.6vw,3.2rem)", color: "#fff" }}>
              {t.templates.title}
            </h2>
            <AccentLine />
            <p className="ff-body mt-4 max-w-xl mx-auto" style={{ fontSize: 15.5, color: "rgba(255,255,255,0.5)" }}>
              {t.templates.desc}
            </p>
          </FadeInWhenVisible>
        </div>

        {/* Cas d'usage orientés résultats */}
        <div className="mx-auto mt-12 max-w-5xl px-4 sm:px-6 lg:px-8 templates-grid grid gap-4" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          {t.templates.cases.map((c, i) => {
            const Icon = TEMPLATE_ICONS[i] ?? Layers;
            return (
              <FadeInWhenVisible key={i} direction="up" delay={i * 0.06}>
                <div className="card-hover rounded-2xl p-6 h-full" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "rgba(8,73,141,0.18)" }}>
                    <Icon size={18} style={{ color: "#5aa0e6" }} />
                  </div>
                  <h3 className="ff-title mb-1.5" style={{ fontSize: 17, fontWeight: 600, color: "#fff" }}>{c.name}</h3>
                  <p className="ff-body leading-relaxed" style={{ fontSize: 15.5, color: MUTED }}>{c.desc}</p>
                </div>
              </FadeInWhenVisible>
            );
          })}
        </div>

      </section>

      {/* TESTIMONIALS */}
      <section className="py-20" style={{ background: ALT }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeInWhenVisible direction="up">
            <SectionTag color="#C7A436"><Users size={11} /> {t.testimonials.tag}</SectionTag>
            <h2 className="ff-title section-title mt-4" style={{ fontSize: "clamp(1.9rem,4.6vw,3.2rem)", color: "#fff" }}>
              {t.testimonials.title}
            </h2>
            <AccentLine />
          </FadeInWhenVisible>
        </div>
        <TestimonialsCarousel items={t.testimonials.items} />
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-20" style={{ background: BG }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeInWhenVisible direction="up">
            <SectionTag color="#C7A436"><BarChart3 size={11} /> {t.pricing.tag}</SectionTag>
            <h2 className="ff-title section-title mt-4" style={{ fontSize: "clamp(1.9rem,4.6vw,3.2rem)", color: "#fff" }}>
              {t.pricing.title}
            </h2>
            <AccentLine />
            <p className="ff-body mt-4 max-w-md mx-auto" style={{ fontSize: 15.5, color: "rgba(255,255,255,0.5)" }}>{t.pricing.desc}</p>
          </FadeInWhenVisible>
        </div>

        <div className="mx-auto mt-12 max-w-5xl px-4 sm:px-6 lg:px-8 pricing-grid grid gap-5 items-stretch" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          {t.pricing.plans.map((plan, i) => {
            const color = PRICING_COLORS[i];
            const popular = PRICING_POPULAR[i];
            return (
              <FadeInWhenVisible key={i} direction="up" delay={i * 0.1}>
                <div className={`flex ${popular ? 'relative' : ''} h-full`}>
                  {popular ? (
                    <div className="relative rounded-2xl overflow-hidden flex flex-col w-full glow-green" style={{ background: "linear-gradient(160deg,#0D2E1E 0%,#08192E 100%)", border: "1.5px solid rgba(49,132,92,0.45)" }}>
                      <div className="flex items-center justify-center gap-1.5 py-2.5 ff-body" style={{ background: "linear-gradient(90deg,#31845C,#1E6644)" }}>
                        <Rocket size={12} style={{ color: "#fff" }} />
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", letterSpacing: "0.1em", textTransform: "uppercase" }}>{t.pricing.popular}</span>
                      </div>
                      <div className="p-7 flex flex-col flex-1">
                        <p className="ff-body" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#31845C", marginBottom: 4 }}>{plan.name}</p>
                        <div className="flex items-end gap-1 mb-1">
                          <span className="ff-title leading-none" style={{ fontSize: 40, color: "#fff" }}>{plan.price}</span>
                          <span className="ff-body mb-1.5" style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>{plan.period}</span>
                        </div>
                        <p className="ff-body mb-6" style={{ fontSize: 15, color: "rgba(255,255,255,0.5)" }}>{plan.desc}</p>
                        <div className="h-px mb-6" style={{ background: "rgba(255,255,255,0.08)" }} />
                        <ul className="space-y-3 flex-1 mb-8">
                          {plan.features.map((f, idx) => (
                            <li key={idx} className="flex items-start gap-2.5">
                              <CheckCircle2 size={14} style={{ color: "#31845C" }} className="mt-0.5 shrink-0" />
                              <span className="ff-body" style={{ fontSize: 15.5, color: "rgba(255,255,255,0.78)" }}>{f}</span>
                            </li>
                          ))}
                        </ul>
                        <a href={`/signup?plan=${["starter", "pro", "agency"][i] ?? "pro"}`} className="block w-full rounded-xl py-3 text-center ff-body font-bold transition hover:opacity-90 active:scale-95" style={{ background: "#31845C", color: "#fff", fontSize: 13 }}>{plan.cta}</a>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl flex flex-col w-full card-hover" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                      <div className="p-7 flex flex-col flex-1">
                        <p className="ff-body" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color, marginBottom: 4 }}>{plan.name}</p>
                        <div className="flex items-end gap-1 mb-1">
                          <span className="ff-title leading-none" style={{ fontSize: 40, color: "#fff" }}>{plan.price}</span>
                          <span className="ff-body mb-1.5" style={{ fontSize: 14, color: "rgba(255,255,255,0.35)" }}>{plan.period}</span>
                        </div>
                        <p className="ff-body mb-6" style={{ fontSize: 15, color: "rgba(255,255,255,0.4)" }}>{plan.desc}</p>
                        <div className="h-px mb-6" style={{ background: "rgba(255,255,255,0.06)" }} />
                        <ul className="space-y-3 flex-1 mb-8">
                          {plan.features.map((f, idx) => (
                            <li key={idx} className="flex items-start gap-2.5">
                              <CheckCircle2 size={14} style={{ color }} className="mt-0.5 shrink-0" />
                              <span className="ff-body" style={{ fontSize: 15.5, color: "rgba(255,255,255,0.62)" }}>{f}</span>
                            </li>
                          ))}
                        </ul>
                        <a href={`/signup?plan=${["starter", "pro", "agency"][i] ?? "pro"}`} className="block w-full rounded-xl py-3 text-center ff-body font-bold text-white transition hover:opacity-90 active:scale-95" style={{ background: color, fontSize: 13 }}>{plan.cta}</a>
                      </div>
                    </div>
                  )}
                </div>
              </FadeInWhenVisible>
            );
          })}
        </div>

        <FadeInWhenVisible direction="up" delay={0.3}>
          <p className="ff-body mt-7 flex items-center justify-center gap-2 text-center" style={{ fontSize: 15, color: "rgba(255,255,255,0.35)" }}>
            <Shield size={12} /> {t.pricing.guarantee}
          </p>
        </FadeInWhenVisible>

        {/* 🆕 Comparatif « nous vs générateurs de pages seuls » (argument massue) */}
        <div className="px-4 sm:px-6 lg:px-8">
          <FadeInWhenVisible direction="up" delay={0.15}>
            <ComparisonTable lang={lang} />
          </FadeInWhenVisible>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20" style={{ background: ALT }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <FadeInWhenVisible direction="up">
              <SectionTag color="#C7A436"><MessageCircle size={11} /> {t.faq.tag}</SectionTag>
              <h2 className="ff-title section-title mt-4" style={{ fontSize: "clamp(1.9rem,4.6vw,3.2rem)", color: "#fff" }}>
                {t.faq.title}
              </h2>
              <AccentLine />
            </FadeInWhenVisible>
          </div>
          <FadeInWhenVisible direction="up" delay={0.15}>
            <div className="rounded-2xl px-6 py-2" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              {t.faq.items.map((faq, i) => (
                <FaqItem key={i} q={faq.q} a={faq.a} />
              ))}
            </div>
          </FadeInWhenVisible>
          <FadeInWhenVisible direction="up" delay={0.25}>
            <div className="text-center mt-10">
              <a href="/signup" className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 ff-body font-bold text-white transition hover:opacity-90 active:scale-95" style={{ background: "linear-gradient(135deg,#31845C,#08498D)", fontSize: 14 }}>
                {t.faq.cta} <ArrowRight size={15} />
              </a>
            </div>
          </FadeInWhenVisible>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(140deg,#080E1A,#0A1628)", padding: "96px 0" }}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-0 top-0 h-80 w-80 translate-x-1/3 -translate-y-1/4 rounded-full opacity-10" style={{ background: "radial-gradient(circle,#C7A436,transparent 65%)" }} />
          <div className="absolute left-0 bottom-0 h-80 w-80 -translate-x-1/3 translate-y-1/4 rounded-full opacity-10" style={{ background: "radial-gradient(circle,#31845C,transparent 65%)" }} />
        </div>
        <div className="relative mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeInWhenVisible direction="up">
            <h2 className="ff-title section-title text-white" style={{ fontSize: "clamp(1.9rem,4.6vw,3.4rem)", lineHeight: 1.08, fontWeight: 700 }}>
              {t.finalCta.title}
            </h2>
            <p className="ff-body mt-5 max-w-xl mx-auto" style={{ fontSize: 16, color: MUTED2, lineHeight: 1.6 }}>{t.finalCta.desc}</p>
            <div className="mt-8 flex flex-wrap gap-3.5 justify-center">
              <a href="#pricing" className="af-cta-pulse group inline-flex items-center gap-2 rounded-xl px-8 py-4 ff-title" style={{ background: "#C7A436", color: "#080E1A", fontSize: 15, fontWeight: 700 }}>
                {t.finalCta.primary} <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </a>
              <a href="#how" className="inline-flex items-center gap-2 rounded-xl px-8 py-4 ff-title transition hover:border-[#31845C]" style={{ background: "transparent", color: "#d7deea", border: "1px solid rgba(255,255,255,0.16)", fontSize: 15, fontWeight: 600 }}>
                {t.finalCta.secondary}
              </a>
            </div>
            <div className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 ff-body" style={{ fontSize: 15.5, color: MUTED2 }}>
              {t.finalCta.points.map((p, i) => (
                <span key={i} className="flex items-center gap-1.5"><CheckCircle2 size={13} style={{ color: "#31845C" }} /> {p}</span>
              ))}
            </div>
          </FadeInWhenVisible>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "#060A12", borderTop: `1px solid ${BORDER}` }}>
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-9 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg ff-title" style={{ background: "linear-gradient(135deg,#31845C,#08498D)", fontSize: 10, fontWeight: 700, color: "#fff" }}>AF</div>
            <span className="ff-title" style={{ fontWeight: 600, fontSize: 14, color: "#fff" }}>AutoFunnel <span style={{ color: "#C7A436" }}>AI</span></span>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1">
            {[
              ["/terms", t.footer.cgv],
              ["/privacy", t.footer.privacy],
            ].map(([href, label]) => (
              <a key={label} href={href} className="ff-body hover:text-[#C7A436] transition-colors" style={{ fontSize: 12.5, color: "rgba(255,255,255,0.4)" }}>
                {label}
              </a>
            ))}
          </div>
          <p className="ff-body" style={{ fontSize: 12.5, color: "rgba(255,255,255,0.3)" }}>© 2026 AutoFunnel AI</p>
        </div>
      </footer>

      {/* 🆕 CHATBOT SUR LA LANDING.
          Il n'était monté que dans AppShell, donc réservé aux utilisateurs
          DÉJÀ connectés — c'est-à-dire à ceux qui ont le moins de questions.
          Un visiteur qui hésite avant de créer un compte n'avait aucun moyen
          de demander si l'outil répond à son besoin.
          Le widget est autonome (état interne, appel à /api/chat) : il n'a
          besoin ni de session ni de contexte d'application. */}
      <ChatWidget />
    </main>
  );
}
