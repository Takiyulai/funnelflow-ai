"use client";

// components/messaging/TelegramConnect.tsx
// 🆕 Onboarding de connexion du bot Telegram.
//
// PARTI PRIS D'ONBOARDING : l'utilisateur type est un solopreneur qui n'a
// jamais entendu parler de @BotFather. Un champ « collez votre jeton » sans
// contexte produirait un taux d'abandon massif. L'écran déroule donc les trois
// gestes dans l'ordre, avec le texte EXACT à taper — et dit d'emblée à quoi ça
// sert et ce que ça ne fait pas.

import { useState } from "react";
import { ArrowRight, Check, Copy, ExternalLink, Loader2, Send } from "lucide-react";

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      {/* `bg-inverse text-inverse-ink` et non `bg-ash-950 text-white` : le
          second donne un rond blanc au chiffre invisible en mode sombre. */}
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-inverse text-[11px] font-bold text-inverse-ink">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <div className="mt-1 text-xs leading-relaxed text-muted">{children}</div>
      </div>
    </li>
  );
}

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          },
          () => {},
        );
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-canvas px-2 py-1 font-mono text-[11px] text-ink transition hover:bg-ash-100"
    >
      {value}
      {copied ? <Check size={11} className="text-success-ink" /> : <Copy size={11} />}
    </button>
  );
}

export function TelegramConnect({ onConnected }: { onConnected: () => void }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/messaging/telegram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.message || "Connexion impossible.");
        return;
      }
      onConnected();
    } catch {
      setError("Connexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    /* Aligné à GAUCHE (et non `mx-auto`) : centrer cette carte pendant que le
       titre de page reste à gauche produisait le décalage visible signalé.
       Cf. components/ui/PageHeader.tsx. */
    <div className="max-w-2xl">
      <div className="rounded-xl border border-line bg-white p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-info-soft text-info-ink">
            <Send size={18} />
          </span>
          <div>
            <h2 className="text-base font-black text-ink">
              Discuter avec tes prospects sur Telegram
            </h2>
            <p className="text-xs text-muted">
              Leurs messages arrivent ici, tu réponds sans quitter AutoFunnel.
            </p>
          </div>
        </div>

        {/* Cadrage indispensable. La formulation compte : dire seulement « le
            bot ne peut pas écrire en premier » fait croire que le canal est
            inutilisable pour relancer sa base. Or la restriction ne porte QUE
            sur le tout premier contact — ensuite, aucune limite. */}
        <div className="mt-4 rounded-lg bg-canvas p-3 text-xs leading-relaxed text-muted">
          <strong className="text-ink">Comment ça marche :</strong> le prospect
          ouvre le dialogue en cliquant sur ton lien Telegram — depuis ton
          tunnel, ou depuis un email que tu lui envoies. Telegram interdit aux
          bots d&apos;écrire à quelqu&apos;un qui ne les a jamais contactés.
          <br />
          <strong className="text-ink">
            Mais une fois ce premier clic fait, la limite disparaît :
          </strong>{" "}
          tu peux lui écrire quand tu veux, autant que tu veux, sans fenêtre de
          temps et sans aucun coût — y compris en envoi groupé à tous ceux qui
          ont franchi ce pas. AutoFunnel génère pour chaque contact un lien
          personnalisé qui rattache automatiquement sa conversation à sa fiche
          CRM.
        </div>

        <ol className="mt-5 space-y-4">
          <Step n={1} title="Ouvre @BotFather sur Telegram">
            C&apos;est le robot officiel de Telegram qui crée les bots.{" "}
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-info-ink hover:underline"
            >
              Ouvrir BotFather <ExternalLink size={11} />
            </a>
          </Step>

          <Step n={2} title="Envoie-lui la commande de création">
            Écris <CopyChip value="/newbot" /> puis laisse-toi guider : il
            demande un nom d&apos;affichage, puis un identifiant qui doit se
            terminer par <span className="font-mono">bot</span> (par exemple{" "}
            <span className="font-mono">mamarque_support_bot</span>).
          </Step>

          <Step n={3} title="Copie le jeton qu'il te renvoie">
            BotFather répond avec une longue ligne du type{" "}
            <span className="font-mono">123456789:AAE...</span>. Copie-la{" "}
            <strong className="text-ink">en entier</strong> et colle-la
            ci-dessous. Elle vaut mot de passe : ne la partage avec personne.
          </Step>
        </ol>

        <div className="mt-5">
          <label className="mb-1.5 block text-xs font-semibold text-ink">
            Jeton du bot
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="123456789:AAE..."
            autoComplete="off"
            className="w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-sm text-ink outline-none focus:border-accent"
          />
          {error && (
            <p className="mt-2 text-xs text-danger-ink">{error}</p>
          )}
          {/* CTA principal : aplat d'accent + encre, conformément à la règle
              « l'or ne s'écrit pas sur du blanc » (cf. app/globals.css). Ce
              couple reste lisible dans les deux thèmes, contrairement à
              l'ancien `bg-ash-950 text-white` dont le libellé disparaissait en
              mode sombre. */}
          <button
            type="button"
            onClick={connect}
            disabled={busy || token.trim().length < 20}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-accent-contrast transition hover:opacity-90 disabled:opacity-40"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Connexion…
              </>
            ) : (
              <>
                Connecter mon bot <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TelegramConnect;
