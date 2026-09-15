import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { formResolver } from '@/lib/zodForm';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { ClipboardList, SlidersHorizontal, ArrowLeftRight, MinusCircle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Can } from '@/components/common/Can';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import * as stockService from '@/services/stock.service';
import { productService, warehouseService } from '@/services/catalog.service';
import { getErrorMessage } from '@/lib/apiClient';
import type { Inventory } from '@/types';

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [warehouseId, setWarehouseId] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [modal, setModal] = useState<'adjust' | 'consume' | 'transfer' | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inventory', page, warehouseId, lowStockOnly],
    queryFn: () => stockService.listInventory({ page, limit: 15, warehouseId: warehouseId || undefined, lowStock: lowStockOnly || undefined }),
  });

  const { data: warehouses } = useQuery({ queryKey: ['warehouses', 'all'], queryFn: () => warehouseService.list({ limit: 100 }) });
  const { data: products } = useQuery({ queryKey: ['products', 'all'], queryFn: () => productService.list({ limit: 200 }) });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    setModal(null);
  };

  const columns: Column<Inventory>[] = [
    { header: 'Product', accessor: (i) => <span className="font-medium text-slate-900">{i.product.name}</span> },
    { header: 'Warehouse', accessor: (i) => i.warehouse.name },
    {
      header: 'Quantity',
      accessor: (i) => {
        const isLow = Number(i.quantity) <= Number(i.product.minimumStock);
        return (
          <Badge tone={isLow ? 'red' : 'green'}>
            {Number(i.quantity).toLocaleString()} {i.product.unit.abbreviation}
          </Badge>
        );
      },
    },
    { header: 'Min. stock', accessor: (i) => `${Number(i.product.minimumStock)} ${i.product.unit.abbreviation}` },
    { header: 'Avg. cost', accessor: (i) => Number(i.averageCost).toLocaleString() },
    { header: 'Value', accessor: (i) => (Number(i.quantity) * Number(i.averageCost)).toLocaleString() },
    {
      header: 'Expiry',
      accessor: (i) => (i.expiryDate ? new Date(i.expiryDate).toLocaleDateString() : <span className="text-slate-400">—</span>),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Live stock levels across all warehouses."
        action={
          <div className="flex gap-2">
            <Can permission="stock.consume">
              <Button variant="outline" onClick={() => setModal('consume')}>
                <MinusCircle className="h-4 w-4" /> Consume
              </Button>
            </Can>
            <Can permission="stock.transfer">
              <Button variant="outline" onClick={() => setModal('transfer')}>
                <ArrowLeftRight className="h-4 w-4" /> Transfer
              </Button>
            </Can>
            <Can permission="stock.adjust">
              <Button onClick={() => setModal('adjust')}>
                <SlidersHorizontal className="h-4 w-4" /> Adjust Stock
              </Button>
            </Can>
          </div>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <Select className="max-w-[220px]" value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setPage(1); }}>
            <option value="">All warehouses</option>
            {warehouses?.data.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={lowStockOnly}
              onChange={(e) => {
                setLowStockOnly(e.target.checked);
                setPage(1);
              }}
            />
            Low stock only
          </label>
        </div>

        {isLoading ? (
          <TableSkeleton cols={6} />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        ) : !data || data.data.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No inventory records" description="Receive a purchase or adjust stock to get started." />
        ) : (
          <>
            <DataTable columns={columns} data={data.data} rowKey={(i) => i.id} />
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>

      {modal === 'adjust' && (
        <AdjustModal products={products?.data ?? []} warehouses={warehouses?.data ?? []} onClose={() => setModal(null)} onSuccess={invalidate} />
      )}
      {modal === 'consume' && (
        <ConsumeModal products={products?.data ?? []} warehouses={warehouses?.data ?? []} onClose={() => setModal(null)} onSuccess={invalidate} />
      )}
      {modal === 'transfer' && (
        <TransferModal products={products?.data ?? []} warehouses={warehouses?.data ?? []} onClose={() => setModal(null)} onSuccess={invalidate} />
      )}
    </div>
  );
}

interface ProductOpt {
  id: string;
  name: string;
  unit: { abbreviation: string };
}
interface WarehouseOpt {
  id: string;
  name: string;
}

const adjustSchema = z.object({
  productId: z.string().uuid('Select a product'),
  warehouseId: z.string().uuid('Select a warehouse'),
  type: z.enum(['INCREASE', 'DECREASE']),
  quantity: z.coerce.number().positive('Must be greater than 0'),
  reason: z.string().min(1, 'Reason is required'),
  notes: z.string().optional(),
});

function AdjustModal({ products, warehouses, onClose, onSuccess }: { products: ProductOpt[]; warehouses: WarehouseOpt[]; onClose: () => void; onSuccess: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof adjustSchema>>({ resolver: formResolver(adjustSchema), defaultValues: { type: 'INCREASE' } });

  const mutation = useMutation({
    mutationFn: stockService.adjustStock,
    onSuccess: () => {
      toast.success('Stock adjusted successfully');
      onSuccess();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Adjust stock"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="adjust-form" type="submit" isLoading={mutation.isPending}>
            Apply adjustment
          </Button>
        </>
      }
    >
      <form id="adjust-form" onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <Select label="Product" error={errors.productId?.message} {...register('productId')}>
          <option value="">Select product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
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
        <div className="grid grid-cols-2 gap-3">
          <Select label="Direction" {...register('type')}>
            <option value="INCREASE">Increase</option>
            <option value="DECREASE">Decrease</option>
          </Select>
          <Input label="Quantity" type="number" step="0.01" error={errors.quantity?.message} {...register('quantity')} />
        </div>
        <Input label="Reason" placeholder="Stock count correction" error={errors.reason?.message} {...register('reason')} />
        <Input label="Notes (optional)" error={errors.notes?.message} {...register('notes')} />
      </form>
    </Modal>
  );
}

const consumeSchema = z.object({
  productId: z.string().uuid('Select a product'),
  warehouseId: z.string().uuid('Select a warehouse'),
  quantity: z.coerce.number().positive('Must be greater than 0'),
  reason: z.string().optional(),
});

function ConsumeModal({ products, warehouses, onClose, onSuccess }: { products: ProductOpt[]; warehouses: WarehouseOpt[]; onClose: () => void; onSuccess: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof consumeSchema>>({ resolver: formResolver(consumeSchema) });

  const mutation = useMutation({
    mutationFn: stockService.consumeStock,
    onSuccess: () => {
      toast.success('Consumption recorded successfully');
      onSuccess();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Record restaurant consumption"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="consume-form" type="submit" isLoading={mutation.isPending}>
            Record consumption
          </Button>
        </>
      }
    >
      <form id="consume-form" onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <Select label="Product" error={errors.productId?.message} {...register('productId')}>
          <option value="">Select product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
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
        <Input label="Quantity used" type="number" step="0.01" error={errors.quantity?.message} {...register('quantity')} />
        <Input label="Reason (optional)" placeholder="Kitchen prep" error={errors.reason?.message} {...register('reason')} />
      </form>
    </Modal>
  );
}

const transferSchema = z
  .object({
    productId: z.string().uuid('Select a product'),
    fromWarehouseId: z.string().uuid('Select a source'),
    toWarehouseId: z.string().uuid('Select a destination'),
    quantity: z.coerce.number().positive('Must be greater than 0'),
    notes: z.string().optional(),
  })
  .refine((d) => d.fromWarehouseId !== d.toWarehouseId, { message: 'Source and destination must differ', path: ['toWarehouseId'] });

function TransferModal({ products, warehouses, onClose, onSuccess }: { products: ProductOpt[]; warehouses: WarehouseOpt[]; onClose: () => void; onSuccess: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof transferSchema>>({ resolver: formResolver(transferSchema) });

  const mutation = useMutation({
    mutationFn: stockService.transferStock,
    onSuccess: () => {
      toast.success('Stock transferred successfully');
      onSuccess();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Transfer stock"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="transfer-form" type="submit" isLoading={mutation.isPending}>
            Transfer
          </Button>
        </>
      }
    >
      <form id="transfer-form" onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <Select label="Product" error={errors.productId?.message} {...register('productId')}>
          <option value="">Select product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Select label="From warehouse" error={errors.fromWarehouseId?.message} {...register('fromWarehouseId')}>
            <option value="">Select warehouse</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
          <Select label="To warehouse" error={errors.toWarehouseId?.message} {...register('toWarehouseId')}>
            <option value="">Select warehouse</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>
        <Input label="Quantity" type="number" step="0.01" error={errors.quantity?.message} {...register('quantity')} />
        <Input label="Notes (optional)" error={errors.notes?.message} {...register('notes')} />
      </form>
    </Modal>
  );
}
