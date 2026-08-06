import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-component)] border border-slate-800/80 bg-slate-900/80 p-6 shadow-xl',
        className,
      )}
      {...props}
    />
  );
}

export function GlassPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-component)] border border-[var(--color-glass-border)] bg-[var(--color-glass)] p-6 shadow-[var(--shadow-glass)] backdrop-blur-[var(--blur-glass)]',
        className,
      )}
      {...props}
    />
  );
}
