import { LoaderCircle, Mail } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { applicationApi, applicationErrorMessage } from '../../features/access-applications/application-api';
import type { AccessApplication, ApplicationEvent } from '../../features/access-applications/application-types';
import {
  ApplicationField,
  ApplicationNotice,
  ApplicationPanel,
  ApplicationPrimaryButton,
} from '../../features/access-applications/application-ui';
import { ApplicationWorkspace } from '../../features/access-applications/application-workspace';

function ApplicationSignIn() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'info' | 'error'>('info');
  const [loading, setLoading] = useState(false);

  async function sendLink(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setMessageTone('info');
    try {
      await applicationApi.requestAccessLink(email);
      setMessage('If an eligible professional application exists for this email, we’ve sent a secure sign-in link.');
    } catch (error) {
      setMessageTone('error');
      setMessage(applicationErrorMessage(error, 'We could not send a secure sign-in link. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg pt-6 sm:pt-10">
      <ApplicationPanel>
        <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/[0.15] bg-cyan-300/[0.06] text-cyan-200">
          <Mail size={18} aria-hidden="true" />
        </div>
        <header className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Applicant portal</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-white">Sign in to your application</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Enter the email you verified when you started your Doctor or Researcher application. We’ll send a single-use
            secure sign-in link.
          </p>
        </header>
        <form onSubmit={sendLink} className="grid gap-4">
          <ApplicationField
            label="Application email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          {message ? <ApplicationNotice tone={messageTone}>{message}</ApplicationNotice> : null}
          <div className="flex justify-end">
            <ApplicationPrimaryButton loading={loading} type="submit" className="w-full sm:w-auto sm:min-w-52">
              Email secure sign-in link
            </ApplicationPrimaryButton>
          </div>
        </form>
        <p className="mt-5 text-xs leading-5 text-slate-500">
          Applicant access is separate from Clinora account login. The link is short-lived and becomes unusable after it
          establishes your private application session.
        </p>
      </ApplicationPanel>
    </div>
  );
}

export function ApplicationStatusPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState<AccessApplication | null>(null);
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsAccess, setNeedsAccess] = useState(false);
  const [error, setError] = useState('');
  const sessionBootStarted = useRef(false);

  async function refresh() {
    setError('');
    try {
      const app = await applicationApi.me();
      setApplication(app);
      setEvents(await applicationApi.events());
      setNeedsAccess(false);
    } catch {
      setNeedsAccess(true);
      setApplication(null);
      setEvents([]);
    }
  }

  async function load() {
    setLoading(true);
    try {
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const token = searchParams.get('token');
    async function boot() {
      if (token) {
        if (sessionBootStarted.current) return;
        sessionBootStarted.current = true;
        window.history.replaceState(window.history.state, document.title, '/application/status');
        try {
          await applicationApi.establishSession(token);
          navigate('/application/status', { replace: true });
        } catch (caught) {
          setError(applicationErrorMessage(caught, 'This secure sign-in link could not be used.'));
          setNeedsAccess(true);
          setLoading(false);
          return;
        }
      }
      await load();
    }
    void boot();
    // The one-time token is consumed once and removed from the visible URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="grid min-h-[55vh] place-items-center" role="status" aria-label="Loading application">
        <LoaderCircle className="animate-spin text-cyan-300 motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  }

  if (needsAccess || !application) {
    return (
      <>
        <ApplicationSignIn />
        {error ? (
          <div className="mx-auto mt-4 max-w-lg">
            <ApplicationNotice tone="error">{error}</ApplicationNotice>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <ApplicationWorkspace application={application} events={events} onApplication={setApplication} onReload={refresh} />
  );
}
