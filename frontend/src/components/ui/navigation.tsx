import type { AnchorHTMLAttributes, HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type NavigationItemProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  active?: boolean;
};

export function NavigationItem({ active = false, className, ...props }: NavigationItemProps) {
  return (
    <a
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-[var(--radius-component)] px-4 text-sm font-semibold transition duration-300',
        active
          ? 'bg-cyan-300 text-slate-950 shadow-[0_0_24px_rgba(14,165,233,.28)]'
          : 'text-slate-300 hover:bg-white/10 hover:text-white',
        className,
      )}
      {...props}
    />
  );
}

export function Breadcrumb({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <nav aria-label="Breadcrumb" className={cn('text-sm text-slate-400', className)} {...props} />;
}

export function BreadcrumbList({ className, ...props }: HTMLAttributes<HTMLOListElement>) {
  return <ol className={cn('flex flex-wrap items-center gap-2', className)} {...props} />;
}

export function BreadcrumbItem({ className, ...props }: HTMLAttributes<HTMLLIElement>) {
  return <li className={cn('flex items-center gap-2', className)} {...props} />;
}
