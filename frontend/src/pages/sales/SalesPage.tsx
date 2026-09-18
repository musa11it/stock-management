import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { formResolver } from '@/lib/zodForm';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Receipt, Trash2, Ban, Check, Globe, Store, FileText } from 'lucide-react';
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
import { saleCrud, updateSaleStatus } from '@/services/sale.service';
import { menuItemService } from '@/services/recipe.service';
import { getErrorMessage } from '@/lib/apiClient';
import { ReceiptModal } from '@/components/receipt/Receipt';
import type { Sale, SaleStatus } from '@/types';

const statusTone: Record<SaleStatus, 'amber' | 'green' | 'red'> = { PENDING: 'amber', COMPLETED: 'green', CANCELLED: 'red' };

const itemSchema = z.object({ menuItemId: z.string().uuid('Select an item'), quantity: z.coerce.number().int().positive('Must be > 0') });
const schema = z.object({
  paymentMethod: z.enum(['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'OTHER']),
  customerName: z.string().optional(),
  discount: z.coerce.number().min(0).default(0),
  tax: z.coerce.number().min(0).default(0),
  items: z.array(itemSchema).min(1, 'Add at least one item'),
});
type FormValues = z.infer<typeof schema>;

export default function SalesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<Sale | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['sales', page, status],
    queryFn: () => saleCrud.list({ page, limit: 15, status: status || undefined }),
    // Customer orders arrive on their own schedule - poll so staff see new PENDING orders without refreshing.
    refetchInterval: 10000,
  });
  const { data: menuItems } = useQuery({ queryKey: ['menu', 'all'], queryFn: () => menuItemService.list({ limit: 200, isActive: true }) });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['sales'] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => saleCrud.create(values),
    onSuccess: () => {
      toast.success('Sale recorded successfully');
      invalidateAll();
      setIsCreateOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => updateSaleStatus(id, 'CANCELLED'),
    onSuccess: () => {
      toast.success('Order cancelled and stock reversed');
      invalidateAll();
      setCancelTarget(null);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
      setCancelTarget(null);
    },
  });

  const fulfillMutation = useMutation({
    mutationFn: (id: string) => updateSaleStatus(id, 'COMPLETED'),
    onSuccess: () => {
      toast.success('Order marked as fulfilled');
      invalidateAll();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const columns: Column<Sale>[] = [
    { header: 'Sale #', accessor: (s) => <span className="font-medium text-slate-900">{s.saleNumber}</span> },
    {
      header: 'Source',
      accessor: (s) =>
        s.source === 'ONLINE' ? (
          <Badge tone="purple">
            <Globe className="mr-1 inline h-3 w-3" /> Online
          </Badge>
        ) : (
          <Badge tone="slate">
            <Store className="mr-1 inline h-3 w-3" /> POS
          </Badge>
        ),
    },
    {
      header: 'Customer',
      accessor: (s) => (s.customer ? `${s.customer.firstName} ${s.customer.lastName}` : s.customerName || <span className="text-slate-400">Walk-in</span>),
    },
    { header: 'Items', accessor: (s) => s.items.reduce((sum, i) => sum + i.quantity, 0) },
    { header: 'Total', accessor: (s) => Number(s.total).toLocaleString() },
    { header: 'Date', accessor: (s) => new Date(s.createdAt).toLocaleString() },
    { header: 'Status', accessor: (s) => <Badge tone={statusTone[s.status]}>{s.status}</Badge> },
    {
      header: '',
      accessor: (s) => (
        <div className="flex justify-end gap-1">
          {s.status === 'COMPLETED' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setReceiptTarget(s);
              }}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="View receipt"
            >
              <FileText className="h-4 w-4" />
            </button>
          )}
          <Can permission="sales.update">
            <>
              {s.status === 'PENDING' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fulfillMutation.mutate(s.id);
                  }}
                  className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"
                  title="Mark fulfilled"
                >
                  <Check className="h-4 w-4" />
                </button>
              )}
              {(s.status === 'PENDING' || s.status === 'COMPLETED') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCancelTarget(s);
                  }}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                  title="Cancel"
                >
                  <Ban className="h-4 w-4" />
                </button>
              )}
            </>
          </Can>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Sales"
        description="Walk-in sales and online customer orders - fulfill or cancel as they come in."
        action={
          <Can permission="sales.create">
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New Sale
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
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>

        {isLoading ? (
          <TableSkeleton cols={8} />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        ) : !data || data.data.length === 0 ? (
          <EmptyState icon={Receipt} title="No sales recorded" description="Record a sale, or wait for a customer order to arrive." />
        ) : (
          <>
            <DataTable columns={columns} data={data.data} rowKey={(s) => s.id} />
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>

      {isCreateOpen && (
        <CreateSaleModal
          menuItems={menuItems?.data ?? []}
          isSubmitting={createMutation.isPending}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={(values) => createMutation.mutate(values)}
        />
      )}

      {receiptTarget && <ReceiptModal sale={receiptTarget} onClose={() => setReceiptTarget(null)} />}

      <ConfirmDialog
        isOpen={!!cancelTarget}
        title="Cancel sale"
        message={`Cancelling "${cancelTarget?.saleNumber}" will reverse the ingredient stock it consumed. Continue?`}
        confirmLabel="Cancel sale"
        isLoading={cancelMutation.isPending}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
      />
    </div>
  );
}

function CreateSaleModal({
  menuItems,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  menuItems: { id: string; name: string; price: string }[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: FormValues) => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: formResolver(schema),
    defaultValues: { paymentMethod: 'CASH', discount: 0, tax: 0, items: [{ menuItemId: '', quantity: 1 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');
  const subtotal = items?.reduce((sum, i) => {
    const menuItem = menuItems.find((m) => m.id === i.menuItemId);
    return sum + (menuItem ? Number(menuItem.price) * (Number(i.quantity) || 0) : 0);
  }, 0) ?? 0;
  const tax = Number(watch('tax')) || 0;
  const discount = Number(watch('discount')) || 0;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="New sale"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="sale-form" type="submit" isLoading={isSubmitting}>
            Record sale
          </Button>
        </>
      }
    >
      <form id="sale-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Payment method" {...register('paymentMethod')}>
            {(['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'OTHER'] as const).map((m) => (
              <option key={m} value={m}>
                {m.replace('_', ' ')}
              </option>
            ))}
          </Select>
          <Input label="Customer name (optional)" {...register('customerName')} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Items</p>
            <Button type="button" size="sm" variant="outline" onClick={() => append({ menuItemId: '', quantity: 1 })}>
              <Plus className="h-3.5 w-3.5" /> Add item
            </Button>
          </div>
          {errors.items?.message && <p className="mb-2 text-xs text-red-600">{errors.items.message}</p>}
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-2 rounded-lg border border-slate-200 p-2">
                <Select className="flex-[2]" label={index === 0 ? 'Menu item' : undefined} {...register(`items.${index}.menuItemId` as const)}>
                  <option value="">Select item</option>
                  {menuItems.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({Number(m.price).toLocaleString()})
                    </option>
                  ))}
                </Select>
                <Input className="flex-1" label={index === 0 ? 'Quantity' : undefined} type="number" {...register(`items.${index}.quantity` as const)} />
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

        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{subtotal.toLocaleString()}</span>
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
