import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

export function DashboardCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-muted">{label}</p>
          <p className="mt-2 text-3xl font-black text-ink">{value}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-softBlue text-navy">{icon}</div>
      </div>
    </Card>
  );
}
