import { ArrowDown, ArrowRight, CheckCircle2, FileScan, ShieldCheck, Sparkles, Stethoscope } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Badge, GlassPanel } from '../ui';
import { buttonVariants } from '../ui/button-variants';
import { BiomedicalBackground } from './biomedical-background';
import { trustSignals } from './landing-data';

export function LandingHero() {
  const reducedMotion = useReducedMotion();
  const heroInitial = reducedMotion ? false : { opacity: 0, y: 24 };
  const heroAnimate = reducedMotion ? undefined : { opacity: 1, y: 0 };
  const heroTransition = (delay: number) => ({ duration: 0.62, delay, ease: [0.22, 1, 0.36, 1] as const });

  return (
    <section id="top" className="relative isolate overflow-hidden border-b border-white/5">
      <BiomedicalBackground />
      <div className="hero-veil absolute inset-0" />
      <div className="relative mx-auto grid min-h-[calc(100svh-5rem)] w-full max-w-[var(--container-max)] items-center gap-14 px-6 py-20 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:px-[var(--container-padding)] lg:py-28">
        <div className="relative z-10 max-w-4xl">
          <motion.div
            initial={heroInitial}
            animate={heroAnimate}
            transition={heroTransition(0.04)}
            className="flex flex-wrap items-center gap-3"
          >
            <Badge variant="info" className="gap-2 px-4 py-2 text-[11px] uppercase tracking-[0.16em]">
              <Sparkles aria-hidden="true" size={14} />
              AI-powered clinical intelligence
            </Badge>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Human reviewed</span>
          </motion.div>

          <motion.h1
            initial={heroInitial}
            animate={heroAnimate}
            transition={heroTransition(0.12)}
            className="mt-7 max-w-4xl text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl xl:text-[5.35rem]"
          >
            Clinical intelligence,{' '}
            <span className="block bg-gradient-to-r from-cyan-200 via-sky-300 to-teal-300 bg-clip-text text-transparent">
              built around human judgment.
            </span>
          </motion.h1>

          <motion.p
            initial={heroInitial}
            animate={heroAnimate}
            transition={heroTransition(0.2)}
            className="mt-7 max-w-2xl text-pretty text-base leading-8 text-slate-300 sm:text-lg"
          >
            Clinora AI connects patients, clinicians, hospitals, researchers, and blood banks through secure AI-assisted
            workflows that turn complex clinical information into reviewable insight—with qualified professionals in
            control.
          </motion.p>

          <motion.div
            initial={heroInitial}
            animate={heroAnimate}
            transition={heroTransition(0.28)}
            className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
          >
            <a href="#platform" className={buttonVariants({ size: 'lg' })}>
              Explore Platform
              <ArrowRight aria-hidden="true" size={18} />
            </a>
            <a href="#workflow" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
              See How It Works
              <ArrowDown aria-hidden="true" size={18} />
            </a>
          </motion.div>

          <motion.ul
            initial={heroInitial}
            animate={heroAnimate}
            transition={heroTransition(0.36)}
            className="mt-10 flex flex-wrap gap-x-5 gap-y-3"
            aria-label="Platform trust principles"
          >
            {trustSignals.map((signal) => (
              <li key={signal} className="flex items-center gap-2 text-xs font-medium text-slate-400 sm:text-sm">
                <CheckCircle2 aria-hidden="true" className="text-teal-300" size={16} />
                {signal}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          initial={reducedMotion ? undefined : { opacity: 0, scale: 0.97, x: 18 }}
          animate={reducedMotion ? undefined : { opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 0.68, delay: 0.38, ease: [0.22, 1, 0.36, 1] }}
          whileHover={reducedMotion ? undefined : { y: -4, scale: 1.006 }}
          className="relative z-10 mx-auto hidden w-full max-w-xl lg:block"
        >
          <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-cyan-400/8 via-transparent to-teal-400/8 blur-2xl" />
          <GlassPanel className="relative overflow-hidden border-cyan-200/15 bg-slate-950/48 p-4 shadow-[0_28px_90px_rgba(0,0,0,.48)]">
            <div className="flex items-center justify-between gap-4 border-b border-white/8 px-3 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Clinical workflow</p>
                <p className="mt-1 text-sm text-slate-400">Illustrative interface</p>
              </div>
              <Badge variant="success">Review required</Badge>
            </div>

            <div className="grid gap-3 py-4 sm:grid-cols-2">
              <div className="rounded-[1.35rem] border border-white/8 bg-slate-950/55 p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                    <FileScan aria-hidden="true" size={19} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">Report ready</p>
                    <p className="text-xs text-slate-500">Structured values extracted</p>
                  </div>
                </div>
                <div className="mt-5 space-y-2">
                  <div className="h-2 rounded-full bg-white/7">
                    <div className="h-2 w-4/5 rounded-full bg-gradient-to-r from-cyan-400/55 to-teal-400/35" />
                  </div>
                  <div className="h-2 w-3/4 rounded-full bg-white/7" />
                  <div className="h-2 w-1/2 rounded-full bg-white/7" />
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-white/8 bg-slate-950/55 p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-400/10 text-teal-200">
                    <Stethoscope aria-hidden="true" size={19} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">AI assistance</p>
                    <p className="text-xs text-slate-500">Advisory reasoning available</p>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl border border-teal-300/10 bg-teal-300/5 p-3 text-xs leading-5 text-slate-300">
                  Clinical context is presented for professional review—not as an autonomous diagnosis.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-[1.35rem] border border-white/8 bg-white/[0.035] p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/5 text-slate-300">
                  <ShieldCheck aria-hidden="true" size={19} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">Physician review</p>
                  <p className="text-xs text-slate-500">Human judgment remains authoritative</p>
                </div>
              </div>
              <span className="hidden h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,.7)] sm:block" />
            </div>
          </GlassPanel>
        </motion.div>
      </div>
    </section>
  );
}
