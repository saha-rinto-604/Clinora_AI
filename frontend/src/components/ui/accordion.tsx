import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../../lib/cn';

export const Accordion = AccordionPrimitive.Root;
export const AccordionItem = AccordionPrimitive.Item;

export function AccordionTrigger({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header>
      <AccordionPrimitive.Trigger
        className={cn(
          'group flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 text-left text-sm font-semibold text-slate-100 transition hover:bg-white/10 data-[state=open]:bg-white/10',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 shrink-0 transition duration-300 group-data-[state=open]:rotate-180"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({ className, ...props }: ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      className={cn(
        'overflow-hidden px-4 pb-4 pt-1 text-sm leading-6 text-slate-300 data-[state=closed]:animate-[accordion-up_260ms_ease-in] data-[state=open]:animate-[accordion-down_320ms_ease-out]',
        className,
      )}
      {...props}
    />
  );
}
