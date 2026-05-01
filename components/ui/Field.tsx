import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`focus-ring min-h-11 rounded-lg border border-line bg-white px-3 text-sm ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`focus-ring min-h-28 rounded-lg border border-line bg-white p-3 text-sm ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`focus-ring min-h-11 rounded-lg border border-line bg-white px-3 text-sm ${props.className ?? ""}`} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      <span>{label}</span>
      {children}
    </label>
  );
}
