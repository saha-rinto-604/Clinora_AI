import { CalendarClock, FileText, HeartPulse, Stethoscope } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/feedback';
import { HealthRecordHeader, HealthRecordTabs } from '../../features/patient-record/health-record-shell';
import {
  patientRecordApi,
  patientRecordError,
  type TimelineCategory,
  type TimelineEvent,
} from '../../features/patient-record/patient-record-api';
import { cn } from '../../lib/cn';

const filters: { label: string; value: TimelineCategory | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Profile', value: 'PROFILE' },
  { label: 'Reports', value: 'REPORTS' },
  { label: 'Care', value: 'APPOINTMENTS' },
];

export function PatientTimelinePage() {
  const [category, setCategory] = useState<TimelineCategory | ''>('');
  const [items, setItems] = useState<TimelineEvent[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [nextBeforeId, setNextBeforeId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const page = await patientRecordApi.timeline({ category: category || undefined, limit: 30 });
      setItems(page.items);
      setNextBefore(page.nextBefore);
      setNextBeforeId(page.nextBeforeId);
      setHasMore(page.hasMore);
    } catch (requestError) {
      setError(patientRecordError(requestError, 'We could not load your Health Record timeline.'));
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => groupByMonth(items), [items]);
  const loadMore = async () => {
    if (!nextBefore || !nextBeforeId || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const page = await patientRecordApi.timeline({
        category: category || undefined,
        before: nextBefore,
        beforeId: nextBeforeId,
        limit: 30,
      });
      setItems((current) => [...current, ...page.items]);
      setNextBefore(page.nextBefore);
      setNextBeforeId(page.nextBeforeId);
      setHasMore(page.hasMore);
    } catch (requestError) {
      setError(patientRecordError(requestError, 'We could not load older health activity.'));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1000px] pb-8">
      <HealthRecordHeader />
      <HealthRecordTabs />

      <div className="mt-8 flex flex-col gap-5 border-b border-[var(--clinora-border-subtle)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">Timeline</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--clinora-text-muted)]">
            See what changed in your healthcare record and when.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter Health Record timeline">
          {filters.map((filter) => (
            <button
              key={filter.label}
              type="button"
              onClick={() => setCategory(filter.value)}
              aria-pressed={category === filter.value}
              className={cn(
                'min-h-10 rounded-full border px-4 text-sm font-semibold transition',
                category === filter.value
                  ? 'border-[var(--clinora-border-interactive)] bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]'
                  : 'border-[var(--clinora-border-subtle)] text-[var(--clinora-text-muted)] hover:border-[var(--clinora-border-interactive)] hover:text-white',
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-7" aria-labelledby="timeline-activity-title">
        <h2 id="timeline-activity-title" className="sr-only">
          Health Record activity
        </h2>
        {loading ? <TimelineSkeleton /> : null}
        {!loading && error && !items.length ? (
          <div className="rounded-xl border border-rose-300/15 bg-rose-300/[0.04] p-4">
            <p role="alert" className="text-sm text-[var(--clinora-text-muted)]">
              {error}
            </p>
            <Button variant="appSecondary" className="mt-3" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : null}
        {!loading && !items.length && !error ? (
          <EmptyState
            icon={<CalendarClock size={18} aria-hidden="true" />}
            title="Your Health Record timeline starts here"
            copy="Meaningful Profile changes, medical reports and Clinora care will appear here as they are recorded."
          />
        ) : null}
        {groups.map(([month, events]) => (
          <section key={month} className="mt-9 first:mt-0" aria-labelledby={`month-${month.replace(/\s/g, '-')}`}>
            <h3
              id={`month-${month.replace(/\s/g, '-')}`}
              className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--clinora-text-faint)]"
            >
              {month}
            </h3>
            <ol className="mt-5">
              {events.map((event, index) => (
                <TimelineRow key={event.id} event={event} last={index === events.length - 1} />
              ))}
            </ol>
          </section>
        ))}
        {error && items.length ? (
          <p role="alert" className="mt-5 text-sm text-rose-300">
            {error}
          </p>
        ) : null}
        {hasMore ? (
          <Button variant="appSecondary" className="mt-7" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load older activity'}
          </Button>
        ) : null}
      </section>
    </div>
  );
}

function TimelineRow({ event, last }: { event: TimelineEvent; last: boolean }) {
  const Icon = event.category === 'REPORTS' ? FileText : event.category === 'APPOINTMENTS' ? Stethoscope : HeartPulse;
  const link =
    event.sourceType === 'MEDICAL_REPORT' && event.sourceId
      ? { to: `/patient/reports/${event.sourceId}`, label: 'View report' }
      : event.sourceType === 'APPOINTMENT' && event.sourceId
        ? { to: `/patient/appointments/${event.sourceId}`, label: 'View appointment' }
        : null;
  return (
    <li className="relative grid grid-cols-[4.5rem_1.5rem_minmax(0,1fr)] gap-3 pb-7 sm:grid-cols-[6.5rem_2rem_minmax(0,1fr)] sm:gap-4">
      <time dateTime={event.occurredAt} className="pt-1 text-xs font-semibold text-[var(--clinora-text-faint)]">
        {formatDay(event.occurredAt)}
      </time>
      <div className="relative flex justify-center">
        {!last ? (
          <span className="absolute bottom-0 top-5 w-px bg-[var(--clinora-border-interactive)]" aria-hidden="true" />
        ) : null}
        <span className="relative z-10 grid h-8 w-8 place-items-center rounded-full border border-[var(--clinora-border-interactive)] bg-[#081221] text-[var(--clinora-info-foreground)]">
          <Icon size={14} aria-hidden="true" />
        </span>
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-white">{event.title}</p>
        {event.detail ? (
          <p className="mt-1 text-sm leading-6 text-[var(--clinora-text-muted)]">{event.detail}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="text-[var(--clinora-text-faint)]">{sourceLabel(event.sourceType)}</span>
          {link ? (
            <Link to={link.to} className="font-semibold text-[var(--clinora-info-foreground)]">
              {link.label} →
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function sourceLabel(sourceType: string | null) {
  if (sourceType === 'PATIENT_PROFILE' || ['ALLERGY', 'CONDITION', 'MEDICATION'].includes(sourceType ?? ''))
    return 'From your Health Profile';
  if (sourceType === 'MEDICAL_REPORT') return 'Uploaded medical report';
  if (sourceType === 'APPOINTMENT') return 'Clinora appointment';
  return 'Clinora health activity';
}
function TimelineSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading Health Record timeline">
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
    </div>
  );
}
function groupByMonth(items: TimelineEvent[]) {
  const groups = new Map<string, TimelineEvent[]>();
  for (const item of items) {
    const key = new Date(item.occurredAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()];
}
function formatDay(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }).toUpperCase();
}
