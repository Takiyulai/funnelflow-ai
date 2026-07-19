// components/dashboard/Sidebar.tsx
"use client";

import { useEffect, useState } from "react";
import {
  BarChart3, GitBranch, LayoutDashboard, LayoutGrid,
  PlusCircle, Upload, Users, LogOut, Mail, Moon, Sun, CreditCard, LifeBuoy,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { clearFunnelCache } from "@/lib/store/funnelStore";

const NAV = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/create", label: "Créer un tunnel", icon: PlusCircle, primary: true },
  { href: "/galerie", label: "Galerie", icon: LayoutGrid },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/emails", label: "Emails", icon: Mail },
  // Export systeme.io retiré du menu : la logique est intégrée à l'éditeur
  // (bouton « Exporter »). On garde la page accessible par URL directe.
  { href: "/import", label: "Import", icon: Upload },
  { href: "/workflows", label: "Workflows", icon: GitBranch },
  { href: "/paiements", label: "Paiements", icon: CreditCard },
];

export function Sidebar({
  mobileOpen,
  onClose,
  theme,
  onToggleTheme,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [planInfo, setPlanInfo] = useState<{ planName: string | null; status: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/billing/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.ok) setPlanInfo({ planName: d.planName ?? null, status: d.status });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    // getSession() : lecture locale sans appel réseau (évite la contention du
    // verrou navigator.locks qui faisait échouer les écritures Supabase).
    const readUser = (session: { user?: { email?: string | null; user_metadata?: Record<string, unknown> } } | null) => {
      setUserEmail(session?.user?.email ?? null);
      const md = (session?.user?.user_metadata ?? {}) as Record<string, unknown>;
      const name =
        (typeof md.full_name === "string" && md.full_name.trim()) ||
        (typeof md.name === "string" && md.name.trim()) ||
        (typeof md.display_name === "string" && md.display_name.trim()) ||
        null;
      setUserName(name || null);
    };
    supabase.auth.getSession().then(({ data: { session } }) => readUser(session));

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      readUser(session);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      // Purge le cache local des tunnels : évite que le prochain compte
      // connecté sur ce navigateur ne voie les tunnels du compte précédent.
      clearFunnelCache();
      onClose?.();
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("logout error", err);
      setLoggingOut(false);
      alert("Déconnexion impossible. Réessayez.");
    }
  }

  return (
    <>
      {/* Overlay mobile */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 transform flex-col overflow-y-auto border-r border-white/5 px-4 py-5 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        style={{ background: "#0D1628" }}
      >
        {/* Logo */}
        <Link
          href="/"
          onClick={onClose}
          className="mb-7 flex items-center gap-2.5"
        >
          <span
            className="grid h-9 w-9 place-items-center rounded-lg text-xs font-black text-white"
            style={{ background: "linear-gradient(135deg,#31845C,#08498D)" }}
          >
            AF
          </span>
          <span className="text-base font-bold">
            AutoFunnel <span style={{ color: "#C7A436" }}>AI</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="grid gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            if (item.primary) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className="mb-2 flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold transition hover:opacity-90"
                  style={{ background: "#C7A436", color: "#080E1A" }}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/65 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={15} />
                {item.label}
                {active && (
                  <span
                    className="ml-auto h-1.5 w-1.5 rounded-full"
                    style={{ background: "#31845C" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Spacer pour pousser le footer vers le bas */}
        <div className="flex-1" />

        {/* Nous contacter / aide — mailto pré-rempli */}
        <a
          href={
            "https://mail.google.com/mail/?view=cm&fs=1&to=jwdemanou@gmail.com" +
            "&su=" +
            encodeURIComponent("Aide & Contact — AutoFunnel AI") +
            "&body=" +
            encodeURIComponent(
              "Bonjour l'équipe AutoFunnel AI,\n\n" +
                "J'ai besoin d'aide concernant :\n\n" +
                "(décrivez votre demande ici)\n\n" +
                "Mon email de compte : " +
                (userEmail ?? "") +
                "\n\nMerci d'avance.",
            )
          }
          className="mt-4 flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-white/65 transition hover:bg-white/5 hover:text-white"
          target="_blank"
          rel="noopener noreferrer"
        >
          <LifeBuoy size={15} />
          Nous contacter
        </a>

        {/* Toggle thème clair/sombre */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="mt-1 flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-white/65 transition hover:bg-white/5 hover:text-white"
            aria-label={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            {theme === "dark" ? "Mode clair" : "Mode sombre"}
          </button>
        )}

        {/* Carte plan */}
        <div
          className="mt-8 rounded-xl border p-4"
          style={{
            background: "rgba(255,255,255,0.04)",
            borderColor: "rgba(199,164,54,0.25)",
          }}
        >
          <div className="mb-2 flex items-center gap-2">
            <BarChart3 size={14} style={{ color: "#C7A436" }} />
            <p
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "#C7A436" }}
            >
              {planInfo?.planName ? `Plan ${planInfo.planName}` : "Abonnement"}
            </p>
          </div>
          <p className="text-xs leading-relaxed text-white/65">
            {planInfo
              ? planInfo.status === "active" || planInfo.status === "trialing"
                ? "Abonnement actif"
                : "Aucun abonnement actif"
              : "Chargement…"}
          </p>
          <Link
            href="/abonnement"
            className="mt-2 inline-block text-[11px] font-semibold underline"
            style={{ color: "#C7A436" }}
          >
            Gérer mon abonnement
          </Link>
        </div>

        {/* Bloc utilisateur + déconnexion */}
        <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
          {userEmail ? (
            <>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold text-white"
                  style={{
                    background: "linear-gradient(135deg,#31845C,#08498D)",
                  }}
                >
                  {(userName || userEmail).charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  {/* 🆕 Nom du créateur du compte + email */}
                  <p className="truncate text-xs font-semibold text-white">
                    {userName || userEmail}
                  </p>
                  <p className="truncate text-[10px] text-white/50">
                    {userName ? userEmail : "Connecté"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
              >
                <LogOut size={13} />
                {loggingOut ? "Déconnexion…" : "Se déconnecter"}
              </button>
            </>
          ) : (
            <Link
              href="/login"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10"
            >
              Se connecter
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
