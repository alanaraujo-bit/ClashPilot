import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      {children}
      {hint ? (
        <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-[var(--radius-control)] border bg-[var(--bg-base)] px-3 text-[14px]",
        "border-[var(--border-strong)] placeholder:text-[var(--text-tertiary)]",
        "transition-colors duration-120 focus:border-[var(--accent)]",
        className,
      )}
      {...props}
    />
  );
}

/** Erro de formulário. `role="alert"` para o leitor de tela anunciar sem o usuário procurar. */
export function FormError({ children }: { readonly children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-[var(--radius-control)] border px-3 py-2 text-[13px]"
      style={{ borderColor: "var(--critical)", color: "var(--critical)" }}
    >
      {children}
    </p>
  );
}
