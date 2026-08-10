import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { apiErrorMessage, authApi } from '../../features/auth/auth-api';
import { AuthCard, AuthHeading, FormNotice } from '../../features/auth/auth-ui';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const started = useRef(false);
  const [tone, setTone] = useState<'info' | 'success' | 'error'>(token ? 'info' : 'error');
  const [message, setMessage] = useState(token ? 'Verifying your secure link…' : 'The verification token is missing.');

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    window.history.replaceState(window.history.state, document.title, '/verify-email');
    authApi
      .verifyEmail(token)
      .then((response) => {
        setTone('success');
        setMessage(response.data.message);
      })
      .catch((error) => {
        setTone('error');
        setMessage(apiErrorMessage(error, 'The verification link could not be used.'));
      });
  }, [token]);

  return (
    <AuthCard>
      <AuthHeading
        eyebrow="Email ownership"
        title="Verify your email"
        description="Confirm your email to finish setting up your patient account."
      />
      <FormNotice tone={tone}>{message}</FormNotice>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          to="/login"
          className="inline-flex min-h-10 items-center rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950"
        >
          Go to sign in
        </Link>
        <Link
          to="/"
          className="inline-flex min-h-10 items-center rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-200"
        >
          Return home
        </Link>
      </div>
    </AuthCard>
  );
}
