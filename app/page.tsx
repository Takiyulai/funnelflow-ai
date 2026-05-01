"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  ArrowRight, CheckCircle2, Download, Globe2, Sparkles, Upload,
  Zap, Clock, Smartphone, TrendingUp, Shield, Code, Mail, Users,
  Briefcase, Palette, MessageCircle, Star, Eye, Layers, Award,
  ChevronDown, Rocket, BarChart3, Target, Cpu, Wand2, FileCode2,
  Languages, Gauge, MousePointerClick,
} from "lucide-react";
import { TemplateCard } from "@/components/funnel/TemplateCard";
import { funnelTemplates } from "@/lib/funnels/templates";

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
    up:    { opacity: 0, y: 32 },
    down:  { opacity: 0, y: -32 },
    left:  { opacity: 0, x: -32 },
    right: { opacity: 0, x: 32 },
    none:  { opacity: 0 },
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

// Dictionnaire des traductions
const translations = {
  fr: {
    // Header
    navFeatures: "Fonctionnalités",
    navTemplates: "Templates",
    navPricing: "Tarifs",
    navFaq: "FAQ",
    navLogin: "Se connecter",
    ctaHeader: "Générer mon tunnel",

    // Hero
    heroTag: "GÉNÉRATEUR IA POUR SYSTEME.IO",
    heroTitle: "TRANSFORMEZ UNE OFFRE",
    heroTitleEnd: "EN TUNNEL QUI",
    heroDesc: "FunnelFlow AI génère automatiquement votre page de vente, votre capture email et vos emails de relance pour obtenir un tunnel prêt à convertir en quelques minutes",
    ctaPrimary: "Générer mon tunnel",
    ctaSecondary: "Voir la démo",

    // Problem section
    problemTag: "Le problème actuel",
    problemTitle: "SYSTEME.IO EST GÉNIAL POUR",
    problemTitleHighlight: "L'AUTOMATISATION",
    problemTitleEnd: "MAIS CRÉER DES TUNNELS ? C'EST L'ENFER",

    // Problems cards
    problems: [
      { title: "4 à 8h perdues", desc: "Créer manuellement sur Systeme.io est un calvaire répétitif qui épuise votre énergie créative" },
      { title: "Chargement lent", desc: "4-6 secondes en natif. Chaque seconde supplémentaire = 7% de conversions perdues." },
      { title: "Mobile non optimisé", desc: "70% de votre trafic vient du mobile — l'éditeur drag-and-drop casse tout le rendu." },
    ],

    // Solution section
    solutionTag: "La solution",
    solutionTitle: "FUNNELFORGE GÉNÈRE",
    solutionTitleHighlight: "VOTRE TUNNEL PARFAIT",
    before: "Avant",
    after: "Après FunnelFlow AI",
    beforeItems: ["4-8h de travail par tunnel", "Responsive cassé sur mobile", "Copywriting générique", "Chargement en 4-6 secondes"],
    afterItems: ["5 minutes par tunnel", "Mobile-first pixel-perfect", "Copywriting CRO par IA", "Chargement sous 1 seconde"],

    // Agents section
    agentsTag: "Votre équipe IA",
    agentsTitle: "VOTRE ÉQUIPE IA",
    agentsTitleHighlight: "AU TRAVAIL POUR VOUS",
    agentsDesc: "4 agents spécialisés interviennent dans l'ordre. Chacun expert dans son domaine",
    agents: [
      { title: "Strategist", step: "01", desc: "Analyse votre marché, audience et structure l'approche de conversion" },
      { title: "Copywriter", step: "02", desc: "Rédige accroches, blocs de contenu et CTA calibrés pour vendre" },
      { title: "Designer", step: "03", desc: "Sélectionne pack visuel, palette et style adapté à votre offre" },
      { title: "Builder", step: "04", desc: "Assemble et exporte le HTML prêt à coller dans Systeme.io." },
    ],

    // Benefits section
    benefitsTag: "Un Aperçu de votre Arsenal",
    benefitsTitle: "TOUT CE QU'IL FAUT",
    benefitsTitleHighlight: "POUR CONVERTIR",
    benefits: [
      { title: "Génération < 1 seconde", desc: "Tunnel complet en moins d'une minute, aucune attente" },
      { title: "Mobile-first parfait", desc: "Pixel-perfect sur tous les écrans. 70% de votre trafic est mobile" },
      { title: "Copywriting CRO", desc: "Chaque mot est calibré pour convertir, pas juste impressionner" },
      { title: "Export Systeme.io", desc: "HTML/CSS prêt à coller dans votre espace en 1 clic." },
      { title: "Séquences emails IA", desc: "6 emails inclus d'office : bienvenue, relance, nurturing" },
      { title: "Garantie 30 jours", desc: "Satisfait ou remboursé. Sans engagement, sans risque" },
    ],

    // Features section
    featuresTag: "Fonctionnalités premium",
    featuresTitle: "POURQUOI FUNNELFORGE",
    featuresTitleHighlight: "DOMINE SYSTEME.IO",
    features: [
      { title: "Export Systeme.io", desc: "Blocs HTML/CSS prêts à coller. Zéro config" },
      { title: "Import URL", desc: "Analyse structurelle, reproduction fidèle." },
      { title: "FR / EN natif", desc: "Générez dans les deux langues selon votre marché" },
      { title: "100+ templates", desc: "Bibliothèque premium pour toutes les niches" },
      { title: "Mode Reseller", desc: "Brief client auto + commissions sur reventes" },
      { title: "Éditeur visuel", desc: "Modifiez en visuel ou directement dans le code" },
    ],

    // Testimonials section
    testimonialsTag: "Témoignages",
    testimonialsTitle: "ILS ONT FORGÉ",
    testimonialsTitleHighlight: "ILS ONT CONVERTI",
    rating: "4.9/5 · 247+ avis vérifiés",
    testimonials: [
      { name: "Nadia Belkacem", role: "Coach développement personnel", quote: "Premier tunnel en 7 minutes. Mon taux de conversion a grimpé de 38% le premier mois", stat: "+38% conv" },
      { name: "Carlos Hernandez", role: "Formateur marketing digital", quote: "Je passais 8h sur une page. Maintenant 5 minutes, tunnel complet, mobile parfait", stat: "5 min/tunnel" },
      { name: "Léa Fournier", role: "Formatrice yoga & bien-être", quote: "Zéro compétences tech. C'est plus simple que l'éditeur natif Systeme.io, bluffant", stat: "0 technique" },
    ],

    // Pricing section
    pricingTag: "Tarifs",
    pricingTitle: "UN INVESTISSEMENT",
    pricingTitleHighlight: "DES RÉSULTATS ILLIMITÉS",
    pricingDesc: "Choisissez votre plan. Commencez à forger dès aujourd'hui",
    pricingPopular: "Le plus utilisé",
    pricingGuarantee: "Garantie 30 jours satisfait ou remboursé · Sans engagement · Stripe sécurisé",
    pricing: [
      {
        name: "Starter",
        price: "29€",
        period: "/mois",
        desc: "Pour démarrer et valider votre offre",
        features: ["3 tunnels IA / mois", "Export HTML", "Templates de base", "CRM simple", "Support email"],
        cta: "Lancer mon premier tunnel",
      },
      {
        name: "Pro",
        price: "49€",
        period: "/mois",
        desc: "Pour les pros qui veulent scaler",
        features: ["10 tunnels IA / mois", "Export Systeme.io", "Régénération IA", "Emails automatiques", "100+ templates", "Support prioritaire"],
        cta: "Dominer avec le Pro",
      },
      {
        name: "Agency",
        price: "97€",
        period: "/mois",
        desc: "Pour les agences et freelances",
        features: ["Tunnels illimités", "Import URL illimité", "Workflows simples", "Branding client", "Dashboard équipe", "Support dédié 4h"],
        cta: "Scaler mon agence",
      },
    ],

    // Templates section
    templatesTag: "Templates",
    templatesTitle: "TEMPLATES",
    templatesTitleHighlight: "DISPONIBLES",
    templatesDesc: "8 modèles pour ebooks, coaching, formations et services",

    // FAQ section
    faqTag: "FAQ",
    faqTitle: "VOS QUESTIONS.",
    faqTitleHighlight: "NOS RÉPONSES",
    faqCta: "Créer mon compte",
    faqs: [
      { q: "Pourquoi FunnelFlow AI plutôt que l'éditeur natif Systeme.io ?", a: "Gagnez 4 à 8h par tunnel. HTML chargeant en <1s (vs 4-6s natif), mobile-first pixel-perfect, copywriting CRO généré par IA. L'éditeur drag-and-drop devient optionnel — vous collez juste le code généré." },
      { q: "Comment fonctionne la génération IA ?", a: "Répondez à 9 questions sur votre offre, audience et objectif. Vos 4 agents IA (Strategist, Copywriter, Designer, Builder) forgent un tunnel complet en <1 minute. Vous éditez si besoin, puis exportez" },
      { q: "Ai-je besoin de compétences techniques ?", a: "Aucune. FunnelFlow AI génère 100% du code. Copiez-collez dans un bloc HTML personnalisé Systeme.io , déploiement en 30 secondes. L'éditeur visuel permet aussi de modifier sans toucher au code" },
      { q: "Puis-je modifier le tunnel après génération ?", a: "Oui, liberté totale : éditeur visuel intégré, accès direct au HTML/CSS, régénération section par section via IA. Vous n'êtes jamais bloqué par le résultat initial" },
      { q: "L'import URL copie-t-il un site tiers ?", a: "Non. FunnelFlow AI analyse uniquement la structure (sections, hiérarchie, intentions) pour vous inspirer. Textes, images et branding sont entièrement originaux et générés pour vous" },
      { q: "Puis-je créer des tunnels pour mes clients (agence) ?", a: "Le plan Agency inclut brief client automatique, dashboard équipe multi-comptes, branding client dédié et commissions sur reventes. Idéal pour facturer vos tunnels entre 500€ et 2 000€ pièce" },
      { q: "Quelles garanties si je ne suis pas satisfait ?", a: "Garantie 30 jours satisfait ou remboursé, sans conditions, sans engagement. Annulation en 1 clic depuis votre tableau de bord. Zéro risque." },
      { q: "FunnelFlow AI fonctionne-t-il avec d'autres outils que Systeme.io ?", a: "L'export HTML standard est compatible avec tout CMS ou page builder. L'export Systeme.io (blocs natifs) est optimisé pour cette plateforme, mais le code fonctionne aussi sur Webflow, Carrd, WordPress, etc..." },
    ],

    // CTA Final
    ctaFinalTitle: "PRÊT À FORGER DES TUNNELS",
    ctaFinalTitleHighlight: "QUI CONVERTISSENT ?",
    ctaFinalDesc: "Rejoignez 1 247+ entrepreneurs qui ont remplacé des heures de galère par 5 minutes de génération IA",
    ctaFinalPrimary: "Commencer maintenant",
    ctaFinalSecondary: "Voir la démo",
    ctaFinalSetup: "Setup en 5 minutes",
    ctaFinalGuarantee: "Garantie 30 jours",
    ctaFinalUnlimited: "Tunnels illimités",

    // Footer
    footerCgv: "CGV",
    footerPrivacy: "Confidentialité",

    // Preview card
    previewTitle: "APERCU DU RESULTAT FINAL",
    previewDesc: "Aperçu desktop et mobile, publication et exports",
    previewModify: "Modifier",
    previewPublish: "Publier",
    previewExportHtml: "Export HTML/CSS",
    previewExportSysteme: "Export Systeme.io",
    previewProductName: "Ebook premium conversion",
    previewProductDesc: "Une page premium prête à convertir vos visiteurs en clients",
    previewExportBtn: "Export Systeme.io",
    previewPlanTitle: "PLAN DU TUNNEL",
    previewPlanItems: ["Page vente", "Lead form", "Page merci", "Emails", "Export"],
  },
  en: {
    navFeatures: "Features",
    navTemplates: "Templates",
    navPricing: "Pricing",
    navFaq: "FAQ",
    navLogin: "Sign in",
    ctaHeader: "Generate my funnel",

    heroTag: "AI GENERATOR FOR SYSTEME.IO",
    heroTitle: "TURN YOUR OFFER",
    heroTitleEnd: "INTO A FUNNEL THAT",
    heroDesc: "FunnelFlow AI automatically generates your sales page, email capture, and follow-up emails to get a conversion-ready funnel in minutes",
    ctaPrimary: "Generate my funnel",
    ctaSecondary: "Live demo",

    problemTag: "The problem",
    problemTitle: "SYSTEME.IO IS GREAT FOR",
    problemTitleHighlight: "AUTOMATION",
    problemTitleEnd: "BUT CREATING FUNNELS? IT'S A NIGHTMARE",

    problems: [
      { title: "4 to 8 hours wasted", desc: "Building manually on Systeme.io is a repetitive ordeal that drains your creative energy." },
      { title: "Slow loading", desc: "4-6 seconds natively. Every extra second = 7% of conversions lost." },
      { title: "Not mobile optimized", desc: "70% of your traffic comes from mobile, the drag-and-drop editor breaks everything." },
    ],

    solutionTag: "The solution",
    solutionTitle: "FUNNELFORGE GENERATES",
    solutionTitleHighlight: "YOUR PERFECT FUNNEL",
    before: "Before",
    after: "After FunnelFlow AI",
    beforeItems: ["4-8 hours per funnel", "Broken mobile responsive", "Generic copywriting", "4-6 seconds loading"],
    afterItems: ["5 minutes per funnel", "Mobile-first pixel-perfect", "AI CRO copywriting", "Under 1 second loading"],

    agentsTag: "Your AI team",
    agentsTitle: "YOUR AI TEAM",
    agentsTitleHighlight: "WORKING FOR YOU",
    agentsDesc: "4 specialized agents work in sequence. Each an expert in their field",
    agents: [
      { title: "Strategist", step: "01", desc: "Analyzes your market, audience and structures the conversion approach." },
      { title: "Copywriter", step: "02", desc: "Writes hooks, content blocks and CTAs calibrated to sell" },
      { title: "Designer", step: "03", desc: "Selects visual pack, palette and style suited to your offer" },
      { title: "Builder", step: "04", desc: "Assembles and exports the HTML ready to paste into Systeme.io" },
    ],

    benefitsTag: "A Glimpse of Your Arsenal",
    benefitsTitle: "EVERYTHING YOU NEED",
    benefitsTitleHighlight: "TO CONVERT",
    benefits: [
      { title: "Generation < 1 second", desc: "Complete funnel in under a minute, no waiting" },
      { title: "Perfect mobile-first", desc: "Pixel-perfect on all screens. 70% of your traffic is mobile" },
      { title: "CRO Copywriting", desc: "Every word is calibrated to convert, not just impress" },
      { title: "Systeme.io Export", desc: "HTML/CSS ready to paste into your space in 1 click" },
      { title: "AI email sequences", desc: "6 emails included by default: welcome, follow-up, nurturing" },
      { title: "30-day guarantee", desc: "Money-back guarantee. No commitment, no risk" },
    ],

    featuresTag: "Premium features",
    featuresTitle: "WHY FUNNELFORGE",
    featuresTitleHighlight: "DOMINATES SYSTEME.IO",
    features: [
      { title: "Systeme.io Export", desc: "HTML/CSS blocks ready to paste. Zero config" },
      { title: "URL Import", desc: "Structural analysis, faithful reproduction" },
      { title: "FR / EN native", desc: "Generate in both languages for your market" },
      { title: "100+ templates", desc: "Premium library for all niches" },
      { title: "Reseller Mode", desc: "Auto client brief + commissions on resales" },
      { title: "Visual editor", desc: "Edit visually or directly in the code" },
    ],

    testimonialsTag: "Testimonials",
    testimonialsTitle: "THEY FORGED",
    testimonialsTitleHighlight: "THEY CONVERTED",
    rating: "4.9/5 · 247+ verified reviews",
    testimonials: [
      { name: "Nadia Belkacem", role: "Personal development coach", quote: "First funnel in 7 minutes. My conversion rate jumped 38% in the first month.", stat: "+38% conv" },
      { name: "Carlos Hernandez", role: "Digital marketing trainer", quote: "I used to spend 8h on a page. Now 5 minutes, complete funnel, perfect mobile.", stat: "5 min/funnel" },
      { name: "Léa Fournier", role: "Yoga & wellness trainer", quote: "Zero technical skills. It's simpler than the native Systeme.io editor, stunning.", stat: "0 technical" },
    ],

    pricingTag: "Pricing",
    pricingTitle: "AN INVESTMENT",
    pricingTitleHighlight: "UNLIMITED RESULTS",
    pricingDesc: "Choose your plan. Start forging high-converting tunnels today",
    pricingPopular: "Most popular",
    pricingGuarantee: "30-day money-back guarantee · No commitment · Secure Stripe payment",
    pricing: [
      {
        name: "Starter",
        price: "$29",
        period: "/mo",
        desc: "To get started and validate your offer",
        features: ["3 AI funnels / month", "HTML export", "Basic templates", "Simple CRM", "Email support"],
        cta: "Launch my first funnel",
      },
      {
        name: "Pro",
        price: "$49",
        period: "/mo",
        desc: "For pros who want to scale.",
        features: ["10 AI funnels / month", "Systeme.io export", "AI regeneration", "Automated emails", "100+ templates", "Priority support"],
        cta: "Dominate with Pro",
      },
      {
        name: "Agency",
        price: "$97",
        period: "/mo",
        desc: "For agencies and freelancers",
        features: ["Unlimited funnels", "Unlimited URL import", "Simple workflows", "Client branding", "Team dashboard", "Dedicated 4h support"],
        cta: "Scale my agency",
      },
    ],

    templatesTag: "Templates",
    templatesTitle: "AVAILABLE",
    templatesTitleHighlight: "TEMPLATES",
    templatesDesc: "8 models for ebooks, coaching, courses and services",

    faqTag: "FAQ",
    faqTitle: "YOUR QUESTIONS",
    faqTitleHighlight: "OUR ANSWERS",
    faqCta: "Create my account",
    faqs: [
      { q: "Why FunnelFlow AI over the native Systeme.io editor?", a: "Save 4 to 8 hours per funnel. HTML loading in <1s (vs 4-6s native), mobile-first pixel-perfect, AI-generated CRO copywriting. The drag-and-drop editor becomes optional , you just paste the generated code" },
      { q: "How does AI generation work?", a: "Answer 9 questions about your offer, audience and goal. Your 4 AI agents (Strategist, Copywriter, Designer, Builder) forge a complete funnel in <1 minute. Edit if needed, then export" },
      { q: "Do I need technical skills?", a: "None. FunnelFlow AI generates 100% of the code. Copy-paste into a custom HTML block in Systeme.io — deployment in 30 seconds. The visual editor also lets you modify without touching the code" },
      { q: "Can I modify the funnel after generation?", a: "Yes, total freedom: integrated visual editor, direct HTML/CSS access, section-by-section AI regeneration. You're never locked into the initial result." },
      { q: "Does the URL import copy a third-party site?", a: "No. FunnelFlow AI only analyzes the structure (sections, hierarchy, intentions) for inspiration. Texts, images and branding are entirely original and generated for you" },
      { q: "Can I create funnels for my clients (agency)?", a: "The Agency plan includes automatic client brief, multi-account team dashboard, dedicated client branding and commissions on resales. Ideal for billing your funnels between $500 and $2,000 each" },
      { q: "What guarantees if I'm not satisfied?", a: "30-day money-back guarantee, no conditions, no commitment. Cancel in 1 click from your dashboard. Zero risk" },
      { q: "Does FunnelFlow AI work with tools other than Systeme.io?", a: "The standard HTML export is compatible with any CMS or page builder. The Systeme.io export (native blocks) is optimized for this platform, but the code also works on Webflow, Carrd, WordPress, etc" },
    ],

    ctaFinalTitle: "READY TO FORGE FUNNELS",
    ctaFinalTitleHighlight: "THAT CONVERT?",
    ctaFinalDesc: "Join 1,247+ entrepreneurs who replaced hours of struggle with 5 minutes of AI generation",
    ctaFinalPrimary: "Start now",
    ctaFinalSecondary: "Live demo",
    ctaFinalSetup: "5 min setup",
    ctaFinalGuarantee: "30-day guarantee",
    ctaFinalUnlimited: "Unlimited funnels",

    footerCgv: "Terms",
    footerPrivacy: "Privacy",

    previewTitle: "RESULT PREVIEW",
    previewDesc: "Desktop & mobile preview, publishing & exports",
    previewModify: "Edit",
    previewPublish: "Publish",
    previewExportHtml: "Export HTML/CSS",
    previewExportSysteme: "Export to Systeme.io",
    previewProductName: "Premium ebook conversion",
    previewProductDesc: "A premium page ready to convert your visitors into customers",
    previewExportBtn: "Export to Systeme.io",
    previewPlanTitle: "FUNNEL PLAN",
    previewPlanItems: ["Sales page", "Lead form", "Thank you page", "Emails", "Export"],
  },
};

const DYNAMIC_WORDS = ["CONVERTIT", "VEND", "PERFORME"];
const DYNAMIC_WORDS_EN = ["CONVERTS", "SELLS", "PERFORMS"];

const PROBLEM_ICONS = [Clock, TrendingUp, Smartphone];
const AGENT_ICONS = [Target, Wand2, Palette, FileCode2];
const BENEFIT_ICONS = [Gauge, Smartphone, MousePointerClick, FileCode2, Mail, Shield];
const FEATURE_ICONS = [Download, Upload, Globe2, Layers, Briefcase, Eye];
const TESTIMONIAL_COLORS = ["#31845C", "#C7A436", "#08498D"];

const PRICING_COLORS = ["#08498D", "#31845C", "#C7A436"];
const PRICING_POPULAR = [false, true, false];

function SectionTag({ children, color = "#31845C" }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5"
      style={{ background: `${color}20`, color, border: `1px solid ${color}35`, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

function AccentLine() {
  return <div className="mx-auto mt-4 h-px w-12 rounded-full" style={{ background: "linear-gradient(90deg,#31845C,#C7A436)" }} />;
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen(!open)} className="cursor-pointer border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
      <div className="flex items-center justify-between gap-4 py-5">
        <p style={{ fontSize: 15, fontWeight: 600, color: "#fff", lineHeight: 1.4 }}>{q}</p>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.22 }} className="shrink-0">
          <ChevronDown size={17} style={{ color: "#C7A436" }} />
        </motion.div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            <p className="pb-5 leading-relaxed" style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LandingPage() {
  const [wordIdx, setWordIdx] = useState(0);
  const [lang, setLang] = useState<"fr" | "en">("fr");

  const t = translations[lang];
  const dynamicWords = lang === "fr" ? DYNAMIC_WORDS : DYNAMIC_WORDS_EN;

  useEffect(() => {
    const interval = setInterval(() => setWordIdx(p => (p + 1) % dynamicWords.length), 2500);
    return () => clearInterval(interval);
  }, [lang]);

  const BG = "#080E1A";
  const CARD = "#0D1628";
  const BORDER = "rgba(255,255,255,0.07)";

  return (
    <main style={{ background: BG, color: "#fff", scrollBehavior: "smooth" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root { --green:#31845C; --gold:#C7A436; --blue:#08498D; --bg:#080E1A; }
        .ff-title { font-family:'Bebas Neue',sans-serif; letter-spacing:0.02em; }
        .ff-body { font-family:'DM Sans',sans-serif; }
        html { font-family:'DM Sans',sans-serif; }
        ::selection { background:#C7A43640; }
        .glow-gold { box-shadow:0 0 32px rgba(199,164,54,0.15); }
        .glow-green { box-shadow:0 0 32px rgba(49,132,92,0.15); }
        .card-hover { transition:transform 0.22s ease,box-shadow 0.22s ease; }
        .card-hover:hover { transform:translateY(-3px); box-shadow:0 12px 40px rgba(0,0,0,0.35); }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        .float { animation:float 4s ease-in-out infinite; }
        @keyframes spin-slow { to{transform:rotate(360deg)} }
        .spin { animation:spin-slow 1.2s linear infinite; }

        /* ── MOBILE RESPONSIVE ── */
        @media (max-width:640px){
          /* Header */
          .header-logo-text { display:none !important; }
          .header-cta-text { display:none !important; }
          .header-cta { padding: 8px 12px !important; }

          /* Hero */
          .hero-grid { grid-template-columns:1fr !important; gap: 2rem !important; }
          .hero-title { font-size:clamp(2.6rem,11vw,3.8rem) !important; }
          .hero-promise { text-align:center !important; }
          .hero-sub { text-align:center !important; font-size: 13px !important; }
          .hero-ctas { justify-content:center !important; flex-wrap: wrap; }
          .hero-card { width: 100% !important; }

          /* Hero preview card inner layout */
          .preview-inner-grid { grid-template-columns: 1fr !important; }
          .preview-plan-col { display: none !important; }
          .preview-buttons { flex-wrap: wrap !important; gap: 6px !important; }
          .preview-btn { font-size: 11px !important; padding: 6px 10px !important; }

          /* Section titles */
          .section-title { font-size:clamp(2rem,8.5vw,2.8rem) !important; }

          /* Grids */
          .pricing-grid { grid-template-columns:1fr !important; }
          .agents-grid { grid-template-columns:1fr 1fr !important; }
          .benefits-grid { grid-template-columns:1fr !important; }
          .features-grid { grid-template-columns:1fr 1fr !important; }
          .problems-grid { grid-template-columns:1fr !important; }
          .testi-grid { grid-template-columns:1fr !important; }
          .before-after { grid-template-columns:1fr !important; }
        }

        @media (min-width:641px) and (max-width:900px){
          .hero-grid { grid-template-columns:1fr 1fr !important; gap: 1.5rem !important; }
          .hero-title { font-size:clamp(2.2rem,5vw,3.2rem) !important; }
          .section-title { font-size:clamp(2rem,5vw,3rem) !important; }
          .agents-grid { grid-template-columns:1fr 1fr !important; }
          .pricing-grid { grid-template-columns:1fr !important; }
        }
      `}</style>

      {/* HEADER */}
      <header style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, boxShadow: "0 1px 20px rgba(0,0,0,0.4)" }} className="sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-3 sm:px-6 lg:px-8" style={{ gap: 8 }}>
          <a href="/" className="flex items-center gap-2 ff-body shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg ff-title" style={{ background: "linear-gradient(135deg,#31845C,#08498D)", fontSize: 12, color: "#fff", letterSpacing: 0, minWidth: 28 }}>
              FF
            </div>
            <span className="header-logo-text" style={{ fontWeight: 700, fontSize: 15, color: "#fff", fontFamily: "DM Sans, sans-serif" }}>
              FunnelFlow<span style={{ color: "#C7A436" }}> AI</span>
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-5">
            {[
              ["#features", t.navFeatures],
              ["#templates", t.navTemplates],
              ["#pricing", t.navPricing],
              ["#faq", t.navFaq],
              ["#", t.navLogin]
            ].map(([href, label]) => (
              <a key={href as string} href={href as string} style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.6)" }} className="hover:text-white transition-colors ff-body whitespace-nowrap">
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setLang(l => l === "fr" ? "en" : "fr")} className="flex items-center gap-1 rounded-full px-2.5 py-1.5 ff-body transition hover:opacity-80" style={{ background: "rgba(199,164,54,0.12)", border: "1px solid rgba(199,164,54,0.25)", color: "#C7A436", fontSize: 11, fontWeight: 700 }}>
              <Globe2 size={12} /> {lang.toUpperCase()}
            </button>
            <a href="#pricing" className="header-cta inline-flex items-center gap-1.5 rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 ff-body font-bold text-white transition hover:opacity-90 active:scale-95" style={{ background: "linear-gradient(135deg,#31845C,#08498D)", fontSize: 12 }}>
              <span className="header-cta-text">{t.ctaHeader}</span>
              <ArrowRight size={13} />
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden" style={{ background: `linear-gradient(140deg,#080E1A 0%,#0A1628 60%,#080E1A 100%)` }}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-40 -top-40 h-[600px] w-[600px] rounded-full opacity-10" style={{ background: "radial-gradient(circle,#C7A436,transparent 65%)" }} />
          <div className="absolute -bottom-20 -left-20 h-96 w-96 rounded-full opacity-8" style={{ background: "radial-gradient(circle,#31845C,transparent 65%)" }} />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 lg:px-8 lg:pb-28 lg:pt-24">
          <div className="hero-grid grid items-start gap-10" style={{ gridTemplateColumns: "1.1fr 0.9fr" }}>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="hero-promise">
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5" style={{ background: "rgba(199,164,54,0.12)", border: "1px solid rgba(199,164,54,0.28)", color: "#C7A436", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>
                <Sparkles size={11} /> {t.heroTag}
              </div>

              <h1 className="ff-title hero-title mt-5 leading-[0.95] text-white" style={{ fontSize: "clamp(2.6rem,6vw,5rem)" }}>
                {t.heroTitle}
                <br />
                {t.heroTitleEnd}
                <br />
                <AnimatePresence mode="wait">
                  <motion.span key={wordIdx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35 }} style={{ color: "#C7A436" }}>
                    {dynamicWords[wordIdx]}
                  </motion.span>
                </AnimatePresence>
              </h1>

              <p className="hero-sub mt-5 max-w-lg" style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>
                {t.heroDesc}
              </p>

              <div className="hero-ctas mt-8 flex flex-wrap gap-3">
                <a href="#pricing" className="group inline-flex items-center gap-2 rounded-lg px-7 py-3.5 font-bold" style={{ background: "#C7A436", color: "#080E1A", fontSize: 14 }}>
                  {t.ctaPrimary} <ArrowRight size={14} />
                </a>
                <a href="/login" className="inline-flex items-center gap-2 rounded-lg px-7 py-3.5 font-bold" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", fontSize: 14 }}>
                  {t.ctaSecondary}
                </a>
              </div>
            </motion.div>

            {/* Preview Card */}
            <motion.div className="hero-card" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
              <div className="rounded-2xl p-px" style={{ background: "linear-gradient(145deg,rgba(199,164,54,0.35),rgba(49,132,92,0.18),rgba(8,73,141,0.12))" }}>
                <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(8,73,141,0.25), rgba(199,164,54,0.2), rgba(49,132,92,0.25))", backdropFilter: "blur(6px)" }}>
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(13,22,40,0.7)" }}>
                    <div className="flex gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#31845C" }} />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#C7A436" }} />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#08498D" }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#C7A436" }}>Tunnel généré</span>
                  </div>

                  <div className="p-4 sm:p-6">
                    <div className="mb-4">
                      <h3 style={{ fontSize: "clamp(16px,3vw,24px)", fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>{t.previewTitle}</h3>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 5 }}>{t.previewDesc}</p>
                    </div>

                    <div className="preview-buttons mb-5 flex flex-wrap gap-2">
                      {[t.previewModify, t.previewPublish, t.previewExportHtml, t.previewExportSysteme].map((btn, index) => (
                        <div key={index} className="preview-btn rounded-xl px-3 py-1.5" style={{ background: index === 3 ? "#C7A436" : "rgba(255,255,255,0.06)", color: index === 3 ? "#08111F" : "#fff", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                          {btn}
                        </div>
                      ))}
                    </div>

                    <div className="preview-inner-grid grid gap-4" style={{ gridTemplateColumns: "1fr 140px" }}>
                      <div className="rounded-2xl p-4" style={{ background: "#050B15" }}>
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0" style={{ background: "#C7A436", color: "#08111F", fontWeight: 700, fontSize: 12 }}>FF</div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>FunnelFlow AI</p>
                        </div>

                        <span className="inline-block mt-3 rounded-full px-3 py-1" style={{ fontSize: 10, background: "rgba(199,164,54,0.12)", color: "#C7A436" }}>Tunnel vente ebook premium</span>

                        <h4 className="mt-4" style={{ fontSize: "clamp(18px,4vw,26px)", lineHeight: 1.05, fontWeight: 800, color: "#fff" }}>
                          {t.previewProductName}
                        </h4>

                        <p className="mt-3" style={{ fontSize: 12, color: "rgba(255,255,255,0.62)", lineHeight: 1.6 }}>
                          {t.previewProductDesc}
                        </p>

                        <div className="mt-5 rounded-xl py-2.5 text-center" style={{ background: "#C7A436", color: "#08111F", fontWeight: 700, fontSize: 12 }}>
                          {t.previewExportBtn}
                        </div>
                      </div>

                      <div className="preview-plan-col rounded-2xl p-3" style={{ background: "rgba(10,20,40,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: "#31845C", marginBottom: 12 }}>{t.previewPlanTitle}</p>
                        {t.previewPlanItems.map((item, index) => (
                          <div key={index} className="mb-2 flex items-center gap-2 rounded-xl p-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                            <div className="flex h-6 w-6 items-center justify-center rounded-full shrink-0" style={{ background: index === 4 ? "#31845C" : "#1F2937", color: "#fff", fontSize: 10, fontWeight: 700 }}>
                              {index + 1}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* PROBLEM SECTION */}
      <section className="py-20" style={{ background: CARD }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeInWhenVisible direction="up">
            <SectionTag color="#C7A436"><Clock size={11} /> {t.problemTag}</SectionTag>
            <h2 className="ff-title section-title mt-4" style={{ fontSize: "clamp(2rem,5vw,3.6rem)", color: "#fff" }}>
              {t.problemTitle}<br />
              <span style={{ color: "#C7A436" }}>{t.problemTitleHighlight}</span><br />
              {t.problemTitleEnd}
            </h2>
            <AccentLine />
          </FadeInWhenVisible>
        </div>
        <div className="mx-auto mt-12 max-w-5xl px-4 sm:px-6 lg:px-8 problems-grid grid gap-5" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          {t.problems.map((p, i) => {
            const Icon = PROBLEM_ICONS[i];
            return (
              <FadeInWhenVisible key={i} direction="up" delay={i * 0.1}>
                <div className="card-hover rounded-2xl p-6 h-full" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "rgba(220,38,38,0.12)" }}>
                    <Icon size={20} style={{ color: "#EF4444" }} />
                  </div>
                  <h3 className="ff-body font-bold mb-2" style={{ fontSize: 16, color: "#fff" }}>{p.title}</h3>
                  <p className="ff-body leading-relaxed" style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{p.desc}</p>
                </div>
              </FadeInWhenVisible>
            );
          })}
        </div>
      </section>

      {/* SOLUTION / BEFORE AFTER */}
      <section className="py-20" style={{ background: BG }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeInWhenVisible direction="up">
            <SectionTag color="#31845C"><Sparkles size={11} /> {t.solutionTag}</SectionTag>
            <h2 className="ff-title section-title mt-4" style={{ fontSize: "clamp(2rem,5vw,3.6rem)", color: "#fff" }}>
              {t.solutionTitle}<br />
              <span style={{ color: "#31845C" }}>{t.solutionTitleHighlight}</span>
            </h2>
            <AccentLine />
          </FadeInWhenVisible>
        </div>
        <div className="mx-auto mt-12 max-w-4xl px-4 sm:px-6 lg:px-8 before-after grid gap-5" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <FadeInWhenVisible direction="left" delay={0.1}>
            <div className="rounded-2xl p-7 h-full" style={{ background: "rgba(239,68,68,0.06)", border: "1.5px solid rgba(239,68,68,0.2)" }}>
              <p className="ff-body mb-5" style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.15em", color: "#EF4444", textTransform: "uppercase" }}>{t.before}</p>
              <ul className="space-y-3.5">
                {t.beforeItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 ff-body" style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
                    <span style={{ color: "#EF4444", fontWeight: 700, marginTop: 1 }}>✕</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          </FadeInWhenVisible>
          <FadeInWhenVisible direction="right" delay={0.2}>
            <div className="rounded-2xl p-7 h-full" style={{ background: "rgba(49,132,92,0.06)", border: "1.5px solid rgba(49,132,92,0.25)" }}>
              <p className="ff-body mb-5" style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.15em", color: "#31845C", textTransform: "uppercase" }}>{t.after}</p>
              <ul className="space-y-3.5">
                {t.afterItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 ff-body" style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
                    <CheckCircle2 size={16} style={{ color: "#31845C" }} className="mt-0.5 shrink-0" />{item}
                  </li>
                ))}
              </ul>
            </div>
          </FadeInWhenVisible>
        </div>
      </section>

      {/* AGENTS */}
      <section className="py-20" style={{ background: CARD }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeInWhenVisible direction="up">
            <SectionTag color="#C7A436"><Cpu size={11} /> {t.agentsTag}</SectionTag>
            <h2 className="ff-title section-title mt-4" style={{ fontSize: "clamp(2rem,5vw,3.6rem)", color: "#fff" }}>
              {t.agentsTitle}<br /><span style={{ color: "#C7A436" }}>{t.agentsTitleHighlight}</span>
            </h2>
            <AccentLine />
            <p className="ff-body mt-4 max-w-md mx-auto" style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>{t.agentsDesc}</p>
          </FadeInWhenVisible>
        </div>
        <div className="mx-auto mt-12 max-w-5xl px-4 sm:px-6 lg:px-8 agents-grid grid gap-4" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
          {t.agents.map((a, i) => {
            const Icon = AGENT_ICONS[i];
            return (
              <FadeInWhenVisible key={i} direction="up" delay={i * 0.1}>
                <div className="card-hover rounded-2xl p-6 text-center h-full" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: "linear-gradient(135deg,rgba(8,73,141,0.2),rgba(49,132,92,0.2))", border: `1px solid ${BORDER}` }}>
                    <Icon size={22} style={{ color: "#C7A436" }} />
                  </div>
                  <p className="ff-title" style={{ fontSize: 13, color: "rgba(199,164,54,0.6)", letterSpacing: "0.05em" }}>{a.step}</p>
                  <h3 className="ff-body font-bold mt-1" style={{ fontSize: 15, color: "#fff" }}>{a.title}</h3>
                  <p className="ff-body mt-2 leading-relaxed" style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{a.desc}</p>
                </div>
              </FadeInWhenVisible>
            );
          })}
        </div>
      </section>

      {/* BENEFITS */}
      <section id="features" className="py-20" style={{ background: BG }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeInWhenVisible direction="up">
            <SectionTag color="#08498D"><Award size={11} /> {t.benefitsTag}</SectionTag>
            <h2 className="ff-title section-title mt-4" style={{ fontSize: "clamp(2rem,5vw,3.6rem)", color: "#fff" }}>
              {t.benefitsTitle}<br /><span style={{ color: "#08498D" }}>{t.benefitsTitleHighlight}</span>
            </h2>
            <AccentLine />
          </FadeInWhenVisible>
        </div>
        <div className="mx-auto mt-12 max-w-5xl px-4 sm:px-6 lg:px-8 benefits-grid grid gap-4" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          {t.benefits.map(({ title, desc }, i) => {
            const Icon = BENEFIT_ICONS[i];
            return (
              <FadeInWhenVisible key={i} direction="up" delay={(i % 3) * 0.1}>
                <div className="card-hover rounded-xl p-5 h-full" style={{ background: CARD, border: `1px solid ${BORDER}`, borderLeft: "3px solid #C7A436" }}>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "rgba(49,132,92,0.12)" }}>
                    <Icon size={18} style={{ color: "#31845C" }} />
                  </div>
                  <h3 className="ff-body font-bold mb-1.5" style={{ fontSize: 14, color: "#fff" }}>{title}</h3>
                  <p className="ff-body leading-relaxed" style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{desc}</p>
                </div>
              </FadeInWhenVisible>
            );
          })}
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20" style={{ background: CARD }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeInWhenVisible direction="up">
            <SectionTag color="#31845C"><Layers size={11} /> {t.featuresTag}</SectionTag>
            <h2 className="ff-title section-title mt-4" style={{ fontSize: "clamp(2rem,5vw,3.6rem)", color: "#fff" }}>
              {t.featuresTitle}<br /><span style={{ color: "#31845C" }}>{t.featuresTitleHighlight}</span>
            </h2>
            <AccentLine />
          </FadeInWhenVisible>
        </div>
        <div className="mx-auto mt-12 max-w-5xl px-4 sm:px-6 lg:px-8 features-grid grid gap-4" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          {t.features.map(({ title, desc }, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <FadeInWhenVisible key={i} direction="up" delay={(i % 3) * 0.1}>
                <div className="card-hover rounded-2xl p-6 text-center h-full" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                  <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "rgba(49,132,92,0.1)", border: "1px solid rgba(49,132,92,0.2)" }}>
                    <Icon size={19} style={{ color: "#31845C" }} />
                  </div>
                  <h3 className="ff-body font-bold mb-1.5" style={{ fontSize: 14, color: "#fff" }}>{title}</h3>
                  <p className="ff-body leading-relaxed" style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{desc}</p>
                </div>
              </FadeInWhenVisible>
            );
          })}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-20" style={{ background: BG }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeInWhenVisible direction="up">
            <SectionTag color="#C7A436"><Users size={11} /> {t.testimonialsTag}</SectionTag>
            <h2 className="ff-title section-title mt-4" style={{ fontSize: "clamp(2rem,5vw,3.6rem)", color: "#fff" }}>
              {t.testimonialsTitle}<br /><span style={{ color: "#C7A436" }}>{t.testimonialsTitleHighlight}</span>
            </h2>
            <AccentLine />
          </FadeInWhenVisible>
        </div>
        <div className="mx-auto mt-12 max-w-5xl px-4 sm:px-6 lg:px-8 testi-grid grid gap-5" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          {t.testimonials.map((testimonial, i) => (
            <FadeInWhenVisible key={i} direction="up" delay={i * 0.12}>
              <div className="card-hover rounded-2xl p-6 h-full" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, k) => <Star key={k} size={13} fill="#C7A436" style={{ color: "#C7A436" }} />)}
                </div>
                <p className="ff-body italic leading-relaxed mb-5" style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>"{testimonial.quote}"</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="ff-body font-bold" style={{ fontSize: 14, color: "#fff" }}>{testimonial.name}</p>
                    <p className="ff-body mt-0.5" style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{testimonial.role}</p>
                  </div>
                  <span className="rounded-full px-3 py-1 ff-body" style={{ fontSize: 11, fontWeight: 700, background: `${TESTIMONIAL_COLORS[i]}18`, color: TESTIMONIAL_COLORS[i], border: `1px solid ${TESTIMONIAL_COLORS[i]}30` }}>{testimonial.stat}</span>
                </div>
              </div>
            </FadeInWhenVisible>
          ))}
        </div>
        <FadeInWhenVisible direction="up" delay={0.2}>
          <div className="text-center mt-8">
            <span className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 ff-body" style={{ fontSize: 11, fontWeight: 700, background: "rgba(199,164,54,0.12)", color: "#C7A436", border: "1px solid rgba(199,164,54,0.25)" }}>
              <Star size={11} fill="#C7A436" /> {t.rating}
            </span>
          </div>
        </FadeInWhenVisible>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-20" style={{ background: CARD }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeInWhenVisible direction="up">
            <SectionTag color="#C7A436"><BarChart3 size={11} /> {t.pricingTag}</SectionTag>
            <h2 className="ff-title section-title mt-4" style={{ fontSize: "clamp(2rem,5vw,3.6rem)", color: "#fff" }}>
              {t.pricingTitle}<br /><span style={{ color: "#C7A436" }}>{t.pricingTitleHighlight}</span>
            </h2>
            <AccentLine />
            <p className="ff-body mt-4 max-w-sm mx-auto" style={{ fontSize: 14, color: "rgba(255,255,255,0.45)" }}>{t.pricingDesc}</p>
          </FadeInWhenVisible>
        </div>

        <div className="mx-auto mt-12 max-w-5xl px-4 sm:px-6 lg:px-8 pricing-grid grid gap-5 items-stretch" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          {t.pricing.map((plan, i) => {
            const color = PRICING_COLORS[i];
            const popular = PRICING_POPULAR[i];
            return (
              <FadeInWhenVisible key={i} direction="up" delay={i * 0.1}>
                <div className={`flex ${popular ? 'relative' : ''} h-full`}>
                  {popular ? (
                    <div className="relative rounded-2xl overflow-hidden flex flex-col w-full glow-green" style={{ background: "linear-gradient(160deg,#0D2E1E 0%,#08192E 100%)", border: "1.5px solid rgba(49,132,92,0.45)" }}>
                      <div className="flex items-center justify-center gap-1.5 py-2.5 ff-body" style={{ background: "linear-gradient(90deg,#31845C,#1E6644)" }}>
                        <Rocket size={12} style={{ color: "#fff" }} />
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", letterSpacing: "0.1em", textTransform: "uppercase" }}>{t.pricingPopular}</span>
                      </div>
                      <div className="p-7 flex flex-col flex-1">
                        <p className="ff-body" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#31845C", marginBottom: 4 }}>{plan.name}</p>
                        <div className="flex items-end gap-1 mb-1">
                          <span className="ff-title leading-none" style={{ fontSize: 40, color: "#fff" }}>{plan.price}</span>
                          <span className="ff-body mb-1.5" style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>{plan.period}</span>
                        </div>
                        <p className="ff-body mb-6" style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{plan.desc}</p>
                        <div className="h-px mb-6" style={{ background: "rgba(255,255,255,0.08)" }} />
                        <ul className="space-y-3 flex-1 mb-8">
                          {plan.features.map((f, idx) => (
                            <li key={idx} className="flex items-start gap-2.5">
                              <CheckCircle2 size={14} style={{ color: "#31845C" }} className="mt-0.5 shrink-0" />
                              <span className="ff-body" style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{f}</span>
                            </li>
                          ))}
                        </ul>
                        <a href="/signup" className="block w-full rounded-xl py-3 text-center ff-body font-bold transition hover:opacity-90 active:scale-95" style={{ background: "#31845C", color: "#fff", fontSize: 13 }}>{plan.cta}</a>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl flex flex-col w-full card-hover" style={{ background: BG, border: `1px solid ${BORDER}` }}>
                      <div className="p-7 flex flex-col flex-1">
                        <p className="ff-body" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color, marginBottom: 4 }}>{plan.name}</p>
                        <div className="flex items-end gap-1 mb-1">
                          <span className="ff-title leading-none" style={{ fontSize: 40, color: "#fff" }}>{plan.price}</span>
                          <span className="ff-body mb-1.5" style={{ fontSize: 14, color: "rgba(255,255,255,0.35)" }}>{plan.period}</span>
                        </div>
                        <p className="ff-body mb-6" style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{plan.desc}</p>
                        <div className="h-px mb-6" style={{ background: "rgba(255,255,255,0.06)" }} />
                        <ul className="space-y-3 flex-1 mb-8">
                          {plan.features.map((f, idx) => (
                            <li key={idx} className="flex items-start gap-2.5">
                              <CheckCircle2 size={14} style={{ color }} className="mt-0.5 shrink-0" />
                              <span className="ff-body" style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{f}</span>
                            </li>
                          ))}
                        </ul>
                        <a href="/signup" className="block w-full rounded-xl py-3 text-center ff-body font-bold text-white transition hover:opacity-90 active:scale-95" style={{ background: color, fontSize: 13 }}>{plan.cta}</a>
                      </div>
                    </div>
                  )}
                </div>
              </FadeInWhenVisible>
            );
          })}
        </div>
        <FadeInWhenVisible direction="up" delay={0.3}>
          <p className="ff-body mt-7 flex items-center justify-center gap-2 text-center" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            <Shield size={12} /> {t.pricingGuarantee}
          </p>
        </FadeInWhenVisible>
      </section>

      {/* TEMPLATES */}
      <section id="templates" className="py-20" style={{ background: BG }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeInWhenVisible direction="up">
            <SectionTag color="#08498D"><Layers size={11} /> {t.templatesTag}</SectionTag>
            <h2 className="ff-title section-title mt-4" style={{ fontSize: "clamp(2rem,5vw,3.6rem)", color: "#fff" }}>
              {t.templatesTitle}<br /><span style={{ color: "#08498D" }}>{t.templatesTitleHighlight}</span>
            </h2>
            <AccentLine />
            <p className="ff-body mt-4 max-w-sm mx-auto" style={{ fontSize: 14, color: "rgba(255,255,255,0.45)" }}>{t.templatesDesc}</p>
          </FadeInWhenVisible>
        </div>

        <div className="mx-auto mt-10 max-w-7xl px-4 sm:px-6 lg:px-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {funnelTemplates.slice(0, 4).map((template, i) => (
            <FadeInWhenVisible key={template.id} direction="up" delay={i * 0.1}>
              <TemplateCard template={template} />
            </FadeInWhenVisible>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20" style={{ background: CARD }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <FadeInWhenVisible direction="up">
              <SectionTag color="#C7A436"><MessageCircle size={11} /> {t.faqTag}</SectionTag>
              <h2 className="ff-title section-title mt-4" style={{ fontSize: "clamp(2rem,5vw,3.6rem)", color: "#fff" }}>
                {t.faqTitle}<br /><span style={{ color: "#C7A436" }}>{t.faqTitleHighlight}</span>
              </h2>
              <AccentLine />
            </FadeInWhenVisible>
          </div>
          <FadeInWhenVisible direction="up" delay={0.15}>
            <div className="rounded-2xl px-6 py-2" style={{ background: BG, border: `1px solid ${BORDER}` }}>
              {t.faqs.map((faq, i) => (
                <FaqItem key={i} q={faq.q} a={faq.a} />
              ))}
            </div>
          </FadeInWhenVisible>
          <FadeInWhenVisible direction="up" delay={0.25}>
            <div className="text-center mt-10">
              <a href="/signup" className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 ff-body font-bold text-white transition hover:opacity-90 active:scale-95" style={{ background: "linear-gradient(135deg,#31845C,#08498D)", fontSize: 14 }}>
                {t.faqCta} <ArrowRight size={15} />
              </a>
            </div>
          </FadeInWhenVisible>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="relative overflow-hidden py-24" style={{ background: BG }}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-0 top-0 h-80 w-80 translate-x-1/3 -translate-y-1/4 rounded-full opacity-10" style={{ background: "radial-gradient(circle,#C7A436,transparent)" }} />
          <div className="absolute left-0 bottom-0 h-80 w-80 -translate-x-1/3 translate-y-1/4 rounded-full opacity-10" style={{ background: "radial-gradient(circle,#31845C,transparent)" }} />
        </div>
        <div className="relative mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeInWhenVisible direction="up">
            <h2 className="ff-title section-title font-black text-white" style={{ fontSize: "clamp(2rem,5vw,3.8rem)", lineHeight: 1.05 }}>
              {t.ctaFinalTitle}<br /><span style={{ color: "#C7A436" }}>{t.ctaFinalTitleHighlight}</span>
            </h2>
            <p className="ff-body mt-5" style={{ fontSize: 15, color: "rgba(255,255,255,0.55)" }}>{t.ctaFinalDesc}</p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <a href="#pricing" className="group inline-flex items-center gap-2 rounded-xl px-8 py-4 ff-body font-bold transition hover:opacity-90 active:scale-95" style={{ background: "#C7A436", color: "#080E1A", fontSize: 15 }}>
                <Sparkles size={16} /> {t.ctaFinalPrimary} <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </a>
              <a href="/login" className="inline-flex items-center gap-2 rounded-xl px-8 py-4 ff-body font-bold transition hover:bg-white/10" style={{ background: "rgba(255,255,255,0.07)", color: "#fff", border: "1px solid rgba(255,255,255,0.14)", fontSize: 15 }}>
                {t.ctaFinalSecondary}
              </a>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-6 ff-body" style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
              <span className="flex items-center gap-1.5"><Clock size={12} /> {t.ctaFinalSetup}</span>
              <span className="flex items-center gap-1.5"><Shield size={12} /> {t.ctaFinalGuarantee}</span>
              <span className="flex items-center gap-1.5"><Layers size={12} /> {t.ctaFinalUnlimited}</span>
            </div>
          </FadeInWhenVisible>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: CARD, borderTop: `1px solid ${BORDER}` }}>
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-7 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md ff-title" style={{ background: "linear-gradient(135deg,#31845C,#08498D)", fontSize: 10, color: "#fff" }}>FF</div>
            <span className="ff-body" style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>FunnelFlow <span style={{ color: "#C7A436" }}>AI</span></span>
          </div>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
            {[
              ["#features", t.navFeatures],
              ["#pricing", t.navPricing],
              ["#templates", t.navTemplates],
              ["#faq", t.navFaq],
              ["#", t.footerCgv],
              ["#", t.footerPrivacy]
            ].map(([href, label]) => (
              <a key={label as string} href={href as string} className="ff-body hover:text-[#C7A436] transition-colors" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                {label}
              </a>
            ))}
          </div>
          <p className="ff-body" style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>© 2026 FunnelFlow AI</p>
        </div>
      </footer>
    </main>
  );
}