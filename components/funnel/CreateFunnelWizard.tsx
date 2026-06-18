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
import { FunnelKindStep } from "@/components/funnel/wizard/FunnelKindStep";
import { MoodStep } from "@/components/funnel/wizard/MoodStep";
import { VideoStep } from "@/components/funnel/wizard/VideoStep";
import TemplateGalleryStep from "@/components/funnel/TemplateGalleryStep";
import {
  funnelTemplates,
  PREMIUM_TEMPLATES,
  DEFAULT_PREMIUM_TEMPLATE_ID,
  getPremiumTemplate,
} from "@/lib/funnels/templates";
import { getFunnelKind } from "@/lib/funnels/kinds";
import type {
  Funnel, FunnelBrief, Language, CtaConfig, CtaMode, ImageMode, FunnelKind, MediaItem, CopywritingPrefs,
} from "@/lib/funnels/types";
import { makeAnchorCta } from "@/lib/funnels/types";
import type { AiHealth } from "@/lib/ai/health";
import { useRouter } from "next/navigation";
import {
  createFunnelFromAi,
  FunnelStorageQuotaError,
  getStorageUsage,
} from "@/lib/store/funnelStore";
import { MediasStep } from "@/components/funnel/wizard/MediasStep";
import { CopywritingStep } from "@/components/funnel/wizard/CopywritingStep";

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
  primaryCta: makeAnchorCta("Recevoir l'offre", "lead-form"),
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
};

function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function CreateFunnelWizard() {
  const [step, setStep] = useState(0);
  const [mobileTab, setMobileTab] = useState<"form" | "preview">("form");
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
  const [expressPages, setExpressPages] = useState(4);
  const router = useRouter();

  const steps = useMemo<StepLabel[]>(() => {
    const kind = getFunnelKind(brief.funnelKind);
    const includeVideo = kind?.needsVideo === true;
    // Express IA : parcours allégé (le copy vient du prompt, le type est choisi
    // dans l'écran express) → on ne garde que thème, médias et finalisation.
    if (brief.creationMode === "express") {
      const express: StepLabel[] = ["Template", "Médias", "Visuels", "Ambiance", "Génération"];
      // Tunnel qui a besoin d'une vidéo (ex. webinaire) → on insère l'étape Vidéo.
      if (includeVideo) express.splice(1, 0, "Vidéo");
      return express;
    }
    return ALL_STEPS.filter((label) => label !== "Vidéo" || includeVideo);
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

  function selectKind(kind: FunnelKind) {
    const k = getFunnelKind(kind);
    updateMany({
      funnelKind: kind,
      funnelType:
        funnelTemplates.find((t) => t.id === k?.suggestedTemplateId)?.name ??
        brief.funnelType,
    });
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

      const response = await fetch("/api/ai/generate-funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brief),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const apiErr = data as ApiError;
        setErrorReason(apiErr.reason ?? "unknown");
        setErrorMessage(
          apiErr.message ??
          "La génération a échoué. Réessayez dans un instant ou vérifiez votre clé OpenAI"
        );
        setFunnel(null);
        return;
      }

      if (!data?.funnel) {
        setErrorReason("empty-response");
        setErrorMessage("La réponse du serveur est vide. Réessayez la génération");
        setFunnel(null);
        return;
      }

      const enrichedFunnel = {
        ...data.funnel,
        design: {
          ...data.funnel.design,
          primaryColor: brief.mainColor ?? data.funnel.design.primaryColor,
          secondaryColor: brief.secondaryColor ?? data.funnel.design.secondaryColor,
          style: brief.designStyle,
        },
      };

      setFunnel(enrichedFunnel);

      // ✅ FIX : on isole la persistance localStorage pour différencier
      // un échec de quota d'un échec réseau côté API.
      try {
        const stored = createFunnelFromAi(enrichedFunnel, brief);
        setSuccessMessage("Tunnel généré : redirection vers l'éditeur...");
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

      setErrorReason("network-error");
      setErrorMessage(
        "La connexion a été interrompue par le navigateur ou le serveur (Timeout). Nous avons optimisé la vitesse, réessayez une fois. Si cela persiste, vérifiez votre connexion internet."
      );
      setFunnel(null);
    } finally {
      setIsGenerating(false);
    }
  }

  const previewFunnelBase: Funnel = funnel ?? {
    funnelName: `${brief.brandName} — ${brief.offerName}`,
    language: brief.language,
    sections: [
      {
        id: "preview-hero",
        type: "hero",
        eyebrow: brief.funnelType,
        headline: capitalize(brief.promise),
        subheadline: `Un tunnel pensé pour ${brief.targetAudience}`,
        cta: brief.primaryCta,
        image: { mode: brief.defaultImageMode ?? "none" },
        visible: true,
      },
      ...(brief.aboutText
        ? [{
          id: "preview-about",
          type: "about" as const,
          eyebrow: "À propos",
          headline: brief.brandName,
          body: brief.aboutText,
          image: { mode: "none" as const },
          visible: true,
        }]
        : []),
      ...(brief.videoUrl
        ? [{
          id: "preview-video",
          type: "video" as const,
          eyebrow: "Présentation",
          headline: "Découvrez la méthode en quelques minutes",
          video: { provider: "url" as const, url: brief.videoUrl },
          image: { mode: "none" as const },
          visible: true,
        }]
        : []),
      {
        id: "preview-benefits",
        type: "benefits",
        eyebrow: "Aperçu",
        headline: "Le résultat sera personnalisé après génération IA",
        bullets: [
          "Cliquez sur Générer pour produire le copywriting réel",
          "Toutes les sections seront adaptées à votre offre",
          "L'aperçu actuel est une coquille structurelle",
        ],
        cta: brief.primaryCta,
        image: { mode: "none" },
        visible: true,
      },
    ],
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
            <p className="mt-1.5 text-sm text-muted">Décris ton activité en quelques phrases et choisis le nombre de pages. L'IA pré-remplit tout le tunnel, puis tu ajustes thème, visuels et médias.</p>
          </button>
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
        <Field label="Type de tunnel souhaité">
          <Select
            value={brief.funnelKind ?? ""}
            onChange={(e) => update("funnelKind", (e.target.value || undefined) as FunnelKind | undefined)}
          >
            <option value="">Laisser l'IA décider</option>
            <option value="lead-magnet">Aimant à leads — ebook / guide gratuit</option>
            <option value="digital-product">Produit digital — page de vente</option>
            <option value="coaching-high-ticket">Coaching / accompagnement haut de gamme</option>
            <option value="booking">Prise de rendez-vous / appel</option>
            <option value="webinar">Webinaire — inscription + replay</option>
            <option value="challenge">Challenge / défi</option>
          </Select>
        </Field>
        <Field label="Nombre de pages du tunnel généré">
          <Select value={String(expressPages)} onChange={(e) => setExpressPages(Number(e.target.value))}>
            <option value="1">1 page — capture simple</option>
            <option value="2">2 pages — capture + merci</option>
            <option value="3">3 pages — vente courte</option>
            <option value="4">4 pages — tunnel complet</option>
            <option value="5">5 pages — tunnel étendu</option>
            <option value="6">6 pages et plus</option>
          </Select>
        </Field>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted">{canGo ? "Tu pourras générer tout de suite — thème et visuels restent ajustables via les onglets." : "Ajoute encore quelques détails (20 caractères min.)."}</span>
          <Button
            disabled={!canGo}
            onClick={() => {
              updateMany({ creationMode: "express", businessPrompt: expressPrompt.trim(), pageCount: expressPages });
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
            onNext={() => setStep((v) => Math.min(steps.length - 1, v + 1))}
          />

          <div className="mt-5 animate-[slideIn_0.25s_ease-out] min-w-0" key={`${step}-${stepLabel}`}>
            {stepLabel === "Format" && (
              <FunnelKindStep
                language={brief.language}
                value={brief.funnelKind}
                onSelect={selectKind}
              />
            )}
            {stepLabel === "Template" && (
              <TemplateGalleryStep
                funnelKind={brief.funnelKind}
                language={brief.language}
                selectedTemplateId={brief.templateId}
                onSelect={selectTemplate}
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
              />
            )}
          </div>

          <div className="mt-6 sticky bottom-0 -mx-3 -mb-3 sm:static sm:mx-0 sm:mb-0 bg-white/95 backdrop-blur-sm border-t border-line sm:border-0 px-3 py-2 sm:px-0 sm:py-0 sm:bg-transparent xl:static z-10">
            <NavBar
              step={step}
              total={steps.length}
              onPrev={() => setStep((v) => Math.max(0, v - 1))}
              onNext={() => setStep((v) => Math.min(steps.length - 1, v + 1))}
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
                <Button href="/funnels/demo" variant="secondary">Démo</Button>
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

// ─── ÉTAPE FUSIONNÉE : Marque + Offre + À propos ───
function OfferStep({
  brief, update, logoPreview, setLogo,
}: {
  brief: FunnelBrief;
  update: <K extends keyof FunnelBrief>(k: K, v: FunnelBrief[K]) => void;
  logoPreview: string;
  setLogo: (dataUrl: string | undefined) => void;
}) {
  return (
    <div className="grid gap-5">
      <div>
        <h2 className="text-xl font-black text-ink">Ton offre</h2>
        <p className="mt-1 text-xs text-muted">
          Présente ta marque, ton produit et qui tu es. Ces infos guideront tout le copywriting du tunnel.
        </p>
      </div>

      {/* ── Bloc 1 : Marque ── */}
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

      {/* ── Bloc 2 : Offre ── */}
      <section className="grid gap-3 rounded-lg border border-line bg-white p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#C7A436]/15 text-[#C7A436]">
            <Package size={14} />
          </span>
          <h3 className="text-sm font-black uppercase tracking-wider text-ink">Offre</h3>
        </div>

        <Field label="Nom du produit ou service">
          <Input value={brief.offerName} onChange={(e) => update("offerName", e.target.value)} />
        </Field>

        <Field label="Prix">
          <Input value={brief.price} onChange={(e) => update("price", e.target.value)} placeholder="49€, 297€, Gratuit..." />
        </Field>

        <Field label="Lien de paiement (optionnel)" hint="Stripe Payment Link, page de paiement systeme.io, etc. Si renseigné, le bouton de l'offre redirige vers ce lien pour encaisser.">
          <Input value={brief.paymentUrl ?? ""} onChange={(e) => update("paymentUrl", e.target.value)} placeholder="https://buy.stripe.com/..." />
        </Field>

        <Field label="Promesse principale">
          <Textarea
            value={brief.promise}
            onChange={(e) => update("promise", e.target.value)}
            placeholder="Le bénéfice n°1 que ton client obtient grâce à ton offre"
            rows={3}
          />
        </Field>
      </section>

      {/* ── Bloc 3 : À propos ── */}
      <section className="grid gap-3 rounded-lg border border-line bg-white p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#31845C]/10 text-[#31845C]">
            <User size={14} />
          </span>
          <h3 className="text-sm font-black uppercase tracking-wider text-ink">À propos de toi</h3>
        </div>

        <Field label="Présente-toi en quelques lignes (optionnel)">
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
}: {
  templateName: string; templateObjective: string;
  isGenerating: boolean; onGenerate: () => void;
  onCheckHealth: () => Promise<AiHealth>;
  checkingHealth: boolean;
  health: AiHealth | null;
  successMessage: string;
  errorMessage: string;
  errorReason: string;
}) {
  useEffect(() => {
    if (!health && !checkingHealth) onCheckHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blocked =
    health?.reason === "missing-key" ||
    health?.reason === "invalid-key" ||
    health?.reason === "header-error";

  // ✅ FIX : titre et icône adaptés au type d'erreur
  const isStorageIssue = errorReason === "storage-full" || errorReason === "storage-error";

  return (
    <div className="grid gap-4">
      <h2 className="text-xl font-black">Génération</h2>
      <div className="rounded-lg bg-[#08498D]/5 border border-[#08498D]/20 p-4">
        <p className="font-bold text-[#08498D]">{templateName}</p>
        <p className="mt-1 text-xs leading-5 text-muted">{templateObjective}</p>
      </div>

      <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${health?.ok ? "border-[#31845C]/30 bg-[#31845C]/5 text-[#080E1A]" :
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
          <Sparkles size={16} /> {errorMessage ? "Réessayer la génération" : "Générer le tunnel"}
        </Button>
      )}

      {successMessage && !errorMessage && (
        <p className="rounded-lg bg-[#31845C]/10 p-3 text-xs font-semibold text-[#080E1A]">
          {successMessage}
        </p>
      )}

      {errorMessage && (
        <div className={`rounded-lg border p-3 ${isStorageIssue ? "border-amber-400/40 bg-amber-50" : "border-red/30 bg-red/5"}`}>
          <p className={`flex items-start gap-2 text-xs font-bold ${isStorageIssue ? "text-amber-700" : "text-red"}`}>
            {isStorageIssue ? <Database size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
            <span>
              {isStorageIssue ? "Stockage du navigateur saturé" : "La génération a échoué"}
            </span>
          </p>
          <p className={`mt-1 text-xs leading-relaxed ${isStorageIssue ? "text-amber-800" : "text-red/90"}`}>
            {errorMessage}
          </p>
          {isStorageIssue && (
            <p className="mt-2 text-xs leading-relaxed text-amber-800">
              👉 Allez dans <a href="/dashboard" className="underline font-bold">le tableau de bord</a> pour supprimer d'anciens tunnels, puis revenez sur cette page et cliquez sur <strong>Réessayer la génération</strong>.
            </p>
          )}
          {errorReason && (
            <p className={`mt-2 text-[10px] uppercase tracking-wider font-bold ${isStorageIssue ? "text-amber-700/80" : "text-red/70"}`}>
              Code: {errorReason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
