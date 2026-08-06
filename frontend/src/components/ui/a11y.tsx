import type { AnchorHTMLAttributes, HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function VisuallyHidden({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]',
        className,
      )}
      {...props}
    />
  );
}

export function SkipLink({ className, href = '#main-content', ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={href}
      className={cn(
        'sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-cyan-300 focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-slate-950',
        className,
      )}
      {...props}
    />
  );
}
