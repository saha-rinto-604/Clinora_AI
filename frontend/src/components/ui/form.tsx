import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  HTMLAttributes,
} from 'react';
import { forwardRef } from 'react';
import { cn } from '../../lib/cn';

const fieldControl =
  'min-h-11 w-full rounded-2xl border border-[var(--color-glass-border)] bg-slate-950/60 px-4 py-2 text-sm text-[var(--color-text-primary)] shadow-inner shadow-black/20 transition duration-300 placeholder:text-slate-500 focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-50';

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium text-[var(--color-text-secondary)]', className)} {...props} />;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(fieldControl, className)} {...props} />,
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldControl, 'min-h-28 resize-y leading-6', className)} {...props} />
  ),
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(fieldControl, className)} {...props}>
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'checkbox', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn('h-5 w-5 rounded border-[var(--color-glass-border)] accent-[var(--color-medical-cyan)]', className)}
      {...props}
    />
  ),
);
Checkbox.displayName = 'Checkbox';

export const Radio = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'radio', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn('h-5 w-5 border-[var(--color-glass-border)] accent-[var(--color-medical-cyan)]', className)}
      {...props}
    />
  ),
);
Radio.displayName = 'Radio';

export type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  checked?: boolean;
};

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(({ className, checked = false, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    role="switch"
    aria-checked={checked}
    className={cn(
      'inline-flex h-7 w-12 items-center rounded-full border border-[var(--color-glass-border)] p-1 transition duration-300',
      checked ? 'bg-[var(--color-medical-teal)]' : 'bg-slate-800',
      className,
    )}
    {...props}
  >
    <span
      aria-hidden="true"
      className={cn(
        'h-5 w-5 rounded-full bg-white transition duration-300',
        checked ? 'translate-x-5' : 'translate-x-0',
      )}
    />
  </button>
));
Switch.displayName = 'Switch';

export function FormField({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('grid gap-2', className)} {...props} />;
}

export function FormMessage({ className, role = 'status', ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p role={role} className={cn('text-sm leading-6 text-[var(--color-text-muted)]', className)} {...props} />;
}
