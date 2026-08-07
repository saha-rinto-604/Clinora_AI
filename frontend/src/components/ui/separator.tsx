import * as SeparatorPrimitive from '@radix-ui/react-separator';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../../lib/cn';

export function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      orientation={orientation}
      className={cn(orientation === 'vertical' ? 'h-full w-px' : 'h-px w-full', 'bg-white/10', className)}
      {...props}
    />
  );
}
