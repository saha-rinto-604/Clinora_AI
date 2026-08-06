import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-2xl bg-white/10', className)} {...props} />;
}

export function Spinner({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      className={cn(
        'inline-block h-5 w-5 animate-spin rounded-full border-2 border-cyan-200 border-t-transparent',
        className,
      )}
      {...props}
    />
  );
}

export type ProgressProps = HTMLAttributes<HTMLDivElement> & {
  value: number;
  max?: number;
};

export function Progress({ className, value, max = 100, ...props }: ProgressProps) {
  const safeValue = Math.max(0, Math.min(value, max));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={safeValue}
      className={cn('h-3 overflow-hidden rounded-full bg-white/10', className)}
      {...props}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-teal-400"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

export function EmptyState({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-component)] border border-dashed border-slate-700 p-6 text-slate-300',
        className,
      )}
      {...props}
    />
  );
}

export function ErrorState({ className, role = 'alert', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role={role}
      className={cn(
        'rounded-[var(--radius-component)] border border-red-400/40 bg-red-400/10 p-6 text-red-100',
        className,
      )}
      {...props}
    />
  );
}

export function LoadingState({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      className={cn('rounded-[var(--radius-component)] border border-slate-800 p-6 text-slate-300', className)}
      {...props}
    />
  );
}
