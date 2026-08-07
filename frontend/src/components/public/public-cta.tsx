import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { Badge, Container, GlassPanel } from '../ui';
import { buttonVariants } from '../ui/button-variants';
import { Reveal } from './reveal';

export function PublicCta({
  title,
  copy,
  primary,
  secondary,
}: {
  title: string;
  copy: string;
  primary: { label: string; to: string };
  secondary?: { label: string; to: string };
}) {
  return (
    <section className="relative overflow-hidden py-20 lg:py-28">
      <div
        aria-hidden="true"
        className="absolute inset-x-[15%] bottom-0 h-64 rounded-full bg-cyan-400/7 blur-[110px]"
      />
      <Container>
        <Reveal>
          <GlassPanel className="relative overflow-hidden border-cyan-200/15 bg-gradient-to-br from-cyan-400/8 via-white/[0.035] to-teal-400/8 p-8 sm:p-10 lg:p-14">
            <div className="relative max-w-3xl">
              <Badge variant="info" className="gap-2">
                <Sparkles aria-hidden="true" size={14} /> Explore Clinora
              </Badge>
              <h2 className="mt-6 text-balance text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl">
                {title}
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">{copy}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to={primary.to} className={buttonVariants({ size: 'lg' })}>
                  {primary.label} <ArrowRight aria-hidden="true" size={18} />
                </Link>
                {secondary ? (
                  <Link to={secondary.to} className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
                    {secondary.label}
                  </Link>
                ) : null}
              </div>
            </div>
          </GlassPanel>
        </Reveal>
      </Container>
    </section>
  );
}
