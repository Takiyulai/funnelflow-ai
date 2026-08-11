"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function friendlyAuthMessage(message: string) {
  if (message.toLowerCase().includes("rate limit")) {
    return "Trop de tentatives. Veuillez patienter quelques minutes.";
  }
  if (message.toLowerCase().includes("invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (message.toLowerCase().includes("user already registered")) {
    return "Cet email est déjà utilisé. Connectez-vous plutôt.";
  }
  if (message.toLowerCase().includes("password")) {
    return "Mot de passe trop faible. Minimum 8 caractères.";
  }
  const low = message.toLowerCase();
  if (low.includes("invalid value") || low.includes("failed to fetch")) {
    return "Problème de configuration Supabase (URL ou clé invalide). Vérifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans Vercel — sans espace ni retour-ligne.";
  }
  return message;
}

/** Après auth : si un plan est passé en query (?plan=pro), file vers l'abonnement. */
function postAuthDestination(): string {
  try {
    const p = new URLSearchParams(window.location.search).get("plan");
    if (p === "starter" || p === "pro" || p === "agency") return `/abonnement?plan=${p}`;
  } catch {
    /* no-op */
  }
  return "/dashboard";
}

export function AuthForm({ mode }: { mode: "login" | "signup" | "forgot" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  /**
   * 🆕 ÉCRAN NOIR APRÈS CONNEXION.
   *
   * `router.push()` ne bloque pas : le `finally` remettait `isLoading` à false
   * dans la foulée, alors que la navigation vers /dashboard commençait à peine.
   * Le formulaire redevenait donc inerte — bouton normal, aucun indicateur —
   * pendant tout le temps de chargement du Server Component et de ses données.
   * L'utilisateur voyait l'écran s'assombrir sans comprendre ce qui se passait,
   * et pouvait re-cliquer.
   *
   * Cet état reste VRAI jusqu'au démontage du composant par la navigation :
   * c'est la seule façon de couvrir un délai dont on ne contrôle pas la fin.
   */
  const [isRedirecting, setIsRedirecting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");
    // try/catch : une erreur de config (URL/clé Supabase invalide) lèverait
    // sinon une exception non gérée ("Invalid value") au lieu d'un message clair.
    try {
      const supabase = createSupabaseBrowserClient();

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setMessage(friendlyAuthMessage(error.message));
        } else {
          // Posé AVANT le push : le `finally` ne doit pas pouvoir rendre la
          // main à l'utilisateur pendant que la navigation se prépare.
          setIsRedirecting(true);
          router.push(postAuthDestination());
        }
        return;
      }

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) {
          setMessage(friendlyAuthMessage(error.message));
        } else {
          setIsRedirecting(true);
          router.push(postAuthDestination());
        }
        return;
      }

      // 🆕 Le lien du mail atterrit sur /reset-password (page dédiée qui
      // permet de SAISIR le nouveau mot de passe — avant il renvoyait vers
      // /login et l'utilisateur était coincé).
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setMessage(
        error
          ? friendlyAuthMessage(error.message)
          : "✉️ Lien envoyé ! Vérifiez votre boîte mail (et les spams). Le lien ouvre une page où définir votre nouveau mot de passe.",
      );
    } catch (e) {
      setMessage(friendlyAuthMessage(e instanceof Error ? e.message : String(e)));
    } finally {
      setIsLoading(false);
    }
  }

  async function signInWithGoogle() {
    setIsLoading(true);
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      // Le retour Google passe par /auth/callback qui échange le code contre une
      // session, puis redirige vers `next` (préserve aussi le flux ?plan=).
      const next = postAuthDestination();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) {
        setMessage(friendlyAuthMessage(error.message));
        setIsLoading(false);
      }
      // Si pas d'erreur, le navigateur part vers Google : on garde l'état chargé.
    } catch (e) {
      setMessage(friendlyAuthMessage(e instanceof Error ? e.message : String(e)));
      setIsLoading(false);
    }
  }

  const isSignup = mode === "signup";
  const isLogin = mode === "login";
  const isForgot = mode === "forgot";

  return (
    <div className="w-full">
      {/* 🆕 Voile de transition — comble le vide entre l'authentification
          réussie et l'affichage du tableau de bord. Sans lui, l'écran
          s'assombrissait sans explication pendant le chargement du Server
          Component, et rien n'empêchait un second clic. */}
      {isRedirecting && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 px-6 text-center"
          style={{ background: "rgba(11, 18, 32, 0.92)", backdropFilter: "blur(3px)" }}
        >
          <span
            aria-hidden
            className="h-9 w-9 animate-spin rounded-full border-2 border-white/25 motion-reduce:animate-none"
            style={{ borderTopColor: "#C7A436" }}
          />
          <div>
            <p className="text-sm font-bold text-white">Connexion réussie</p>
            <p className="mt-1 text-xs text-white/60">
              Ouverture de ton espace…
            </p>
          </div>
        </div>
      )}

      {/* Bouton Google - uniquement pour signup et login */}
      {!isForgot && (
        <>
          <button
            onClick={signInWithGoogle}
            disabled={isLoading || isRedirecting}
            className="flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 font-semibold transition-all hover:opacity-90 active:scale-98 disabled:opacity-50"
            style={{
              background: "#fff",
              color: "#1a1a2e",
              border: "1px solid rgba(255,255,255,0.2)",
              fontSize: 14,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continuer avec Google
          </button>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 py-1" style={{ background: "#0D1628", color: "rgba(255,255,255,0.4)" }}>
                OU
              </span>
            </div>
          </div>
        </>
      )}

      {/* Formulaire classique */}
      <form onSubmit={submit} className="space-y-4">
        {isSignup && (
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              Nom complet
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jean Dupont"
              required={isSignup}
              className="w-full rounded-xl border px-4 py-2.5 text-sm transition-all focus:outline-none"
              style={{
                background: "rgba(255,255,255,0.05)",
                borderColor: "rgba(255,255,255,0.12)",
                color: "#fff",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#C7A436";
                e.target.style.boxShadow = "0 0 0 2px rgba(199,164,54,0.2)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "rgba(255,255,255,0.12)";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="bonjour@exemple.com"
            required
            className="w-full rounded-xl border px-4 py-2.5 text-sm transition-all focus:outline-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              borderColor: "rgba(255,255,255,0.12)",
              color: "#fff",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#C7A436";
              e.target.style.boxShadow = "0 0 0 2px rgba(199,164,54,0.2)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "rgba(255,255,255,0.12)";
              e.target.style.boxShadow = "none";
            }}
          />
        </div>

        {!isForgot && (
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignup ? "Minimum 8 caractères" : "Votre mot de passe"}
                required
                className="w-full rounded-xl border px-4 py-2.5 pr-11 text-sm transition-all focus:outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  borderColor: "rgba(255,255,255,0.12)",
                  color: "#fff",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#C7A436";
                  e.target.style.boxShadow = "0 0 0 2px rgba(199,164,54,0.2)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(255,255,255,0.12)";
                  e.target.style.boxShadow = "none";
                }}
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
        )}

        {/* Message d'erreur */}
        {message && (
          <div className="rounded-xl p-2.5 text-xs" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#F87171" }}>
            {message}
          </div>
        )}

        {/* Bouton principal */}
        <button
          type="submit"
          disabled={isLoading || isRedirecting}
          className="w-full rounded-xl py-2.5 font-bold transition-all hover:opacity-90 active:scale-98 disabled:opacity-50"
          style={{
            background: "#C7A436",
            color: "#0B2B5E",
            fontSize: 14,
          }}
        >
          {isLoading ? "Chargement..." : isSignup ? "Commencer" : isLogin ? "Se connecter" : "Envoyer le lien"}
        </button>

        {/* Micro-copy rassurant */}
        {isSignup && (
          <p className="text-center text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
            Aucun engagement • Accès immédiat
          </p>
        )}

        {/* Bouton « Accès démo » retiré : il ouvrait /dashboard SANS session,
            ce que la garde d'accès (app/(app)/layout.tsx) bloque désormais
            (redirection vers /login). Pour tester, utiliser un vrai compte. */}
      </form>

      {/* Liens de bas de formulaire */}
      {isLogin && (
        <div className="mt-5 text-center">
          <a href="/forgot-password" className="text-xs transition-colors hover:opacity-70" style={{ color: "rgba(255,255,255,0.5)" }}>
            Mot de passe oublié ?
          </a>
        </div>
      )}

      {isSignup && (
        <div className="mt-5 text-center">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            Déjà inscrit ?{" "}
            <a href="/login" className="font-semibold transition-colors hover:opacity-70" style={{ color: "#C7A436" }}>
              Se connecter
            </a>
          </p>
        </div>
      )}

      {isLogin && (
        <div className="mt-5 text-center">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            Pas encore de compte ?{" "}
            <a href="/signup" className="font-semibold transition-colors hover:opacity-70" style={{ color: "#C7A436" }}>
              Créer un compte
            </a>
          </p>
        </div>
      )}

      {/* Texte de confiance */}
      <div className="mt-6 text-center">
        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
          🔒 Vos données sont sécurisées. Aucun spam.
        </p>
      </div>
    </div>
  );
}