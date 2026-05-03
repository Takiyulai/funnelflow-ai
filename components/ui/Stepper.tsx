// components/ui/Stepper.tsx
export function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-6">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <div key={step} className="grid gap-1.5">
            <div
              className={`h-1 rounded-full transition ${
                done
                  ? "bg-green"
                  : active
                  ? "bg-navy"
                  : "bg-line"
              }`}
            />
            <span
              className={`text-[11px] font-bold uppercase tracking-wider transition ${
                active ? "text-ink" : "text-muted"
              }`}
            >
              {step}
            </span>
          </div>
        );
      })}
    </div>
  );
}
