import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[var(--container-max)] px-6 sm:px-8 lg:px-[var(--container-padding)]',
        className,
      )}
      {...props}
    />
  );
}

export function Stack({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-4', className)} {...props} />;
}

export function Grid({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12', className)} {...props} />;
}
