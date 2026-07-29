"use client";

// components/messaging/MessagingInbox.tsx
// 🆕 Boîte de réception : liste des conversations à gauche, fil à droite.
//
// Le rafraîchissement se fait par sondage toutes les 15 s plutôt que par
// abonnement temps réel : les tables sont écrites par la clé service (le
// webhook), donc les événements Realtime de Supabase ne remonteraient pas
// nécessairement à travers RLS sans configuration supplémentaire. Un sondage
// simple est ici plus prévisible, et le volume de messages ne le justifie pas
// encore autrement.

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, MessageSquare, Send, Unplug } from "lucide-react";
import { TelegramConnect } from "@/components/messaging/TelegramConnect";

const POLL_MS = 15_000;

type Channel = {
  id: string;
  provider: string;
  username: string | null;
  display_name: string | null;
  status: string;
  last_error: string | null;
};

type Conversation = {
  id: string;
  display_name: string | null;
  username: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
};

type Message = {
  id: string;
  direction: "in" | "out";
  body: string | null;
  status: string;
  error: string | null;
  created_at: string;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function MessagingInbox() {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/messaging/conversations", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!json.ok) return;
      setChannel(json.channel as Channel | null);
      setConversations((json.conversations ?? []) as Conversation[]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadThread = useCallback(async (id: string) => {
    const res = await fetch(`/api/messaging/conversations/${id}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!json.ok) return;
    setMessages((json.messages ?? []) as Message[]);
    // La lecture remet le compteur à zéro côté serveur : on reflète localement
    // pour que la pastille disparaisse sans attendre le prochain sondage.
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)),
    );
  }, []);

  useEffect(() => {
    loadList();
    const t = setInterval(loadList, POLL_MS);
    return () => clearInterval(t);
  }, [loadList]);

  useEffect(() => {
    if (!activeId) return;
    loadThread(activeId);
    const t = setInterval(() => loadThread(activeId), POLL_MS);
    return () => clearInterval(t);
  }, [activeId, loadThread]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !activeId) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/messaging/conversations/${activeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.message || "Envoi échoué.");
      } else {
        setDraft("");
      }
      await loadThread(activeId);
      await loadList();
    } finally {
      setSending(false);
    }
  };

  const disconnect = async () => {
    await fetch("/api/messaging/telegram/connect", { method: "DELETE" });
    setChannel(null);
    setConversations([]);
    setActiveId(null);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-line bg-white p-10 text-center text-sm text-muted">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
        Chargement…
      </div>
    );
  }

  if (!channel) {
    return <TelegramConnect onConnected={loadList} />;
  }

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-0.5 font-bold uppercase tracking-wider text-success-ink">
            Connecté
          </span>
          {channel.username && <span className="font-mono">@{channel.username}</span>}
        </div>
        <button
          type="button"
          onClick={disconnect}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-danger hover:text-danger-ink"
        >
          <Unplug size={13} /> Déconnecter
        </button>
      </div>

      {channel.status === "error" && channel.last_error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-danger bg-danger-soft p-3 text-xs text-danger-ink">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span className="min-w-0">{channel.last_error}</span>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[300px_1fr]">
        {/* ── Conversations ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-line bg-white">
          {conversations.length === 0 ? (
            <div className="p-5 text-xs leading-relaxed text-muted">
              <MessageSquare size={20} className="mx-auto mb-2 opacity-40" />
              <p className="text-center">
                Aucune conversation pour l&apos;instant.
              </p>
              {channel.username && (
                <>
                  <p className="mt-3 font-semibold text-ink">
                    Pour tes futurs prospects
                  </p>
                  <p className="mt-0.5">
                    Ajoute ce lien sur ta page de remerciement :{" "}
                    <span className="font-mono text-ink">
                      t.me/{channel.username}
                    </span>
                  </p>
                  <p className="mt-3 font-semibold text-ink">
                    Pour tes contacts déjà en base
                  </p>
                  <p className="mt-0.5">
                    Envoie-leur un email contenant leur lien personnalisé
                    (bouton « Inviter sur Telegram » dans la fiche contact) :
                    leur conversation sera automatiquement rattachée à leur
                    fiche CRM dès le premier clic.
                  </p>
                </>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={`flex w-full items-start gap-2 px-3 py-2.5 text-left transition ${
                      activeId === c.id ? "bg-canvas" : "hover:bg-canvas"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-ink">
                          {c.display_name || "Contact"}
                        </span>
                        {c.unread_count > 0 && (
                          <span className="shrink-0 rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-contrast">
                            {c.unread_count}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted">
                        {c.last_message_preview || "—"}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] text-muted">
                      {timeAgo(c.last_message_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Fil ───────────────────────────────────────────────────────── */}
        <div className="flex min-h-[420px] flex-col rounded-xl border border-line bg-white">
          {!active ? (
            <div className="grid flex-1 place-items-center p-6 text-center text-xs text-muted">
              Sélectionne une conversation.
            </div>
          ) : (
            <>
              <div className="border-b border-line px-4 py-2.5">
                <p className="text-sm font-bold text-ink">
                  {active.display_name || "Contact"}
                </p>
                {active.username && (
                  <p className="font-mono text-[11px] text-muted">@{active.username}</p>
                )}
              </div>

              <div ref={threadRef} className="flex-1 space-y-2 overflow-y-auto p-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                        m.direction === "out"
                          ? m.status === "failed"
                            ? "bg-danger-soft text-danger-ink"
                            : // Paire inverse : bulle sortante lisible dans les
                              // deux thèmes (cf. --ff-inverse dans globals.css).
                              "bg-inverse text-inverse-ink"
                          : "bg-canvas text-ink"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className="mt-1 text-[10px] opacity-60">
                        {new Date(m.created_at).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {m.status === "failed" && " · non envoyé"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <p className="px-4 pb-1 text-[11px] text-danger-ink">{error}</p>
              )}

              <div className="flex items-end gap-2 border-t border-line p-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={2}
                  placeholder="Écris ta réponse… (Entrée pour envoyer)"
                  className="min-w-0 flex-1 resize-none rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={sending || !draft.trim()}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-contrast transition hover:opacity-90 disabled:opacity-40"
                  aria-label="Envoyer"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default MessagingInbox;
