"use client";

// app/(app)/galerie/page.tsx
// 🆕 GALERIE COMMUNAUTAIRE — modèles partagés par les créateurs. Tout le monde
// peut parcourir ; « Utiliser » clone le modèle dans un nouveau tunnel (nécessite
// un abonnement, géré par le gating d'action). Chaque carte affiche un aperçu
// LIVE (miniature) du modèle + un bouton « Aperçu » plein écran.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Users2, Flag, Loader2, ArrowRight, ExternalLink, Heart } from "lucide-react";
import { AppShell } from "@/components/dashboard/AppShell";
import { handlePlanGate } from "@/lib/billing/planGate";
import { queueCelebration } from "@/components/ui/Celebration";

type Template = {
  id: string;
  owner_name: string;
  name: string;
  description: string | null;
  funnel_kind: string | null;
  language: string | null;
  usage_count: number;
  like_count: number;
  featured: boolean;
};

const KIND_LABELS: Record<string, string> = {
  "lead-magnet": "Lead magnet",
  webinar: "Webinaire",
  "digital-product": "Produit digital",
  booking: "Réservation",
  "coaching-high-ticket": "Coaching",
  challenge: "Challenge",
};

// ─────────────────────────────────────────────────────────────────────────────
// Miniature LIVE : iframe de la page de preview du modèle, rendue en 1200px puis
// scalée à la largeur de la carte (on ne montre que le haut du tunnel).
// ─────────────────────────────────────────────────────────────────────────────
const DESIGN_W = 1200;
const THUMB_H = 188;

function TemplateThumb({ id, name }: { id: string; name: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.offsetWidth;
      if (w > 0) setScale(w / DESIGN_W);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden border-b border-line bg-white"
      style={{ height: THUMB_H }}
    >
      <iframe
        src={`/templates/${id}/preview?thumb=1`}
        title={`Aperçu de ${name}`}
        loading="lazy"
        scrolling="no"
        tabIndex={-1}
        aria-hidden
        style={{
          width: DESIGN_W,
          height: THUMB_H / scale,
          border: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      />
      {/* Voile transparent : bloque toute interaction avec la miniature. */}
      <div className="absolute inset-0" />
    </div>
  );
}

export default function GaleriePage() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());
  // 🆕 Likes : ids likés par l'utilisateur + compteurs (init depuis la liste).
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const router = useRouter();

  useEffect(() => {
    fetch("/api/templates/gallery")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list = (d?.templates as Template[]) ?? [];
        setTemplates(list);
        setLikeCounts(Object.fromEntries(list.map((t) => [t.id, t.like_count ?? 0])));
      })
      .catch(() => setTemplates([]));
    // État « déjà liké » de l'utilisateur courant.
    fetch("/api/templates/likes")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setLiked(new Set((d?.likedIds as string[]) ?? [])))
      .catch(() => {});
  }, []);

  async function toggleLike(id: string) {
    // Optimiste : on bascule tout de suite, on réconcilie avec la réponse.
    const wasLiked = liked.has(id);
    setLiked((s) => {
      const n = new Set(s);
      if (wasLiked) n.delete(id);
      else n.add(id);
      return n;
    });
    setLikeCounts((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + (wasLiked ? -1 : 1)) }));
    try {
      const res = await fetch(`/api/templates/${id}/like`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) {
        // Non connecté : on annule l'optimisme et on invite à se connecter.
        setLiked((s) => {
          const n = new Set(s);
          if (wasLiked) n.add(id);
          else n.delete(id);
          return n;
        });
        setLikeCounts((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + (wasLiked ? 1 : -1)) }));
        setNotice("Connecte-toi pour aimer un modèle.");
        return;
      }
      if (json?.ok) {
        setLiked((s) => {
          const n = new Set(s);
          if (json.liked) n.add(id);
          else n.delete(id);
          return n;
        });
        if (typeof json.like_count === "number") {
          setLikeCounts((c) => ({ ...c, [id]: json.like_count }));
        }
      }
    } catch {
      /* réseau : on garde l'état optimiste */
    }
  }

  // ⚠️ NE PAS renommer en `useTemplate…` : ce n'est PAS un hook React mais un
  // gestionnaire de clic. Le préfixe `use` faisait échouer la règle
  // react-hooks/rules-of-hooks (« hook appelé dans un callback »), qui l'avait
  // pris pour un hook du fait de son seul nom.
  async function applyTemplate(id: string) {
    if (busyId) return;
    setBusyId(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/templates/${id}/use`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (handlePlanGate(res.status, json, (m) => setNotice(`${m.title}. ${m.description}`))) return;
      if (!res.ok || !json.ok) {
        setNotice(json.message || json.error || "Impossible d'utiliser ce modèle.");
        return;
      }
      queueCelebration({
        level: "m",
        title: "Modèle ajouté à ton compte ✨",
        message: "Il est prêt à être personnalisé. À toi de jouer !",
      });
      router.push(`/editor/${json.funnelId}`);
    } catch {
      setNotice("Connexion impossible. Réessaie.");
    } finally {
      setBusyId(null);
    }
  }

  async function report(id: string) {
    setReported((s) => new Set(s).add(id));
    try {
      await fetch(`/api/templates/${id}/report`, { method: "POST" });
    } catch {
      /* non bloquant */
    }
    setNotice("Merci, ce modèle a été signalé à la modération.");
  }

  return (
    <AppShell>
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700">
          <Sparkles size={12} /> Galerie communautaire
        </div>
        <h1 className="mt-3 text-2xl font-black text-ink sm:text-3xl">
          Modèles partagés par la communauté
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted">
          Choisis un modèle créé par un autre utilisateur et génère ton tunnel à partir de sa
          structure. Tu pourras tout modifier ensuite.
        </p>
      </div>

      {notice && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {notice}
        </div>
      )}

      {templates === null ? (
        <div className="flex items-center gap-2 py-16 text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement des modèles…
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-muted">
          Aucun modèle partagé pour l&apos;instant. Sois le premier à en partager un depuis
          l&apos;éditeur d&apos;un de tes tunnels !
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="ff-card-hover group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-gold/50"
            >
              {/* Miniature live du modèle */}
              <div className="relative">
                <TemplateThumb id={t.id} name={t.name} />
                <a
                  href={`/templates/${t.id}/preview`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Voir l'aperçu complet"
                  className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] font-semibold text-white opacity-0 backdrop-blur transition group-hover:opacity-100"
                >
                  <ExternalLink size={12} /> Aperçu
                </a>
              </div>

              <div className="flex flex-1 flex-col p-4">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {t.funnel_kind && (
                    <span className="rounded-full bg-canvas px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                      {KIND_LABELS[t.funnel_kind] ?? t.funnel_kind}
                    </span>
                  )}
                  {t.featured && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                      À la une
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-ink">{t.name}</h3>
                {t.description && (
                  <p className="mt-1.5 line-clamp-3 flex-1 text-sm text-muted">{t.description}</p>
                )}
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
                  <Users2 size={12} /> Partagé par{" "}
                  <span className="font-semibold text-ink/70">{t.owner_name || "un créateur"}</span>
                  <span className="mx-1">·</span>
                  {t.usage_count} utilisation{t.usage_count > 1 ? "s" : ""}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applyTemplate(t.id)}
                    disabled={busyId === t.id}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-xs font-bold text-zinc-950 transition hover:opacity-90 disabled:opacity-50"
                  >
                    {busyId === t.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Utiliser ce modèle <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                  <a
                    href={`/templates/${t.id}/preview`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Aperçu complet"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition hover:border-gold/50 hover:text-ink"
                  >
                    <ExternalLink size={14} />
                  </a>
                  <button
                    type="button"
                    onClick={() => toggleLike(t.id)}
                    title={liked.has(t.id) ? "Ne plus aimer" : "J'aime ce modèle"}
                    aria-pressed={liked.has(t.id)}
                    className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-xs font-semibold transition ${
                      liked.has(t.id)
                        ? "border-red-200 bg-red-50 text-red-500"
                        : "border-line text-muted hover:border-red-300 hover:text-red-500"
                    }`}
                  >
                    <Heart size={14} className={liked.has(t.id) ? "fill-current" : ""} />
                    {(likeCounts[t.id] ?? 0) > 0 && <span>{likeCounts[t.id]}</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => report(t.id)}
                    disabled={reported.has(t.id)}
                    title="Signaler ce modèle"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition hover:border-red-300 hover:text-red-500 disabled:opacity-40"
                  >
                    <Flag size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
