"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/dashboard/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Textarea, Select } from "@/components/ui/Field";
import { FunnelPreview } from "@/components/funnel/FunnelPreview";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useHistory } from "@/hooks/useHistory";
import { demoFunnel } from "@/lib/funnels/demo";
import {
  ArrowDown, ArrowUp, Check, Copy, Eye, EyeOff, Image as ImageIcon,
  ImageOff, Palette, Plus, RefreshCw, Save, Sparkles, Trash2, Type,
  Undo2, Redo2, Wand2,
} from "lucide-react";
import type {
  Funnel, FunnelSection, FunnelSectionType, ImageMode,
} from "@/lib/funnels/types";

const STORAGE_KEY_PREFIX = "ff:editor:funnel:";

const AVAILABLE_SECTION_TYPES: FunnelSectionType[] = [
  "hero", "about", "problem", "solution", "benefits", "proof",
  "offer", "bonus", "guarantee", "faq", "cta", "form",
  "program", "pricing", "process", "video", "qualification",
];

export default function EditorPage() {
  // Next.js 15 : useParams renvoie déjà un objet synchrone côté client
  const params = useParams<{ id: string }>();
  const funnelId = params?.id ?? "demo";
  const storageKey = `${STORAGE_KEY_PREFIX}${funnelId}`;

  const history = useHistory<Funnel>(demoFunnel, { limit: 30 });
  const funnel = history.state;

  const [selectedId, setSelectedId] = useState<string>(demoFunnel.sections[0]?.id ?? "");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"content" | "cta" | "image" | "style">("content");
  const [askDelete, setAskDelete] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Charge un funnel sauvegardé en localStorage (clé par id)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.sections)) {
          history.reset(parsed);
          setSelectedId(parsed.sections[0]?.id ?? "");
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Raccourcis clavier undo / redo / save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) { e.preventDefault(); history.undo(); }
      else if ((key === "z" && e.shiftKey) || key === "y") { e.preventDefault(); history.redo(); }
      else if (key === "s") { e.preventDefault(); save(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.undo, history.redo]);

  const selectedSection = useMemo(
    () => funnel.sections.find((s) => s.id === selectedId) ?? funnel.sections[0],
    [funnel.sections, selectedId]
  );

  function updateSection(id: string, patch: Partial<FunnelSection>) {
    history.commit((f) => ({
      ...f,
      sections: f.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }

  function moveSection(id: string, direction: -1 | 1) {
    history.commit((f) => {
      const idx = f.sections.findIndex((s) => s.id === id);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= f.sections.length) return f;
      const next = [...f.sections];
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...f, sections: next };
    });
  }

  function duplicateSection(id: string) {
    history.commit((f) => {
      const idx = f.sections.findIndex((s) => s.id === id);
      if (idx < 0) return f;
      const original = f.sections[idx];
      const copy: FunnelSection = { ...original, id: `${original.id}-copy-${Date.now()}` };
      const next = [...f.sections];
      next.splice(idx + 1, 0, copy);
      return { ...f, sections: next };
    });
  }

  function confirmDeleteSection(id: string) {
    history.commit((f) => ({ ...f, sections: f.sections.filter((s) => s.id !== id) }));
    setAskDelete(null);
  }

  function toggleVisibility(id: string) {
    history.commit((f) => ({
      ...f,
      sections: f.sections.map((s) =>
        s.id === id ? { ...s, visible: s.visible === false ? true : false } : s
      ),
    }));
  }

  function addSection(type: FunnelSectionType) {
    const id = `${type}-${Date.now().toString(36)}`;
    const newSection: FunnelSection = {
      id,
      type,
      headline: defaultHeadline(type),
      visible: true,
      image: { mode: "none" },
    };
    history.commit((f) => ({ ...f, sections: [...f.sections, newSection] }));
    setSelectedId(id);
    setShowAdd(false);
  }

  async function save() {
    setSaving(true);
    try {
      localStorage.setItem(storageKey, JSON.stringify(funnel));
      await new Promise((r) => setTimeout(r, 350));
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      {/* Barre haute */}
      <div className="flex items-start justify-between gap-4 mb-5 animate-[fadeIn_0.4s_ease-out]">
        <div className="min-w-0">
          <h1 className="text-3xl font-black text-ink truncate">Éditeur du tunnel</h1>
          <p className="mt-2 text-sm text-muted">
            Modifiez chaque section, gérez les visuels, ajustez les CTA et régénérez ce qui doit l'être
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {savedAt && (
            <span className="text-[11px] text-muted">
              Sauvegardé à {savedAt.toLocaleTimeString()}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={() => history.undo()} disabled={!history.canUndo}>
            <Undo2 className="h-4 w-4" /> Annuler
          </Button>
          <Button variant="ghost" size="sm" onClick={() => history.redo()} disabled={!history.canRedo}>
            <Redo2 className="h-4 w-4" /> Rétablir
          </Button>
          <Button variant="ghost" href={`/funnels/${funnelId}`}>
            <Eye className="h-4 w-4" />
            Aperçu
          </Button>
          <Button variant="secondary" onClick={save} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
          <Button variant="primary" href="/export-systeme">
            <Sparkles className="h-4 w-4" />
            Exporter
          </Button>
        </div>
      </div>

      {/* 3 colonnes : 220 / centre fluide / 420 */}
      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_420px] items-start">
        {/* Colonne 1 : sections */}
        <Card className="p-3 min-w-0">
          <div className="flex items-center justify-between px-1 mb-2">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted">
              Sections
            </p>
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="grid h-6 w-6 place-items-center rounded-md border border-line bg-white text-muted transition hover:border-[#08498D]/40 hover:text-ink"
              aria-label="Ajouter une section"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {showAdd && (
            <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg border border-line bg-canvas p-1 animate-[fadeIn_0.15s_ease-out]">
              {AVAILABLE_SECTION_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addSection(t)}
                  className="rounded-md bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted transition hover:bg-[#08498D]/10 hover:text-[#08498D]"
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          <ul className="space-y-1.5">
            {funnel.sections.map((section, index) => {
              const active = section.id === selectedId;
              const hidden = section.visible === false;
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(section.id)}
                    className={`w-full text-left rounded-lg p-2.5 border transition-all duration-150 ${
                      active
                        ? "border-[#08498D] bg-[#08498D]/5 ring-1 ring-[#08498D]/30"
                        : "border-line bg-white hover:border-[#08498D]/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-black text-muted shrink-0">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs font-bold truncate ${
                            hidden ? "text-muted line-through" : "text-ink"
                          }`}
                        >
                          {section.headline || section.eyebrow || section.type}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted">
                          {section.type}
                        </p>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 mt-1 px-1">
                    <IconBtn label="Monter" onClick={() => moveSection(section.id, -1)}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn label="Descendre" onClick={() => moveSection(section.id, 1)}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn
                      label={hidden ? "Afficher" : "Masquer"}
                      onClick={() => toggleVisibility(section.id)}
                    >
                      {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </IconBtn>
                    <IconBtn label="Dupliquer" onClick={() => duplicateSection(section.id)}>
                      <Copy className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn
                      label="Supprimer"
                      onClick={() => setAskDelete(section.id)}
                      danger
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconBtn>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Colonne 2 : éditeur */}
        <Card className="p-5 min-w-0">
          {selectedSection ? (
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted">
                    {selectedSection.type}
                  </p>
                  <h2 className="text-xl font-black text-ink truncate">
                    {selectedSection.headline || "Section sans titre"}
                  </h2>
                </div>
                <Button variant="secondary" size="sm">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Régénérer
                </Button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-canvas border border-line mb-5 overflow-x-auto">
                {[
                  { value: "content", label: "Contenu", icon: Type },
                  { value: "cta", label: "Bouton", icon: Wand2 },
                  { value: "image", label: "Image", icon: ImageIcon },
                  { value: "style", label: "Style", icon: Palette }
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTab(value as typeof tab)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 whitespace-nowrap ${
                      tab === value ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="min-w-0 animate-[fadeIn_0.2s_ease-out]" key={tab}>
                {tab === "content" && (
                  <ContentTab
                    section={selectedSection}
                    onChange={(patch) => updateSection(selectedSection.id, patch)}
                  />
                )}
                {tab === "cta" && (
                  <CtaTab
                    section={selectedSection}
                    onChange={(patch) => updateSection(selectedSection.id, patch)}
                  />
                )}
                {tab === "image" && (
                  <ImageTab
                    section={selectedSection}
                    onChange={(patch) => updateSection(selectedSection.id, patch)}
                  />
                )}
                {tab === "style" && (
                  <StyleTab
                    section={selectedSection}
                    onChange={(patch) => updateSection(selectedSection.id, patch)}
                  />
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Aucune section sélectionnée</p>
          )}
        </Card>

        {/* Colonne 3 : preview */}
        <div className="min-w-0 xl:sticky xl:top-4">
          <FunnelPreview funnel={funnel} viewportHeight={680} />
        </div>
      </div>

      <ConfirmDialog
        open={!!askDelete}
        tone="danger"
        title="Supprimer cette section ?"
        description="Vous pouvez annuler avec Ctrl/Cmd + Z juste après si nécessaire"
        confirmLabel="Supprimer"
        onConfirm={() => askDelete && confirmDeleteSection(askDelete)}
        onCancel={() => setAskDelete(null)}
      />
    </AppShell>
  );
}

function defaultHeadline(type: FunnelSectionType): string {
  const map: Record<FunnelSectionType, string> = {
    hero: "Titre principal de la page",
    about: "À propos de nous",
    problem: "Le problème que vous rencontrez",
    solution: "Notre approche",
    benefits: "Ce que vous obtenez",
    proof: "Ce qu'ils en disent",
    offer: "Notre offre",
    bonus: "Vos bonus",
    guarantee: "Notre garantie",
    faq: "Questions fréquentes",
    cta: "Passez à l'action",
    form: "Recevoir les détails",
    thank_you: "Merci",
    program: "Le programme",
    pricing: "Tarifs",
    process: "Notre processus",
    webinar: "Inscrivez-vous au webinaire",
    video: "Présentation en vidéo",
    qualification: "Êtes-vous éligible ?",
  };
  return map[type] ?? "Nouvelle section";
}

function IconBtn({
  children, onClick, label, danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`p-1.5 rounded-md border border-line bg-white hover:bg-canvas transition ${
        danger ? "text-[#B42318] hover:bg-[#B42318]/5 hover:border-[#B42318]/30" : "text-muted"
      }`}
    >
      {children}
    </button>
  );
}

/* ── Tabs ───────────────────────────────────────────── */

function ContentTab({
  section, onChange,
}: {
  section: FunnelSection;
  onChange: (patch: Partial<FunnelSection>) => void;
}) {
  return (
    <div className="grid gap-4 min-w-0">
      <Field label="Étiquette courte (optionnel)">
        <Input value={section.eyebrow ?? ""} onChange={(e) => onChange({ eyebrow: e.target.value })} />
      </Field>
      <Field label="Titre principal">
        <Textarea value={section.headline ?? ""} onChange={(e) => onChange({ headline: e.target.value })} rows={2} />
      </Field>
      <Field label="Sous-titre (optionnel)">
        <Textarea value={section.subheadline ?? ""} onChange={(e) => onChange({ subheadline: e.target.value })} rows={3} />
      </Field>
      <Field label="Texte (optionnel)">
        <Textarea value={section.body ?? ""} onChange={(e) => onChange({ body: e.target.value })} rows={4} />
      </Field>
      {Array.isArray(section.bullets) && (
        <Field label="Points clés">
          <div className="grid gap-2">
            {section.bullets.map((b, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={b}
                  onChange={(e) => {
                    const next = [...(section.bullets ?? [])];
                    next[i] = e.target.value;
                    onChange({ bullets: next });
                  }}
                />
                <button
                  type="button"
                  onClick={() => onChange({ bullets: section.bullets?.filter((_, j) => j !== i) })}
                  className="px-2 rounded-lg border border-line text-muted hover:text-[#B42318] hover:border-[#B42318]/30 transition shrink-0"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onChange({ bullets: [...(section.bullets ?? []), "Nouveau point"] })}
              className="text-xs font-bold text-[#08498D] hover:underline self-start"
            >
              + Ajouter un point
            </button>
          </div>
        </Field>
      )}
    </div>
  );
}

function CtaTab({
  section, onChange,
}: {
  section: FunnelSection;
  onChange: (patch: Partial<FunnelSection>) => void;
}) {
  const cta = section.cta ?? { label: "", mode: "anchor" as const, anchorId: "lead-form" };
  return (
    <div className="grid gap-4 min-w-0">
      <Field label="Texte du bouton">
        <Input value={cta.label} onChange={(e) => onChange({ cta: { ...cta, label: e.target.value } })} />
      </Field>
      <Field label="Comportement">
        <Select value={cta.mode} onChange={(e) => onChange({ cta: { ...cta, mode: e.target.value as any } })}>
          <option value="redirect">Redirection</option>
          <option value="anchor">Ancre interne</option>
          <option value="popup">Popup (à venir)</option>
        </Select>
      </Field>
      {cta.mode === "redirect" && (
        <>
          <Field label="URL">
            <Input type="url" value={cta.url ?? ""} onChange={(e) => onChange({ cta: { ...cta, url: e.target.value } })} placeholder="https://..." />
          </Field>
          <Field label="Ouverture">
            <Select value={cta.target ?? "_blank"} onChange={(e) => onChange({ cta: { ...cta, target: e.target.value as any } })}>
              <option value="_blank">Nouvel onglet</option>
              <option value="_self">Même onglet</option>
            </Select>
          </Field>
        </>
      )}
      {cta.mode === "anchor" && (
        <Field label="Ancre cible">
          <Input value={cta.anchorId ?? "lead-form"} onChange={(e) => onChange({ cta: { ...cta, anchorId: e.target.value.replace(/^#/, "") } })} />
        </Field>
      )}
    </div>
  );
}

function ImageTab({
  section, onChange,
}: {
  section: FunnelSection;
  onChange: (patch: Partial<FunnelSection>) => void;
}) {
  const image = section.image ?? { mode: "none" as ImageMode };

  function setMode(mode: ImageMode) {
    if (mode === "ai-suggested") {
      onChange({
        image: {
          mode,
          url: `https://picsum.photos/seed/${section.type}-${section.id}/960/540`,
          alt: section.headline ?? section.type,
        },
      });
    } else if (mode === "none") {
      onChange({ image: { mode: "none" } });
    } else {
      onChange({ image: { mode: "upload", url: image.url, alt: image.alt } });
    }
  }

  return (
    <div className="grid gap-4 min-w-0">
      <div className="grid grid-cols-3 gap-2">
        <ModeBtn active={image.mode === "none"} icon={ImageOff} label="Aucune" onClick={() => setMode("none")} />
        <ModeBtn active={image.mode === "ai-suggested"} icon={Wand2} label="IA" onClick={() => setMode("ai-suggested")} />
        <ModeBtn active={image.mode === "upload"} icon={ImageIcon} label="Upload" onClick={() => setMode("upload")} />
      </div>

      {image.mode !== "none" && image.url && (
        <div className="rounded-lg overflow-hidden border border-line max-w-full">
          <img src={image.url} alt={image.alt ?? ""} className="w-full h-44 object-cover" />
        </div>
      )}

      {image.mode === "upload" && (
        <Field label="URL de l'image">
          <Input value={image.url ?? ""} onChange={(e) => onChange({ image: { ...image, url: e.target.value } })} placeholder="https://..." />
        </Field>
      )}

      {image.mode !== "none" && (
        <Field label="Texte alternatif">
          <Input value={image.alt ?? ""} onChange={(e) => onChange({ image: { ...image, alt: e.target.value } })} />
        </Field>
      )}
    </div>
  );
}

function ModeBtn({
  active, icon: Icon, label, onClick,
}: {
  active: boolean;
  icon: any;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-bold transition-all duration-200 ${
        active ? "border-[#31845C] bg-[#31845C]/10 text-ink" : "border-line bg-white text-muted hover:border-[#08498D]/30"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function StyleTab({
  section, onChange,
}: {
  section: FunnelSection;
  onChange: (patch: Partial<FunnelSection>) => void;
}) {
  const style = section.style ?? {};
  return (
    <div className="grid gap-4 min-w-0">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Couleur du texte">
          <Input type="color" value={style.textColor ?? "#080E1A"} onChange={(e) => onChange({ style: { ...style, textColor: e.target.value } })} />
        </Field>
        <Field label="Couleur d'accent">
          <Input type="color" value={style.accentColor ?? "#C7A436"} onChange={(e) => onChange({ style: { ...style, accentColor: e.target.value } })} />
        </Field>
      </div>
      <Field label="Espacement vertical">
        <Select value={style.spacing ?? "default"} onChange={(e) => onChange({ style: { ...style, spacing: e.target.value as any } })}>
          <option value="compact">Compact</option>
          <option value="default">Standard</option>
          <option value="large">Aéré</option>
        </Select>
      </Field>
      <Field label="Alignement">
        <Select value={style.align ?? "left"} onChange={(e) => onChange({ style: { ...style, align: e.target.value as any } })}>
          <option value="left">À gauche</option>
          <option value="center">Centré</option>
          <option value="right">À droite</option>
        </Select>
      </Field>
      <Field label="Disposition">
        <Select value={style.layout ?? "text-only"} onChange={(e) => onChange({ style: { ...style, layout: e.target.value as any } })}>
          <option value="text-only">Texte seul</option>
          <option value="image-only">Image seule</option>
          <option value="text-image">Texte puis image</option>
          <option value="image-text">Image puis texte</option>
        </Select>
      </Field>
      <button
        type="button"
        onClick={() => onChange({ style: {} })}
        className="text-xs font-bold text-muted hover:text-ink self-start inline-flex items-center gap-1"
      >
        <Check className="h-3.5 w-3.5" /> Réinitialiser le style
      </button>
    </div>
  );
}
