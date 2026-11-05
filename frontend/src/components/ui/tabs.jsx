import * as RadixTabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

// shadcn/ui Tabs sobre o Radix: setas do teclado trocam de aba, ARIA completo.
export const Tabs = RadixTabs.Root;

export function TabsLista({ className, ...props }) {
  return (
    <RadixTabs.List
      className={cn("inline-flex gap-1 rounded-full border border-borda bg-superficie p-1", className)}
      {...props}
    />
  );
}

export function TabsGatilho({ className, ...props }) {
  return (
    <RadixTabs.Trigger
      className={cn(
        "min-h-10 rounded-full px-4 text-sm font-semibold text-texto-2 transition-colors hover:text-texto",
        "data-[state=active]:bg-superficie-3 data-[state=active]:text-texto",
        className
      )}
      {...props}
    />
  );
}

export function TabsConteudo({ className, ...props }) {
  return <RadixTabs.Content className={cn("mt-5 outline-none", className)} {...props} />;
}
