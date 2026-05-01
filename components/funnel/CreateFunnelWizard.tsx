"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ImagePlus, Palette, Sparkles, Target, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { LoaderIA } from "@/components/ui/LoaderIA";
import { FunnelPreview } from "./FunnelPreview";
import { funnelTemplates } from "@/lib/funnels/templates";
import type { Funnel, FunnelBrief, Language } from "@/lib/funnels/types";

const steps = ["Objectif", "Business", "Offre", "Audience", "Design", "Génération"];

const initialBrief: FunnelBrief = {
  brandName: "Votre marque",
  offerName: "Ebook premium",
  price: "49€",
  targetAudience: "créateurs de produits digitaux",
  mainPain: "ils ont une offre intéressante mais leur page ne crée pas assez de confiance",
  promise: "transformer une expertise en tunnel prêt à vendre",
  tone: "premium",
  funnelType: "Vente ebook premium",
  designStyle: "premium",
  language: "fr"
};

const funnelGoals = [
  { label: "Capturer des leads", value: "Ebook gratuit lead magnet", hint: "Page de capture + merci + emails" },
  { label: "Vendre un produit", value: "Vente ebook premium", hint: "Page de vente + offre + garantie" },
  { label: "Vendre un service", value: "Service de création d’ebook", hint: "Process + preuve + prise de contact" },
  { label: "Réserver des appels", value: "Consultation gratuite", hint: "Qualification + CTA calendrier" }
];

const designPresets = [
  { label: "Logo Gold Black", primary: "#05070B", secondary: "#FFD84D", accent: "#1ECB83" },
  { label: "Navy Authority", primary: "#061B36", secondary: "#FFD84D", accent: "#28D6D6" },
  { label: "Prestige Export", primary: "#0A1020", secondary: "#D8A928", accent: "#1ECB83" }
];

export function CreateFunnelWizard() {
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState<FunnelBrief>(initialBrief);
  const [primaryColor, setPrimaryColor] = useState("#05070B");
  const [secondaryColor, setSecondaryColor] = useState("#FFD84D");
  const [accentColor, setAccentColor] = useState("#1ECB83");
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [message, setMessage] = useState("");

  const currentTemplate = useMemo(
    () => funnelTemplates.find((template) => template.name === brief.funnelType) ?? funnelTemplates[1],
    [brief.funnelType]
  );

  function update<K extends keyof FunnelBrief>(key: K, value: FunnelBrief[K]) {
    setBrief((current) => ({ ...current, [key]: value }));
  }

  function uploadLogo(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function generate() {
    setIsGenerating(true);
    setMessage("");
    try {
      const response = await fetch("/api/ai/generate-funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brief)
      });
      if (!response.ok) throw new Error("La génération n’a pas répondu correctement.");
      const data = await response.json();
      setFunnel({
        ...data.funnel,
        design: {
          ...data.funnel.design,
          primaryColor,
          secondaryColor,
          accentColor,
          style: brief.designStyle
        }
      });
      setMessage("Tunnel généré : page, formulaire, page merci, emails et export sont prêts en mode démo.");
    } catch {
      setMessage("La génération externe n’est pas disponible. Le mode démo local reste utilisable.");
    } finally {
      setIsGenerating(false);
    }
  }

  const previewFunnel = funnel ?? {
    funnelName: `${brief.brandName} - ${brief.offerName}`,
    language: brief.language,
    sections: [
      {
        id: "preview-hero",
        type: "hero" as const,
        eyebrow: brief.funnelType,
        headline: `${brief.offerName} : ${brief.promise}`,
        subheadline: `Un tunnel premium pour ${brief.targetAudience}, avec preuve, offre et CTA visible.`,
        cta: "Voir l’offre"
      },
      {
        id: "preview-benefits",
        type: "benefits" as const,
        eyebrow: "Conversion",
        headline: "Un parcours clair du premier clic à la conversion",
        bullets: ["Page de vente structurée", "Formulaire lead", "Merci + emails", "Export Systeme.io"]
      }
    ],
    thankYouPage: { headline: "Merci", body: "Votre demande est confirmée." },
    emails: [],
    seo: { title: brief.offerName, description: brief.promise },
    design: { primaryColor, secondaryColor, accentColor, style: brief.designStyle }
  };

  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-line bg-white p-3 shadow-sm">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {steps.map((label, index) => (
            <button key={label} type="button" onClick={() => setStep(index)} className={`rounded-lg px-3 py-3 text-left text-xs font-black transition ${index === step ? "bg-navy text-white" : index < step ? "bg-green/10 text-green" : "bg-canvas text-muted"}`}>
              <span className="mb-1 block text-[11px] opacity-80">0{index + 1}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[440px_1fr]">
        <Card className="p-5">
          <div className="mb-5 flex justify-between gap-3 rounded-lg bg-canvas p-2">
            <Button type="button" variant="secondary" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}><ArrowLeft size={18} />Retour</Button>
            <Button type="button" disabled={step === steps.length - 1} onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}>Suivant<ArrowRight size={18} /></Button>
          </div>

          {step === 0 ? (
            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <Target className="text-green" />
                <h2 className="text-2xl font-black">Objectif du tunnel</h2>
              </div>
              <div className="grid gap-3">
                {funnelGoals.map((goal) => (
                  <button key={goal.value} type="button" onClick={() => { update("funnelType", goal.value); setStep(1); }} className={`rounded-lg border p-4 text-left transition ${brief.funnelType === goal.value ? "border-green bg-green/10" : "border-line bg-white hover:border-navy/30"}`}>
                    <span className="flex items-center justify-between gap-3 font-black text-ink">{goal.label}{brief.funnelType === goal.value ? <CheckCircle2 className="text-green" size={18} /> : null}</span>
                    <span className="mt-1 block text-sm text-muted">{goal.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-4">
              <h2 className="text-2xl font-black">Business et marque</h2>
              <Field label="Nom de marque"><Input value={brief.brandName} onChange={(event) => update("brandName", event.target.value)} /></Field>
              <Field label="Logo">
                <label className="focus-ring flex min-h-28 cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed border-line bg-canvas p-4 text-sm font-bold text-muted">
                  {logoPreview ? <img src={logoPreview} alt="" className="h-16 w-16 rounded-lg object-cover" /> : <ImagePlus size={22} />}
                  <span>{logoPreview ? "Logo chargé, cliquez pour remplacer" : "Importer un logo"}</span>
                  <input className="hidden" type="file" accept="image/*" onChange={(event) => uploadLogo(event.target.files?.[0])} />
                </label>
              </Field>
              <Field label="Secteur"><Input placeholder="Coaching, ebook, formation..." /></Field>
              <Field label="Langue"><Select value={brief.language} onChange={(event) => update("language", event.target.value as Language)}><option value="fr">Français</option><option value="en">English</option></Select></Field>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-4">
              <h2 className="text-2xl font-black">Offre</h2>
              <Field label="Nom du produit/service"><Input value={brief.offerName} onChange={(event) => update("offerName", event.target.value)} /></Field>
              <Field label="Prix"><Input value={brief.price} onChange={(event) => update("price", event.target.value)} /></Field>
              <Field label="Promesse principale"><Textarea value={brief.promise} onChange={(event) => update("promise", event.target.value)} /></Field>
              <Field label="Bonus ou garantie"><Input placeholder="Ex : checklist, audit, satisfait ou accompagné" /></Field>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-4">
              <h2 className="text-2xl font-black">Audience</h2>
              <Field label="Client idéal"><Textarea value={brief.targetAudience} onChange={(event) => update("targetAudience", event.target.value)} /></Field>
              <Field label="Problème principal"><Textarea value={brief.mainPain} onChange={(event) => update("mainPain", event.target.value)} /></Field>
              <Field label="Ton souhaité"><Select value={brief.tone} onChange={(event) => update("tone", event.target.value)}><option>premium</option><option>expert</option><option>chaleureux</option><option>direct</option><option>storytelling</option></Select></Field>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <Palette className="text-green" />
                <h2 className="text-2xl font-black">Design premium</h2>
              </div>
              <div className="grid gap-3">
                {designPresets.map((preset) => (
                  <button key={preset.label} type="button" onClick={() => { setPrimaryColor(preset.primary); setSecondaryColor(preset.secondary); setAccentColor(preset.accent); }} className="flex items-center justify-between rounded-lg border border-line bg-white p-4 text-left hover:border-navy/30">
                    <span className="font-black">{preset.label}</span>
                    <span className="flex gap-1">
                      {[preset.primary, preset.secondary, preset.accent].map((color) => <span key={color} className="h-6 w-6 rounded-full border border-line" style={{ background: color }} />)}
                    </span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Noir"><Input type="color" value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} /></Field>
                <Field label="Or"><Input type="color" value={secondaryColor} onChange={(event) => setSecondaryColor(event.target.value)} /></Field>
                <Field label="Vert"><Input type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} /></Field>
              </div>
              <Field label="Style"><Select value={brief.designStyle} onChange={(event) => update("designStyle", event.target.value)}><option>premium</option><option>minimaliste</option><option>dynamique</option><option>corporate</option><option>créatif</option></Select></Field>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="grid gap-4">
              <h2 className="text-2xl font-black">Génération</h2>
              <div className="rounded-lg bg-softBlue p-4">
                <p className="font-black text-navy">{currentTemplate.name}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{currentTemplate.objective}</p>
              </div>
              {isGenerating ? <LoaderIA /> : <Button onClick={generate} type="button"><Sparkles size={18} />Générer le tunnel</Button>}
              {message ? <p className="rounded-lg bg-green/10 p-3 text-sm font-semibold text-navy">{message}</p> : null}
            </div>
          ) : null}

          <div className="mt-8 flex justify-between gap-3">
            <Button type="button" variant="secondary" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}><ArrowLeft size={18} />Retour</Button>
            <Button type="button" disabled={step === steps.length - 1} onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}>Suivant<ArrowRight size={18} /></Button>
          </div>
        </Card>

        <div className="grid gap-4">
          <Card className="p-5">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <p className="text-xs font-black uppercase text-green">Live preview</p>
                <h2 className="mt-1 text-2xl font-black text-ink">{brief.brandName}</h2>
                <p className="mt-1 text-sm text-muted">{brief.funnelType} · {currentTemplate.sections.length} sections · {brief.language.toUpperCase()}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button href="/funnels/demo" variant="secondary">Résultat</Button>
                <Button href="/export-systeme" variant="secondary"><Upload size={16} />Export</Button>
              </div>
            </div>
          </Card>
          <FunnelPreview funnel={previewFunnel} logoSrc={logoPreview} />
        </div>
      </div>
    </div>
  );
}
