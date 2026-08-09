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
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setError('');
    try {
      await authApi.login(values.email, values.password);
      const state = location.state as { from?: string } | null;
      navigate(state?.from ?? '/account', { replace: true });
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to sign in. Please try again.'));
    }
  });

  return (
    <AuthCard>
      <AuthHeading
        eyebrow="Welcome back"
        title="Sign in to Clinora"
        description="Use the email and password attached to your active Clinora account."
      />
      <form onSubmit={onSubmit} className="grid gap-5">
        {error ? <FormNotice tone="error">{error}</FormNotice> : null}
        <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <PasswordField label="Password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">
            Forgot password?
          </Link>
        </div>
        <SubmitButton loading={isSubmitting}>Sign in</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-slate-400">
        New Patient?{' '}
        <Link to="/register" className="font-semibold text-cyan-300 hover:text-cyan-200">Create an account</Link>
      </p>
    </AuthCard>
  );
}
