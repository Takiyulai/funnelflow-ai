// components/dashboard/DashboardCard.tsx
import type { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/Card";

type Trend = { value: number; positive?: boolean };

export function DashboardCard({
  label,
  value,
  icon,
  trend,
  accent = "blue",
}: {
  label: string;
  value: string;
  icon: ReactNode;
  trend?: Trend;
  accent?: "blue" | "green" | "gold";
}) {
  const accentMap = {
    blue: { bg: "bg-softBlue", fg: "text-navy" },
    green: { bg: "bg-softGreen", fg: "text-green" },
    gold: { bg: "bg-lightGold", fg: "text-[#7A6520]" },
  } as const;
  const a = accentMap[accent];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black leading-none text-ink">
            {value}
          </p>
          {trend && (
            <div
              className={`mt-2 inline-flex items-center gap-1 text-xs font-bold ${
                trend.positive !== false ? "text-green" : "text-red"
              }`}
            >
              {trend.positive !== false ? (
                <TrendingUp size={12} />
              ) : (
                <TrendingDown size={12} />
              )}
              {trend.value > 0 ? "+" : ""}
              {trend.value}%
            </div>
          )}
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${a.bg} ${a.fg}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
