"use client";

// components/chatbot/ChatWidget.tsx
//
// 🆕 CHATBOT IA — Widget de chat flottant (support automatique).
//
// COHABITE avec Tawk.to : Tawk.to est en bas à DROITE, ce widget est en bas à
// GAUCHE (aucune superposition). La position est facilement ajustable via
// WIDGET_CONFIG ci-dessous. Appelle la route serveur /api/chat (la clé et les
// modèles restent 100 % côté serveur).

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// ⚙️ POSITION / APPARENCE — ajuste ici librement.
//   side: "right" (position standard) ou "left".
//   offsetX/offsetY: distance aux bords (px).
// ─────────────────────────────────────────────────────────────────────────────
const WIDGET_CONFIG = {
  side: "right" as "left" | "right",
  offsetX: 20,
  offsetY: 20,
  title: "Assistant AutoFunnel",
  greeting: "Bonjour 👋 Je suis l'assistant AutoFunnel AI. Comment puis-je t'aider aujourd'hui ?",
  zIndex: 2147482000,
};

type Msg = { role: "user" | "assistant"; content: string };

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sideStyle =
    WIDGET_CONFIG.side === "left"
      ? { left: WIDGET_CONFIG.offsetX }
      : { right: WIDGET_CONFIG.offsetX };

  // Auto-scroll en bas à chaque nouveau message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const nextHistory = [...messages, { role: "user" as const, content: text }];
    setMessages(nextHistory);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // On envoie l'historique AVANT le nouveau message (le serveur ajoute
        // le message courant). Le serveur borne l'historique de son côté.
        body: JSON.stringify({ message: text, history: messages }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 429) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "Un instant 🙏 tu envoies un peu trop de messages d'un coup. Réessaie dans quelques secondes.",
          },
        ]);
        return;
      }
      const reply =
        (data && typeof data.reply === "string" && data.reply) ||
        "Désolé, une erreur est survenue. Réessaie dans un instant.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Connexion impossible pour le moment. Réessaie dans un instant.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="fixed" style={{ bottom: WIDGET_CONFIG.offsetY, ...sideStyle, zIndex: WIDGET_CONFIG.zIndex }}>
      {/* Fenêtre de conversation */}
      {open && (
        <div
          className="mb-3 flex w-[calc(100vw-2.5rem)] max-w-[380px] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl"
          style={{ height: "min(560px, calc(100vh - 7rem))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-line bg-ink px-4 py-3 text-white">
            <div className="flex items-center gap-2 min-w-0">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gold/20 text-gold">
                <Sparkles size={15} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{WIDGET_CONFIG.title}</p>
                <p className="truncate text-[11px] text-white/60">Réponses automatiques · IA</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer le chat"
              className="grid h-7 w-7 place-items-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-canvas p-3">
            {/* Message d'accueil (toujours affiché) */}
            <Bubble role="assistant" content={WIDGET_CONFIG.greeting} />
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} content={m.content} />
            ))}
            {loading && (
              <div className="flex items-center gap-1.5 px-1 text-xs text-muted">
                <Loader2 size={13} className="animate-spin" /> L'assistant écrit…
              </div>
            )}
          </div>

          {/* Saisie */}
          <div className="flex items-center gap-2 border-t border-line bg-white p-2.5">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Écris ta question…"
              className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-gold/60"
            />
            <button
              type="button"
              onClick={send}
              disabled={loading || !input.trim()}
              aria-label="Envoyer"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold text-zinc-950 transition hover:opacity-90 disabled:opacity-40"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      )}

      {/* Bulle flottante */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fermer l'assistant" : "Ouvrir l'assistant"}
        className="grid h-14 w-14 place-items-center rounded-full bg-ink text-white shadow-xl transition hover:scale-105"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "rounded-br-sm bg-ink text-white"
            : "rounded-bl-sm border border-line bg-white text-ink"
        }`}
      >
        {content}
      </div>
    </div>
  );
}

export default ChatWidget;
