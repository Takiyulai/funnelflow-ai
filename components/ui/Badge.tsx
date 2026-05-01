import type { ReactNode } from "react";

export function Badge({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "gold" | "green" }) {
  const styles = {
    blue: "bg-softBlue text-navy",
    gold: "bg-lightGold text-navy",
    green: "bg-green/10 text-green"
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${styles[tone]}`}>{children}</span>;
}
