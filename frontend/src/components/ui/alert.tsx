import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const alertVariants = cva('rounded-[var(--radius-component)] border p-4 text-sm leading-6', {
  variants: {
    variant: {
      info: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100',
      success: 'border-green-400/40 bg-green-400/10 text-green-100',
      warning: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
      danger: 'border-red-400/40 bg-red-400/10 text-red-100',
    },
  },
  defaultVariants: {
    variant: 'info',
  },
});

export type AlertProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>;

export function Alert({ className, variant, role = 'status', ...props }: AlertProps) {
  return <div role={role} className={cn(alertVariants({ variant }), className)} {...props} />;
}
