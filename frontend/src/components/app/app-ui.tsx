import { Check, Circle } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

const appSurfaceVariants = cva('border text-[var(--clinora-text-primary)]', {
  variants: {
    variant: {
      standard: 'border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-1)]',
      elevated: 'border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-2)]',
      hero: 'border-[var(--clinora-border-interactive)] bg-[var(--clinora-surface-hero)]',
      nested: 'border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)]',
      interactive:
        'border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-1)] transition duration-[var(--clinora-motion-hover)] hover:border-[var(--clinora-border-interactive)] hover:bg-[var(--clinora-surface-hover)]',
      attention: 'border-[var(--clinora-border-warning)] bg-[var(--clinora-warning-soft)]',
    },
    padding: {
      none: '',
      compact: 'p-4 sm:p-5',
      default: 'p-5 sm:p-6 lg:p-7',
    },
    radius: {
      compact: 'rounded-[var(--radius-app-compact)]',
      card: 'rounded-[var(--radius-app-card)]',
    },
  },
  defaultVariants: {
    variant: 'standard',
    padding: 'default',
    radius: 'card',
  },
});

type AppSurfaceProps = HTMLAttributes<HTMLElement> &
  VariantProps<typeof appSurfaceVariants> & {
    as?: 'div' | 'section' | 'aside' | 'article';
  };

export function AppSurface({ as = 'div', variant, padding, radius, className, ...props }: AppSurfaceProps) {
  const Component = as;
  return (
    <Component
      data-surface-variant={variant ?? 'standard'}
      className={cn(appSurfaceVariants({ variant, padding, radius }), className)}
      {...props}
    />
  );
}

export function AppSectionHeader({
  eyebrow,
  title,
  copy,
  titleId,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  titleId?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--clinora-info-foreground)]">
            {eyebrow}
          </p>
        ) : null}
        <h2
          id={titleId}
          className={cn(
            'text-balance text-2xl font-semibold tracking-[-0.035em] text-[var(--clinora-text-primary)] sm:text-[1.75rem]',
            eyebrow ? 'mt-2' : '',
          )}
        >
          {title}
        </h2>
        {copy ? <p className="mt-2 text-sm leading-6 text-[var(--clinora-text-muted)] sm:text-[15px]">{copy}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

const statusPillVariants = cva(
  'inline-flex min-h-7 items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1 text-xs font-semibold',
  {
    variants: {
      tone: {
        neutral: 'bg-[var(--clinora-neutral-soft)] text-slate-300',
        info: 'bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]',
        success: 'bg-[var(--clinora-success-soft)] text-[var(--clinora-success-foreground)]',
        warning: 'bg-[var(--clinora-warning-soft)] text-[var(--clinora-warning-foreground)]',
        danger: 'bg-[var(--clinora-danger-soft)] text-[var(--clinora-danger-foreground)]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type StatusPillProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof statusPillVariants>;

export function StatusPill({ tone, className, ...props }: StatusPillProps) {
  return <span className={cn(statusPillVariants({ tone }), className)} {...props} />;
}

export function IconWell({
  children,
  tone = 'info',
  className,
}: {
  children: ReactNode;
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  className?: string;
}) {
  const tones = {
    info: 'bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]',
    success: 'bg-[var(--clinora-success-soft)] text-[var(--clinora-success-foreground)]',
    warning: 'bg-[var(--clinora-warning-soft)] text-[var(--clinora-warning-foreground)]',
    danger: 'bg-[var(--clinora-danger-soft)] text-[var(--clinora-danger-foreground)]',
    neutral: 'bg-[var(--clinora-neutral-soft)] text-slate-300',
  };

  return (
    <span
      className={cn(
        'grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-app-icon)] ring-1 ring-inset ring-[var(--clinora-border-subtle)]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function DashboardMetric({
  label,
  value,
  detail,
  icon,
  tone = 'info',
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: ReactNode;
  tone?: 'info' | 'success' | 'warning' | 'neutral';
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-start gap-3">
        {icon ? <IconWell tone={tone}>{icon}</IconWell> : null}
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--clinora-text-faint)]">{label}</p>
          <p className="mt-1 text-base font-semibold tracking-[-0.015em] text-[var(--clinora-text-primary)]">{value}</p>
        </div>
      </div>
      {detail ? <p className="mt-3 text-xs leading-5 text-[var(--clinora-text-muted)]">{detail}</p> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  iconTone = 'info',
  title,
  copy,
  action,
  className,
}: {
  icon?: ReactNode;
  iconTone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  title: string;
  copy: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-start', className)}>
      {icon ? <IconWell tone={iconTone}>{icon}</IconWell> : null}
      <h3 className={cn('text-base font-semibold text-[var(--clinora-text-primary)]', icon ? 'mt-4' : '')}>{title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--clinora-text-muted)]">{copy}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export type ProgressItem = {
  label: string;
  state: 'complete' | 'current' | 'pending';
  description?: string;
};

export function ProgressRail({ items, label }: { items: readonly ProgressItem[]; label: string }) {
  return (
    <ol
      aria-label={label}
      className="grid gap-x-6 gap-y-2 rounded-[var(--clinora-radius-md)] bg-[var(--clinora-surface-nested)] px-4 py-2 sm:grid-cols-2"
    >
      {items.map((item, index) => (
        <li
          key={item.label}
          aria-current={item.state === 'current' ? 'step' : undefined}
          className="relative flex min-h-16 gap-3 py-3"
        >
          <span
            className={cn(
              'grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold tabular-nums',
              item.state === 'complete'
                ? 'border-[var(--clinora-border-success)] bg-[var(--clinora-success-soft)] text-[var(--clinora-success-foreground)]'
                : item.state === 'current'
                  ? 'border-[var(--clinora-border-interactive)] bg-[var(--clinora-info-soft)] text-white ring-4 ring-[var(--clinora-focus-ring-soft)]'
                  : 'border-white/[0.09] bg-white/[0.025] text-slate-500',
            )}
          >
            {item.state === 'complete' ? (
              <Check size={14} aria-label="Complete" />
            ) : item.state === 'current' ? (
              <Circle size={10} fill="currentColor" aria-label="Current" />
            ) : (
              <span aria-label="Pending">{String(index + 1).padStart(2, '0')}</span>
            )}
          </span>
          <span className="min-w-0 pt-0.5">
            <span
              className={cn(
                'block text-sm font-semibold',
                item.state === 'complete'
                  ? 'text-[var(--clinora-success-foreground)]'
                  : item.state === 'current'
                    ? 'text-white'
                    : 'text-slate-400',
              )}
            >
              {item.label}
            </span>
            {item.description ? (
              <span
                className={cn(
                  'mt-1 block text-xs leading-5',
                  item.state === 'current' ? 'text-[var(--clinora-text-muted)]' : 'text-[var(--clinora-text-faint)]',
                )}
              >
                {item.description}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export type ReportProcessingStage = 'Uploaded' | 'Extracted' | 'Analysed' | 'Reviewed';
const reportProcessingStages: readonly ReportProcessingStage[] = ['Uploaded', 'Extracted', 'Analysed', 'Reviewed'];

export function ReportProcessingStatus({ stage, className }: { stage: ReportProcessingStage; className?: string }) {
  const currentIndex = reportProcessingStages.indexOf(stage);

  return (
    <div className={className} role="group" aria-label="Report processing status" data-system-controlled="true">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--clinora-text-primary)]">Report processing</p>
          <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-faint)]">
            Clinora updates these stages automatically.
          </p>
        </div>
        <StatusPill tone={stage === 'Reviewed' ? 'success' : 'info'}>{stage}</StatusPill>
      </div>
      <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="System-controlled report stages">
        {reportProcessingStages.map((label, index) => {
          const complete = index < currentIndex;
          const current = index === currentIndex;
          return (
            <li key={label} aria-current={current ? 'step' : undefined} className="min-w-0">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] font-bold',
                    complete
                      ? 'border-[var(--clinora-border-success)] bg-[var(--clinora-success-soft)] text-[var(--clinora-success-foreground)]'
                      : current
                        ? 'border-[var(--clinora-border-interactive)] bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]'
                        : 'border-white/[0.09] text-slate-600',
                  )}
                >
                  {complete ? <Check size={12} /> : index + 1}
                </span>
                <span
                  className={cn(
                    'truncate text-xs font-semibold',
                    current ? 'text-[var(--clinora-info-foreground)]' : 'text-slate-400',
                  )}
                >
                  {label}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
