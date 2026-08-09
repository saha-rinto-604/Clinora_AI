import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { apiErrorMessage, authApi } from '../../features/auth/auth-api';
import { AuthCard, AuthHeading, FormNotice, PasswordField, SubmitButton } from '../../features/auth/auth-ui';

const password = z.string()
  .min(8, 'Use at least 8 characters.')
  .regex(/[A-Z]/, 'Add an uppercase letter.')
  .regex(/[a-z]/, 'Add a lowercase letter.')
  .regex(/[0-9]/, 'Add a number.')
  .regex(/[^A-Za-z0-9]/, 'Add a special character.');

const schema = z.object({
  password,
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match.',
});
type FormValues = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [message, setMessage] = useState('');
  const [error, setError] = useState(token ? '' : 'The password-reset token is missing.');
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ password: nextPassword }) => {
    if (!token) return;
    setError('');
    try {
      const response = await authApi.resetPassword(token, nextPassword);
      setMessage(response.data.message);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'The reset link could not be used.'));
    }
  });

  return (
    <AuthCard>
      <AuthHeading
        eyebrow="Secure reset"
        title="Choose a new password"
        description="A successful reset revokes existing sessions for the account."
      />
      <form onSubmit={onSubmit} className="grid gap-5">
        {message ? <FormNotice tone="success">{message}</FormNotice> : null}
        {error ? <FormNotice tone="error">{error}</FormNotice> : null}
        <PasswordField label="New password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
        <PasswordField label="Confirm new password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <SubmitButton loading={isSubmitting}>Reset password</SubmitButton>
      </form>
      {message ? (
        <Link to="/login" className="mt-6 block text-center text-sm font-semibold text-cyan-300">
          Sign in with the new password
        </Link>
      ) : null}
    </AuthCard>
  );
}
