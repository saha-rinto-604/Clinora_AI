import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Dna, ShieldCheck, Sparkles } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router';
import { BiomedicalBackground } from '../../components/landing/biomedical-background';

export function AuthLayout() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-[0.18]" aria-hidden="true">
        <BiomedicalBackground />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-slate-950/[0.72]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_30%,rgba(14,165,233,.11),transparent_34%),radial-gradient(circle_at_82%_78%,rgba(20,184,166,.08),transparent_32%)]" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1320px] lg:grid-cols-[0.9fr_1.1fr]">
        <motion.aside
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="hidden border-r border-white/[0.08] px-10 py-10 lg:flex lg:flex-col lg:justify-between xl:px-12 xl:py-12"
        >
          <Link
            to="/"
            className="inline-flex w-fit items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Back to Clinora
          </Link>

          <div className="max-w-md">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/[0.16] bg-cyan-300/[0.07] shadow-[0_0_44px_rgba(14,165,233,.12)]">
              <Dna size={24} className="text-cyan-200" aria-hidden="true" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Secure access</p>
            <div className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-white xl:text-4xl">
              Your Clinora account, protected from the start.
            </div>
            <p className="mt-5 text-base leading-7 text-slate-400">
              Sign in or create a patient account through a focused, secure flow before accessing future clinical
              features.
            </p>
          </div>

          <div className="grid gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-3">
              <ShieldCheck size={16} className="text-teal-300" aria-hidden="true" />
              Protected account and session access
            </span>
            <span className="flex items-center gap-3">
              <Sparkles size={16} className="text-cyan-300" aria-hidden="true" />
              Professional access uses a separate application flow
            </span>
          </div>
        </motion.aside>

        <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-8 lg:px-10 xl:px-12">
          <div className="w-full max-w-lg">
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <Link to="/" className="text-sm font-semibold text-slate-300 transition hover:text-white">
                Clinora AI
              </Link>
              <span className="rounded-full border border-cyan-300/[0.12] bg-cyan-300/[0.05] px-2.5 py-1 text-[11px] font-medium text-cyan-200">
                Secure access
              </span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -7, scale: 0.997 }}
                transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      </div>
    </main>
  );
}
