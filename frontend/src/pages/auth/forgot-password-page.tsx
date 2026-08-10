import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { apiErrorMessage, authApi } from '../../features/auth/auth-api';
import { AuthCard, AuthHeading, Field, FormNotice, SubmitButton } from '../../features/auth/auth-ui';

const schema = z.object({ email: z.string().email('Enter a valid email address.') });
type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError('');
    try {
      const response = await authApi.forgotPassword(email);
      setMessage(response.data.message);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to process the request.'));
    }
  });

  return (
    <AuthCard>
      <AuthHeading
        eyebrow="Account recovery"
        title="Reset your password"
        description="Enter your account email. If it is eligible, we’ll send a secure reset link."
      />
      <form onSubmit={onSubmit} className="grid gap-4">
        {message ? <FormNotice tone="success">{message}</FormNotice> : null}
        {error ? <FormNotice tone="error">{error}</FormNotice> : null}
        <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <SubmitButton loading={isSubmitting}>Send reset link</SubmitButton>
      </form>
      <Link to="/login" className="mt-5 block text-center text-sm font-medium text-cyan-300 hover:text-cyan-200">
        Back to sign in
      </Link>
    </AuthCard>
  );
}
