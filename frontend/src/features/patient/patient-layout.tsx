import { ChevronDown, FileText, HeartPulse, Home, LockKeyhole, LogOut, UserRound } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { ClinoraBrandMark } from '../../components/ui/clinora-brand-mark';
import { cn } from '../../lib/cn';
import { authApi } from '../auth/auth-api';
import { useAuthStore } from '../auth/auth-store';

const navigation = [
  { to: '/patient', label: 'Home', shortLabel: 'Home', icon: Home, end: true },
  { to: '/patient/reports', label: 'Medical Reports', shortLabel: 'Reports', icon: FileText },
  { to: '/patient/profile', label: 'Health Profile', shortLabel: 'Profile', icon: HeartPulse },
  { to: '/account', label: 'Account & Security', shortLabel: 'Security', icon: LockKeyhole },
];

export function PatientLayout() {
  return (
    <PatientShell>
      <Outlet />
    </PatientShell>
  );
}

export function PatientShell({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const clinicalHome = location.pathname === '/patient' || location.pathname === '/patient/';
  const reportWorkspace = location.pathname.startsWith('/patient/reports');
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await authApi.logout();
      navigate('/login', { replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="relative isolate min-h-dvh overflow-x-clip bg-[var(--clinora-bg-canvas)] text-white">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[244px] flex-col border-r border-[var(--clinora-border-subtle)] bg-[var(--clinora-bg-chrome)] px-4 py-6 lg:flex">
        <NavLink to="/patient" className="flex min-h-11 items-center gap-3 rounded-2xl px-3">
          <ClinoraBrandMark />
          <span>
            <span className="block font-semibold tracking-[-0.02em]">Clinora AI</span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--clinora-info-foreground)]">
              Patient care
            </span>
          </span>
        </NavLink>

        <nav aria-label="Patient navigation" className="mt-9 grid gap-1.5">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'relative flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-colors duration-200',
                  isActive
                    ? 'bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]'
                    : 'text-slate-400 hover:bg-white/[0.045] hover:text-slate-100',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <motion.span
                      layoutId="patient-active"
                      className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--clinora-accent-cyan)]"
                    />
                  ) : null}
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-2.5 text-left hover:bg-white/[0.06]"
                aria-label="Open Patient account menu"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]">
                  <UserRound size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {user?.firstName} {user?.lastName}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">Patient</span>
                </span>
                <ChevronDown size={15} className="text-slate-500" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => navigate('/account')}>
                <LockKeyhole size={15} aria-hidden="true" /> Account & Security
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void signOut()} disabled={signingOut}>
                <LogOut size={15} aria-hidden="true" /> {signingOut ? 'Signing out…' : 'Sign out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="relative z-10 min-h-dvh text-white lg:pl-[244px]" style={{ colorScheme: 'dark' }}>
        <header className="sticky top-0 z-30 border-b border-[var(--clinora-border-subtle)] bg-[var(--clinora-bg-canvas)] px-4 py-2.5 lg:hidden">
          <div className="mx-auto flex min-h-11 max-w-[1160px] items-center justify-between gap-3">
            <NavLink to="/patient" className="flex items-center gap-2.5 font-semibold text-white">
              <ClinoraBrandMark size="sm" />
              Clinora <span className="text-[var(--clinora-info-foreground)]">Patient</span>
            </NavLink>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Open Patient account menu"
                  className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 text-slate-300"
                >
                  <UserRound size={19} aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={() => navigate('/account')}>
                  <LockKeyhole size={15} aria-hidden="true" /> Account & Security
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void signOut()} disabled={signingOut}>
                  <LogOut size={15} aria-hidden="true" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <motion.main
          initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            'mx-auto w-full px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-6 sm:px-7 sm:pt-8 lg:px-8 lg:pb-12 lg:pt-10',
            clinicalHome ? 'max-w-[1480px]' : reportWorkspace ? 'max-w-[1360px]' : 'max-w-[1224px]',
          )}
        >
          {children}
        </motion.main>

        <nav
          aria-label="Patient mobile navigation"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--clinora-border-subtle)] bg-[var(--clinora-bg-chrome)] px-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <div className="mx-auto grid max-w-lg grid-cols-4">
            {navigation.map(({ to, shortLabel, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-[64px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-200',
                    isActive ? 'text-[var(--clinora-info-foreground)]' : 'text-slate-500',
                  )
                }
              >
                <Icon size={19} aria-hidden="true" /> {shortLabel}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
