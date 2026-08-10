import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { apiErrorMessage, authApi } from '../../features/auth/auth-api';
import { AuthCard, AuthHeading, Field, FormNotice, PasswordField, SubmitButton } from '../../features/auth/auth-ui';

const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .regex(/[A-Z]/, 'Add an uppercase letter.')
  .regex(/[a-z]/, 'Add a lowercase letter.')
  .regex(/[0-9]/, 'Add a number.')
  .regex(/[^A-Za-z0-9]/, 'Add a special character.');

const schema = z
  .object({
    firstName: z.string().min(1, 'Enter your first name.').max(120),
    lastName: z.string().min(1, 'Enter your last name.').max(120),
    email: z.string().email('Enter a valid email address.'),
    password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });
type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setError('');
    setMessage('');
    try {
      const response = await authApi.register({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
      });
      setMessage(`Verification email sent to ${response.data.data.email}.`);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to create the account. Please try again.'));
    }
  });

  return (
    <AuthCard>
      <AuthHeading
        eyebrow="Patient account"
        title="Create your Clinora account"
        description="Set up your patient account to securely access Clinora."
      />
      <form onSubmit={onSubmit} className="grid gap-4">
        {message ? <FormNotice tone="success">{message}</FormNotice> : null}
        {error ? <FormNotice tone="error">{error}</FormNotice> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="First name"
            autoComplete="given-name"
            error={errors.firstName?.message}
            {...register('firstName')}
          />
          <Field
            label="Last name"
            autoComplete="family-name"
            error={errors.lastName?.message}
            {...register('lastName')}
          />
        </div>
        <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <p className="text-xs leading-5 text-slate-500">
          Use 8+ characters with uppercase, lowercase, a number, and a special character.
        </p>
        <SubmitButton loading={isSubmitting}>Create patient account</SubmitButton>
      </form>
      <p className="mt-5 text-center text-sm text-slate-400">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-cyan-300 hover:text-cyan-200">
          Sign in
        </Link>
      </p>
      <div className="mt-5 border-t border-white/10 pt-5 text-center text-sm text-slate-400">
        Doctor or researcher? Apply for professional access:{' '}
        <Link to="/apply/doctor" className="font-semibold text-cyan-300 hover:text-cyan-200">
          Doctor
        </Link>{' '}
        <span aria-hidden="true">·</span>{' '}
        <Link to="/apply/researcher" className="font-semibold text-cyan-300 hover:text-cyan-200">
          Researcher
        </Link>
      </div>
    </AuthCard>
  );
}
