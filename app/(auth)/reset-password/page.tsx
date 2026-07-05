// app/(auth)/reset-password/page.tsx
// 🆕 Page de RÉINITIALISATION du mot de passe (cible du lien email Supabase).
// Le lien de récupération ouvre cette page avec un code/token ; le client
// Supabase échange automatiquement le code contre une session de récupération,
// puis l'utilisateur définit son nouveau mot de passe (updateUser).

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <main
      className="grid min-h-screen place-items-center px-4 py-8"
      style={{ background: "#080E1A" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{
          background: "#0D1628",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div className="flex justify-center">
          <a href="/" className="inline-flex items-center gap-2" style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: "linear-gradient(135deg,#31845C,#08498D)" }}
            >
              <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>AF</span>
            </div>
            AutoFunnel<span style={{ color: "#C7A436" }}> AI</span>
          </a>
        </div>

        <h1 className="mt-6 text-center text-3xl font-black tracking-tight" style={{ color: "#fff" }}>
          Nouveau mot de passe
        </h1>
        <p className="mt-1.5 text-center text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
          Choisissez un nouveau mot de passe pour votre compte
        </p>

        <div className="mt-5">
          <ResetPasswordForm />
        </div>

        <div className="mt-5 text-center">
          <a href="/login" className="text-xs transition-colors hover:opacity-70" style={{ color: "rgba(255,255,255,0.5)" }}>
            ← Retour à la connexion
          </a>
        </div>
      </div>
    </main>
  );
}
