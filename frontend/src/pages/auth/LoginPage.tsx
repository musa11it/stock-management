import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMessage } from '@/lib/apiClient';
import { getDefaultRoute } from '@/lib/defaultRoute';
import { isPathAllowed } from '@/lib/routeAccess';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

const demoAccounts = [
  { role: 'Super Admin', email: 'admin@restaurant.com', password: 'Admin@12345' },
  { role: 'Manager', email: 'manager@restaurant.com', password: 'Manager@12345' },
  { role: 'Staff', email: 'staff@restaurant.com', password: 'Staff@12345' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const permissions = await login(values.email, values.password);
      toast.success('Welcome back!');
      const requestedFrom = (location.state as { from?: Location })?.from?.pathname;
      const from = requestedFrom && isPathAllowed(requestedFrom, permissions) ? requestedFrom : getDefaultRoute(permissions);
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  };

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Sign in</h2>
      <p className="mb-6 text-sm text-slate-500">Enter your credentials to access the dashboard.</p>

      {serverError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Email address" type="email" placeholder="you@restaurant.com" error={errors.email?.message} {...register('email')} />
        <Input label="Password" type="password" placeholder="••••••••" error={errors.password?.message} {...register('password')} />
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Sign in
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        Don't have an account?{' '}
        <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700">
          Create one
        </Link>
      </p>

      <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Demo accounts</p>
        <div className="space-y-1">
          {demoAccounts.map((acc) => (
            <button
              key={acc.email}
              type="button"
              onClick={() => {
                setValue('email', acc.email);
                setValue('password', acc.password);
              }}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-50"
            >
              <span className="font-medium text-slate-700">{acc.role}</span>
              <span className="text-slate-400">{acc.email}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
