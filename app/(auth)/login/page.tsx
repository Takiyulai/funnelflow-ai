import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage() {
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
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
        }}
      >
        {/* Logo centré */}
        <div className="flex justify-center">
          <a href="/" className="inline-flex items-center gap-2" style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>
            <div 
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: "linear-gradient(135deg,#31845C,#08498D)" }}
            >
              <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>FF</span>
            </div>
            FunnelFlow<span style={{ color: "#C7A436" }}> AI</span>
          </a>
        </div>
        
        {/* Titre centré */}
        <h1 className="mt-6 text-center text-3xl font-black tracking-tight" style={{ color: "#fff" }}>Connexion</h1>
        <p className="mt-1.5 text-center text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
          Accédez à votre espace de création
        </p>
        
        <div className="mt-5">
          <AuthForm mode="login" />
        </div>
      </div>
    </main>
  );
}