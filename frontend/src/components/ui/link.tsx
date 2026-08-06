import type { AnchorHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '../../lib/cn';

export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  subtle?: boolean;
};

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(({ className, subtle = false, ...props }, ref) => (
  <a
    ref={ref}
    className={cn(
      'rounded-md font-medium underline-offset-4 transition duration-300 hover:underline',
      subtle ? 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]' : 'text-cyan-300',
      className,
    )}
    {...props}
  />
));

Link.displayName = 'Link';
