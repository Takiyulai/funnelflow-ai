import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
};

const variants = {
  primary: "bg-abaGold text-abaBlack hover:bg-[#f2c83a] shadow-gold",
  secondary: "border border-abaGold/30 bg-white text-abaBlack hover:border-abaGold hover:bg-abaWhite",
  ghost: "text-ink hover:bg-abaGold/10"
};

export function Button({ href, children, variant = "primary", className = "", ...props }: ButtonProps) {
  const classes = `focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold transition ${variants[variant]} ${className}`;

  if (href) {
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
