import { Card } from "@/components/ui/Card";
import { AuthForm } from "@/components/auth/AuthForm";

export default function SignupPage() {
  return (
    <main 
      className="grid min-h-screen place-items-center px-4 py-10" 
      style={{ background: "#080E1A" }}
    >
      <div 
        className="w-full max-w-md rounded-2xl p-8"
        style={{ 
          background: "#0D1628", 
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
        }}
      >
        <a href="/" className="inline-flex items-center gap-2 ff-body" style={{ fontWeight: 700, fontSize: 18, color: "#fff" }}>
          <div 
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: "linear-gradient(135deg,#31845C,#08498D)" }}
          >
            <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>FF</span>
          </div>
          FunnelFlow<span style={{ color: "#C7A436" }}> AI</span>
        </a>
        
        <h1 className="mt-8 text-4xl font-black tracking-tight" style={{ color: "#fff" }}>Créer un compte</h1>
        <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          Rejoignez l'aventure FunnelFlow AI
        </p>
        
        <div className="mt-6">
          <AuthForm mode="signup" />
        </div>
      </div>
    </main>
  );
}