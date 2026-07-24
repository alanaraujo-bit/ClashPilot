import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Junta classes resolvendo conflitos do Tailwind (a última vence de verdade). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const numberFormatter = new Intl.NumberFormat("pt-BR");

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** Datas e números sempre por `Intl` — nunca formatação manual (docs/07 §7). */
export function formatDate(value: Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", options ?? { dateStyle: "medium" }).format(value);
}
