// components/ui/Field.tsx
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const BASE_INPUT =
  "focus-ring w-full rounded-lg border border-line bg-white text-sm text-ink placeholder:text-muted/70 transition";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`${BASE_INPUT} min-h-10 px-3 ${className}`}
    />
  );
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${BASE_INPUT} min-h-24 px-3 py-2.5 leading-relaxed ${className}`}
    />
  );
}

export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${BASE_INPUT} min-h-10 px-3 pr-8 ${className}`}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
        {label}
        {required && <span className="text-red">•</span>}
      </span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}
