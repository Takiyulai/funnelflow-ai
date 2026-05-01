export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-6">
      {steps.map((step, index) => (
        <div key={step} className="grid gap-2">
          <div className={`h-2 rounded-full ${index <= current ? "bg-green" : "bg-line"}`} />
          <span className={`text-xs font-semibold ${index === current ? "text-navy" : "text-muted"}`}>{step}</span>
        </div>
      ))}
    </div>
  );
}
