import { ArrowLeft, Dna, ShieldCheck, Sparkles } from 'lucide-react';
import { Link, Outlet } from 'react-router';

export function AuthLayout() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,.10),transparent_35%)]" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-[1400px] lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="hidden border-r border-white/10 px-12 py-12 lg:flex lg:flex-col lg:justify-between">
          <Link to="/" className="inline-flex items-center gap-3 text-sm text-slate-300 hover:text-white">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Clinora
          </Link>

          <div className="max-w-lg">
            <div className="mb-8 inline-flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-300/20 bg-cyan-300/10 shadow-[0_0_60px_rgba(14,165,233,.16)]">
              <Dna size={32} className="text-cyan-200" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Secure patient identity</p>
            <div className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white xl:text-5xl">
              Protected access before clinical intelligence.
            </div>
            <p className="mt-6 text-lg leading-8 text-slate-300">
              Clinora verifies identity and protects sessions before any future medical workflow becomes available.
            </p>
          </div>

          <div className="grid gap-3 text-sm text-slate-400">
            <span className="flex items-center gap-3">
              <ShieldCheck size={17} className="text-teal-300" aria-hidden="true" />
              Patient-only public self-registration
            </span>
            <span className="flex items-center gap-3">
              <Sparkles size={17} className="text-cyan-300" aria-hidden="true" />
              No medical profile collected during Phase 4B
            </span>
          </div>
        </aside>

        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-xl">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <Link to="/" className="text-sm font-semibold text-slate-300 hover:text-white">
                Clinora AI
              </Link>
              <span className="rounded-full border border-cyan-300/15 bg-cyan-300/5 px-3 py-1 text-xs text-cyan-200">
                Secure access
              </span>
            </div>
            <Outlet />
          </div>
        </section>
      </div>
    </main>
  );
}
