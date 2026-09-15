import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { formResolver } from '@/lib/zodForm';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Trash2, Check, X, Trash } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Can } from '@/components/common/Can';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { wastageCrud, reviewWastage } from '@/services/wastage.service';
import { productService, warehouseService } from '@/services/catalog.service';
import { getErrorMessage } from '@/lib/apiClient';
import type { Wastage, WastageStatus } from '@/types';

const statusTone: Record<WastageStatus, 'slate' | 'amber' | 'green' | 'red'> = {
  PENDING: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
};

const itemSchema = z.object({ productId: z.string().uuid('Select a product'), quantity: z.coerce.number().positive('Must be > 0') });
const schema = z.object({
  warehouseId: z.string().uuid('Select a warehouse'),
  reason: z.enum(['EXPIRED', 'DAMAGED', 'SPOILED', 'BURNED', 'SPILLED', 'OTHER']),
  description: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Add at least one item'),
});
type FormValues = z.infer<typeof schema>;

export default function WastagePage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['wastage', page, status],
    queryFn: () => wastageCrud.list({ page, limit: 15, status: status || undefined }),
  });

  const { data: warehouses } = useQuery({ queryKey: ['warehouses', 'all'], queryFn: () => warehouseService.list({ limit: 100 }) });
  const { data: products } = useQuery({ queryKey: ['products', 'all'], queryFn: () => productService.list({ limit: 200 }) });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => wastageCrud.create(values),
    onSuccess: () => {
      toast.success('Wastage report recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['wastage'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsCreateOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => reviewWastage(id, approve),
    onSuccess: (_data, vars) => {
      toast.success(vars.approve ? 'Wastage approved and stock updated' : 'Wastage rejected');
      queryClient.invalidateQueries({ queryKey: ['wastage'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const columns: Column<Wastage>[] = [
    { header: 'Report #', accessor: (w) => <span className="font-medium text-slate-900">{w.wastageNumber}</span> },
    { header: 'Warehouse', accessor: (w) => w.warehouse.name },
    { header: 'Reason', accessor: (w) => w.reason },
    { header: 'Items', accessor: (w) => w.items.length },
    { header: 'Reported by', accessor: (w) => `${w.createdBy.firstName} ${w.createdBy.lastName}` },
    { header: 'Date', accessor: (w) => new Date(w.createdAt).toLocaleDateString() },
    { header: 'Status', accessor: (w) => <Badge tone={statusTone[w.status]}>{w.status}</Badge> },
    {
      header: '',
      accessor: (w) =>
        w.status === 'PENDING' ? (
          <Can permission="wastage.approve">
            <div className="flex justify-end gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  reviewMutation.mutate({ id: w.id, approve: true });
                }}
                className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"
                title="Approve"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  reviewMutation.mutate({ id: w.id, approve: false });
                }}
                className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                title="Reject"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </Can>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Wastage"
        description="Track spoiled, damaged, or expired inventory."
        action={
          <Can permission="wastage.create">
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Report Wastage
            </Button>
          </Can>
        }
      />

      <Card>
        <div className="border-b border-slate-100 p-4">
          <Select
            className="max-w-[200px]"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </Select>
        </div>

        {isLoading ? (
          <TableSkeleton cols={7} />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        ) : !data || data.data.length === 0 ? (
          <EmptyState icon={Trash} title="No wastage reports" description="Report wastage to keep inventory accurate." />
        ) : (
          <>
            <DataTable columns={columns} data={data.data} rowKey={(w) => w.id} />
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>

      {isCreateOpen && (
        <CreateWastageModal
          warehouses={warehouses?.data ?? []}
          products={products?.data ?? []}
          isSubmitting={createMutation.isPending}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={(values) => createMutation.mutate(values)}
        />
      )}
    </div>
  );
}

function CreateWastageModal({
  warehouses,
  products,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  warehouses: { id: string; name: string }[];
  products: { id: string; name: string }[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: FormValues) => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: formResolver(schema),
    defaultValues: { reason: 'SPOILED', items: [{ productId: '', quantity: 1 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Report wastage"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="wastage-form" type="submit" isLoading={isSubmitting}>
            Submit report
          </Button>
        </>
      }
    >
      <form id="wastage-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Warehouse" error={errors.warehouseId?.message} {...register('warehouseId')}>
            <option value="">Select warehouse</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
          <Select label="Reason" {...register('reason')}>
            {(['EXPIRED', 'DAMAGED', 'SPOILED', 'BURNED', 'SPILLED', 'OTHER'] as const).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Items</p>
            <Button type="button" size="sm" variant="outline" onClick={() => append({ productId: '', quantity: 1 })}>
              <Plus className="h-3.5 w-3.5" /> Add item
            </Button>
          </div>
          {errors.items?.message && <p className="mb-2 text-xs text-red-600">{errors.items.message}</p>}
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-2 rounded-lg border border-slate-200 p-2">
                <Select className="flex-[2]" label={index === 0 ? 'Product' : undefined} {...register(`items.${index}.productId` as const)}>
                  <option value="">Select product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <Input className="flex-1" label={index === 0 ? 'Quantity' : undefined} type="number" step="0.01" {...register(`items.${index}.quantity` as const)} />
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} disabled={fields.length === 1}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <Textarea label="Description (optional)" rows={2} {...register('description')} />
      </form>
    </Modal>
  );
}
