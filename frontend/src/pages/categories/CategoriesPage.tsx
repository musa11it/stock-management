import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Tags } from 'lucide-react';
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
import { categoryService } from '@/services/catalog.service';
import { getErrorMessage } from '@/lib/apiClient';
import type { Category } from '@/types';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; category?: Category } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryService.list({ limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => categoryService.create(values),
    onSuccess: () => {
      toast.success('Category created successfully');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setModalState(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: FormValues }) => categoryService.update(id, values),
    onSuccess: () => {
      toast.success('Category updated successfully');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setModalState(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoryService.remove(id),
    onSuccess: () => {
      toast.success('Category deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
      setDeleteTarget(null);
    },
  });

  const columns: Column<Category>[] = [
    { header: 'Name', accessor: (c) => <span className="font-medium text-slate-900">{c.name}</span> },
    { header: 'Description', accessor: (c) => c.description || <span className="text-slate-400">—</span> },
    { header: 'Products', accessor: (c) => <Badge tone="blue">{c._count?.products ?? 0}</Badge> },
    { header: 'Status', accessor: (c) => <Badge tone={c.isActive ? 'green' : 'slate'}>{c.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      header: '',
      headerClassName: 'w-24',
      accessor: (c) => (
        <div className="flex justify-end gap-1">
          <Can permission="categories.update">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setModalState({ mode: 'edit', category: c });
              }}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </Can>
          <Can permission="categories.delete">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(c);
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
        title="Categories"
        description="Group products for easier organization and reporting."
        action={
          <Can permission="categories.create">
            <Button onClick={() => setModalState({ mode: 'create' })}>
              <Plus className="h-4 w-4" /> New Category
            </Button>
          </Can>
        }
      />

      <Card>
        {isLoading ? (
          <TableSkeleton />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        ) : !data || data.data.length === 0 ? (
          <EmptyState
            icon={Tags}
            title="No categories yet"
            description="Create your first category to start organizing products."
          />
        ) : (
          <DataTable columns={columns} data={data.data} rowKey={(c) => c.id} />
        )}
      </Card>

      {modalState && (
        <CategoryFormModal
          category={modalState.category}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
          onClose={() => setModalState(null)}
          onSubmit={(values) =>
            modalState.mode === 'edit' && modalState.category
              ? updateMutation.mutate({ id: modalState.category.id, values })
              : createMutation.mutate(values)
          }
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete category"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

function CategoryFormModal({
  category,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  category?: Category;
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
    defaultValues: { name: category?.name ?? '', description: category?.description ?? '' },
  });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={category ? 'Edit category' : 'New category'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="category-form" type="submit" isLoading={isSubmitting}>
            {category ? 'Save changes' : 'Create category'}
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Name" error={errors.name?.message} {...register('name')} />
        <Textarea label="Description" rows={3} error={errors.description?.message} {...register('description')} />
      </form>
    </Modal>
  );
}
