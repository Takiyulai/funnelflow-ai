// components/ui/Button.tsx
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode, AnchorHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "dark" | "danger";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: string;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  external?: boolean;
};

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-gold text-brand-ink hover:bg-[#B89530] active:bg-[#A8881F] shadow-sm",
  secondary:
    "border border-line bg-white text-ink hover:border-navy/40 hover:bg-canvas active:bg-line/40",
  ghost:
    "text-ink hover:bg-canvas active:bg-line/50",
  dark:
    "bg-gradient-to-br from-[#31845C] to-[#08498D] text-white hover:opacity-90 active:opacity-95 shadow-sm",
  danger:
    "border border-red/30 bg-white text-red hover:bg-red/5 active:bg-red/10",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "min-h-8 px-3 text-xs gap-1.5 rounded-md",
  md: "min-h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "min-h-12 px-5 text-sm gap-2 rounded-lg",
};

export function Button({
  href,
  children,
  variant = "primary",
  size = "md",
  external,
  className = "",
  ...props
}: ButtonProps) {
  const classes = `focus-ring inline-flex items-center justify-center font-bold transition disabled:opacity-50 disabled:cursor-not-allowed ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`;

  if (href) {
    if (external) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener"
          className={classes}
        >
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
