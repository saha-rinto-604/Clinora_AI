import { AlertTriangle, CheckCircle2, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  applicationApi,
  applicationErrorCode,
  applicationErrorMessage,
} from '../../features/access-applications/application-api';
import { AuthCard, FormNotice, SubmitButton } from '../../features/auth/auth-ui';

type VerificationState = 'loading' | 'verified' | 'expired' | 'reused' | 'error';

export function ApplicationEmailVerificationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const started = useRef(false);
  const [state, setState] = useState<VerificationState>('loading');
  const [message, setMessage] = useState('Verifying your professional application email...');
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

    applicationApi
      .verifyEmail(token)
      .then((result) => {
        setContinuationToken(result.continuationToken);
        setState('verified');
        setMessage('Your professional application email has been confirmed.');
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
      setMessage(applicationErrorMessage(error, 'Secure applicant access could not be established.'));
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
      setMessage(applicationErrorMessage(error, 'A new verification email could not be sent for this link.'));
    } finally {
      setResending(false);
    }
  }

  const success = state === 'verified';
  const canResend = state === 'expired';
  const canResume = state === 'reused';

  return (
    <div className="mx-auto max-w-xl">
      <AuthCard>
        <div className="grid gap-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
            {state === 'loading' ? (
              <LoaderCircle className="animate-spin text-cyan-200 motion-reduce:animate-none" aria-hidden="true" />
            ) : success ? (
              <CheckCircle2 className="text-emerald-200" aria-hidden="true" />
            ) : (
              <AlertTriangle className="text-amber-200" aria-hidden="true" />
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Professional application</p>
            <h1 className="mt-3 text-3xl font-semibold">{success ? 'Email verified' : 'Email verification'}</h1>
            {success ? (
              <p className="mt-3 leading-7 text-slate-300">Your professional application email has been confirmed.</p>
            ) : null}
          </div>
          {message ? (
            <FormNotice tone={success ? 'success' : state === 'loading' ? 'info' : 'error'}>{message}</FormNotice>
          ) : null}
          {success ? (
            <SubmitButton loading={continuing} onClick={() => void continueApplication()} type="button">
              Continue application
            </SubmitButton>
          ) : null}
          {canResend ? (
            <button
              type="button"
              onClick={() => void resendVerification()}
              disabled={resending}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-cyan-300/20 px-4 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/10 disabled:opacity-60"
            >
              {resending ? 'Sending...' : 'Send a new verification email'}
            </button>
          ) : null}
          {canResume ? (
            <Link className="font-semibold text-cyan-300 hover:text-cyan-200" to="/application/status">
              Resume application
            </Link>
          ) : null}
          {state === 'error' ? (
            <Link className="font-semibold text-cyan-300 hover:text-cyan-200" to="/application/status">
              Return to your saved application
            </Link>
          ) : null}
        </div>
      </AuthCard>
    </div>
  );
}
