// components/dashboard/Sidebar.tsx
"use client";

import {
  BarChart3, Download, GitBranch, LayoutDashboard,
  PlusCircle, Upload, Users, FileText, Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/create", label: "Créer un tunnel", icon: PlusCircle, primary: true },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/export-systeme", label: "Export systeme.io", icon: Download },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/workflows", label: "Workflows", icon: GitBranch },
];

export function Sidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname() ?? "";

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
        className={`fixed inset-y-0 left-0 z-50 w-72 transform overflow-y-auto border-r border-white/5 px-4 py-5 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
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
            FF
          </span>
          <span className="text-base font-bold">
            FunnelFlow <span style={{ color: "#C7A436" }}>AI</span>
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

        {/* Carte plan en bas */}
        <div
          className="mt-8 rounded-xl border p-4"
          style={{
            background: "rgba(255,255,255,0.04)",
            borderColor: "rgba(199,164,54,0.25)",
          }}
        >
          <div className="mb-2 flex items-center gap-2">
            <BarChart3 size={14} style={{ color: "#C7A436" }} />
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#C7A436" }}>
              Plan Pro
            </p>
          </div>
          <p className="text-xs leading-relaxed text-white/65">
            Export systeme.io et régénération IA inclus
          </p>
        </div>
      </aside>
    </>
  );
}
