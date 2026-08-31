import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const markVariants = cva('relative grid shrink-0 place-items-center', {
  variants: {
    size: {
      sm: 'h-8 w-8',
      md: 'h-10 w-10',
      lg: 'h-12 w-12',
    },
  },
  defaultVariants: { size: 'md' },
});

export type ClinoraBrandMarkProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof markVariants>;

export function ClinoraBrandMark({ size, className, ...props }: ClinoraBrandMarkProps) {
  return (
    <span aria-hidden="true" className={cn(markVariants({ size }), className)} {...props}>
      <img
        src="/assets/brand/clinora-logo.png"
        alt=""
        draggable={false}
        className="h-full w-full select-none object-contain drop-shadow-[0_0_16px_rgba(14,165,233,.18)]"
      />
    </span>
  );
}
