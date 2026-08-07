import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Badge, Container } from '../ui';
import { buttonVariants } from '../ui/button-variants';
import { BiomedicalPageBackground, type BiomedicalBackgroundVariant } from './biomedical-page-background';
import { Reveal } from './reveal';

export function PublicPageHero({
  eyebrow,
  title,
  copy,
  variant = 'network',
  aside,
  primaryAction,
  secondaryAction,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  variant?: BiomedicalBackgroundVariant;
  aside?: ReactNode;
  primaryAction?: { label: string; to: string };
  secondaryAction?: { label: string; to: string };
}) {
  return (
    <section className="relative isolate overflow-hidden border-b border-white/5">
      <BiomedicalPageBackground variant={variant} />
      <Container className="grid min-h-[34rem] items-center gap-12 py-20 lg:grid-cols-[1.04fr_.96fr] lg:py-28">
        <Reveal className="relative z-10 max-w-4xl">
          <Badge
            variant={variant === 'emergency' ? 'danger' : 'info'}
            className="px-4 py-2 text-[11px] uppercase tracking-[0.16em]"
          >
            {eyebrow}
          </Badge>
          <h1 className="mt-7 text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl">
            {title}
          </h1>
          <p className="mt-7 max-w-3xl text-pretty text-base leading-8 text-slate-300 sm:text-lg">{copy}</p>
          {primaryAction || secondaryAction ? (
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {primaryAction ? (
                <Link to={primaryAction.to} className={buttonVariants({ size: 'lg' })}>
                  {primaryAction.label}
                  <ArrowRight aria-hidden="true" size={18} />
                </Link>
              ) : null}
              {secondaryAction ? (
                <Link to={secondaryAction.to} className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
                  {secondaryAction.label}
                </Link>
              ) : null}
            </div>
          ) : null}
        </Reveal>
        {aside ? <Reveal delay={0.08}>{aside}</Reveal> : <div className="hidden lg:block" />}
      </Container>
    </section>
  );
}
