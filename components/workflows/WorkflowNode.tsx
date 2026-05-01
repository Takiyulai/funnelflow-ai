import type { ReactNode } from "react";

export function WorkflowNode({ title, label, icon }: { title: string; label: string; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-softBlue text-navy">{icon}</div>
      <p className="text-xs font-bold uppercase text-green">{label}</p>
      <h3 className="mt-1 font-black text-ink">{title}</h3>
    </div>
  );
}
