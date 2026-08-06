import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold', {
  variants: {
    variant: {
      neutral: 'border-slate-700 bg-slate-800 text-slate-200',
      info: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200',
      success: 'border-green-400/40 bg-green-400/10 text-green-200',
      warning: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
      danger: 'border-red-400/40 bg-red-400/10 text-red-200',
    },
  },
  defaultVariants: {
    variant: 'neutral',
  },
});

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
