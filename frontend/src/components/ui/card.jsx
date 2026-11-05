import { cn } from "@/lib/utils";

// shadcn/ui Card: superfície um degrau acima da noite, borda de 1 px, sem sombra pesada.
export function Card({ className, ...props }) {
  return <div className={cn("rounded-lg border border-borda bg-superficie p-5 md:p-6", className)} {...props} />;
}

export function CardTitulo({ className, as: Tag = "h2", ...props }) {
  return <Tag className={cn("text-lg font-semibold text-texto", className)} {...props} />;
}
