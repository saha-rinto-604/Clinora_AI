import { Activity, ArrowUp } from 'lucide-react';
import { Link } from 'react-router';
import { Separator } from '../ui';
import { footerGroups } from './public-data';

export function PublicFooter() {
  return (
    <footer className="border-t border-white/7 bg-slate-950/80">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-6 py-14 sm:px-8 lg:px-[var(--container-padding)]">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_1.85fr]">
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
              Human-centered clinical intelligence connecting healthcare workflows, AI-assisted reasoning, emergency
              coordination, and privacy-conscious research.
            </p>
          </div>

          <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-8 sm:grid-cols-3 xl:grid-cols-5">
            {footerGroups.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{group.label}</p>
                <ul className="mt-4 space-y-3">
                  {group.links.map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className="rounded-md text-sm font-medium text-slate-400 transition duration-300 hover:text-white focus-visible:text-white"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <Separator className="my-9" />
        <div className="flex flex-col justify-between gap-4 text-xs text-slate-500 sm:flex-row sm:items-center">
          <p>© 2026 Clinora AI. Public product information.</p>
          <a
            href="#main-content"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 font-semibold text-slate-400 hover:text-white"
          >
            Back to top <ArrowUp aria-hidden="true" size={14} />
          </a>
        </div>
      </div>
    </footer>
  );
}
