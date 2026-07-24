import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-[var(--accent)] text-[oklch(0.99_0_0)] hover:opacity-90",
  secondary: "border border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]",
  ghost: "hover:bg-[var(--bg-elevated)]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: Variant;
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-[var(--radius-control)] px-4 text-[13px] font-medium",
        "transition-[opacity,background-color] duration-120 ease-out",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
