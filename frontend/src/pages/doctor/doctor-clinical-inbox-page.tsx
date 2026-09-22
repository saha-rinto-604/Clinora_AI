import { ArrowRight, FileCheck2, Inbox, Stethoscope, TimerReset } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { AppSectionHeader, AppSurface, EmptyState, IconWell, StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/feedback';
import {
  consultationApi,
  consultationError,
  type ClinicalInboxItem,
  type ClinicalInboxView,
} from '../../features/consultations/consultation-api';

export function DoctorClinicalInboxPage() {
  const [data, setData] = useState<ClinicalInboxView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await consultationApi.inbox());
    } catch (requestError) {
      setError(consultationError(requestError, 'We could not load your Clinical Inbox.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => groupItems(data?.items ?? []), [data]);

  if (loading) {
    return (
      <div className="space-y-5" role="status" aria-label="Loading Clinical Inbox">
        <Skeleton className="h-24 rounded-[20px]" />
        <Skeleton className="h-20 rounded-[18px]" />
        <Skeleton className="h-56 rounded-[20px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[var(--clinora-border-subtle)] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <AppSectionHeader
          eyebrow="Action queue"
          title="Clinical Inbox"
          copy="Clinical work requiring your attention - unfinished consultations, reviewable shared evidence and follow-up."
        />
        <Button variant="appSecondary" onClick={() => void load()}>
          Refresh
        </Button>
      </header>

      {error ? (
        <AppSurface variant="attention">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p role="alert" className="text-sm text-amber-100">
              {error}
            </p>
            <Button size="sm" variant="appSecondary" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        </AppSurface>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Clinical Inbox summary">
        <InboxMetric icon={<Inbox size={16} />} label="Needs attention" value={data?.needsAttentionCount ?? 0} />
        <InboxMetric icon={<Stethoscope size={16} />} label="In progress" value={data?.inProgressCount ?? 0} />
        <InboxMetric icon={<FileCheck2 size={16} />} label="Evidence ready" value={data?.evidenceReadyCount ?? 0} />
        <InboxMetric icon={<TimerReset size={16} />} label="Follow-up" value={data?.followUpCount ?? 0} />
      </section>

      {!data?.items.length ? (
        <AppSurface>
          <EmptyState
            icon={<Inbox size={18} />}
            iconTone="success"
            title="Your clinical queue is clear"
            copy="Only work that needs action appears here. Normal upcoming appointments stay in Schedule."
          />
        </AppSurface>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <AppSurface key={group.type} padding="none" className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--clinora-border-subtle)] px-5 py-3.5 sm:px-6">
                <div>
                  <h2 className="text-sm font-semibold text-white">{group.title}</h2>
                  <p className="mt-0.5 text-[11px] text-[var(--clinora-text-faint)]">{group.copy}</p>
                </div>
                <span className="text-xs tabular-nums text-[var(--clinora-text-faint)]">{group.items.length}</span>
              </div>
              <ul className="divide-y divide-[var(--clinora-border-subtle)]">
                {group.items.map((item) => (
                  <li key={item.key}>
                    <Link
                      to={item.destination}
                      className="group grid min-h-[86px] gap-2 px-5 py-3.5 transition-colors hover:bg-[var(--clinora-surface-hover)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6"
                    >
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <StatusPill
                            tone={
                              item.priority === 'HIGH'
                                ? 'warning'
                                : item.type === 'EVIDENCE_READY'
                                  ? 'success'
                                  : 'neutral'
                            }
                          >
                            {itemLabel(item.type)}
                          </StatusPill>
                          <strong className="truncate text-sm font-semibold text-white">{item.patientName}</strong>
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-[var(--clinora-text-muted)]">
                          {item.detail}
                        </span>
                        {item.dueAt || item.dueDate ? (
                          <span className="mt-1 block text-[11px] text-[var(--clinora-text-faint)]">
                            {item.dueDate ? localDate(item.dueDate) : formatWhen(item.dueAt as string)}
                          </span>
                        ) : null}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--clinora-info-foreground)]">
                        {actionLabel(item.type)}{' '}
                        <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </AppSurface>
          ))}
        </div>
      )}
    </div>
  );
}

function InboxMetric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <AppSurface padding="compact">
      <div className="flex items-center gap-3">
        <IconWell tone={value > 0 ? 'info' : 'neutral'}>{icon}</IconWell>
        <div>
          <strong className="block text-xl font-semibold tabular-nums text-white">{value}</strong>
          <span className="text-xs text-[var(--clinora-text-muted)]">{label}</span>
        </div>
      </div>
    </AppSurface>
  );
}

function groupItems(items: ClinicalInboxItem[]) {
  const definitions = [
    { type: 'IN_PROGRESS', title: 'In progress', copy: 'Encounter documentation that still needs completion.' },
    { type: 'EVIDENCE_READY', title: 'Needs review', copy: 'Patient-shared evidence available before upcoming care.' },
    { type: 'FOLLOW_UP', title: 'Follow-up', copy: 'Doctor-recommended follow-up without a future booking.' },
  ] as const;
  return definitions
    .map((definition) => ({ ...definition, items: items.filter((item) => item.type === definition.type) }))
    .filter((group) => group.items.length > 0);
}

function itemLabel(type: ClinicalInboxItem['type']) {
  if (type === 'IN_PROGRESS') return 'In progress';
  if (type === 'EVIDENCE_READY') return 'Evidence ready';
  return 'Follow-up';
}

function actionLabel(type: ClinicalInboxItem['type']) {
  if (type === 'IN_PROGRESS') return 'Resume';
  if (type === 'EVIDENCE_READY') return 'Review';
  return 'Open Patient';
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function localDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
