import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { formResolver } from '@/lib/zodForm';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, UtensilsCrossed } from 'lucide-react';
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
import { menuItemService } from '@/services/recipe.service';
import { getErrorMessage } from '@/lib/apiClient';
import type { MenuItem } from '@/types';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  price: z.coerce.number().min(0),
  category: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function MenuPage() {
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; item?: MenuItem } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['menu'], queryFn: () => menuItemService.list({ limit: 100 }) });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => menuItemService.create(values),
    onSuccess: () => {
      toast.success('Menu item created successfully');
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      setModalState(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: FormValues }) => menuItemService.update(id, values),
    onSuccess: () => {
      toast.success('Menu item updated successfully');
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      setModalState(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => menuItemService.remove(id),
    onSuccess: () => {
      toast.success('Menu item deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
      setDeleteTarget(null);
    },
  });

  const columns: Column<MenuItem>[] = [
    { header: 'Name', accessor: (m) => <span className="font-medium text-slate-900">{m.name}</span> },
    { header: 'Category', accessor: (m) => m.category || <span className="text-slate-400">—</span> },
    { header: 'Price', accessor: (m) => Number(m.price).toLocaleString() },
    { header: 'Recipe', accessor: (m) => (m.recipe ? <Badge tone="blue">{m.recipe.name}</Badge> : <Badge tone="slate">No recipe</Badge>) },
    { header: 'Status', accessor: (m) => <Badge tone={m.isActive ? 'green' : 'slate'}>{m.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      header: '',
      headerClassName: 'w-24',
      accessor: (m) => (
        <div className="flex justify-end gap-1">
          <Can permission="menu.update">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setModalState({ mode: 'edit', item: m });
              }}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </Can>
          <Can permission="menu.delete">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(m);
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
        title="Menu"
        description="Items sold to customers, each optionally linked to a recipe."
        action={
          <Can permission="menu.create">
            <Button onClick={() => setModalState({ mode: 'create' })}>
              <Plus className="h-4 w-4" /> New Menu Item
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
          <EmptyState icon={UtensilsCrossed} title="No menu items yet" description="Add a menu item to start recording sales." />
        ) : (
          <DataTable columns={columns} data={data.data} rowKey={(m) => m.id} />
        )}
      </Card>

      {modalState && (
        <MenuItemFormModal
          item={modalState.item}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
          onClose={() => setModalState(null)}
          onSubmit={(values) =>
            modalState.mode === 'edit' && modalState.item
              ? updateMutation.mutate({ id: modalState.item.id, values })
              : createMutation.mutate(values)
          }
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete menu item"
        message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

function MenuItemFormModal({
  item,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  item?: MenuItem;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: FormValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: formResolver(schema),
    defaultValues: {
      name: item?.name ?? '',
      description: item?.description ?? '',
      price: item ? Number(item.price) : 0,
      category: item?.category ?? '',
    },
  });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={item ? 'Edit menu item' : 'New menu item'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="menu-form" type="submit" isLoading={isSubmitting}>
            {item ? 'Save changes' : 'Create item'}
          </Button>
        </>
      }
    >
      <form id="menu-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Name" error={errors.name?.message} {...register('name')} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Price" type="number" step="0.01" error={errors.price?.message} {...register('price')} />
          <Input label="Category (optional)" placeholder="Burgers" error={errors.category?.message} {...register('category')} />
        </div>
        <Textarea label="Description (optional)" rows={2} error={errors.description?.message} {...register('description')} />
        {item && !item.recipe && (
          <p className="text-xs text-slate-400">Tip: link a recipe to this item from the Recipes page to enable automatic stock deduction.</p>
        )}
      </form>
    </Modal>
  );
}
