import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../../lib/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export function DialogContent({ className, ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-[var(--radius-component)] border border-[var(--color-glass-border)] bg-slate-950/95 p-6 text-slate-100 shadow-[var(--shadow-glass)] backdrop-blur-[var(--blur-glass)]',
          className,
        )}
        {...props}
      />
    </DialogPrimitive.Portal>
  );
}

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;
export const DrawerTitle = DialogPrimitive.Title;
export const DrawerDescription = DialogPrimitive.Description;

export function DrawerContent({ className, ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm" />
      <DialogPrimitive.Content
        className={cn(
          'fixed bottom-0 right-0 top-0 z-50 grid w-full max-w-md gap-4 overflow-y-auto border-l border-[var(--color-glass-border)] bg-slate-950/95 p-6 text-slate-100 shadow-[var(--shadow-glass)] backdrop-blur-[var(--blur-glass)] sm:rounded-l-[var(--radius-component)]',
          className,
        )}
        {...props}
      />
    </DialogPrimitive.Portal>
  );
}
