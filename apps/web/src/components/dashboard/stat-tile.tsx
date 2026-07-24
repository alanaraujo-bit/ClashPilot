import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  small = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly small?: boolean;
}) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <span
        className="text-[11px] font-medium tracking-wide uppercase"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </span>
      <span
        className={cn(
          "tabular leading-none font-semibold tracking-[-0.02em]",
          small ? "text-[15px]" : "text-[22px]",
        )}
      >
        {value}
      </span>
    </div>
  );
}
