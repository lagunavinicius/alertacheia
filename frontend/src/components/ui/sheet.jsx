import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// shadcn/ui Sheet sobre o Radix Dialog: foco preso, Esc fecha, leitor de tela anuncia.
// No celular sobe de baixo (alcance do polegar); no computador abre à direita.
export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

export function SheetContent({ className, children, titulo, descricao, ...props }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-[#030812]/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <Dialog.Content
        className={cn(
          "fixed z-50 flex flex-col gap-4 border-borda bg-superficie p-6 shadow-cartao outline-none",
          "inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-2xl border-t pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
          "md:inset-y-0 md:right-0 md:left-auto md:bottom-auto md:h-full md:max-h-none md:w-[420px] md:rounded-none md:border-l md:border-t-0",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
          "md:data-[state=open]:slide-in-from-right md:data-[state=closed]:slide-out-to-right md:data-[state=open]:slide-in-from-bottom-0",
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <Dialog.Title className="text-2xl font-semibold">{titulo}</Dialog.Title>
            {descricao && <Dialog.Description className="mt-1 text-texto-2">{descricao}</Dialog.Description>}
          </div>
          <Dialog.Close className="grid size-11 shrink-0 place-items-center rounded-full border border-borda hover:bg-superficie-2" aria-label="Fechar">
            <X size={20} weight="bold" aria-hidden="true" />
          </Dialog.Close>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
