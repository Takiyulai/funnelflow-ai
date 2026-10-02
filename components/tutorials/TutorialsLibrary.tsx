"use client";

import { FormEvent, useEffect, useState } from "react";
import { ExternalLink, Loader2, Play, Plus, Trash2, Video } from "lucide-react";
import type { Tutorial } from "@/lib/tutorials";
import {
  isTellaVideoUrl,
  sortTutorialsOldestFirst,
  tutorialEmbedUrl,
  tutorialThumbnail,
} from "@/lib/tutorials";

type Draft = { title: string; description: string; videoUrl: string; thumbnailUrl: string };
const EMPTY: Draft = { title: "", description: "", videoUrl: "", thumbnailUrl: "" };

export function TutorialsLibrary({ isAdmin }: { isAdmin: boolean }) {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const draftEmbed = tutorialEmbedUrl(draft.videoUrl);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/tutorials", { cache: "no-store" }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) : {};
    if (response?.ok && data?.ok) {
      setTutorials(sortTutorialsOldestFirst(data.tutorials ?? []));
    }
    else setError(data?.message ?? "Impossible de charger les tutoriels.");
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    const response = await fetch("/api/tutorials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) : {};
    if (response?.ok && data?.ok) {
      setDraft(EMPTY);
      await load();
    } else setError(data?.message ?? "Création impossible.");
    setSaving(false);
  }

  async function remove(id: string) {
    if (!window.confirm("Supprimer définitivement ce tutoriel ?")) return;
    const response = await fetch(`/api/tutorials/${id}`, { method: "DELETE" });
    if (response.ok) setTutorials((current) => current.filter((item) => item.id !== id));
    else setError("Suppression impossible.");
  }

  return (
    <div className="space-y-6">
      {isAdmin && (
        <form onSubmit={create} className="rounded-2xl border border-[#C7A436]/30 bg-surface p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#C7A436]/15 text-[#9A7919]"><Plus size={19} /></span>
            <div>
              <h2 className="font-black text-ink">Ajouter un tutoriel</h2>
              <p className="text-xs text-muted">YouTube, Vimeo et Tella sont intégrés. Pour Tella, colle directement le lien d'intégration ou le code iframe fourni.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Titre du tutoriel" className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-[#C7A436]" />
            <input required type="text" value={draft.videoUrl} onChange={(event) => setDraft({ ...draft, videoUrl: event.target.value })} placeholder="Lien vidéo ou code iframe Tella" className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-[#C7A436]" />
            <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Ce que l'utilisateur apprendra…" className="min-h-24 rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-[#C7A436] md:col-span-2" />
            <input type="url" value={draft.thumbnailUrl} onChange={(event) => setDraft({ ...draft, thumbnailUrl: event.target.value })} placeholder="Image d'aperçu personnalisée (URL, facultatif)" className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-[#C7A436] md:col-span-2" />
            {draft.videoUrl.trim() && (
              <div className="md:col-span-2">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Aperçu de la vidéo</p>
                {draftEmbed ? (
                  <div className="aspect-video max-w-2xl overflow-hidden rounded-xl border border-line bg-[#0D1628]">
                    <iframe
                      src={draftEmbed}
                      title="Aperçu du tutoriel"
                      loading="lazy"
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <p className="rounded-xl border border-amber-300/50 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Ce lien ne permet pas encore d'afficher un lecteur intégré. Vérifie l'URL ou le code iframe copié.
                  </p>
                )}
              </div>
            )}
          </div>
          {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
          <button disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#C7A436] px-4 py-2.5 text-sm font-black text-[#080E1A] disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Publier le tutoriel
          </button>
        </form>
      )}

      {loading ? (
        <div className="grid min-h-48 place-items-center text-muted"><Loader2 className="animate-spin" /></div>
      ) : tutorials.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
          <Video className="mx-auto text-muted" />
          <p className="mt-3 font-bold text-ink">Aucun tutoriel publié pour le moment</p>
          <p className="mt-1 text-sm text-muted">Les prochaines vidéos apparaîtront ici.</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {tutorials.map((tutorial) => {
            const embed = tutorialEmbedUrl(tutorial.videoUrl);
            const thumbnail = tutorialThumbnail(tutorial);
            const active = playing === tutorial.id && embed;
            // Le lecteur Tella fournit nativement la miniature configurée dans
            // Tella. On le charge donc paresseusement dès l'affichage quand
            // aucune miniature personnalisée n'a été saisie, sans attendre le
            // premier clic comme pour YouTube/Vimeo.
            const showTellaPreview = !thumbnail && embed && isTellaVideoUrl(tutorial.videoUrl);
            return (
              <article key={tutorial.id} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                <div className="relative aspect-video bg-[#0D1628]">
                  {active || showTellaPreview ? (
                    <iframe src={embed} title={tutorial.title} loading="lazy" className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
                  ) : (
                    <button type="button" onClick={() => embed && setPlaying(tutorial.id)} className="group relative h-full w-full overflow-hidden" aria-label={`Lire ${tutorial.title}`}>
                      {thumbnail ? <img src={thumbnail} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" /> : <Video size={42} className="absolute inset-0 m-auto text-white/35" />}
                      <span className="absolute inset-0 bg-black/25 transition group-hover:bg-black/15" />
                      <span className="absolute inset-0 m-auto grid h-14 w-14 place-items-center rounded-full bg-[#C7A436] text-[#080E1A] shadow-xl"><Play size={22} fill="currentColor" /></span>
                    </button>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-black text-ink">{tutorial.title}</h2>
                    {isAdmin && <button type="button" onClick={() => void remove(tutorial.id)} aria-label="Supprimer" className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>}
                  </div>
                  {tutorial.description && <p className="mt-2 text-sm leading-relaxed text-muted">{tutorial.description}</p>}
                  {!embed && <a href={tutorial.videoUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[#08498D]">Ouvrir la vidéo <ExternalLink size={14} /></a>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
