import { AlertTriangle, CheckCircle2, KeyRound } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { applicationApi, applicationErrorMessage } from '../../features/access-applications/application-api';
import {
  ApplicationField,
  ApplicationNotice,
  ApplicationPanel,
  ApplicationPrimaryButton,
} from '../../features/access-applications/application-ui';

type ActivationState = 'ready' | 'success' | 'error';

export function ApplicationActivationPage() {
  const [searchParams] = useSearchParams();
  const tokenRef = useRef(searchParams.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<ActivationState>(tokenRef.current ? 'ready' : 'error');
  const [message, setMessage] = useState(tokenRef.current ? '' : 'This activation link is incomplete.');

  useEffect(() => {
    if (tokenRef.current) {
      window.history.replaceState(window.history.state, document.title, '/application/activate');
    }
  }, []);

  async function activate(event: FormEvent) {
    event.preventDefault();
    if (!tokenRef.current || loading) return;
    if (password !== confirmPassword) {
      setState('error');
      setMessage('Passwords must match.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      await applicationApi.activate(tokenRef.current, password);
      tokenRef.current = '';
      setPassword('');
      setConfirmPassword('');
      setState('success');
      setMessage('Your professional account is active. Sign in with your new password.');
    } catch (error) {
      setState('error');
      setMessage(applicationErrorMessage(error, 'This activation link could not be used.'));
    } finally {
      setLoading(false);
    }
  }

  const success = state === 'success';

  return (
    <div className="mx-auto max-w-lg pt-6 sm:pt-10">
      <ApplicationPanel>
        <div
          className={`mb-6 flex h-10 w-10 items-center justify-center rounded-xl border ${
            success
              ? 'border-emerald-300/[0.18] bg-emerald-300/[0.07] text-emerald-200'
              : state === 'error' && !tokenRef.current
                ? 'border-amber-300/[0.18] bg-amber-300/[0.07] text-amber-200'
                : 'border-cyan-300/[0.15] bg-cyan-300/[0.06] text-cyan-200'
          }`}
        >
          {success ? (
            <CheckCircle2 size={18} aria-hidden="true" />
          ) : state === 'error' && !tokenRef.current ? (
            <AlertTriangle size={18} aria-hidden="true" />
          ) : (
            <KeyRound size={18} aria-hidden="true" />
          )}
        </div>
        <header className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Professional activation</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-white">
            {success ? 'Account activated' : 'Set your account password'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Approved Doctor and Researcher accounts are activated only after setting a private password through this
            single-use link.
          </p>
        </header>

        {message ? (
          <ApplicationNotice tone={success ? 'success' : 'error'} className="mb-5">
            {message}
          </ApplicationNotice>
        ) : null}

        {success ? (
          <Link className="text-sm font-medium text-cyan-300 transition hover:text-cyan-200" to="/login">
            Continue to login
          </Link>
        ) : tokenRef.current ? (
          <form onSubmit={activate} className="grid gap-4">
            <ApplicationField
              label="Password"
              aria-label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <ApplicationField
              label="Confirm password"
              aria-label="Confirm password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
            <div className="flex justify-end">
              <ApplicationPrimaryButton loading={loading} type="submit" className="w-full sm:w-auto sm:min-w-48">
                Activate account
              </ApplicationPrimaryButton>
            </div>
          </form>
        ) : (
          <Link className="text-sm font-medium text-cyan-300 transition hover:text-cyan-200" to="/application/status">
            Return to application access
          </Link>
        )}
      </ApplicationPanel>
    </div>
  );
}
