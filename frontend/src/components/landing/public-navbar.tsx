import { ArrowDown, Menu, X } from 'lucide-react';
import { buttonVariants } from '../ui/button-variants';
import { Drawer, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger, IconButton, Separator } from '../ui';
import { navItems } from './landing-data';

export function PublicNavbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/55 backdrop-blur-2xl">
      <div className="mx-auto flex min-h-20 w-full max-w-[var(--container-max)] items-center justify-between gap-4 px-6 sm:px-8 lg:px-[var(--container-padding)]">
        <a href="#top" className="group flex items-center gap-3 rounded-xl" aria-label="Clinora AI home">
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
        </a>

        <nav aria-label="Public navigation" className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="min-h-11 rounded-2xl px-3.5 py-3 text-sm font-medium text-slate-300 transition duration-300 hover:-translate-y-0.5 hover:bg-white/5 hover:text-white active:translate-y-0 active:scale-[0.98]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:block">
          <a href="#workflow" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            How it works
            <ArrowDown aria-hidden="true" size={16} />
          </a>
        </div>

        <div className="lg:hidden">
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
              <nav aria-label="Mobile public navigation" className="grid gap-2">
                {navItems.map((item) => (
                  <DrawerClose asChild key={item.href}>
                    <a
                      href={item.href}
                      className="flex min-h-12 items-center rounded-2xl px-4 text-base font-semibold text-slate-200 transition duration-300 hover:bg-white/10 hover:text-white active:scale-[0.985]"
                    >
                      {item.label}
                    </a>
                  </DrawerClose>
                ))}
              </nav>
              <DrawerClose asChild>
                <a href="#workflow" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
                  How Clinora Works
                  <ArrowDown aria-hidden="true" size={17} />
                </a>
              </DrawerClose>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    </header>
  );
}
