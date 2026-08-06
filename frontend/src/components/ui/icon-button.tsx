import type { ButtonHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '../../lib/cn';
import type { ButtonProps } from './button';
import { buttonVariants } from './button-variants';

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> &
  Pick<ButtonProps, 'variant' | 'size'> & {
    'aria-label': string;
  };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'secondary', size = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), 'aspect-square min-w-11 px-0', className)}
      {...props}
    />
  ),
);

IconButton.displayName = 'IconButton';
