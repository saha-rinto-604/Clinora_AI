import {
  Bell,
  ChevronDown,
  Clock3,
  Database,
  FolderGit2,
  LockKeyhole,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router';
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
  description: string;
  icon: LucideIcon;
  end?: boolean;
};

const navigation: { label: string; items: NavigationItem[] }[] = [
  {
    label: 'Governance',
    items: [
      {
        to: '/admin/access-reviews',
        label: 'Access Applications',
        shortLabel: 'Applications',
        description: 'Doctor & researcher credential reviews',
        icon: UserCheck,
        end: true,
      },
    ],
  },
  {
    label: 'Research Audit',
    items: [
      {
        to: '/admin/research/projects',
        label: 'Research Projects',
        shortLabel: 'Projects',
        description: 'Study protocol & IRB governance',
        icon: FolderGit2,
      },
      {
        to: '/admin/research/dataset-requests',
        label: 'Dataset Requests',
        shortLabel: 'Datasets',
        description: 'Cohort extraction & data governance',
        icon: Database,
      },
    ],
  },
  {
    label: 'Account',
    items: [
      {
        to: '/account',
        label: 'Account & Security',
        shortLabel: 'Account',
        description: 'Admin profile and security settings',
        icon: LockKeyhole,
      },
    ],
  },
];

const allNavigation = navigation.flatMap((section) => section.items);

export function AdminLayout() {
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFeedback, setSearchFeedback] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [signingOut, setSigningOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 10_000);
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    if (/access|doctor|researcher|apply|application|credential/.test(query)) {
      setSearchFeedback('');
      navigate('/admin/access-reviews');
    } else if (/project|protocol|irb|study|research/.test(query)) {
      setSearchFeedback('');
      navigate('/admin/research/projects');
    } else if (/data|dataset|cohort|request|extract/.test(query)) {
      setSearchFeedback('');
      navigate('/admin/research/dataset-requests');
    } else if (/account|security|password|profile/.test(query)) {
      setSearchFeedback('');
      navigate('/account');
    } else {
      setSearchFeedback('Try searching: "applications", "projects", "datasets", or "security"');
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await authApi.logout();
      navigate('/login', { replace: true });
    } catch {
      navigate('/login', { replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  const adminName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ''}`.trim()
    : 'System Admin';
  const adminEmail = user?.email ?? 'admin@clinora.local';

  return (
    <div className="relative isolate min-h-dvh overflow-x-clip bg-[var(--clinora-bg-canvas)] text-white selection:bg-cyan-500/30">
      {/* Fixed 244px Sidebar Matching Patient & Doctor Workspaces */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[244px] flex-col border-r border-[var(--clinora-border-subtle)] bg-[var(--clinora-bg-chrome)] px-4 py-6 lg:flex">
        {/* Brand Header */}
        <NavLink to="/admin/access-reviews" className="flex min-h-11 items-center gap-3 rounded-2xl px-3 transition-opacity hover:opacity-90">
          <ClinoraBrandMark />
          <span>
            <span className="block font-semibold tracking-[-0.02em]">Clinora AI</span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--clinora-info-foreground)]">
              Governance &amp; Admin
            </span>
          </span>
        </NavLink>

        {/* Navigation Sections */}
        <nav aria-label="Admin navigation" className="mt-7 grid gap-5">
          {navigation.map((section) => (
            <section key={section.label} aria-labelledby={`admin-nav-${section.label.toLowerCase().replace(/\s+/g, '-')}`}>
              <h2
                id={`admin-nav-${section.label.toLowerCase().replace(/\s+/g, '-')}`}
                className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600"
              >
                {section.label}
              </h2>
              <div className="mt-1.5 grid gap-1">
                {section.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      cn(
                        'relative flex min-h-10 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-colors duration-200',
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
                            layoutId={reducedMotion ? undefined : 'admin-active-indicator'}
                            className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--clinora-accent-cyan)]"
                          />
                        ) : null}
                        <Icon size={17} aria-hidden="true" />
                        {label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </section>
          ))}
        </nav>

        {/* Profile Card & Menu */}
        <div className="mt-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-2.5 text-left hover:bg-white/[0.06] transition-colors"
                aria-label="Open Admin account menu"
              >
                <ProfileAvatar
                  source={{ kind: 'self' }}
                  name={adminName}
                  size="sm"
                  className="rounded-xl"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">
                    {adminName}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500 font-mono">
                    System Admin
                  </span>
                </span>
                <ChevronDown size={15} className="text-slate-500" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2 border-b border-white/10 text-xs">
                <div className="font-semibold text-slate-200">{adminName}</div>
                <div className="text-[10px] text-slate-400 font-mono truncate">{adminEmail}</div>
              </div>
              <DropdownMenuItem onSelect={() => navigate('/account')}>
                <LockKeyhole size={15} aria-hidden="true" /> Account & Security
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => void signOut()}
                disabled={signingOut}
                id="admin-logout-button"
                className="text-rose-400 focus:text-rose-300"
              >
                <LogOut size={15} aria-hidden="true" /> {signingOut ? 'Signing out…' : 'Sign out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="relative z-10 min-h-dvh text-white lg:pl-[244px]" style={{ colorScheme: 'dark' }}>
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex min-h-12 items-center justify-between border-b border-[var(--clinora-border-subtle)] bg-[var(--clinora-bg-canvas)] px-4 py-2.5 lg:hidden">
          <NavLink to="/admin/access-reviews" className="flex items-center gap-2.5 font-semibold text-white">
            <ClinoraBrandMark size="sm" />
            Clinora <span className="text-[var(--clinora-info-foreground)]">Admin</span>
          </NavLink>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-slate-300 hover:text-white"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </header>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-b border-white/10 bg-slate-950/95 px-4 py-4 space-y-3 animate-in slide-in-from-top-2">
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs">
              <div className="font-semibold text-slate-200">{adminName}</div>
              <div className="text-[11px] text-slate-400 font-mono">{adminEmail}</div>
            </div>
            <nav className="grid gap-1">
              {allNavigation.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]'
                          : 'text-slate-400 hover:bg-white/[0.045] hover:text-white'
                      )
                    }
                  >
                    <Icon size={18} />
                    <div>
                      <div className="font-semibold">{item.label}</div>
                      <div className="text-[11px] text-slate-400">{item.description}</div>
                    </div>
                  </NavLink>
                );
              })}
            </nav>
            <div className="pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={signingOut}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs font-semibold hover:bg-rose-900/40"
              >
                <LogOut size={16} />
                <span>{signingOut ? 'Signing out...' : 'Sign Out'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Desktop Top Utility Bar (Search, Alerts, Live Clock) Matching Patient Portal */}
        <div className="hidden lg:flex min-h-[64px] items-center justify-between gap-6 border-b border-[rgba(125,211,252,0.07)] px-8 py-3 bg-[var(--clinora-bg-canvas)]/80 backdrop-blur-md sticky top-0 z-20">
          {/* Global Quick Jump / Search */}
          <div className="relative w-full max-w-[480px]">
            <form onSubmit={handleSearchSubmit} className="relative flex min-h-10 items-center gap-2.5 rounded-xl border border-[rgba(125,211,252,0.14)] bg-[rgba(6,24,37,0.88)] px-3 text-sm text-slate-300 transition-all focus-within:border-cyan-400/60 focus-within:ring-1 focus-within:ring-cyan-400/30">
              <Search size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search applications, research protocols, datasets…"
                className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none"
                aria-label="Search governance console"
              />
              <kbd className="shrink-0 rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                Ctrl K
              </kbd>
            </form>
            {searchFeedback && (
              <p className="absolute left-0 top-full mt-1.5 rounded-lg border border-white/10 bg-[#061521] px-3 py-1.5 text-xs text-cyan-300 shadow-lg z-30">
                {searchFeedback}
              </p>
            )}
          </div>

          {/* Right Utilities: Tag, Notifications, and Live Clock */}
          <div className="flex items-center gap-6 shrink-0">
            {/* Governance Tag */}
            <span className="hidden xl:inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-950/40 px-3 py-1 text-xs font-medium text-cyan-300 shadow-sm">
              <ShieldCheck size={13} className="text-cyan-400" />
              Institutional Review Board
            </span>

            {/* Notification Bell */}
            <button
              type="button"
              className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors"
              aria-label="Admin alerts"
              title="System governance alerts"
            >
              <Bell size={18} aria-hidden="true" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            </button>

            {/* Live Clock Component Matching Patient Portal */}
            <div className="flex items-center gap-3.5 border-l border-white/10 pl-6 text-slate-300 font-mono text-xs tabular-nums">
              <Clock3 size={22} className="text-cyan-400 shrink-0" aria-hidden="true" />
              <time dateTime={now.toISOString()} className="flex flex-col leading-tight">
                <span className="text-[11px] text-slate-400 font-sans tracking-wide">
                  {now.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <strong className="text-base font-semibold text-white font-sans">
                  {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()}
                </strong>
              </time>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="w-full pb-16">{children}</main>
      </div>
    </div>
  );
}
