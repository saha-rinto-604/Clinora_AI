import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { apiErrorMessage, authApi } from '../../features/auth/auth-api';
import { AuthCard, AuthHeading, Field, FormNotice, PasswordField, SubmitButton } from '../../features/auth/auth-ui';

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setError('');
    try {
      const session = await authApi.login(values.email, values.password);
      const state = location.state as { from?: string } | null;
      const defaultRoute = session.user.role === 'PATIENT' ? '/patient' : '/account';
      navigate(state?.from ?? defaultRoute, { replace: true });
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to sign in. Please try again.'));
    }
  });

  return (
    <AuthCard>
      <AuthHeading
        eyebrow="Welcome back"
        title="Sign in to Clinora"
        description="Use your account email and password to continue."
      />
      <form onSubmit={onSubmit} className="grid gap-4">
        {error ? <FormNotice tone="error">{error}</FormNotice> : null}
        <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">
            Forgot password?
          </Link>
        </div>
        <SubmitButton loading={isSubmitting}>Sign in</SubmitButton>
      </form>
      <p className="mt-5 text-center text-sm text-slate-400">
        New to Clinora?{' '}
        <Link to="/register" className="font-semibold text-cyan-300 hover:text-cyan-200">
          Create an account
        </Link>
      </p>
      <div className="mt-5 border-t border-white/10 pt-5 text-center text-sm text-slate-400">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Professional access</p>
        <p className="mt-2">Doctors and Researchers use a separate professional application process.</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
          <Link to="/apply/doctor" className="font-semibold text-cyan-300 hover:text-cyan-200">
            Doctor application
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/apply/researcher" className="font-semibold text-cyan-300 hover:text-cyan-200">
            Researcher application
          </Link>
        </div>
        <p className="mt-3">
          Already applied?{' '}
          <Link to="/application/status" className="font-semibold text-cyan-300 hover:text-cyan-200">
            Continue your application
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
