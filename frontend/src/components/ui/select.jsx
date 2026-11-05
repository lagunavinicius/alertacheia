import * as Select from "@radix-ui/react-select";
import { CaretDown, CaretUp, Check } from "@phosphor-icons/react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

// shadcn/ui Select sobre o Radix: setas, Home/End e busca por digitação no teclado, ARIA completo.
const gatilho = cva(
  "group inline-flex max-w-full items-center justify-between gap-2.5 border border-borda-forte text-left font-semibold text-texto transition-colors hover:border-texto-2 data-[state=open]:border-linha data-[placeholder]:text-texto-3 aria-[invalid=true]:border-emergencia disabled:opacity-60",
  {
    variants: {
      variante: {
        pilula: "min-h-12 rounded-full bg-superficie/70 py-2 pr-4 pl-5 backdrop-blur",
        campo: "min-h-13 w-full rounded-md bg-noite px-4 text-lg font-normal",
        compacto: "min-h-11 w-full rounded-md bg-noite py-2 pr-3 pl-3",
      },
    },
    defaultVariants: { variante: "campo" },
  }
);

// O Radix não aceita item com valor vazio; "" continua sendo "sem filtro" para quem usa o componente.
const VAZIO = "__vazio__";
const para = (v) => (v === "" ? VAZIO : v);

/**
 * opcoes: [{ valor, rotulo, detalhe?, fim? }]. `detalhe` é a segunda linha da opção e `fim` fica à
 * direita (um selo de risco, por exemplo); só o rótulo aparece no botão depois de escolher.
 */
export function Selecao({ value, onChange, opcoes, variante, icone: Icone, placeholder = "Carregando…", className, largura, ...gatilhoProps }) {
  return (
    <Select.Root value={para(value)} onValueChange={(v) => onChange(v === VAZIO ? "" : v)}>
      <Select.Trigger className={cn(gatilho({ variante }), className)} {...gatilhoProps}>
        <span className="flex min-w-0 items-center gap-2.5">
          {Icone && <Icone size={20} weight="fill" className="shrink-0 text-rio" aria-hidden="true" />}
          <span className="truncate"><Select.Value placeholder={placeholder} /></span>
        </span>
        <Select.Icon asChild>
          <CaretDown size={16} weight="bold" className="shrink-0 text-texto-2 transition-transform group-data-[state=open]:rotate-180" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            "z-50 max-h-[min(24rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-24px)]",
            "overflow-hidden rounded-lg border border-borda-forte bg-superficie-2 text-texto shadow-cartao",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
            largura
          )}
        >
          <Select.ScrollUpButton className="flex h-7 items-center justify-center text-texto-2"><CaretUp size={14} weight="bold" aria-hidden="true" /></Select.ScrollUpButton>
          <Select.Viewport className="p-1.5">
            {opcoes.map((o) => (
              <Select.Item
                key={o.valor}
                value={para(o.valor)}
                className="relative flex min-h-12 cursor-pointer items-center gap-3 rounded-md py-2 pr-3 pl-9 outline-none select-none data-[highlighted]:bg-superficie-3 data-[state=checked]:font-semibold"
              >
                <Select.ItemIndicator className="absolute left-2.5">
                  <Check size={18} weight="bold" className="text-linha" aria-hidden="true" />
                </Select.ItemIndicator>
                <span className="min-w-0 flex-1">
                  <span className="block truncate"><Select.ItemText>{o.rotulo}</Select.ItemText></span>
                  {o.detalhe && <span className="block truncate text-sm font-normal text-texto-3">{o.detalhe}</span>}
                </span>
                {o.fim}
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="flex h-7 items-center justify-center text-texto-2"><CaretDown size={14} weight="bold" aria-hidden="true" /></Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
