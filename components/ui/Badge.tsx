// components/ui/Badge.tsx
import type { ReactNode } from "react";

type Tone = "blue" | "gold" | "green" | "neutral" | "red";

const TONES: Record<Tone, string> = {
  blue: "bg-softBlue text-navy",
  gold: "bg-lightGold text-[#7A6520]",
  green: "bg-softGreen text-green",
  neutral: "bg-canvas text-muted",
  red: "bg-red/10 text-red",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
