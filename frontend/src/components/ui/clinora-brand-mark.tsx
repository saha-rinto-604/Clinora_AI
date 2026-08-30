import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const markVariants = cva(
  'relative grid shrink-0 place-items-center overflow-hidden border border-cyan-300/20 bg-cyan-300/10 shadow-[0_0_28px_rgba(14,165,233,.18)]',
  {
    variants: {
      size: {
        sm: 'h-8 w-8 rounded-xl [&>span]:h-6 [&>span]:w-1.5',
        md: 'h-10 w-10 rounded-2xl [&>span]:h-8 [&>span]:w-2',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export type ClinoraBrandMarkProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof markVariants>;

export function ClinoraBrandMark({ size, className, ...props }: ClinoraBrandMarkProps) {
  return (
    <span aria-hidden="true" className={cn(markVariants({ size }), className)} {...props}>
      <span className="absolute rotate-45 rounded-full bg-gradient-to-b from-cyan-300 to-teal-400 opacity-70" />
      <span className="absolute -rotate-45 rounded-full bg-gradient-to-b from-teal-300 to-cyan-400 opacity-50" />
    </span>
  );
}
