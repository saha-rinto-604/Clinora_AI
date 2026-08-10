import { motion, useReducedMotion } from 'framer-motion';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type PropsWithChildren } from 'react';

export function AuthCard({ children }: PropsWithChildren) {
  return (
    <div className="rounded-[24px] border border-white/[0.12] bg-white/[0.065] p-5 shadow-[0_18px_48px_rgba(0,0,0,.28)] backdrop-blur-[18px] sm:p-6">
      {children}
    </div>
  );
}

export function AuthHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="mb-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">{eyebrow}</p>
      <h1 className="mt-2.5 text-[28px] font-semibold tracking-[-0.03em] text-white sm:text-[32px]">{title}</h1>
      <p className="mt-2.5 text-sm leading-6 text-slate-400">{description}</p>
    </header>
  );
}

export function Field({
  label,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  return (
    <label htmlFor={inputId} className="grid gap-1.5 text-[13px] font-medium text-slate-200">
      <span>{label}</span>
      <input
        {...props}
        id={inputId}
        className="min-h-11 w-full rounded-xl border border-white/[0.12] bg-slate-950/50 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-cyan-300/[0.55] focus:ring-2 focus:ring-cyan-400/10"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : props['aria-describedby']}
      />
      {error ? (
        <span id={errorId} className="text-xs font-medium leading-5 text-rose-300">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function PasswordField({
  label,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <label htmlFor={inputId} className="grid gap-1.5 text-[13px] font-medium text-slate-200">
      <span>{label}</span>
      <span className="relative">
        <input
          {...props}
          id={inputId}
          type={visible ? 'text' : 'password'}
          className="min-h-11 w-full rounded-xl border border-white/[0.12] bg-slate-950/50 px-3.5 pr-11 text-sm text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-cyan-300/[0.55] focus:ring-2 focus:ring-cyan-400/10"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : props['aria-describedby']}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.05] hover:text-white"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        </button>
      </span>
      {error ? (
        <span id={errorId} className="text-xs font-medium leading-5 text-rose-300">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function SubmitButton({
  loading,
  children,
  disabled,
  type = 'submit',
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }>) {
  return (
    <button
      {...props}
      type={type}
      disabled={loading || disabled}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 px-4 text-sm font-semibold text-slate-950 shadow-[0_10px_28px_rgba(14,165,233,.14)] transition duration-300 hover:-translate-y-px hover:shadow-[0_12px_32px_rgba(20,184,166,.18)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transform-none"
    >
      {loading ? (
        <LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}

export function FormNotice({ tone = 'info', children }: PropsWithChildren<{ tone?: 'info' | 'success' | 'error' }>) {
  const reduceMotion = useReducedMotion();
  const classes =
    tone === 'success'
      ? 'border-emerald-300/[0.18] bg-emerald-300/[0.07] text-emerald-100'
      : tone === 'error'
        ? 'border-rose-300/20 bg-rose-300/[0.08] text-rose-100'
        : 'border-cyan-300/[0.18] bg-cyan-300/[0.06] text-cyan-100';

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border px-3.5 py-3 text-sm leading-6 ${classes}`}
    >
      {children}
    </motion.div>
  );
}
