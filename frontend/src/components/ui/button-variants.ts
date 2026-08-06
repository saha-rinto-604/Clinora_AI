import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-component)] px-5 text-sm font-semibold transition duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-[var(--color-medical-cyan)] to-[var(--color-medical-teal)] text-slate-950 shadow-[0_0_24px_rgba(14,165,233,.28)] hover:-translate-y-0.5 hover:shadow-[0_0_34px_rgba(20,184,166,.35)]',
        secondary:
          'border border-[var(--color-glass-border)] bg-[var(--color-glass)] text-[var(--color-text-primary)] shadow-[var(--shadow-glass)] backdrop-blur-[var(--blur-glass)] hover:bg-[var(--color-glass-strong)]',
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
