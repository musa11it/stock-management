import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Warehouse as WarehouseIcon } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Can } from '@/components/common/Can';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { warehouseService } from '@/services/catalog.service';
import { getErrorMessage } from '@/lib/apiClient';
import type { Warehouse } from '@/types';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function WarehousesPage() {
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; warehouse?: Warehouse } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Warehouse | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseService.list({ limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => warehouseService.create(values),
    onSuccess: () => {
      toast.success('Warehouse created successfully');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setModalState(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: FormValues }) => warehouseService.update(id, values),
    onSuccess: () => {
      toast.success('Warehouse updated successfully');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setModalState(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => warehouseService.remove(id),
    onSuccess: () => {
      toast.success('Warehouse deactivated successfully');
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
      setDeleteTarget(null);
    },
  });

  const columns: Column<Warehouse>[] = [
    { header: 'Name', accessor: (w) => <span className="font-medium text-slate-900">{w.name}</span> },
    { header: 'Location', accessor: (w) => w.location || <span className="text-slate-400">—</span> },
    { header: 'Status', accessor: (w) => <Badge tone={w.isActive ? 'green' : 'slate'}>{w.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      header: '',
      headerClassName: 'w-24',
      accessor: (w) => (
        <div className="flex justify-end gap-1">
          <Can permission="warehouses.update">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setModalState({ mode: 'edit', warehouse: w });
              }}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </Can>
          <Can permission="warehouses.delete">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(w);
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
        title="Warehouses"
        description="Storage locations that hold inventory, such as your main kitchen store."
        action={
          <Can permission="warehouses.create">
            <Button onClick={() => setModalState({ mode: 'create' })}>
              <Plus className="h-4 w-4" /> New Warehouse
            </Button>
          </Can>
        }
      />

      <Card>
        {isLoading ? (
          <TableSkeleton cols={3} />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        ) : !data || data.data.length === 0 ? (
          <EmptyState icon={WarehouseIcon} title="No warehouses yet" description="Add a warehouse to start tracking stock." />
        ) : (
          <DataTable columns={columns} data={data.data} rowKey={(w) => w.id} />
        )}
      </Card>

      {modalState && (
        <WarehouseFormModal
          warehouse={modalState.warehouse}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
          onClose={() => setModalState(null)}
          onSubmit={(values) =>
            modalState.mode === 'edit' && modalState.warehouse
              ? updateMutation.mutate({ id: modalState.warehouse.id, values })
              : createMutation.mutate(values)
          }
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Deactivate warehouse"
        message={`Are you sure you want to deactivate "${deleteTarget?.name}"?`}
        confirmLabel="Deactivate"
        isLoading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

function WarehouseFormModal({
  warehouse,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  warehouse?: Warehouse;
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
    defaultValues: { name: warehouse?.name ?? '', location: warehouse?.location ?? '' },
  });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={warehouse ? 'Edit warehouse' : 'New warehouse'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="warehouse-form" type="submit" isLoading={isSubmitting}>
            {warehouse ? 'Save changes' : 'Create warehouse'}
          </Button>
        </>
      }
    >
      <form id="warehouse-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Name" placeholder="Main Kitchen Store" error={errors.name?.message} {...register('name')} />
        <Input label="Location" placeholder="Ground Floor" error={errors.location?.message} {...register('location')} />
      </form>
    </Modal>
  );
}
