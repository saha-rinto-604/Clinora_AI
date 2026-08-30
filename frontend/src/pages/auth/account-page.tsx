import { zodResolver } from '@hookform/resolvers/zod';
import { Check, ChevronDown, Circle, KeyRound, LogOut, MonitorSmartphone, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEventHandler } from 'react';
import { useForm, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog';
import { apiErrorMessage, authApi } from '../../features/auth/auth-api';
import { useAuthStore } from '../../features/auth/auth-store';
import { FormNotice, PasswordField } from '../../features/auth/auth-ui';
import type { AuthSessionItem, AuthUser } from '../../features/auth/auth-types';
import { parseUserAgent } from '../../features/auth/session-display';
import { cn } from '../../lib/cn';

const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .regex(/[A-Z]/, 'Add an uppercase letter.')
  .regex(/[a-z]/, 'Add a lowercase letter.')
  .regex(/[0-9]/, 'Add a number.')
  .regex(/[^A-Za-z0-9]/, 'Add a special character.');
const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });
type FormValues = z.infer<typeof schema>;
type SettingsSection = 'account' | 'password' | 'sessions' | 'signout';

const settingsSections = [
  { id: 'account' as const, label: 'Account', icon: UserRound },
  { id: 'password' as const, label: 'Password', icon: KeyRound },
  { id: 'sessions' as const, label: 'Sessions', icon: MonitorSmartphone },
  { id: 'signout' as const, label: 'Sign out', icon: LogOut },
];

export function AccountPage({ embedded = false }: { embedded?: boolean }) {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const [sessions, setSessions] = useState<AuthSessionItem[]>([]);
  const [sessionError, setSessionError] = useState('');
  const [sessionMessage, setSessionMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmOtherSignOut, setConfirmOtherSignOut] = useState(false);
  const {
    register,
    reset,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const newPassword = watch('newPassword');

  const loadSessions = async () => {
    try {
      setSessions((await authApi.sessions()).sort((a, b) => Number(b.current) - Number(a.current)));
      setSessionError('');
    } catch (error) {
      setSessionError(apiErrorMessage(error, 'Unable to load your sessions.'));
    }
  };
  useEffect(() => {
    void loadSessions();
  }, []);

  const changePassword = handleSubmit(async (values) => {
    setPasswordError('');
    setPasswordMessage('');
    try {
      await authApi.changePassword(values.currentPassword, values.newPassword);
      setPasswordMessage('Password changed. Your other active sessions have been signed out.');
      reset();
      await loadSessions();
    } catch (error) {
      setPasswordError(apiErrorMessage(error, 'Unable to change the password.'));
    }
  });
  const logout = async () => {
    await authApi.logout();
    navigate('/login', { replace: true });
  };
  const signOutOthers = async () => {
    try {
      await authApi.revokeOtherSessions();
      setConfirmOtherSignOut(false);
      setSessionMessage('Other devices have been signed out.');
      await loadSessions();
    } catch (error) {
      setConfirmOtherSignOut(false);
      setSessionError(apiErrorMessage(error, 'Unable to sign out other devices.'));
    }
  };

  const currentSession = sessions.find((session) => session.current);
  const otherSessions = sessions.filter((session) => !session.current);
  const lastActivity = useMemo(() => {
    const mostRecent = [...sessions].sort(
      (a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime(),
    )[0];
    return mostRecent ? formatActivity(mostRecent.lastUsedAt, mostRecent.current) : 'Not available';
  }, [sessions]);

  const content = (
    <div className="mx-auto w-full max-w-[1120px]">
      <header>
        <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-[2.4rem]">Account & Security</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-[15px]">
          Manage your account details, password, and signed-in devices from one place.
        </p>
      </header>

      <div className="mt-7 grid gap-3 border-y border-white/[0.07] py-4 sm:grid-cols-3">
        <StatusItem
          icon={ShieldCheck}
          label="Email"
          value={user?.emailVerified ? 'Verified' : 'Verification pending'}
          good={Boolean(user?.emailVerified)}
        />
        <StatusItem
          icon={Check}
          label="Account"
          value={friendlyStatus(user?.accountStatus)}
          good={user?.accountStatus === 'ACTIVE'}
        />
        <StatusItem
          icon={MonitorSmartphone}
          label="Sessions"
          value={sessionError ? 'Unavailable' : `${sessions.length} active`}
          good={!sessionError}
        />
      </div>

      <div className="mt-7 grid items-start gap-5 lg:grid-cols-12 lg:gap-6">
        <nav aria-label="Account settings" className="lg:sticky lg:top-6 lg:col-span-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {settingsSections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                aria-current={activeSection === id ? 'page' : undefined}
                className={cn(
                  'flex min-h-12 items-center gap-3 rounded-xl border px-3.5 text-left text-sm font-medium transition',
                  activeSection === id
                    ? 'border-cyan-300/[0.14] bg-cyan-300/[0.07] text-cyan-100'
                    : 'border-transparent text-slate-500 hover:border-white/[0.06] hover:bg-white/[0.03] hover:text-slate-200',
                )}
              >
                <Icon size={17} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <p className="mt-5 hidden text-xs leading-5 text-slate-600 lg:block">
            Last account activity
            <br />
            <span className="text-slate-400">{lastActivity}</span>
          </p>
        </nav>

        <section className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0b1424]/95 lg:col-span-9">
          {activeSection === 'account' ? <AccountSettings user={user} /> : null}
          {activeSection === 'password' ? (
            <PasswordSettings
              changePassword={changePassword}
              register={register}
              errors={errors}
              newPassword={newPassword}
              isSubmitting={isSubmitting}
              passwordMessage={passwordMessage}
              passwordError={passwordError}
            />
          ) : null}
          {activeSection === 'sessions' ? (
            <SessionSettings
              currentSession={currentSession}
              otherSessions={otherSessions}
              sessionMessage={sessionMessage}
              sessionError={sessionError}
              onSignOutOtherDevices={() => setConfirmOtherSignOut(true)}
              onSignOutOne={async (sessionId) => {
                try {
                  await authApi.revokeSession(sessionId);
                  setSessionMessage('Device signed out.');
                  await loadSessions();
                } catch (error) {
                  setSessionError(apiErrorMessage(error, 'Unable to sign out this device.'));
                }
              }}
            />
          ) : null}
          {activeSection === 'signout' ? <SignOutSettings logout={logout} /> : null}
        </section>
      </div>

      <Dialog open={confirmOtherSignOut} onOpenChange={setConfirmOtherSignOut}>
        <DialogContent>
          <DialogTitle>Sign out other devices?</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-slate-400">
            Every other active Clinora session will be ended. This device will remain signed in.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmOtherSignOut(false)}
              className="min-h-11 rounded-xl border border-white/10 px-4 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void signOutOthers()}
              className="min-h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 px-4 text-sm font-semibold text-slate-950"
            >
              Sign out other devices
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  return embedded ? content : <main className="min-h-screen bg-[#020617] px-4 py-8 text-white sm:px-8">{content}</main>;
}

function StatusItem({
  icon: Icon,
  label,
  value,
  good,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  good: boolean;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3">
      <span
        className={cn(
          'grid h-9 w-9 place-items-center rounded-xl',
          good ? 'bg-teal-300/[0.07] text-teal-200' : 'bg-amber-300/[0.07] text-amber-200',
        )}
      >
        <Icon size={16} aria-hidden="true" />
      </span>
      <div>
        <p className="text-[11px] font-medium text-slate-600">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-slate-200">{value}</p>
      </div>
    </div>
  );
}

function AccountSettings({ user }: { user: AuthUser | null }) {
  return (
    <div className="p-5 sm:p-7">
      <SettingsHeader title="Account" description="Your sign-in identity and current account status." />
      <dl className="mt-7 divide-y divide-white/[0.07] border-y border-white/[0.07]">
        <DefinitionRow label="Name" value={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || '—'} />
        <DefinitionRow label="Email" value={user?.email ?? '—'} />
        <DefinitionRow label="Account type" value={friendlyRole(user?.role)} />
        <DefinitionRow label="Email status" value={user?.emailVerified ? 'Verified' : 'Pending verification'} />
        <DefinitionRow label="Account status" value={friendlyStatus(user?.accountStatus)} />
      </dl>
      <div className="mt-6 flex gap-3 text-xs leading-5 text-slate-500">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-cyan-200" aria-hidden="true" />
        <p>Account identity and clinical Patient information are managed separately inside Clinora.</p>
      </div>
    </div>
  );
}

function PasswordSettings({
  changePassword,
  register,
  errors,
  newPassword,
  isSubmitting,
  passwordMessage,
  passwordError,
}: {
  changePassword: FormEventHandler<HTMLFormElement>;
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
  newPassword: string;
  isSubmitting: boolean;
  passwordMessage: string;
  passwordError: string;
}) {
  return (
    <form onSubmit={changePassword} className="p-5 sm:p-7">
      <SettingsHeader title="Password" description="Use a strong password that you do not use on another service." />
      <div className="mt-6 grid max-w-2xl gap-5">
        {passwordMessage ? <FormNotice tone="success">{passwordMessage}</FormNotice> : null}
        {passwordError ? <FormNotice tone="error">{passwordError}</FormNotice> : null}
        <PasswordField
          label="Current password"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <PasswordField
          label="New password"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <PasswordRequirements value={newPassword} />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <div className="flex gap-3 border-y border-white/[0.07] py-4 text-xs leading-5 text-slate-500">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-cyan-200" aria-hidden="true" />
          <p>
            After your password is changed, your other active sessions will be signed out. This browser will remain
            signed in.
          </p>
        </div>
        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 px-5 text-sm font-semibold text-slate-950 shadow-[0_10px_28px_rgba(14,165,233,.12)] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isSubmitting ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </div>
    </form>
  );
}

function SessionSettings({
  currentSession,
  otherSessions,
  sessionMessage,
  sessionError,
  onSignOutOtherDevices,
  onSignOutOne,
}: {
  currentSession?: AuthSessionItem;
  otherSessions: AuthSessionItem[];
  sessionMessage: string;
  sessionError: string;
  onSignOutOtherDevices: () => void;
  onSignOutOne: (sessionId: string) => Promise<void>;
}) {
  return (
    <div className="p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SettingsHeader
          title="Sessions"
          description="Review the browsers and devices currently signed in to your Clinora account."
        />
        <button
          type="button"
          disabled={otherSessions.length === 0}
          onClick={onSignOutOtherDevices}
          className="min-h-11 shrink-0 rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-35"
        >
          Sign out other devices
        </button>
      </div>
      <div className="mt-5" aria-live="polite">
        {sessionMessage ? <FormNotice tone="success">{sessionMessage}</FormNotice> : null}
        {sessionError ? <FormNotice tone="error">{sessionError}</FormNotice> : null}
      </div>
      <div className="mt-6">
        <p className="text-xs font-semibold text-slate-500">Current device</p>
        <div className="mt-2 border-y border-white/[0.07]">
          {currentSession ? (
            <SessionRow session={currentSession} onSignOut={async () => undefined} />
          ) : (
            <p className="py-4 text-sm text-slate-500">Current session information is unavailable.</p>
          )}
        </div>
      </div>
      <div className="mt-7">
        <p className="text-xs font-semibold text-slate-500">Other devices</p>
        <div className="mt-2 divide-y divide-white/[0.07] border-y border-white/[0.07]">
          {otherSessions.length ? (
            otherSessions.map((session) => (
              <SessionRow key={session.id} session={session} onSignOut={() => onSignOutOne(session.id)} />
            ))
          ) : (
            <p className="py-4 text-sm text-slate-500">No other active sessions.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SignOutSettings({ logout }: { logout: () => Promise<void> }) {
  return (
    <div className="p-5 sm:p-7">
      <SettingsHeader title="Sign out" description="End the current Clinora session on this browser." />
      <div className="mt-7 flex flex-col gap-5 border-y border-white/[0.07] py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-200">Sign out of this device</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            You can sign in again at any time with your email and password.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/12 px-5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.04]"
        >
          <LogOut size={16} aria-hidden="true" /> Sign out
        </button>
      </div>
    </div>
  );
}

function SettingsHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-[-0.025em]">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function DefinitionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-5">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="break-words text-sm font-medium text-slate-200">{value}</dd>
    </div>
  );
}

function PasswordRequirements({ value = '' }: { value?: string }) {
  const rules = [
    ['At least 8 characters', value.length >= 8],
    ['Uppercase letter', /[A-Z]/.test(value)],
    ['Lowercase letter', /[a-z]/.test(value)],
    ['Number', /[0-9]/.test(value)],
    ['Special character', /[^A-Za-z0-9]/.test(value)],
  ] as const;
  return (
    <div aria-label="Password requirements" className="grid gap-2 border-y border-white/[0.07] py-4 sm:grid-cols-2">
      {rules.map(([label, met]) => (
        <div key={label} className={cn('flex items-center gap-2 text-xs', met ? 'text-teal-300' : 'text-slate-500')}>
          {met ? <Check size={14} aria-hidden="true" /> : <Circle size={10} aria-hidden="true" />}
          <span>{label}</span>
          <span className="sr-only">{met ? 'met' : 'not met'}</span>
        </div>
      ))}
    </div>
  );
}

function SessionRow({ session, onSignOut }: { session: AuthSessionItem; onSignOut: () => Promise<void> }) {
  const parsed = parseUserAgent(session.userAgent);
  const [busy, setBusy] = useState(false);
  return (
    <article className="py-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-100">{parsed.label}</h3>
            {session.current ? (
              <span className="rounded-full border border-teal-300/15 bg-teal-300/[0.06] px-2 py-1 text-[11px] font-semibold text-teal-200">
                Current device
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">{formatActivity(session.lastUsedAt, session.current)}</p>
          <details className="group mt-2.5">
            <summary className="flex min-h-10 w-fit cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-cyan-200">
              View technical details{' '}
              <ChevronDown size={14} className="transition group-open:rotate-180" aria-hidden="true" />
            </summary>
            <dl className="mt-1 grid gap-1.5 text-xs text-slate-400">
              <div>
                <dt className="inline text-slate-500">Browser: </dt>
                <dd className="inline">{parsed.browser}</dd>
              </div>
              <div>
                <dt className="inline text-slate-500">Operating system: </dt>
                <dd className="inline">{parsed.os}</dd>
              </div>
              <div>
                <dt className="inline text-slate-500">IP address: </dt>
                <dd className="inline">{session.ipAddress || 'Unknown'}</dd>
              </div>
              <div>
                <dt className="inline text-slate-500">Last activity: </dt>
                <dd className="inline">{new Date(session.lastUsedAt).toLocaleString()}</dd>
              </div>
            </dl>
          </details>
        </div>
        {!session.current ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSignOut();
              } finally {
                setBusy(false);
              }
            }}
            className="min-h-11 rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-300 hover:bg-white/[0.04] disabled:opacity-50"
          >
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function formatActivity(value: string, current: boolean) {
  return current ? 'Active now' : `Last active ${new Date(value).toLocaleString()}`;
}
function friendlyRole(role?: string) {
  return (
    role
      ?.split('_')
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(' ') ?? 'Unknown'
  );
}
function friendlyStatus(status?: string) {
  return status ? status.charAt(0) + status.slice(1).toLowerCase() : 'Unknown';
}
