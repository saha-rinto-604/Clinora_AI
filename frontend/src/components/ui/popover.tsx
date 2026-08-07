import * as PopoverPrimitive from '@radix-ui/react-popover';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../../lib/cn';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;

export function PopoverContent({
  className,
  align = 'center',
  sideOffset = 10,
  ...props
}: ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-80 rounded-[var(--radius-component)] border border-[var(--color-glass-border)] bg-slate-950/95 p-4 text-slate-100 shadow-[var(--shadow-glass)] backdrop-blur-[var(--blur-glass)]',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
