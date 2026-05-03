"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Palette,
  Sparkles, Target, Upload, Link as LinkIcon, AnchorIcon,
  ImageOff, Image as ImageIcon, Wand2, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { LoaderIA } from "@/components/ui/LoaderIA";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";
import { LogoUploader } from "@/components/funnel/LogoUploader";
import { FunnelKindStep } from "@/components/funnel/wizard/FunnelKindStep";
import { MoodStep } from "@/components/funnel/wizard/MoodStep";
import { AboutStep } from "@/components/funnel/wizard/AboutStep";
import { VideoStep } from "@/components/funnel/wizard/VideoStep";
import { funnelTemplates } from "@/lib/funnels/templates";
import { getFunnelKind } from "@/lib/funnels/kinds";
import type {
  Funnel, FunnelBrief, Language, CtaConfig, CtaMode, ImageMode, FunnelKind,
} from "@/lib/funnels/types";
import { makeAnchorCta } from "@/lib/funnels/types";
import type { AiHealth } from "@/lib/ai/health";

const ALL_STEPS = [
  "Format", "Objectif", "Marque", "Offre", "Audience",
  "À propos", "Vidéo", "CTA", "Visuels", "Ambiance", "Génération",
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

export function CreateFunnelWizard() {
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState<FunnelBrief>(initialBrief);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [message, setMessage] = useState("");
  const [aiHealth, setAiHealth] = useState<AiHealth | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  const steps = useMemo<StepLabel[]>(() => {
    const kind = getFunnelKind(brief.funnelKind);
    const includeVideo = kind?.needsVideo === true;
    return ALL_STEPS.filter((label) => label !== "Vidéo" || includeVideo);
  }, [brief.funnelKind]);

  useEffect(() => {
    if (step >= steps.length) setStep(steps.length - 1);
  }, [steps.length, step]);

  const currentTemplate = useMemo(
    () => funnelTemplates.find((t) => t.id === brief.templateId)
       ?? funnelTemplates.find((t) => t.name === brief.funnelType)
       ?? funnelTemplates[1],
    [brief.funnelType, brief.templateId]
  );

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
      templateId: k?.suggestedTemplateId,
      funnelType: funnelTemplates.find((t) => t.id === k?.suggestedTemplateId)?.name ?? brief.funnelType,
    });
    setStep((v) => Math.min(v + 1, steps.length - 1));
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
        message: "Impossible de vérifier la clé IA. La génération démo sera utilisée si l'erreur persiste",
      };
      setAiHealth(fallback);
      return fallback;
    } finally {
      setCheckingHealth(false);
    }
  }

  async function generate() {
    setIsGenerating(true);
    setMessage("");
    try {
      const health = aiHealth ?? (await checkHealth());
      if (health.reason === "invalid-key") {
        setMessage(health.message);
        setIsGenerating(false);
        return;
      }
      const response = await fetch("/api/ai/generate-funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brief),
      });
      if (!response.ok) throw new Error("Generation failed");
      const data = await response.json();
      setFunnel({
        ...data.funnel,
        design: {
          ...data.funnel.design,
          primaryColor: brief.mainColor ?? data.funnel.design.primaryColor,
          secondaryColor: brief.secondaryColor ?? data.funnel.design.secondaryColor,
          style: brief.designStyle,
        },
      });
      setMessage("Tunnel généré : page, formulaire, page merci, emails et export sont prêts");
    } catch {
      setMessage("La génération externe n'est pas disponible, le mode démo local reste utilisable");
    } finally {
      setIsGenerating(false);
    }
  }

  const previewFunnel: Funnel = funnel ?? {
    funnelName: `${brief.brandName} — ${brief.offerName}`,
    language: brief.language,
    sections: [
      {
        id: "preview-hero",
        type: "hero",
        eyebrow: brief.funnelType,
        headline: `${brief.offerName} : ${brief.promise}`,
        subheadline: `Un tunnel pensé pour ${brief.targetAudience}, avec preuve, offre et CTA visible`,
        cta: brief.primaryCta,
        image: { mode: brief.defaultImageMode ?? "none" },
        visible: true,
      },
      ...(brief.aboutText
        ? [{
            id: "preview-about",
            type: "about" as const,
            eyebrow: "À propos",
            headline: "Un accompagnement aligné avec votre métier",
            body: brief.aboutText,
            image: { mode: "none" as const },
            visible: true,
          }]
        : []),
      {
        id: "preview-benefits",
        type: "benefits",
        eyebrow: "Conversion",
        headline: "Un parcours clair du premier clic à la décision",
        bullets: [
          "Page de vente structurée",
          "Formulaire lead",
          "Page de remerciement et emails",
          "Export systeme.io",
        ],
        cta: brief.primaryCta,
        image: { mode: brief.defaultImageMode ?? "none" },
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

  const stepLabel = steps[step];

  return (
    <div className="grid gap-5 animate-[fadeIn_0.4s_ease-out]">
      <Card className="p-3">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-11">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(index)}
              className={`rounded-lg px-2.5 py-2.5 text-left text-xs font-bold transition-all duration-200 ${
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
              {label}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,38%)_minmax(0,62%)] items-start">
        <Card className="p-5 min-w-0">
          <NavBar
            step={step}
            total={steps.length}
            onPrev={() => setStep((v) => Math.max(0, v - 1))}
            onNext={() => setStep((v) => Math.min(steps.length - 1, v + 1))}
          />

          <div className="mt-5 animate-[slideIn_0.25s_ease-out]" key={`${step}-${stepLabel}`}>
            {stepLabel === "Format" && (
              <FunnelKindStep
                language={brief.language}
                value={brief.funnelKind}
                onSelect={selectKind}
              />
            )}
            {stepLabel === "Objectif" && (
              <ObjectiveStep
                value={brief.funnelType}
                onSelect={(v) => { update("funnelType", v); setStep((s) => Math.min(s + 1, steps.length - 1)); }}
              />
            )}
            {stepLabel === "Marque" && (
              <BusinessStep
                brief={brief}
                update={update}
                logoPreview={logoPreview}
                setLogo={setLogo}
              />
            )}
            {stepLabel === "Offre" && <OfferStep brief={brief} update={update} />}
            {stepLabel === "Audience" && <AudienceStep brief={brief} update={update} />}
            {stepLabel === "À propos" && (
              <AboutStep
                language={brief.language}
                value={brief.aboutText}
                onChange={(text) => update("aboutText", text)}
              />
            )}
            {stepLabel === "Vidéo" && (
              <VideoStep
                language={brief.language}
                videoUrl={brief.videoUrl}
                onChange={(url) => update("videoUrl", url)}
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
                onChange={(patch) => updateMany(patch)}
              />
            )}
            {stepLabel === "Génération" && (
              <GenerationStep
                templateName={currentTemplate.name}
                templateObjective={currentTemplate.objective}
                isGenerating={isGenerating}
                onGenerate={generate}
                onCheckHealth={checkHealth}
                checkingHealth={checkingHealth}
                health={aiHealth}
                message={message}
              />
            )}
          </div>

          <div className="mt-6">
            <NavBar
              step={step}
              total={steps.length}
              onPrev={() => setStep((v) => Math.max(0, v - 1))}
              onNext={() => setStep((v) => Math.min(steps.length - 1, v + 1))}
            />
          </div>
        </Card>

        <div className="grid gap-3 min-w-0">
          <Card className="p-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#C7A436]">Live preview</p>
                <h2 className="mt-1 truncate text-lg font-black text-ink">{brief.brandName}</h2>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {brief.funnelType} · {currentTemplate.sections.length} sections · {brief.language.toUpperCase()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button href="/funnels/demo" variant="secondary">Résultat</Button>
                <Button href="/export-systeme" variant="secondary">
                  <Upload size={14} /> Export
                </Button>
              </div>
            </div>
          </Card>

          <div className="xl:sticky xl:top-4">
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
            className={`rounded-lg border p-4 text-left transition-all duration-200 ${
              value === goal.value
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

function BusinessStep({
  brief, update, logoPreview, setLogo,
}: {
  brief: FunnelBrief;
  update: <K extends keyof FunnelBrief>(k: K, v: FunnelBrief[K]) => void;
  logoPreview: string;
  setLogo: (dataUrl: string | undefined) => void;
}) {
  return (
    <div className="grid gap-4">
      <h2 className="text-xl font-black">Marque et identité</h2>
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
    </div>
  );
}

function OfferStep({ brief, update }: { brief: FunnelBrief; update: <K extends keyof FunnelBrief>(k: K, v: FunnelBrief[K]) => void; }) {
  return (
    <div className="grid gap-4">
      <h2 className="text-xl font-black">Offre</h2>
      <Field label="Nom du produit ou service">
        <Input value={brief.offerName} onChange={(e) => update("offerName", e.target.value)} />
      </Field>
      <Field label="Prix">
        <Input value={brief.price} onChange={(e) => update("price", e.target.value)} />
      </Field>
      <Field label="Promesse principale">
        <Textarea value={brief.promise} onChange={(e) => update("promise", e.target.value)} />
      </Field>
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
      <Field label="Ton souhaité">
        <Select value={brief.tone} onChange={(e) => update("tone", e.target.value)}>
          <option value="premium">Premium</option>
          <option value="expert">Expert</option>
          <option value="chaleureux">Chaleureux</option>
          <option value="direct">Direct</option>
          <option value="storytelling">Storytelling</option>
        </Select>
      </Field>
    </div>
  );
}

function CtaStep({ brief, updateCta }: { brief: FunnelBrief; updateCta: (patch: Partial<CtaConfig>) => void; }) {
  const cta = brief.primaryCta ?? makeAnchorCta("Recevoir l'offre", "lead-form");
  const modes: { value: CtaMode; label: string; hint: string; icon: any; available: boolean }[] = [
    { value: "redirect", label: "Lien de redirection", hint: "Checkout, calendrier, page externe, WhatsApp", icon: LinkIcon, available: true },
    { value: "anchor", label: "Ancre interne", hint: "Faire défiler vers une section, par exemple le formulaire", icon: AnchorIcon, available: true },
    { value: "popup", label: "Popup intégrée", hint: "Ouvrir un formulaire en superposition", icon: Wand2, available: false },
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
              className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition-all duration-200 ${
                active ? "border-[#31845C] bg-[#31845C]/10 shadow-sm" :
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
          <Field label="URL de redirection">
            <Input value={cta.url ?? ""} onChange={(e) => updateCta({ url: e.target.value })} placeholder="https://votre-page-de-paiement.com" type="url" />
          </Field>
          <Field label="Ouverture du lien">
            <Select value={cta.target ?? "_blank"} onChange={(e) => updateCta({ target: e.target.value as "_self" | "_blank" })}>
              <option value="_blank">Nouvel onglet</option>
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
  const modes: { value: ImageMode; label: string; hint: string; icon: any }[] = [
    { value: "none", label: "Aucune image par défaut", hint: "Tunnel sobre et rapide, vous ajoutez les images section par section après génération", icon: ImageOff },
    { value: "ai-suggested", label: "Visuels recommandés par l'IA", hint: "Images libres de droits sélectionnées automatiquement selon le contexte", icon: Wand2 },
    { value: "upload", label: "Préparer des emplacements pour vos visuels", hint: "Le tunnel laisse des emplacements prêts à recevoir vos propres images", icon: ImageIcon },
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
              onClick={() => update("defaultImageMode", m.value)}
              className={`flex items-start gap-3 rounded-lg border p-3.5 text-left transition-all duration-200 ${
                active ? "border-[#31845C] bg-[#31845C]/10 shadow-sm" : "border-line bg-white hover:border-[#080E1A]/30"
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
  templateName, templateObjective, isGenerating, onGenerate, message,
  onCheckHealth, checkingHealth, health,
}: {
  templateName: string; templateObjective: string;
  isGenerating: boolean; onGenerate: () => void; message: string;
  onCheckHealth: () => Promise<AiHealth>;
  checkingHealth: boolean;
  health: AiHealth | null;
}) {
  useEffect(() => {
    if (!health && !checkingHealth) onCheckHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blocked = health?.reason === "invalid-key";

  return (
    <div className="grid gap-4">
      <h2 className="text-xl font-black">Génération</h2>
      <div className="rounded-lg bg-[#08498D]/5 border border-[#08498D]/20 p-4">
        <p className="font-bold text-[#08498D]">{templateName}</p>
        <p className="mt-1 text-xs leading-5 text-muted">{templateObjective}</p>
      </div>

      <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${
        health?.ok ? "border-[#31845C]/30 bg-[#31845C]/5 text-[#080E1A]" :
        blocked ? "border-red/30 bg-red/5 text-red" :
        "border-line bg-canvas text-muted"
      }`}>
        {health?.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#31845C]" /> :
         <AlertCircle size={14} className="mt-0.5 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            {checkingHealth ? "Vérification de la clé IA…" : health?.ok ? "Clé IA opérationnelle" : "Diagnostic IA"}
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
          <Sparkles size={16} /> Générer le tunnel
        </Button>
      )}

      {message && (
        <p className="rounded-lg bg-[#31845C]/10 p-3 text-xs font-semibold text-[#080E1A]">{message}</p>
      )}
    </div>
  );
}
