import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Junta classes condicionais e resolve conflitos do Tailwind (padrão shadcn/ui). */
export function cn(...entradas) {
  return twMerge(clsx(entradas));
}
