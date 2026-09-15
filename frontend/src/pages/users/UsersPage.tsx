import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Pencil, UserX, Users as UsersIcon } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Can } from '@/components/common/Can';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { userService } from '@/services/user.service';
import { getErrorMessage } from '@/lib/apiClient';
import { useAuth } from '@/hooks/useAuth';
import type { RoleName, User, UserStatus } from '@/types';

const roleTone: Record<RoleName, 'purple' | 'blue' | 'green' | 'slate'> = {
  SUPER_ADMIN: 'purple',
  MANAGER: 'blue',
  STAFF: 'green',
  RETAIL_USER: 'slate',
};

const statusTone: Record<UserStatus, 'green' | 'slate' | 'red'> = { ACTIVE: 'green', INACTIVE: 'slate', SUSPENDED: 'red' };

const createSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
  password: z.string().min(8, 'At least 8 characters'),
  roleName: z.enum(['SUPER_ADMIN', 'MANAGER', 'STAFF', 'RETAIL_USER']),
});
const updateSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  phone: z.string().optional(),
  roleName: z.enum(['SUPER_ADMIN', 'MANAGER', 'STAFF', 'RETAIL_USER']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
});
type CreateValues = z.infer<typeof createSchema>;
type UpdateValues = z.infer<typeof updateSchema>;

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [page, setPage] = useState(1);
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; user?: User } | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['users', page],
    queryFn: () => userService.list({ page, limit: 15 }),
  });
  const createMutation = useMutation({
    mutationFn: (values: CreateValues) => userService.create(values),
    onSuccess: () => {
      toast.success('User created successfully');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setModalState(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: UpdateValues }) => userService.update(id, values),
    onSuccess: () => {
      toast.success('User updated successfully');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setModalState(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => userService.remove(id),
    onSuccess: () => {
      toast.success('User deactivated successfully');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeactivateTarget(null);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
      setDeactivateTarget(null);
    },
  });

  const columns: Column<User>[] = [
    {
      header: 'User',
      accessor: (u) => (
        <div>
          <p className="font-medium text-slate-900">
            {u.firstName} {u.lastName}
          </p>
          <p className="text-xs text-slate-400">{u.email}</p>
        </div>
      ),
    },
    { header: 'Role', accessor: (u) => <Badge tone={roleTone[u.role.name]}>{u.role.name.replace('_', ' ')}</Badge> },
    { header: 'Status', accessor: (u) => <Badge tone={statusTone[u.status]}>{u.status}</Badge> },
    { header: 'Last login', accessor: (u) => (u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : <span className="text-slate-400">Never</span>) },
    {
      header: '',
      headerClassName: 'w-24',
      accessor: (u) => (
        <div className="flex justify-end gap-1">
          <Can permission="users.update">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setModalState({ mode: 'edit', user: u });
              }}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </Can>
          {u.role.name !== 'SUPER_ADMIN' && u.id !== currentUser?.id && (
            <Can permission="users.delete">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeactivateTarget(u);
                }}
                className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
              >
                <UserX className="h-4 w-4" />
              </button>
            </Can>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage staff, managers, and administrator accounts."
        action={
          <Can permission="users.create">
            <Button onClick={() => setModalState({ mode: 'create' })}>
              <Plus className="h-4 w-4" /> New User
            </Button>
          </Can>
        }
      />

      <Card>
        {isLoading ? (
          <TableSkeleton cols={5} />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        ) : !data || data.data.length === 0 ? (
          <EmptyState icon={UsersIcon} title="No users yet" description="Add a user to give them access to the system." />
        ) : (
          <>
            <DataTable columns={columns} data={data.data} rowKey={(u) => u.id} />
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>

      {modalState?.mode === 'create' && (
        <CreateUserModal isSubmitting={createMutation.isPending} onClose={() => setModalState(null)} onSubmit={(v) => createMutation.mutate(v)} />
      )}
      {modalState?.mode === 'edit' && modalState.user && (
        <EditUserModal
          user={modalState.user}
          isSubmitting={updateMutation.isPending}
          onClose={() => setModalState(null)}
          onSubmit={(v) => updateMutation.mutate({ id: modalState.user!.id, values: v })}
        />
      )}

      <ConfirmDialog
        isOpen={!!deactivateTarget}
        title="Deactivate user"
        message={`Are you sure you want to deactivate "${deactivateTarget?.firstName} ${deactivateTarget?.lastName}"? They will no longer be able to sign in.`}
        confirmLabel="Deactivate"
        isLoading={deactivateMutation.isPending}
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)}
      />
    </div>
  );
}

function CreateUserModal({ isSubmitting, onClose, onSubmit }: { isSubmitting: boolean; onClose: () => void; onSubmit: (v: CreateValues) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: { roleName: 'STAFF' } });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="New user"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="create-user-form" type="submit" isLoading={isSubmitting}>
            Create user
          </Button>
        </>
      }
    >
      <form id="create-user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" error={errors.firstName?.message} {...register('firstName')} />
          <Input label="Last name" error={errors.lastName?.message} {...register('lastName')} />
        </div>
        <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
        <Input label="Phone (optional)" error={errors.phone?.message} {...register('phone')} />
        <Input label="Temporary password" type="password" error={errors.password?.message} {...register('password')} />
        <Select label="Role" {...register('roleName')}>
          <option value="STAFF">Staff</option>
          <option value="MANAGER">Manager</option>
          <option value="SUPER_ADMIN">Super Admin</option>
          <option value="RETAIL_USER">Retail Customer</option>
        </Select>
      </form>
    </Modal>
  );
}

function EditUserModal({ user, isSubmitting, onClose, onSubmit }: { user: User; isSubmitting: boolean; onClose: () => void; onSubmit: (v: UpdateValues) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateValues>({
    resolver: zodResolver(updateSchema),
    defaultValues: { firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? '', roleName: user.role.name, status: user.status },
  });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Edit user"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="edit-user-form" type="submit" isLoading={isSubmitting}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" error={errors.firstName?.message} {...register('firstName')} />
          <Input label="Last name" error={errors.lastName?.message} {...register('lastName')} />
        </div>
        <Input label="Phone" error={errors.phone?.message} {...register('phone')} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Role" disabled={user.role.name === 'SUPER_ADMIN'} {...register('roleName')}>
            <option value="STAFF">Staff</option>
            <option value="MANAGER">Manager</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="RETAIL_USER">Retail Customer</option>
          </Select>
          <Select label="Status" {...register('status')}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </Select>
        </div>
      </form>
    </Modal>
  );
}
