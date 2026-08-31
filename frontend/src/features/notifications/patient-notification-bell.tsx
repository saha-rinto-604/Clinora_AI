import { Bell, CheckCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { EmptyState } from '../../components/app/app-ui';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { buttonVariants } from '../../components/ui/button-variants';
import { cn } from '../../lib/cn';
import { notificationApi, type PatientNotification } from './notification-api';
import { notificationTarget } from './notification-target';
import { connectPatientNotificationStream } from './patient-notification-stream';

export function PatientNotificationBell({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PatientNotification[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const reconcile = () => {
      void Promise.allSettled([notificationApi.unreadCount(), notificationApi.list({ limit: 5 })]).then(
        ([count, page]) => {
          if (!active) return;
          if (count.status === 'fulfilled') setUnread(count.value);
          if (page.status === 'fulfilled') setItems(page.value.items);
        },
      );
    };
    reconcile();
    const disconnect = connectPatientNotificationStream((notification) => {
      setItems((current) => {
        const alreadyPresent = current.some((item) => item.id === notification.id);
        if (!alreadyPresent && !notification.readAt) setUnread((value) => value + 1);
        return [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 5);
      });
    }, reconcile);
    return () => {
      active = false;
      disconnect();
    };
  }, []);

  const openNotification = async (notification: PatientNotification) => {
    if (!notification.readAt) {
      try {
        await notificationApi.read(notification.id);
        setUnread((value) => Math.max(0, value - 1));
      } catch {
        /* the destination is still useful if read-state persistence temporarily fails */
      }
    }
    setOpen(false);
    navigate(notificationTarget(notification));
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          className={cn(
            'relative grid h-10 w-10 place-items-center rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] text-[var(--clinora-text-muted)] transition hover:border-[var(--clinora-border-interactive)] hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--clinora-focus-ring-soft)]',
            className,
          )}
        >
          <Bell size={17} aria-hidden="true" />
          {unread ? (
            <span
              className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-cyan-300 px-1 text-[10px] font-bold text-slate-950"
              aria-hidden="true"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(22rem,calc(100vw-2rem))] p-4"
        aria-label="Recent notifications"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Notifications</p>
            <p className="mt-0.5 text-xs text-[var(--clinora-text-faint)]">Important Clinora updates</p>
          </div>
          <CheckCheck size={16} className="text-[var(--clinora-text-faint)]" aria-hidden="true" />
        </div>
        {items.length ? (
          <ul className="mt-4 divide-y divide-[var(--clinora-border-subtle)] border-y border-[var(--clinora-border-subtle)]">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void openNotification(item)}
                  className="flex w-full gap-3 rounded-xl px-1 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--clinora-border-interactive)]"
                >
                  <span
                    className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.readAt ? 'bg-slate-700' : 'bg-cyan-300')}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">{item.title}</span>
                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--clinora-text-muted)]">
                      {item.body}
                    </span>
                    <span className="mt-1.5 block text-[11px] text-[var(--clinora-text-faint)]">
                      {relativeTime(item.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            className="mt-4"
            icon={<Bell size={16} />}
            title="You're up to date"
            copy="Important appointment and account updates will appear here."
          />
        )}
        <Link
          to="/patient/notifications"
          onClick={() => setOpen(false)}
          className={cn(buttonVariants({ variant: 'ghost' }), 'mt-3 w-full justify-center')}
        >
          View all notifications
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
