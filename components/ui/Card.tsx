import type { ReactNode, HTMLAttributes } from "react";

export function Card({ children, className = "", style, ...props }: { children: ReactNode; className?: string; style?: React.CSSProperties } & HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-lg border border-line bg-white shadow-sm ${className}`} style={style} {...props}>{children}</div>;
}