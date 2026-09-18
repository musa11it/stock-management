import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { formResolver } from '@/lib/zodForm';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Can } from '@/components/common/Can';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { purchaseCrud } from '@/services/purchase.service';
import { productService, supplierService, warehouseService } from '@/services/catalog.service';
import { getErrorMessage } from '@/lib/apiClient';
import type { Purchase, PurchaseStatus } from '@/types';
import { useProductAssignments, filterProductsForWarehouse } from '@/hooks/useProductAssignments';

const statusTone: Record<PurchaseStatus, 'slate' | 'amber' | 'green' | 'blue' | 'red'> = {
  DRAFT: 'slate',
  PENDING: 'amber',
  RECEIVED: 'green',
  PARTIALLY_RECEIVED: 'blue',
  CANCELLED: 'red',
};

const itemSchema = z.object({
  productId: z.string().uuid('Select a product'),
  quantity: z.coerce.number().positive('Must be > 0'),
  unitCost: z.coerce.number().min(0),
});

const schema = z.object({
  supplierId: z.string().uuid('Select a supplier'),
  warehouseId: z.string().uuid('Select a warehouse'),
  invoiceNumber: z.string().optional(),
  tax: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Add at least one item'),
});
type FormValues = z.infer<typeof schema>;

export default function PurchasesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['purchases', page, status],
    queryFn: () => purchaseCrud.list({ page, limit: 15, status: status || undefined }),
  });

  const { data: suppliers } = useQuery({ queryKey: ['suppliers', 'all'], queryFn: () => supplierService.list({ limit: 100 }) });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses', 'all'], queryFn: () => warehouseService.list({ limit: 100 }) });
  const { data: products } = useQuery({ queryKey: ['products', 'all'], queryFn: () => productService.list({ limit: 200 }) });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => purchaseCrud.create(values),
    onSuccess: () => {
      toast.success('Purchase created successfully');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      setIsCreateOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const columns: Column<Purchase>[] = [
    { header: 'Purchase #', accessor: (p) => <span className="font-medium text-slate-900">{p.purchaseNumber}</span> },
    { header: 'Supplier', accessor: (p) => p.supplier.name },
    { header: 'Date', accessor: (p) => new Date(p.purchaseDate).toLocaleDateString() },
    { header: 'Items', accessor: (p) => p.items.length },
    { header: 'Total', accessor: (p) => Number(p.total).toLocaleString() },
    { header: 'Status', accessor: (p) => <Badge tone={statusTone[p.status]}>{p.status.replace('_', ' ')}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Purchases"
        description="Purchase orders from suppliers and their receiving status."
        action={
          <Can permission="purchases.create">
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New Purchase
            </Button>
          </Can>
        }
      />

      <Card>
        <div className="border-b border-slate-100 p-4">
          <Select
            className="max-w-[220px]"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {(['DRAFT', 'PENDING', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'] as const).map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </Select>
        </div>

        {isLoading ? (
          <TableSkeleton cols={6} />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        ) : !data || data.data.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="No purchases yet" description="Create a purchase order to start receiving stock." />
        ) : (
          <>
            <DataTable columns={columns} data={data.data} rowKey={(p) => p.id} onRowClick={(p) => navigate(`/purchases/${p.id}`)} />
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>

      {isCreateOpen && (
        <CreatePurchaseModal
          suppliers={suppliers?.data ?? []}
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

function CreatePurchaseModal({
  suppliers,
  warehouses,
  products,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  suppliers: { id: string; name: string }[];
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
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: formResolver(schema),
    defaultValues: { items: [{ productId: '', quantity: 1, unitCost: 0 }], tax: 0, discount: 0 },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');
  const subtotal = items?.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0) ?? 0;
  const tax = Number(watch('tax')) || 0;
  const discount = Number(watch('discount')) || 0;

  const assignments = useProductAssignments();
  const warehouseId = watch('warehouseId');
  // A purchase can establish a product's first assignment to a warehouse, so products never
  // stocked anywhere yet stay selectable alongside ones already assigned to this warehouse.
  const productOptions = filterProductsForWarehouse(products, warehouseId, assignments, true);

  useEffect(() => {
    items?.forEach((item, index) => {
      if (item.productId && warehouseId && !productOptions.some((p) => p.id === item.productId)) {
        setValue(`items.${index}.productId`, '');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId]);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="New purchase order"
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="purchase-form" type="submit" isLoading={isSubmitting}>
            Create purchase
          </Button>
        </>
      }
    >
      <form id="purchase-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Supplier" error={errors.supplierId?.message} {...register('supplierId')}>
            <option value="">Select supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select label="Warehouse" error={errors.warehouseId?.message} {...register('warehouseId')}>
            <option value="">Select warehouse</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>
        <Input label="Invoice number (optional)" error={errors.invoiceNumber?.message} {...register('invoiceNumber')} />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Items</p>
            <Button type="button" size="sm" variant="outline" onClick={() => append({ productId: '', quantity: 1, unitCost: 0 })}>
              <Plus className="h-3.5 w-3.5" /> Add item
            </Button>
          </div>
          {errors.items?.message && <p className="mb-2 text-xs text-red-600">{errors.items.message}</p>}
          {warehouseId && productOptions.length === 0 && (
            <p className="mb-2 text-xs text-amber-600">No products are assigned to this warehouse yet.</p>
          )}
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-2 rounded-lg border border-slate-200 p-2">
                <Select className="flex-[2]" label={index === 0 ? 'Product' : undefined} {...register(`items.${index}.productId` as const)}>
                  <option value="">Select product</option>
                  {productOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <Input
                  className="flex-1"
                  label={index === 0 ? 'Quantity' : undefined}
                  type="number"
                  step="0.01"
                  {...register(`items.${index}.quantity` as const)}
                />
                <Input
                  className="flex-1"
                  label={index === 0 ? 'Unit cost' : undefined}
                  type="number"
                  step="0.01"
                  {...register(`items.${index}.unitCost` as const)}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} disabled={fields.length === 1}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Tax" type="number" step="0.01" {...register('tax')} />
          <Input label="Discount" type="number" step="0.01" {...register('discount')} />
        </div>
        <Textarea label="Notes (optional)" rows={2} {...register('notes')} />

        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Tax + Discount</span>
            <span>
              +{tax.toLocaleString()} / -{discount.toLocaleString()}
            </span>
          </div>
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900">
            <span>Total</span>
            <span>{(subtotal + tax - discount).toLocaleString()}</span>
          </div>
        </div>
      </form>
    </Modal>
  );
}
