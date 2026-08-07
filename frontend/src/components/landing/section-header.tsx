import type { ReactNode } from 'react';
import { Badge } from '../ui';
import { cn } from '../../lib/cn';

export function SectionHeader({
  eyebrow,
  title,
  copy,
  align = 'left',
  aside,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  align?: 'left' | 'center';
  aside?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-5',
        align === 'center' ? 'mx-auto max-w-3xl items-center text-center' : 'max-w-3xl',
      )}
    >
      <Badge variant="info" className="w-fit uppercase tracking-[0.18em]">
        {eyebrow}
      </Badge>
      <h2 className="text-balance text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      <p className="text-pretty text-base leading-8 text-slate-300 sm:text-lg">{copy}</p>
      {aside}
    </div>
  );
}
