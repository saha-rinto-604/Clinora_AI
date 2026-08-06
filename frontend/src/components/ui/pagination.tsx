import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { Button } from './button';

export function Pagination({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-between gap-3', className)} {...props} />
  );
}

export function PaginationButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Button variant="secondary" size="sm" className={cn('min-w-10 px-3', className)} {...props} />;
}

export function PaginationStatus({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('text-sm text-slate-300', className)} {...props} />;
}
