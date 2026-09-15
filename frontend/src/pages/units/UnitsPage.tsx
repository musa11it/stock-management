import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Ruler } from 'lucide-react';
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
import { unitService } from '@/services/catalog.service';
import { getErrorMessage } from '@/lib/apiClient';
import type { Unit } from '@/types';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  abbreviation: z.string().min(1, 'Abbreviation is required').max(10),
});
type FormValues = z.infer<typeof schema>;

export default function UnitsPage() {
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; unit?: Unit } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['units'],
    queryFn: () => unitService.list({ limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => unitService.create(values),
    onSuccess: () => {
      toast.success('Unit created successfully');
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setModalState(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: FormValues }) => unitService.update(id, values),
    onSuccess: () => {
      toast.success('Unit updated successfully');
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setModalState(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => unitService.remove(id),
    onSuccess: () => {
      toast.success('Unit deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
      setDeleteTarget(null);
    },
  });

  const columns: Column<Unit>[] = [
    { header: 'Name', accessor: (u) => <span className="font-medium text-slate-900">{u.name}</span> },
    { header: 'Abbreviation', accessor: (u) => u.abbreviation },
    {
      header: '',
      headerClassName: 'w-24',
      accessor: (u) => (
        <div className="flex justify-end gap-1">
          <Can permission="units.update">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setModalState({ mode: 'edit', unit: u });
              }}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </Can>
          <Can permission="units.delete">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(u);
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
        title="Units"
        description="Units of measurement used across products and recipes."
        action={
          <Can permission="units.create">
            <Button onClick={() => setModalState({ mode: 'create' })}>
              <Plus className="h-4 w-4" /> New Unit
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
          <EmptyState icon={Ruler} title="No units yet" description="Create a unit such as Kilogram or Litre." />
        ) : (
          <DataTable columns={columns} data={data.data} rowKey={(u) => u.id} />
        )}
      </Card>

      {modalState && (
        <UnitFormModal
          unit={modalState.unit}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
          onClose={() => setModalState(null)}
          onSubmit={(values) =>
            modalState.mode === 'edit' && modalState.unit
              ? updateMutation.mutate({ id: modalState.unit.id, values })
              : createMutation.mutate(values)
          }
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete unit"
        message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

function UnitFormModal({
  unit,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  unit?: Unit;
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
    defaultValues: { name: unit?.name ?? '', abbreviation: unit?.abbreviation ?? '' },
  });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={unit ? 'Edit unit' : 'New unit'}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="unit-form" type="submit" isLoading={isSubmitting}>
            {unit ? 'Save changes' : 'Create unit'}
          </Button>
        </>
      }
    >
      <form id="unit-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Name" placeholder="Kilogram" error={errors.name?.message} {...register('name')} />
        <Input label="Abbreviation" placeholder="KG" error={errors.abbreviation?.message} {...register('abbreviation')} />
      </form>
    </Modal>
  );
}
