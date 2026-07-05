"use client";

// 🆕 Formulaire de réinitialisation du mot de passe.
// Arrivée depuis le lien email Supabase : le client (@supabase/ssr) échange
// automatiquement le code présent dans l'URL contre une session de
// récupération. On attend cette session, puis updateUser({ password }).
// Gère aussi le cas lien expiré/invalide avec un renvoi vers /forgot-password.

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  borderColor: "rgba(255,255,255,0.12)",
  color: "#fff",
};

export function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Attendre la session de récupération (échange du code fait par le client).
  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();

    // 1) Échange explicite si un ?code= est présent (PKCE) — sans erreur si
    //    le client l'a déjà consommé automatiquement.
    const tryExchange = async () => {
      try {
        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          await supabase.auth.exchangeCodeForSession(code).catch(() => {});
        }
      } catch {
        /* no-op */
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (active) setReady(session ? "ok" : "checking");
    };
    tryExchange();

    // 2) Événement PASSWORD_RECOVERY / SIGNED_IN (flux implicite #access_token).
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session) setReady("ok");
      else if (event === "SIGNED_OUT") setReady("invalid");
    });

    // 3) Filet : après 4s sans session → lien invalide/expiré.
    const timeout = window.setTimeout(() => {
      if (active) {
        setReady((r) => (r === "checking" ? "invalid" : r));
      }
    }, 4000);

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (password.length < 8) {
      setMessage("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setMessage("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setIsLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage(
          error.message.toLowerCase().includes("same")
            ? "Le nouveau mot de passe doit être différent de l'ancien."
            : error.message,
        );
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/dashboard"), 1800);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  if (ready === "checking") {
    return (
      <p className="py-6 text-center text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
        Vérification du lien de réinitialisation…
      </p>
    );
  }

  if (ready === "invalid") {
    return (
      <div className="space-y-4 py-2 text-center">
        <p className="text-xs" style={{ color: "#F87171" }}>
          Ce lien est invalide ou a expiré.
        </p>
        <a
          href="/forgot-password"
          className="inline-block w-full rounded-xl py-2.5 text-center font-bold transition-all hover:opacity-90"
          style={{ background: "#C7A436", color: "#0B2B5E", fontSize: 14 }}
        >
          Recevoir un nouveau lien
        </a>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-3 py-4 text-center">
        <CheckCircle2 size={36} className="mx-auto" style={{ color: "#31845C" }} />
        <p className="text-sm font-semibold" style={{ color: "#fff" }}>
          Mot de passe mis à jour !
        </p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
          Redirection vers votre tableau de bord…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
          Nouveau mot de passe
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 caractères"
            required
            minLength={8}
            className="w-full rounded-xl border px-4 py-2.5 pr-11 text-sm transition-all focus:outline-none"
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
          Confirmer le mot de passe
        </label>
        <input
          type={showPassword ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Retapez le mot de passe"
          required
          minLength={8}
          className="w-full rounded-xl border px-4 py-2.5 text-sm transition-all focus:outline-none"
          style={inputStyle}
        />
      </div>

      {message && (
        <div
          className="rounded-xl p-2.5 text-xs"
          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#F87171" }}
        >
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-xl py-2.5 font-bold transition-all hover:opacity-90 active:scale-98 disabled:opacity-50"
        style={{ background: "#C7A436", color: "#0B2B5E", fontSize: 14 }}
      >
        {isLoading ? "Mise à jour…" : "Définir le nouveau mot de passe"}
      </button>
    </form>
  );
}
