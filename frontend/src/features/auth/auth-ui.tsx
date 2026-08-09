import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type PropsWithChildren } from 'react';

export function AuthCard({ children }: PropsWithChildren) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      className="rounded-[32px] border border-white/15 bg-white/[0.075] p-6 shadow-[0_20px_50px_rgba(0,0,0,.35)] backdrop-blur-[18px] sm:p-8"
    >
      {children}
    </motion.div>
  );
}

export function AuthHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="mb-7">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{eyebrow}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">{title}</h1>
      <p className="mt-3 leading-7 text-slate-300">{description}</p>
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
    <label htmlFor={inputId} className="grid gap-2 text-sm font-medium text-slate-200">
      <span>{label}</span>
      <input
        {...props}
        id={inputId}
        className="min-h-12 w-full rounded-2xl border border-white/15 bg-slate-950/55 px-4 text-white outline-none transition placeholder:text-slate-600 hover:border-white/25 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/15"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : props['aria-describedby']}
      />
      {error ? (
        <span id={errorId} className="text-xs font-medium text-rose-300">
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
    <label htmlFor={inputId} className="grid gap-2 text-sm font-medium text-slate-200">
      <span>{label}</span>
      <span className="relative">
        <input
          {...props}
          id={inputId}
          type={visible ? 'text' : 'password'}
          className="min-h-12 w-full rounded-2xl border border-white/15 bg-slate-950/55 px-4 pr-12 text-white outline-none transition placeholder:text-slate-600 hover:border-white/25 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/15"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : props['aria-describedby']}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </span>
      {error ? (
        <span id={errorId} className="text-xs font-medium text-rose-300">
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
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-400 px-5 font-bold text-slate-950 shadow-[0_10px_32px_rgba(14,165,233,.18)] transition duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transform-none"
    >
      {loading ? (
        <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}

export function FormNotice({ tone = 'info', children }: PropsWithChildren<{ tone?: 'info' | 'success' | 'error' }>) {
  const classes =
    tone === 'success'
      ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
      : tone === 'error'
        ? 'border-rose-300/20 bg-rose-300/10 text-rose-100'
        : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100';

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${classes}`}
    >
      {children}
    </div>
  );
}
