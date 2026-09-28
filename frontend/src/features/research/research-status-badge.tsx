import type { DatasetRequestStatus, ResearchProjectStatus } from './research-types';
import { cn } from '../../lib/cn';

interface Props {
  status: ResearchProjectStatus | DatasetRequestStatus;
  className?: string;
}

type StatusBadgeConfig = {
  label: string;
  dotClass: string;
  badgeClass: string;
};

function getStatusBadgeConfig(status: ResearchProjectStatus | DatasetRequestStatus): StatusBadgeConfig {
  switch (status) {
    case 'APPROVED':
      return {
        label: 'Approved',
        dotClass: 'bg-emerald-400',
        badgeClass: 'border-emerald-800/50 bg-emerald-950/30 text-emerald-300',
      };
    case 'ACTIVE':
      return {
        label: 'Active',
        dotClass: 'bg-emerald-400',
        badgeClass: 'border-emerald-800/50 bg-emerald-950/30 text-emerald-300',
      };
    case 'COMPLETED':
      return {
        label: 'Completed',
        dotClass: 'bg-teal-400',
        badgeClass: 'border-teal-800/50 bg-teal-950/30 text-teal-300',
      };
    case 'SUBMITTED':
      return {
        label: 'Submitted',
        dotClass: 'bg-cyan-400',
        badgeClass: 'border-cyan-800/50 bg-cyan-950/30 text-cyan-300',
      };
    case 'UNDER_REVIEW':
      return {
        label: 'Under review',
        dotClass: 'bg-amber-400',
        badgeClass: 'border-amber-800/50 bg-amber-950/30 text-amber-300',
      };
    case 'MORE_INFO_REQUIRED':
      return {
        label: 'Action required',
        dotClass: 'bg-amber-400',
        badgeClass: 'border-amber-800/60 bg-amber-950/40 text-amber-200',
      };
    case 'REJECTED':
      return {
        label: 'Rejected',
        dotClass: 'bg-rose-400',
        badgeClass: 'border-rose-800/50 bg-rose-950/30 text-rose-300',
      };
    case 'DRAFT':
      return {
        label: 'Draft',
        dotClass: 'bg-slate-400',
        badgeClass: 'border-slate-700/70 bg-slate-800/40 text-slate-300',
      };
    case 'WITHDRAWN':
      return {
        label: 'Withdrawn',
        dotClass: 'bg-slate-500',
        badgeClass: 'border-slate-800/60 bg-slate-900/40 text-slate-400',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        dotClass: 'bg-slate-500',
        badgeClass: 'border-slate-800/60 bg-slate-900/40 text-slate-400',
      };
    case 'ARCHIVED':
      return {
        label: 'Archived',
        dotClass: 'bg-slate-500',
        badgeClass: 'border-slate-800/60 bg-slate-900/40 text-slate-400',
      };
    default:
      return {
        label: String(status),
        dotClass: 'bg-slate-400',
        badgeClass: 'border-slate-700/60 bg-slate-800/40 text-slate-300',
      };
  }
}

export function ResearchStatusBadge({ status, className }: Props) {
  const config = getStatusBadgeConfig(status);
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1.5 px-2.5 rounded-full border text-xs font-medium tracking-tight shrink-0',
        config.badgeClass,
        className,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', config.dotClass)} aria-hidden="true" />
      {config.label}
    </span>
  );
}
