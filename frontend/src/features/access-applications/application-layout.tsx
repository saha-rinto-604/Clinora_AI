import { ArrowLeft, FileLock2, ShieldCheck } from 'lucide-react';
import { Link, Outlet } from 'react-router';

export function ApplicationLayout() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_5%,rgba(14,165,233,.12),transparent_32%),radial-gradient(circle_at_90%_90%,rgba(20,184,166,.09),transparent_34%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1320px] flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white">
            <ArrowLeft size={16} aria-hidden="true" /> Back to Clinora
          </Link>
          <div className="flex flex-wrap gap-3 text-xs text-slate-300">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/5 px-3 py-1.5">
              <ShieldCheck size={14} className="text-teal-300" aria-hidden="true" />
              Applicant access only
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/5 px-3 py-1.5">
              <FileLock2 size={14} className="text-cyan-300" aria-hidden="true" />
              Private evidence
            </span>
          </div>
        </header>
        <section className="w-full flex-1">
          <Outlet />
        </section>
      </div>
    </main>
  );
}
