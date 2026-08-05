"use client";

// components/editor/ShareTemplateButton.tsx
// 🆕 Partage le tunnel courant dans la GALERIE COMMUNAUTAIRE (réservé aux
// abonnés). Le contenu est assaini côté serveur (logo, liens perso, intégrations
// retirés) avant publication.

import { useState } from "react";
import { Share2, Loader2, Check, X } from "lucide-react";
import { useCelebrate } from "@/components/ui/Celebration";
import { loadFunnel } from "@/lib/store/funnelStore";
import { saveRemote } from "@/lib/store/funnelRepository";

/**
 * Messages lisibles pour chaque refus de la route de partage. Sans cette table,
 * la modale affichait le code brut (« not_found ») : le bêta-testeur en
 * concluait « le partage ne marche pas », sans savoir quoi faire.
 */
const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "Nom ou nom d'auteur invalide. Vérifie les champs et réessaie.",
  not_owner: "Seul le propriétaire d'un tunnel peut le partager.",
  unauthorized: "Ta session a expiré. Reconnecte-toi puis réessaie.",
  share_failed: "L'enregistrement dans la galerie a échoué. Réessaie dans un instant.",
};

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
  /** Phase « synchronisation du tunnel vers Supabase » avant l'appel de partage. */
  const [syncing, setSyncing] = useState(false);
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
      // ─────────────────────────────────────────────────────────────────────
      // 🆕 ÉTAPE 1 — GARANTIR LA PRÉSENCE DU TUNNEL CÔTÉ SERVEUR.
      //
      // C'est la cause du « je n'arrive pas à partager mon tunnel importé ».
      // Le partage lit le tunnel dans Supabase, or :
      //   - /api/clone-funnel ne persiste RIEN côté serveur (le tunnel est
      //     construit puis enregistré par le client) ;
      //   - `saveFunnel()` déclenche la synchro distante en tâche de fond, sans
      //     que personne ne l'attende ;
      //   - un tunnel importé est le plus lourd (jusqu'à ~2 Mo), donc le plus
      //     lent à remonter et le premier évincé par le quota localStorage.
      // Un utilisateur qui clone puis partage dans la foulée déclenchait donc
      // un 404 côté serveur.
      //
      // On force ici une synchro ATTENDUE (upsert idempotent) avant de
      // partager. Un échec n'interrompt pas : la ligne peut déjà exister côté
      // serveur — on garde la cause sous le coude pour le message d'erreur.
      let syncError: string | null = null;
      try {
        const stored = loadFunnel(funnelId);
        if (stored) {
          setSyncing(true);
          await saveRemote(stored);
        }
      } catch (e) {
        syncError = e instanceof Error ? e.message : String(e);
        console.warn("[share] synchronisation préalable impossible :", syncError);
      } finally {
        setSyncing(false);
      }

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

      // FILET DE SÉCURITÉ — le partage n'exige PLUS d'abonnement (la route ne
      // demande qu'une session valide). Ce cas ne devrait donc plus survenir ;
      // on le conserve au cas où une couche intermédiaire renverrait un 402,
      // pour ne jamais retomber sur un code brut illisible.
      //
      // Il reste traité SANS `handlePlanGate` : ce helper redirige vers
      // /abonnement au bout de 1,3 s, ce qui éjectait l'utilisateur de son
      // éditeur depuis une modale ouverte.
      if (res.status === 402 || json.error === "subscription_required") {
        setNeedsPlan(true);
        setMsg(null);
        return;
      }

      if (!res.ok || !json.ok) {
        // Le tunnel reste introuvable côté serveur MALGRÉ la synchro forcée :
        // c'est donc la synchro qui a échoué. On remonte sa cause réelle
        // (session expirée, RLS, quota…) plutôt qu'un « tunnel introuvable »
        // qui enverrait l'utilisateur chercher au mauvais endroit.
        if (json.error === "funnel_not_synced" && syncError) {
          setMsg(`Enregistrement du tunnel impossible : ${syncError}`);
          return;
        }
        setMsg(
          json.message ||
            ERROR_MESSAGES[json.error as string] ||
            json.error ||
            "Partage impossible.",
        );
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
                    {syncing
                      ? "Enregistrement du tunnel…"
                      : busy
                        ? "Partage…"
                        : "Partager dans la galerie"}
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
