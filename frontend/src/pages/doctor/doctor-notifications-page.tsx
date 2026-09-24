import { Bell, CalendarDays } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AppSurface, EmptyState, IconWell } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/feedback';
import {
  doctorNotificationApi,
  doctorNotificationError,
  type DoctorNotification,
} from '../../features/notifications/doctor-notification-api';
import { doctorNotificationTarget } from '../../features/notifications/doctor-notification-target';
import { cn } from '../../lib/cn';

export function DoctorNotificationsPage() {
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [items, setItems] = useState<DoctorNotification[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [nextBeforeId, setNextBeforeId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const applyPage = (page: Awaited<ReturnType<typeof doctorNotificationApi.list>>) => {
    setItems(page.items);
    setNextBefore(page.nextBefore);
    setNextBeforeId(page.nextBeforeId);
    setHasMore(page.hasMore);
  };

  const load = async () => applyPage(await doctorNotificationApi.list({ unreadOnly, limit: 30 }));

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    doctorNotificationApi
      .list({ unreadOnly, limit: 30 })
      .then((page) => {
        if (active) applyPage(page);
      })
      .catch((requestError) => {
        if (active) setError(doctorNotificationError(requestError, 'We could not load Doctor notifications.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [unreadOnly]);

  const openItem = async (item: DoctorNotification) => {
    if (!item.readAt) {
      try {
        await doctorNotificationApi.read(item.id);
      } catch {
        // Navigation remains available if the read-state update fails.
      }
    }
    navigate(doctorNotificationTarget(item));
  };

  const markAllRead = async () => {
    setBusy('read-all');
    setError('');
    try {
      await doctorNotificationApi.readAll();
      await load();
    } catch (requestError) {
      setError(doctorNotificationError(requestError, 'We could not update Doctor notifications.'));
    } finally {
      setBusy('');
    }
  };

  const loadOlder = async () => {
    if (!nextBefore || !nextBeforeId) return;
    setBusy('older');
    setError('');
    try {
      const page = await doctorNotificationApi.list({
        unreadOnly,
        before: nextBefore,
        beforeId: nextBeforeId,
        limit: 30,
      });
      setItems((current) => [...current, ...page.items]);
      setNextBefore(page.nextBefore);
      setNextBeforeId(page.nextBeforeId);
      setHasMore(page.hasMore);
    } catch (requestError) {
      setError(doctorNotificationError(requestError, 'We could not load older Doctor notifications.'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1040px] pb-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--clinora-info-foreground)]">
          Practice updates
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">Notifications</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--clinora-text-muted)]">
          New Patient bookings, reschedules and cancellations appear here. Clinical Inbox remains your action queue.
        </p>
      </header>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-fit rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-1">
          <button type="button" onClick={() => setUnreadOnly(false)} className={tabClass(!unreadOnly)}>
            All
          </button>
          <button type="button" onClick={() => setUnreadOnly(true)} className={tabClass(unreadOnly)}>
            Unread
          </button>
        </div>
        <Button variant="appSecondary" onClick={() => void markAllRead()} disabled={busy === 'read-all'}>
          {busy === 'read-all' ? 'Updating…' : 'Mark all as read'}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <AppSurface as="section" className="mt-5" aria-labelledby="doctor-notification-list-title">
        <h2 id="doctor-notification-list-title" className="sr-only">Doctor notification list</h2>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : null}
        {!loading && !items.length ? (
          <EmptyState
            icon={<Bell size={18} />}
            title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
            copy={unreadOnly ? 'You are up to date.' : 'New bookings and Patient schedule changes will appear here.'}
          />
        ) : null}
        {items.length ? (
          <ul className="divide-y divide-[var(--clinora-border-subtle)] border-y border-[var(--clinora-border-subtle)]">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void openItem(item)}
                  className="grid w-full gap-3 py-4 text-left sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--clinora-border-interactive)]"
                >
                  <IconWell tone={item.readAt ? 'neutral' : 'info'}>
                    <CalendarDays size={16} aria-hidden="true" />
                  </IconWell>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{item.title}</span>
                      {!item.readAt ? <span className="h-2 w-2 rounded-full bg-cyan-300" aria-label="Unread" /> : null}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-[var(--clinora-text-muted)]">{item.body}</span>
                  </span>
                  <time className="text-xs text-[var(--clinora-text-faint)]">{formatTimestamp(item.createdAt)}</time>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {hasMore ? (
          <Button variant="appSecondary" className="mt-6" disabled={busy === 'older'} onClick={() => void loadOlder()}>
            {busy === 'older' ? 'Loading…' : 'Load older notifications'}
          </Button>
        ) : null}
      </AppSurface>
    </div>
  );
}

function tabClass(active: boolean) {
  return cn(
    'min-h-9 rounded-lg px-4 py-2 text-sm font-semibold transition',
    active
      ? 'bg-[var(--clinora-info-soft)] text-[var(--clinora-info-foreground)]'
      : 'text-[var(--clinora-text-muted)] hover:text-white',
  );
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
