import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

// shadcn/ui Button, ajustado à marca: pílula, alvo mínimo de 48 px, um acento (a linha laranja).
const variantes = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background-color,color,border-color,transform] duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        padrao: "bg-texto text-noite hover:bg-texto/85",
        alerta: "bg-linha text-white hover:bg-linha/90",
        contorno: "border border-borda-forte bg-transparent text-texto hover:bg-superficie-2",
        fantasma: "bg-transparent text-texto hover:bg-superficie-2",
        claro: "bg-white text-[#0f1b2d] hover:bg-white/90",
      },
      size: {
        padrao: "min-h-12 px-6 text-base",
        pequeno: "min-h-11 px-4 text-sm",
        icone: "size-11 p-0",
      },
    },
    defaultVariants: { variant: "padrao", size: "padrao" },
  }
);

export function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(variantes({ variant, size }), className)} {...props} />;
}
