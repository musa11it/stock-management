import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMessage, tokenStorage } from '@/lib/apiClient';
import * as authService from '@/services/auth.service';
import { getDefaultRoute } from '@/lib/defaultRoute';

const schema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Enter a valid email address'),
    phone: z.string().optional(),
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Needs an uppercase letter')
      .regex(/[a-z]/, 'Needs a lowercase letter')
      .regex(/[0-9]/, 'Needs a number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await authService.register(values);
      // Registration already returns tokens; log in with the same credentials to hydrate auth state consistently.
      tokenStorage.clear();
      const permissions = await login(values.email, values.password);
      toast.success('Account created successfully!');
      navigate(getDefaultRoute(permissions), { replace: true });
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  };

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Create a customer account</h2>
      <p className="mb-6 text-sm text-slate-500">Sign up to browse the menu and place orders.</p>

      {serverError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" error={errors.firstName?.message} {...register('firstName')} />
          <Input label="Last name" error={errors.lastName?.message} {...register('lastName')} />
        </div>
        <Input label="Email address" type="email" error={errors.email?.message} {...register('email')} />
        <Input label="Phone (optional)" error={errors.phone?.message} {...register('phone')} />
        <Input label="Password" type="password" error={errors.password?.message} {...register('password')} />
        <Input label="Confirm password" type="password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}
