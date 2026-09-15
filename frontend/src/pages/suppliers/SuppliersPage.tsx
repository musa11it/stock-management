import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Truck } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Can } from '@/components/common/Can';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { supplierService } from '@/services/catalog.service';
import { getErrorMessage } from '@/lib/apiClient';
import type { Supplier } from '@/types';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  contactPerson: z.string().optional(),
  email: z.string().email('Enter a valid email').or(z.literal('')).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; supplier?: Supplier } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => supplierService.list({ limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => supplierService.create(values),
    onSuccess: () => {
      toast.success('Supplier created successfully');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setModalState(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: FormValues }) => supplierService.update(id, values),
    onSuccess: () => {
      toast.success('Supplier updated successfully');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setModalState(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => supplierService.remove(id),
    onSuccess: () => {
      toast.success('Supplier removed successfully');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
      setDeleteTarget(null);
    },
  });

  const columns: Column<Supplier>[] = [
    { header: 'Name', accessor: (s) => <span className="font-medium text-slate-900">{s.name}</span> },
    { header: 'Contact', accessor: (s) => s.contactPerson || <span className="text-slate-400">—</span> },
    { header: 'Email', accessor: (s) => s.email || <span className="text-slate-400">—</span> },
    { header: 'Phone', accessor: (s) => s.phone || <span className="text-slate-400">—</span> },
    { header: 'Status', accessor: (s) => <Badge tone={s.isActive ? 'green' : 'slate'}>{s.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      header: '',
      headerClassName: 'w-24',
      accessor: (s) => (
        <div className="flex justify-end gap-1">
          <Can permission="suppliers.update">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setModalState({ mode: 'edit', supplier: s });
              }}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </Can>
          <Can permission="suppliers.delete">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(s);
              }}
              className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </Can>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Suppliers"
        description="Vendors you purchase ingredients and products from."
        action={
          <Can permission="suppliers.create">
            <Button onClick={() => setModalState({ mode: 'create' })}>
              <Plus className="h-4 w-4" /> New Supplier
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
          <EmptyState icon={Truck} title="No suppliers yet" description="Add a supplier to start creating purchases." />
        ) : (
          <DataTable columns={columns} data={data.data} rowKey={(s) => s.id} />
        )}
      </Card>

      {modalState && (
        <SupplierFormModal
          supplier={modalState.supplier}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
          onClose={() => setModalState(null)}
          onSubmit={(values) =>
            modalState.mode === 'edit' && modalState.supplier
              ? updateMutation.mutate({ id: modalState.supplier.id, values })
              : createMutation.mutate(values)
          }
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Remove supplier"
        message={`Are you sure you want to remove "${deleteTarget?.name}"?`}
        confirmLabel="Remove"
        isLoading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

function SupplierFormModal({
  supplier,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  supplier?: Supplier;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: FormValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: supplier?.name ?? '',
      contactPerson: supplier?.contactPerson ?? '',
      email: supplier?.email ?? '',
      phone: supplier?.phone ?? '',
      address: supplier?.address ?? '',
    },
  });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={supplier ? 'Edit supplier' : 'New supplier'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="supplier-form" type="submit" isLoading={isSubmitting}>
            {supplier ? 'Save changes' : 'Create supplier'}
          </Button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Name" error={errors.name?.message} {...register('name')} />
        <Input label="Contact person" error={errors.contactPerson?.message} {...register('contactPerson')} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Phone" error={errors.phone?.message} {...register('phone')} />
        </div>
        <Textarea label="Address" rows={2} error={errors.address?.message} {...register('address')} />
      </form>
    </Modal>
  );
}
