import { Activity, ArrowUpRight } from 'lucide-react';
import { Link, Separator } from '../ui';
import { footerLinks } from './landing-data';

export function PublicFooter() {
  return (
    <footer className="border-t border-white/7 bg-slate-950/75">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-6 py-12 sm:px-8 lg:px-[var(--container-padding)]">
        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="max-w-xl">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/8 text-cyan-200">
                <Activity aria-hidden="true" size={19} />
              </span>
              <div>
                <p className="font-semibold text-white">Clinora AI</p>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Clinical Intelligence Platform</p>
              </div>
            </div>
            <p className="mt-5 max-w-lg text-sm leading-7 text-slate-400">
              A human-centered clinical intelligence platform connecting AI-assisted decision support, healthcare
              coordination, and privacy-conscious research.
            </p>
          </div>

          <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
            {footerLinks.map((item) => (
              <Link key={`${item.href}-${item.label}`} href={item.href} subtle className="text-sm no-underline">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <Separator className="my-8" />
        <div className="flex flex-col justify-between gap-4 text-xs text-slate-500 sm:flex-row sm:items-center">
          <p>© 2026 Clinora AI.</p>
          <a
            href="#top"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 font-semibold text-slate-400 hover:text-white"
          >
            Back to top <ArrowUpRight aria-hidden="true" size={14} />
          </a>
        </div>
      </div>
    </footer>
  );
}
