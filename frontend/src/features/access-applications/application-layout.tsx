import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router';

export function ApplicationLayout() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_4%,rgba(14,165,233,.10),transparent_30%),radial-gradient(circle_at_92%_92%,rgba(20,184,166,.07),transparent_32%)]" />
      <div className="biomedical-grid pointer-events-none absolute inset-0 opacity-[0.08]" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1240px] flex-col px-4 py-5 sm:px-7 sm:py-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between border-b border-white/[0.08] pb-4">
          <Link
            to="/"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
          >
            <ArrowLeft size={15} aria-hidden="true" /> Back to Clinora
          </Link>
          <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
            <LockKeyhole size={13} className="text-teal-300" aria-hidden="true" /> Private application
          </span>
        </header>
        <section className="w-full flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${location.pathname}:${location.search ? 'query' : 'route'}`}
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
}
