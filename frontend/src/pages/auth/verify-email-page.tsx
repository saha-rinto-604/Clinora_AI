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
        description="Email verification confirms ownership of your address; it does not grant privileged roles."
      />
      <FormNotice tone={tone}>{message}</FormNotice>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/login" className="min-h-11 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950">
          Go to sign in
        </Link>
        <Link
          to="/"
          className="min-h-11 rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-200"
        >
          Return home
        </Link>
      </div>
    </AuthCard>
  );
}
