import { ArrowRight, Menu, X } from 'lucide-react';
import { Link, NavLink } from 'react-router';
import { Drawer, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger, IconButton, Separator } from '../ui';
import { buttonVariants } from '../ui/button-variants';
import { publicNavItems } from './public-data';

function navClass({ isActive }: { isActive: boolean }) {
  return `min-h-11 rounded-2xl px-3 py-3 text-sm font-medium transition duration-300 hover:-translate-y-0.5 hover:bg-white/5 hover:text-white active:translate-y-0 active:scale-[0.98] ${
    isActive ? 'bg-white/[0.055] text-cyan-200' : 'text-slate-300'
  }`;
}

export function PublicNavbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/70 backdrop-blur-2xl">
      <div className="mx-auto flex min-h-20 w-full max-w-[var(--container-max)] items-center justify-between gap-4 px-6 sm:px-8 lg:px-[var(--container-padding)]">
        <Link to="/" className="group flex items-center gap-3 rounded-xl" aria-label="Clinora AI home">
          <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-2xl border border-cyan-300/20 bg-cyan-300/10 shadow-[0_0_28px_rgba(14,165,233,.18)]">
            <span className="absolute h-8 w-2 rotate-45 rounded-full bg-gradient-to-b from-cyan-300 to-teal-400 opacity-70" />
            <span className="absolute h-8 w-2 -rotate-45 rounded-full bg-gradient-to-b from-teal-300 to-cyan-400 opacity-50" />
          </span>
          <span>
            <span className="block text-sm font-bold tracking-tight text-white">Clinora AI</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Clinical Intelligence
            </span>
          </span>
        </Link>

        <nav aria-label="Public navigation" className="hidden items-center gap-0.5 xl:flex">
          {publicNavItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={navClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden xl:block">
          <Link to="/contact" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            Contact
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>

        <div className="xl:hidden">
          <Drawer>
            <DrawerTrigger asChild>
              <IconButton aria-label="Open navigation menu" variant="secondary">
                <Menu aria-hidden="true" size={20} />
              </IconButton>
            </DrawerTrigger>
            <DrawerContent className="max-w-sm">
              <div className="flex items-center justify-between gap-4">
                <DrawerTitle className="text-lg font-semibold text-white">Clinora AI navigation</DrawerTitle>
                <DrawerClose asChild>
                  <IconButton aria-label="Close navigation menu" variant="ghost">
                    <X aria-hidden="true" size={20} />
                  </IconButton>
                </DrawerClose>
              </div>
              <Separator />
              <nav aria-label="Mobile public navigation" className="grid gap-1">
                {publicNavItems.map((item) => (
                  <DrawerClose asChild key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `flex min-h-12 items-center rounded-2xl px-4 text-base font-semibold transition duration-300 hover:bg-white/10 hover:text-white active:scale-[0.985] ${
                          isActive ? 'bg-white/[0.06] text-cyan-200' : 'text-slate-200'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </DrawerClose>
                ))}
              </nav>
              <DrawerClose asChild>
                <Link to="/contact" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
                  Contact Clinora
                  <ArrowRight aria-hidden="true" size={17} />
                </Link>
              </DrawerClose>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    </header>
  );
}
