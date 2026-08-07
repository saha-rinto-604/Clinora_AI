import * as ToastPrimitive from '@radix-ui/react-toast';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../../lib/cn';

export const ToastProvider = ToastPrimitive.Provider;
export const ToastViewport = (props: ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>) => (
  <ToastPrimitive.Viewport
    className="fixed bottom-4 right-4 z-50 grid w-[calc(100%-2rem)] max-w-sm gap-3 outline-none"
    {...props}
  />
);

export function Toast({ className, ...props }: ComponentPropsWithoutRef<typeof ToastPrimitive.Root>) {
  return (
    <ToastPrimitive.Root
      className={cn(
        'rounded-[var(--radius-component)] border border-[var(--color-glass-border)] bg-slate-950/95 p-4 text-slate-100 shadow-[var(--shadow-glass)] backdrop-blur-[var(--blur-glass)]',
        className,
      )}
      {...props}
    />
  );
}

export function ToastTitle({ className, ...props }: ComponentPropsWithoutRef<typeof ToastPrimitive.Title>) {
  return <ToastPrimitive.Title className={cn('text-sm font-semibold', className)} {...props} />;
}

export function ToastDescription({ className, ...props }: ComponentPropsWithoutRef<typeof ToastPrimitive.Description>) {
  return <ToastPrimitive.Description className={cn('mt-1 text-sm leading-6 text-slate-300', className)} {...props} />;
}

export function ToastClose({ className, ...props }: ComponentPropsWithoutRef<typeof ToastPrimitive.Close>) {
  return (
    <ToastPrimitive.Close
      className={cn('mt-3 rounded-xl px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-white/10', className)}
      {...props}
    />
  );
}
