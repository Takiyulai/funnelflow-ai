import { BarChart3, Download, GitBranch, LayoutDashboard, PlusCircle, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create", label: "Créer", icon: PlusCircle },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/export-systeme", label: "Export", icon: Download },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/workflows", label: "Workflows", icon: GitBranch }
];

export function Sidebar() {
  return (
    <aside className="border-b border-abaGold/20 bg-abaBlack px-4 py-4 text-white lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
      <div className="mb-6 flex items-center justify-between gap-3 lg:block">
        <a href="/" className="text-lg font-black text-abaGold">FunnelFlow AI</a>
        <Button href="/create" className="hidden lg:inline-flex"><PlusCircle size={18} />Créer</Button>
      </div>
      <nav className="flex gap-2 overflow-x-auto lg:grid">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <a key={item.href} href={item.href} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-abaGold">
              <Icon size={18} />
              {item.label}
            </a>
          );
        })}
      </nav>
      <div className="mt-8 hidden rounded-lg border border-abaGold/30 bg-white/10 p-4 text-white lg:block">
        <BarChart3 className="mb-3 text-abaGold" />
        <p className="text-sm font-bold">Plan Pro</p>
        <p className="mt-1 text-xs text-white/70">Export Systeme.io et régénération IA inclus.</p>
      </div>
    </aside>
  );
}
