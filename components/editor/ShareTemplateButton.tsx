"use client";

// components/editor/ShareTemplateButton.tsx
// 🆕 Partage le tunnel courant dans la GALERIE COMMUNAUTAIRE (réservé aux
// abonnés). Le contenu est assaini côté serveur (logo, liens perso, intégrations
// retirés) avant publication.

import { useState } from "react";
import { Share2, Loader2, Check, X } from "lucide-react";
import { useCelebrate } from "@/components/ui/Celebration";

export function ShareTemplateButton({
  funnelId,
  defaultName,
  defaultOwner,
}: {
  funnelId: string;
  defaultName?: string;
  defaultOwner?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName ?? "");
  const [owner, setOwner] = useState(defaultOwner ?? "");
  const [desc, setDesc] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  /** 🆕 Refus pour absence d'abonnement : affiché en place, sans redirection. */
  const [needsPlan, setNeedsPlan] = useState(false);
  const { celebrate } = useCelebrate();

  async function submit() {
    if (busy) return;
    if (!name.trim() || !owner.trim()) {
      setMsg("Renseigne un nom de modèle et ton nom d'auteur.");
      return;
    }
    if (!consent) {
      setMsg("Coche la case de consentement pour partager publiquement.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/templates/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          funnelId,
          name: name.trim(),
          description: desc.trim() || undefined,
          ownerName: owner.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));

      // 🆕 CAS DU FORFAIT — traité SANS `handlePlanGate` ici, volontairement.
      //
      // Le helper générique redirige vers /abonnement au bout de 1,3 s. Depuis
      // une modale ouverte, l'utilisateur voit un message fugace puis se
      // retrouve éjecté de son éditeur : c'est exactement ce que remontaient
      // les utilisateurs sans abonnement actif — « le partage ne marche pas »,
      // alors que le refus était intentionnel mais illisible.
      //
      // On affiche donc l'explication EN PLACE, avec un lien qu'il choisit de
      // suivre ou non, et sans lui faire perdre son travail en cours.
      if (res.status === 402 || json.error === "subscription_required") {
        setNeedsPlan(true);
        setMsg(null);
        return;
      }

      if (!res.ok || !json.ok) {
        setMsg(json.message || json.error || "Partage impossible.");
        return;
      }
      setDone(true);
      // 🆕 Micro-victoire : 1er partage communautaire = jalon (confettis).
      celebrate({
        level: "l",
        once: "first_share",
        emoji: "🤝",
        title: "Merci de contribuer !",
        message:
          "Ton modèle est désormais dans la galerie communautaire. Chaque utilisation le mettra en avant.",
      });
    } catch {
      setMsg("Connexion impossible. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setDone(false); setMsg(null); setNeedsPlan(false); }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300/30 bg-violet-300/10 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:border-violet-300/50"
        title="Partager ce tunnel comme modèle communautaire"
      >
        <Share2 size={14} /> Partager le modèle
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-white/50 hover:bg-white/5"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>

            {done ? (
              <div className="py-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <Check size={24} />
                </div>
                <h3 className="text-lg font-bold text-white">Modèle partagé !</h3>
                <p className="mt-1.5 text-sm text-white/50">
                  Il est désormais visible dans la Galerie communautaire sous ton nom.
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-5 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-white">Partager ce modèle</h3>
                <p className="mt-1 text-xs text-white/50">
                  La structure, le design et le copy sont partagés. Ton logo, tes liens perso
                  et intégrations sont automatiquement retirés.
                </p>
                <div className="mt-4 grid gap-3">
                  <label className="grid gap-1 text-xs font-medium text-white/70">
                    Nom du modèle
                    <input
                      value={name}
                      maxLength={120}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex. Tunnel webinaire coaching"
                      className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-300/50"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-white/70">
                    Ton nom d&apos;auteur (affiché publiquement)
                    <input
                      value={owner}
                      maxLength={80}
                      onChange={(e) => setOwner(e.target.value)}
                      placeholder="Ex. Dramane"
                      className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-300/50"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-white/70">
                    Description (optionnel)
                    <textarea
                      value={desc}
                      maxLength={400}
                      onChange={(e) => setDesc(e.target.value)}
                      rows={2}
                      placeholder="À qui / à quoi sert ce modèle ?"
                      className="resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-300/50"
                    />
                  </label>
                  <label className="flex items-start gap-2 text-xs text-white/60">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4"
                    />
                    J&apos;accepte de partager publiquement ce modèle sous mon nom dans la Galerie
                    communautaire.
                  </label>
                  {needsPlan && (
                    <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">
                      <strong className="block text-amber-50">
                        Un forfait actif est requis pour partager un modèle.
                      </strong>
                      <span className="mt-1 block">
                        Ton travail est conservé — ferme simplement cette fenêtre.
                      </span>
                      <a
                        href="/abonnement"
                        className="mt-2 inline-block font-semibold text-amber-200 underline underline-offset-2"
                      >
                        Voir les forfaits
                      </a>
                    </div>
                  )}
                  {msg && <p className="text-xs text-red-300">{msg}</p>}
                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy}
                    className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-violet-400 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 size={15} />}
                    {busy ? "Partage…" : "Partager dans la galerie"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default ShareTemplateButton;
