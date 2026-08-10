import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LoaderCircle } from 'lucide-react';
import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type PropsWithChildren,
  type TextareaHTMLAttributes,
} from 'react';
import { Button } from '../../components/ui/button';
import { Input, Textarea } from '../../components/ui/form';
import { cn } from '../../lib/cn';

export function ApplicationPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[20px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_18px_48px_rgba(0,0,0,.22)] backdrop-blur-[14px] sm:p-6',
        className,
      )}
      {...props}
    />
  );
}

export function ApplicationField({
  label,
  error,
  hint,
  id,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null, props['aria-describedby']].filter(Boolean).join(' ') || undefined;

  return (
    <label htmlFor={inputId} className="grid gap-1.5 text-[13px] font-medium text-slate-200">
      <span>
        {label}
        {props.required ? (
          <span className="ml-1 text-cyan-300" aria-hidden="true">
            *
          </span>
        ) : null}
      </span>
      <Input
        {...props}
        id={inputId}
        className={cn(
          'min-h-11 rounded-xl border-white/[0.12] bg-slate-950/[0.45] px-3.5 shadow-none hover:border-white/20 focus:border-cyan-300/[0.55] focus:ring-2 focus:ring-cyan-400/10',
          className,
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
      />
      {hint ? (
        <span id={hintId} className="text-xs font-normal leading-5 text-slate-500">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="text-xs font-medium leading-5 text-rose-300">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function ApplicationTextArea({
  label,
  error,
  hint,
  id,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null, props['aria-describedby']].filter(Boolean).join(' ') || undefined;

  return (
    <label htmlFor={inputId} className="grid gap-1.5 text-[13px] font-medium text-slate-200">
      <span>
        {label}
        {props.required ? (
          <span className="ml-1 text-cyan-300" aria-hidden="true">
            *
          </span>
        ) : null}
      </span>
      <Textarea
        {...props}
        id={inputId}
        className={cn(
          'min-h-28 rounded-xl border-white/[0.12] bg-slate-950/[0.45] px-3.5 py-3 shadow-none hover:border-white/20 focus:border-cyan-300/[0.55] focus:ring-2 focus:ring-cyan-400/10',
          className,
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
      />
      {hint ? (
        <span id={hintId} className="text-xs font-normal leading-5 text-slate-500">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="text-xs font-medium leading-5 text-rose-300">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function ApplicationPrimaryButton({
  loading,
  children,
  className,
  disabled,
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }>) {
  return (
    <Button
      {...props}
      disabled={loading || disabled}
      className={cn(
        'min-h-11 rounded-xl px-5 text-sm font-semibold shadow-[0_10px_28px_rgba(14,165,233,.14)]',
        className,
      )}
    >
      {loading ? (
        <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : null}
      {children}
    </Button>
  );
}

export const ApplicationSecondaryButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <Button
      ref={ref}
      {...props}
      variant="secondary"
      className={cn(
        'min-h-10 rounded-xl border-white/[0.12] bg-white/[0.035] px-4 text-sm shadow-none backdrop-blur-none hover:bg-white/[0.07]',
        className,
      )}
    />
  ),
);
ApplicationSecondaryButton.displayName = 'ApplicationSecondaryButton';

export function ApplicationNotice({
  tone = 'info',
  children,
  className,
}: PropsWithChildren<{ tone?: 'info' | 'success' | 'error'; className?: string }>) {
  const reduceMotion = useReducedMotion();
  const classes =
    tone === 'success'
      ? 'border-emerald-300/[0.18] bg-emerald-300/[0.07] text-emerald-100'
      : tone === 'error'
        ? 'border-rose-300/20 bg-rose-300/[0.08] text-rose-100'
        : 'border-cyan-300/[0.18] bg-cyan-300/[0.06] text-cyan-100';

  return (
    <AnimatePresence initial={false}>
      <motion.div
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -3 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        role={tone === 'error' ? 'alert' : 'status'}
        className={cn('rounded-xl border px-3.5 py-3 text-sm leading-6', classes, className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
