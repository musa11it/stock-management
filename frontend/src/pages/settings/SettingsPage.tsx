import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMessage } from '@/lib/apiClient';
import * as authService from '@/services/auth.service';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Needs an uppercase letter')
      .regex(/[a-z]/, 'Needs a lowercase letter')
      .regex(/[0-9]/, 'Needs a number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
type FormValues = z.infer<typeof schema>;

export default function SettingsPage() {
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => authService.changePassword(values.currentPassword, values.newPassword),
    onSuccess: () => {
      toast.success('Password changed successfully');
      reset();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" description="Manage your profile and account security." />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Name</span>
              <span className="font-medium text-slate-900">
                {user?.firstName} {user?.lastName}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Email</span>
              <span className="font-medium text-slate-900">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Role</span>
              <Badge tone="blue">{user?.role.name.replace('_', ' ')}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
              <Input label="Current password" type="password" error={errors.currentPassword?.message} {...register('currentPassword')} />
              <Input label="New password" type="password" error={errors.newPassword?.message} {...register('newPassword')} />
              <Input label="Confirm new password" type="password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
              <Button type="submit" isLoading={mutation.isPending}>
                Update password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
