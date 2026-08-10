import { AlertTriangle, CheckCircle2, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  applicationApi,
  applicationErrorCode,
  applicationErrorMessage,
} from '../../features/access-applications/application-api';
import {
  ApplicationNotice,
  ApplicationPanel,
  ApplicationPrimaryButton,
  ApplicationSecondaryButton,
} from '../../features/access-applications/application-ui';

type VerificationState = 'loading' | 'verified' | 'expired' | 'reused' | 'error';

export function ApplicationEmailVerificationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const started = useRef(false);
  const [state, setState] = useState<VerificationState>('loading');
  const [message, setMessage] = useState('Verifying your email…');
  const [continuationToken, setContinuationToken] = useState('');
  const [continuing, setContinuing] = useState(false);
  const [resending, setResending] = useState(false);
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('This verification link is incomplete.');
      return;
    }
    if (started.current) return;
    started.current = true;
    window.history.replaceState(window.history.state, document.title, '/application/email-verification');

    applicationApi
      .verifyEmail(token)
      .then((result) => {
        setContinuationToken(result.continuationToken);
        setState('verified');
        setMessage('Your email has been verified.');
      })
      .catch((error) => {
        const code = applicationErrorCode(error);
        setState(
          code === 'APPLICATION_VERIFICATION_ALREADY_USED'
            ? 'reused'
            : code === 'APPLICATION_VERIFICATION_EXPIRED'
              ? 'expired'
              : 'error',
        );
        setMessage(applicationErrorMessage(error, 'The verification link could not be used.'));
      });
  }, [token]);

  async function continueApplication() {
    if (!continuationToken) return;
    setContinuing(true);
    setMessage('');
    try {
      await applicationApi.establishSession(continuationToken);
      navigate('/application/status', { replace: true });
    } catch (error) {
      setState('error');
      setMessage(applicationErrorMessage(error, 'We could not open your secure application session.'));
    } finally {
      setContinuing(false);
    }
  }

  async function resendVerification() {
    if (!token) return;
    setResending(true);
    setMessage('');
    try {
      await applicationApi.resendVerification(token);
      setMessage('A new verification email has been sent. Use the newest link in your inbox.');
    } catch (error) {
      setState('error');
      setMessage(applicationErrorMessage(error, 'We could not send a new verification email for this link.'));
    } finally {
      setResending(false);
    }
  }

  const success = state === 'verified';
  const canResend = state === 'expired';
  const canResume = state === 'reused';

  return (
    <div className="mx-auto max-w-lg pt-6 sm:pt-10">
      <ApplicationPanel className="text-center">
        <div
          className={`mx-auto grid h-11 w-11 place-items-center rounded-xl border ${success ? 'border-emerald-300/[0.18] bg-emerald-300/[0.07]' : 'border-cyan-300/[0.15] bg-cyan-300/[0.06]'}`}
        >
          {state === 'loading' ? (
            <LoaderCircle
              size={20}
              className="animate-spin text-cyan-200 motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : success ? (
            <CheckCircle2 size={20} className="text-emerald-200" aria-hidden="true" />
          ) : (
            <AlertTriangle size={20} className="text-amber-200" aria-hidden="true" />
          )}
        </div>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
          Professional application
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-white">
          {success ? 'Email verified' : 'Email verification'}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">
          {success
            ? 'Your email is confirmed. Continue when you’re ready to open your private application workspace.'
            : 'We’re checking the single-use link from your email.'}
        </p>

        {message ? (
          <ApplicationNotice
            tone={success ? 'success' : state === 'loading' ? 'info' : 'error'}
            className="mt-5 text-left"
          >
            {message}
          </ApplicationNotice>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 sm:items-center">
          {success ? (
            <ApplicationPrimaryButton
              loading={continuing}
              onClick={() => void continueApplication()}
              type="button"
              className="w-full sm:w-auto sm:min-w-48"
            >
              Continue application
            </ApplicationPrimaryButton>
          ) : null}

          {canResend ? (
            <ApplicationSecondaryButton
              type="button"
              onClick={() => void resendVerification()}
              disabled={resending}
              className="w-full sm:w-auto"
            >
              {resending ? 'Sending…' : 'Send a new verification email'}
            </ApplicationSecondaryButton>
          ) : null}

          {canResume ? (
            <Link className="text-sm font-medium text-cyan-300 transition hover:text-cyan-200" to="/application/status">
              Resume application
            </Link>
          ) : null}

          {state === 'error' ? (
            <Link className="text-sm font-medium text-cyan-300 transition hover:text-cyan-200" to="/application/status">
              Return to application access
            </Link>
          ) : null}
        </div>
      </ApplicationPanel>
    </div>
  );
}
