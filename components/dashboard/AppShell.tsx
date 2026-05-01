import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-abaWhite lg:flex">
      <Sidebar />
      <main className="w-full px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
