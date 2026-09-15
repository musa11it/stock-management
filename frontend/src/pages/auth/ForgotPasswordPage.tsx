import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { apiClient, getErrorMessage } from '@/lib/apiClient';
import { CheckCircle2 } from 'lucide-react';

const schema = z.object({ email: z.string().email('Enter a valid email address') });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await apiClient.post('/auth/forgot-password', values);
      setSent(true);
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <h2 className="mt-3 text-lg font-semibold text-slate-900">Check your email</h2>
        <p className="mt-1 text-sm text-slate-500">If an account exists for that email, a reset link has been sent.</p>
        <Link to="/login" className="mt-4 text-sm font-medium text-brand-600 hover:text-brand-700">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Forgot password</h2>
      <p className="mb-6 text-sm text-slate-500">We'll send you a link to reset your password.</p>

      {serverError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Email address" type="email" error={errors.email?.message} {...register('email')} />
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Send reset link
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
