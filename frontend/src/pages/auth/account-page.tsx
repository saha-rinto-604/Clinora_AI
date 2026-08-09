import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, LogOut, MonitorSmartphone, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { apiErrorMessage, authApi } from '../../features/auth/auth-api';
import { useAuthStore } from '../../features/auth/auth-store';
import { FormNotice, PasswordField, SubmitButton } from '../../features/auth/auth-ui';
import type { AuthSessionItem } from '../../features/auth/auth-types';

const schema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z.string()
    .min(8, 'Use at least 8 characters.')
    .regex(/[A-Z]/, 'Add an uppercase letter.')
    .regex(/[a-z]/, 'Add a lowercase letter.')
    .regex(/[0-9]/, 'Add a number.')
    .regex(/[^A-Za-z0-9]/, 'Add a special character.'),
});
type FormValues = z.infer<typeof schema>;

export function AccountPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<AuthSessionItem[]>([]);
  const [sessionError, setSessionError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const { register, reset, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) });

  const loadSessions = async () => {
    try {
      setSessions(await authApi.sessions());
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
      setPasswordMessage('Password changed. Other sessions were revoked.');
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

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white sm:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 flex flex-col gap-5 rounded-[32px] border border-white/10 bg-white/[0.055] p-6 backdrop-blur-[18px] sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Authenticated account</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">{user?.firstName} {user?.lastName}</h1>
            <p className="mt-2 text-slate-400">{user?.email}</p>
          </div>
          <button type="button" onClick={logout} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 text-sm font-semibold text-slate-200 hover:bg-white/5">
            <LogOut size={17} aria-hidden="true" /> Sign out
          </button>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[32px] border border-white/10 bg-white/[0.055] p-6 backdrop-blur-[18px] sm:p-8">
            <div className="mb-6 flex items-start gap-3">
              <ShieldCheck className="mt-1 text-teal-300" size={22} aria-hidden="true" />
              <div>
                <h2 className="text-xl font-semibold">Identity status</h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">Account security only; this is not a clinical dashboard.</p>
              </div>
            </div>
            <dl className="grid gap-4 text-sm">
              <div className="flex justify-between gap-4 border-b border-white/10 pb-4"><dt className="text-slate-400">Role</dt><dd className="font-semibold">{user?.role}</dd></div>
              <div className="flex justify-between gap-4 border-b border-white/10 pb-4"><dt className="text-slate-400">Account status</dt><dd className="font-semibold">{user?.accountStatus}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-400">Email</dt><dd className="font-semibold">{user?.emailVerified ? 'Verified' : 'Pending'}</dd></div>
            </dl>
          </section>

          <section className="rounded-[32px] border border-white/10 bg-white/[0.055] p-6 backdrop-blur-[18px] sm:p-8">
            <div className="mb-6 flex items-start gap-3">
              <KeyRound className="mt-1 text-cyan-300" size={22} aria-hidden="true" />
              <div>
                <h2 className="text-xl font-semibold">Change password</h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">Keep this session and revoke the others.</p>
              </div>
            </div>
            <form onSubmit={changePassword} className="grid gap-4">
              {passwordMessage ? <FormNotice tone="success">{passwordMessage}</FormNotice> : null}
              {passwordError ? <FormNotice tone="error">{passwordError}</FormNotice> : null}
              <PasswordField label="Current password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
              <PasswordField label="New password" autoComplete="new-password" error={errors.newPassword?.message} {...register('newPassword')} />
              <SubmitButton loading={isSubmitting}>Update password</SubmitButton>
            </form>
          </section>
        </div>

        <section className="mt-6 rounded-[32px] border border-white/10 bg-white/[0.055] p-6 backdrop-blur-[18px] sm:p-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-start gap-3">
              <MonitorSmartphone className="mt-1 text-cyan-300" size={22} aria-hidden="true" />
              <div>
                <h2 className="text-xl font-semibold">Sessions</h2>
                <p className="mt-1 text-sm text-slate-400">Review and revoke browser sessions tied to your account.</p>
              </div>
            </div>
            <button type="button" onClick={async () => {
              try {
                await authApi.revokeOtherSessions();
                await loadSessions();
              } catch (error) {
                setSessionError(apiErrorMessage(error, 'Unable to revoke other sessions.'));
              }
            }} className="min-h-11 rounded-2xl border border-white/15 px-4 text-sm font-semibold text-slate-200 hover:bg-white/5">
              Revoke other sessions
            </button>
          </div>

          {sessionError ? <FormNotice tone="error">{sessionError}</FormNotice> : null}
          <div className="mt-4 grid gap-3">
            {sessions.map((session) => (
              <article key={session.id} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{session.userAgent || 'Unknown browser'}</p>
                    {session.current ? <span className="rounded-full bg-teal-300/10 px-2 py-1 text-[11px] font-bold text-teal-200">CURRENT</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {session.ipAddress || 'Unknown IP'} · Last used {new Date(session.lastUsedAt).toLocaleString()}
                  </p>
                </div>
                {!session.current ? (
                  <button type="button" aria-label="Revoke session" onClick={async () => {
                    try {
                      await authApi.revokeSession(session.id);
                      await loadSessions();
                    } catch (error) {
                      setSessionError(apiErrorMessage(error, 'Unable to revoke the session.'));
                    }
                  }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-rose-300/20 px-4 text-sm font-semibold text-rose-200 hover:bg-rose-300/10">
                    <Trash2 size={16} aria-hidden="true" /> Revoke
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
