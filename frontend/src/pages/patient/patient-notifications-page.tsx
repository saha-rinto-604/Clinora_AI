import { Bell, CalendarDays, FileText, LockKeyhole, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AppSectionHeader, AppSurface, EmptyState, IconWell } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/feedback';
import {
  notificationApi,
  notificationError,
  type NotificationPreferences,
  type PatientNotification,
} from '../../features/notifications/notification-api';
import { notificationTarget } from '../../features/notifications/notification-target';
import { cn } from '../../lib/cn';

export function PatientNotificationsPage() {
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [items, setItems] = useState<PatientNotification[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [nextBeforeId, setNextBeforeId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const [page, prefs] = await Promise.all([
      notificationApi.list({ unreadOnly, limit: 30 }),
      notificationApi.preferences(),
    ]);
    setItems(page.items);
    setNextBefore(page.nextBefore);
    setNextBeforeId(page.nextBeforeId);
    setHasMore(page.hasMore);
    setPreferences(prefs);
  };
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([notificationApi.list({ unreadOnly, limit: 30 }), notificationApi.preferences()])
      .then(([page, prefs]) => {
        if (active) {
          setItems(page.items);
          setNextBefore(page.nextBefore);
          setNextBeforeId(page.nextBeforeId);
          setHasMore(page.hasMore);
          setPreferences(prefs);
        }
      })
      .catch(
        (requestError) => active && setError(notificationError(requestError, 'We could not load your notifications.')),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [unreadOnly]);

  const grouped = useMemo(() => groupNotifications(items), [items]);
  const openItem = async (item: PatientNotification) => {
    if (!item.readAt) {
      try {
        await notificationApi.read(item.id);
        setItems((current) =>
          current.map((value) => (value.id === item.id ? { ...value, readAt: new Date().toISOString() } : value)),
        );
      } catch {
        /* navigation remains available */
      }
    }
    navigate(notificationTarget(item));
  };
  const markAllRead = async () => {
    setBusy('read-all');
    setError('');
    try {
      await notificationApi.readAll();
      await load();
    } catch (requestError) {
      setError(notificationError(requestError, 'We could not update your notifications.'));
    } finally {
      setBusy('');
    }
  };
  const loadOlder = async () => {
    if (!nextBefore || !nextBeforeId) return;
    setBusy('older');
    try {
      const page = await notificationApi.list({ unreadOnly, before: nextBefore, beforeId: nextBeforeId, limit: 30 });
      setItems((current) => [...current, ...page.items]);
      setNextBefore(page.nextBefore);
      setNextBeforeId(page.nextBeforeId);
      setHasMore(page.hasMore);
    } catch (requestError) {
      setError(notificationError(requestError, 'We could not load older notifications.'));
    } finally {
      setBusy('');
    }
  };
  const updatePreferences = async (next: NotificationPreferences) => {
    setPreferences(next);
    setBusy('preferences');
    setError('');
    try {
      setPreferences(await notificationApi.updatePreferences(next));
      if (unreadOnly) await load();
    } catch (requestError) {
      setError(notificationError(requestError, 'We could not save notification preferences.'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1040px] pb-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--clinora-info-foreground)]">
          Stay informed
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">Notifications</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--clinora-text-muted)]">
          Appointment changes and reminders from your Clinora care. Open an update to review the related booking.
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
        <p
          role="alert"
          className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : null}
      <AppSurface as="section" className="mt-5" aria-labelledby="notification-list-title">
        <h2 id="notification-list-title" className="sr-only">
          Notification list
        </h2>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : null}
        {!loading && !items.length ? (
          <EmptyState
            icon={<Bell size={18} />}
            title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
            copy={
              unreadOnly
                ? 'You are up to date.'
                : 'Booking confirmations, schedule changes, cancellations, and reminders will appear here when there is something new to review.'
            }
          />
        ) : null}
        {grouped.map(([group, values]) => (
          <section key={group} className="mt-6 first:mt-0">
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--clinora-text-faint)]">{group}</h3>
            <ul className="mt-3 divide-y divide-[var(--clinora-border-subtle)] border-y border-[var(--clinora-border-subtle)]">
              {values.map((item) => (
                <NotificationRow key={item.id} item={item} onOpen={() => void openItem(item)} />
              ))}
            </ul>
          </section>
        ))}
        {hasMore ? (
          <Button variant="appSecondary" className="mt-6" disabled={busy === 'older'} onClick={() => void loadOlder()}>
            {busy === 'older' ? 'Loading…' : 'Load older notifications'}
          </Button>
        ) : null}
      </AppSurface>

      <AppSurface as="section" variant="elevated" className="mt-6" aria-labelledby="notification-settings-title">
        <AppSectionHeader
          eyebrow="Preferences"
          title="Notification settings"
          titleId="notification-settings-title"
          copy="Choose how Clinora delivers appointment confirmations, schedule changes, cancellations, and reminders."
        />
        {preferences ? (
          <div className="mt-6 border-y border-[var(--clinora-border-subtle)]">
            <PreferenceRow
              title="Appointments"
              copy="Booking confirmations, schedule changes, cancellations, and reminders."
              inApp={preferences.appointmentsInApp}
              email={preferences.appointmentsEmail}
              disabled={busy === 'preferences'}
              onInAppChange={(value) => void updatePreferences({ ...preferences, appointmentsInApp: value })}
              onEmailChange={(value) => void updatePreferences({ ...preferences, appointmentsEmail: value })}
            />
          </div>
        ) : (
          <Skeleton className="mt-6 h-28 rounded-xl" />
        )}
      </AppSurface>
    </div>
  );
}

function NotificationRow({ item, onOpen }: { item: PatientNotification; onOpen: () => void }) {
  const Icon =
    item.category === 'APPOINTMENTS'
      ? CalendarDays
      : item.category === 'REPORTS'
        ? FileText
        : item.category === 'SECURITY'
          ? LockKeyhole
          : Settings2;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="grid w-full gap-3 py-4 text-left sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--clinora-border-interactive)]"
      >
        <IconWell tone={item.readAt ? 'neutral' : 'info'}>
          <Icon size={16} aria-hidden="true" />
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
  );
}

function PreferenceRow({
  title,
  copy,
  inApp,
  email,
  disabled,
  onInAppChange,
  onEmailChange,
}: {
  title: string;
  copy: string;
  inApp: boolean;
  email: boolean;
  disabled: boolean;
  onInAppChange: (value: boolean) => void;
  onEmailChange: (value: boolean) => void;
}) {
  return (
    <div className="grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 max-w-xl text-xs leading-5 text-[var(--clinora-text-muted)]">{copy}</p>
      </div>
      <Toggle label="In-app" checked={inApp} disabled={disabled} onChange={onInAppChange} />
      <Toggle label="Email" checked={email} disabled={disabled} onChange={onEmailChange} />
    </div>
  );
}
function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-w-24 items-center justify-between gap-2 text-xs font-semibold text-[var(--clinora-text-muted)]">
      {label}
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-cyan-400"
      />
    </label>
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
function groupNotifications(items: PatientNotification[]) {
  const map = new Map<string, PatientNotification[]>();
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startWeek = startToday - 6 * 86400000;
  for (const item of items) {
    const time = new Date(item.createdAt).getTime();
    const group = time >= startToday ? 'Today' : time >= startWeek ? 'Earlier this week' : 'Older';
    map.set(group, [...(map.get(group) ?? []), item]);
  }
  return [...map.entries()];
}
function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
