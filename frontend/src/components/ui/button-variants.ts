import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-component)] px-5 text-sm font-semibold transition duration-300 active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-[var(--color-medical-cyan)] to-[var(--color-medical-teal)] text-slate-950 shadow-[0_0_24px_rgba(14,165,233,.28)] hover:-translate-y-0.5 hover:shadow-[0_0_34px_rgba(20,184,166,.35)]',
        appPrimary:
          'rounded-[var(--clinora-radius-md)] bg-[image:var(--clinora-primary-gradient)] text-slate-950 shadow-none duration-[var(--clinora-motion-hover)] hover:-translate-y-px hover:brightness-105',
        secondary:
          'border border-[var(--color-glass-border)] bg-[var(--color-glass)] text-[var(--color-text-primary)] shadow-[var(--shadow-glass)] backdrop-blur-[var(--blur-glass)] hover:bg-[var(--color-glass-strong)]',
        appSecondary:
          'rounded-[var(--clinora-radius-md)] border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] text-[var(--clinora-text-primary)] shadow-none duration-[var(--clinora-motion-hover)] hover:border-[var(--clinora-border-interactive)] hover:bg-[var(--clinora-surface-hover)] disabled:hover:border-[var(--clinora-border-subtle)] disabled:hover:bg-[var(--clinora-surface-nested)]',
        text: 'rounded-[var(--clinora-radius-md)] px-3 text-[var(--clinora-info-foreground)] shadow-none duration-[var(--clinora-motion-hover)] hover:bg-[var(--clinora-surface-hover)] hover:text-[var(--clinora-text-primary)]',
        ghost: 'text-[var(--color-text-secondary)] hover:bg-white/10 hover:text-[var(--color-text-primary)]',
        danger: 'bg-[var(--color-danger)] text-white hover:bg-red-400',
      },
      size: {
        sm: 'min-h-10 px-4 text-xs',
        md: 'min-h-11 px-5 text-sm',
        lg: 'min-h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);
