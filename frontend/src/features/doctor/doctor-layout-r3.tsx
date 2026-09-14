import { CalendarClock, CalendarDays, ChevronDown, Home, LockKeyhole, LogOut, Menu, UserRound } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
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
import { ProfileAvatar } from '../profile/profile-image';

type NavigationItem = {
  to: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  end?: boolean;
};

const navigation: { label: string; items: NavigationItem[] }[] = [
  {
    label: 'Care workspace',
    items: [
      { to: '/doctor', label: 'Today', shortLabel: 'Today', icon: Home, end: true },
      { to: '/doctor/schedule', label: 'Schedule', shortLabel: 'Schedule', icon: CalendarDays },
    ],
  },
  {
    label: 'Practice',
    items: [
      { to: '/doctor/availability', label: 'Availability', shortLabel: 'Times', icon: CalendarClock },
      { to: '/doctor/profile', label: 'Professional profile', shortLabel: 'Profile', icon: UserRound },
    ],
  },
  {
    label: 'Account',
    items: [{ to: '/account', label: 'Security & account', shortLabel: 'Account', icon: LockKeyhole }],
  },
];

const allNavigation = navigation.flatMap((section) => section.items);
const mobileNavigation = allNavigation.filter((item) =>
  ['/doctor', '/doctor/schedule', '/doctor/availability', '/doctor/profile'].includes(item.to),
);

export function DoctorLayout() {
  return (
    <DoctorShell>
      <Outlet />
    </DoctorShell>
  );
}

export function DoctorShell({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const [signingOut, setSigningOut] = useState(false);
  const wideWorkspace =
    location.pathname.includes('/reports/') ||
    location.pathname.includes('/availability') ||
    location.pathname.includes('/schedule');

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
    <div className="clinora-r3-shell relative isolate min-h-dvh overflow-x-clip text-white">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-white/[0.055] bg-[#040b13]/95 px-4 py-5 backdrop-blur-xl lg:flex">
        <NavLink
          to="/doctor"
          className="flex min-h-12 items-center gap-3 rounded-xl px-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        >
          <ClinoraBrandMark />
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold tracking-[-0.025em] text-white">Clinora AI</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-300/80" aria-hidden="true" />
              Clinical workspace
            </span>
          </span>
        </NavLink>

        <div className="mt-6 h-px bg-white/[0.055]" />

        <nav aria-label="Doctor navigation" className="mt-5 grid gap-6">
          {navigation.map((section) => (
            <section
              key={section.label}
              aria-labelledby={`doctor-r3-nav-${section.label.replaceAll(' ', '-').toLowerCase()}`}
            >
              <h2
                id={`doctor-r3-nav-${section.label.replaceAll(' ', '-').toLowerCase()}`}
                className="px-2.5 text-[9px] font-bold uppercase tracking-[0.17em] text-slate-600"
              >
                {section.label}
              </h2>
              <div className="mt-2 grid gap-1">
                {section.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    aria-label={to === '/doctor' ? 'Home' : undefined}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex min-h-10 items-center gap-3 rounded-[11px] px-3 text-[13px] font-medium transition-colors duration-200',
                        isActive
                          ? 'bg-white/[0.055] text-white'
                          : 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-200',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive ? (
                          <motion.span
                            layoutId="doctor-r3-active"
                            className="absolute inset-y-2.5 left-0 w-[2px] rounded-full bg-cyan-300"
                            transition={{ duration: reducedMotion ? 0 : 0.2 }}
                          />
                        ) : null}
                        <Icon
                          size={16}
                          strokeWidth={1.8}
                          aria-hidden="true"
                          className={isActive ? 'text-cyan-200' : 'text-slate-600 group-hover:text-slate-300'}
                        />
                        <span className="truncate">{label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="mt-auto border-t border-white/[0.055] pt-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="group flex min-h-14 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.035]"
                aria-label="Open Doctor account menu"
              >
                <ProfileAvatar
                  source={{ kind: 'self' }}
                  name={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Doctor'}
                  size="sm"
                  className="rounded-[10px] ring-1 ring-white/[0.08]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-slate-100">
                    {user?.firstName} {user?.lastName}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-slate-600">Verified Doctor account</span>
                </span>
                <ChevronDown size={14} className="text-slate-600 group-hover:text-slate-400" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => navigate('/doctor/profile')}>
                <UserRound size={15} aria-hidden="true" /> Professional profile
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate('/account')}>
                <LockKeyhole size={15} aria-hidden="true" /> Security & account
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void signOut()} disabled={signingOut}>
                <LogOut size={15} aria-hidden="true" /> {signingOut ? 'Signing out…' : 'Sign out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="relative z-10 min-h-dvh lg:pl-[264px]" style={{ colorScheme: 'dark' }}>
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#030914]/90 px-4 py-2.5 backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex min-h-11 max-w-[1180px] items-center justify-between gap-3">
            <NavLink to="/doctor" className="flex items-center gap-2.5 font-semibold text-white">
              <ClinoraBrandMark size="sm" />
              <span className="tracking-[-0.02em]">Clinora Doctor</span>
            </NavLink>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open Doctor navigation"
                    className="grid h-10 w-10 place-items-center rounded-[10px] border border-white/[0.08] bg-white/[0.025] text-slate-300"
                  >
                    <Menu size={18} aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {allNavigation.map(({ to, label, icon: Icon }) => (
                    <DropdownMenuItem key={to} onSelect={() => navigate(to)}>
                      <Icon size={16} aria-hidden="true" /> {label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem onSelect={() => void signOut()} disabled={signingOut}>
                    <LogOut size={16} aria-hidden="true" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                aria-label="Open Doctor profile"
                onClick={() => navigate('/doctor/profile')}
                className="grid h-10 w-10 place-items-center rounded-[10px] border border-white/[0.08] bg-white/[0.025] text-slate-300"
              >
                <UserRound size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        <motion.main
          initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            'mx-auto w-full px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-7 sm:pt-7 lg:px-8 lg:pb-12 lg:pt-8 2xl:px-10',
            wideWorkspace ? 'max-w-[1660px]' : 'max-w-[1580px]',
          )}
        >
          {children}
        </motion.main>

        <nav
          aria-label="Doctor mobile navigation"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-[#040b13]/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
        >
          <div className="mx-auto grid max-w-lg grid-cols-4">
            {mobileNavigation.map(({ to, shortLabel, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                aria-label={to === '/doctor' ? 'Home' : undefined}
                className={({ isActive }) =>
                  cn(
                    'relative flex min-h-[62px] flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors duration-200',
                    isActive ? 'text-cyan-200' : 'text-slate-600',
                  )
                }
              >
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                {shortLabel}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
