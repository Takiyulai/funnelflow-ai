// components/ui/Card.tsx
import type { ReactNode, HTMLAttributes } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
} & HTMLAttributes<HTMLDivElement>;

export function Card({ children, className = "", interactive, ...props }: Props) {
  return (
    <div
      className={`rounded-xl border border-line bg-white shadow-card ${
        interactive ? "ff-card-hover cursor-pointer" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
