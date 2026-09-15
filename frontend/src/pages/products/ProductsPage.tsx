import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { formResolver } from '@/lib/zodForm';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Package, Search } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Can } from '@/components/common/Can';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { productService, categoryService, unitService } from '@/services/catalog.service';
import { getErrorMessage } from '@/lib/apiClient';
import type { Product } from '@/types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const schema = z
  .object({
    name: z.string().min(1, 'Name is required').max(200),
    sku: z.string().max(40, 'Keep it under 40 characters').optional(),
    barcode: z.string().max(64).optional(),
    description: z.string().max(2000).optional(),
    categoryId: z.string().uuid('Select a category'),
    unitId: z.string().uuid('Select a unit'),
    minimumStock: z.coerce.number().min(0, 'Cannot be negative'),
    maximumStock: z.coerce.number().min(0, 'Cannot be negative').optional(),
    costPrice: z.coerce.number().min(0, 'Cannot be negative'),
    sellingPrice: z.coerce.number().min(0, 'Cannot be negative'),
    isPerishable: z.boolean(),
    shelfLifeDays: z.coerce.number().min(0).max(3650).optional(),
  })
  .refine((v) => v.maximumStock === undefined || v.maximumStock >= v.minimumStock, {
    message: 'Must be greater than or equal to minimum stock',
    path: ['maximumStock'],
  });
type FormValues = z.infer<typeof schema>;

function totalQty(p: Product): number {
  return (p.inventories ?? []).reduce((sum, inv) => sum + Number(inv.quantity), 0);
}

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 400);
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; product?: Product } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['products', page, debouncedSearch],
    queryFn: () => productService.list({ page, limit: 15, search: debouncedSearch || undefined }),
  });

  const { data: categories } = useQuery({ queryKey: ['categories', 'all'], queryFn: () => categoryService.list({ limit: 100 }) });
  const { data: units } = useQuery({ queryKey: ['units', 'all'], queryFn: () => unitService.list({ limit: 100 }) });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => productService.create({ ...values, sku: values.sku || undefined, barcode: values.barcode || undefined }),
    onSuccess: () => {
      toast.success('Product created successfully');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setModalState(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: FormValues }) =>
      productService.update(id, { ...values, barcode: values.barcode || null }),
    onSuccess: () => {
      toast.success('Product updated successfully');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setModalState(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productService.remove(id),
    onSuccess: () => {
      toast.success('Product deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
      setDeleteTarget(null);
    },
  });

  const columns: Column<Product>[] = [
    {
      header: 'Product',
      accessor: (p) => (
        <div>
          <p className="font-medium text-slate-900">{p.name}</p>
          <p className="text-xs text-slate-400">{p.sku}</p>
        </div>
      ),
    },
    { header: 'Category', accessor: (p) => p.category?.name },
    { header: 'Unit', accessor: (p) => p.unit?.abbreviation },
    {
      header: 'Stock',
      accessor: (p) => {
        const qty = totalQty(p);
        const isLow = qty <= Number(p.minimumStock);
        return (
          <Badge tone={isLow ? 'red' : 'green'}>
            {qty} {p.unit?.abbreviation}
          </Badge>
        );
      },
    },
    { header: 'Cost', accessor: (p) => Number(p.costPrice).toLocaleString() },
    { header: 'Price', accessor: (p) => Number(p.sellingPrice).toLocaleString() },
    { header: 'Status', accessor: (p) => <Badge tone={p.isActive ? 'green' : 'slate'}>{p.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      header: '',
      headerClassName: 'w-24',
      accessor: (p) => (
        <div className="flex justify-end gap-1">
          <Can permission="products.update">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setModalState({ mode: 'edit', product: p });
              }}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </Can>
          <Can permission="products.delete">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(p);
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
        title="Products"
        description="Every ingredient and item tracked in inventory."
        action={
          <Can permission="products.create">
            <Button onClick={() => setModalState({ mode: 'create' })}>
              <Plus className="h-4 w-4" /> New Product
            </Button>
          </Can>
        }
      />

      <Card>
        <div className="border-b border-slate-100 p-4">
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by name, SKU, barcode..."
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton cols={7} />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        ) : !data || data.data.length === 0 ? (
          <EmptyState icon={Package} title="No products found" description="Try a different search or add a new product." />
        ) : (
          <>
            <DataTable columns={columns} data={data.data} rowKey={(p) => p.id} />
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>

      {modalState && (
        <ProductFormModal
          product={modalState.product}
          categories={categories?.data ?? []}
          units={units?.data ?? []}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
          onClose={() => setModalState(null)}
          onSubmit={(values) =>
            modalState.mode === 'edit' && modalState.product
              ? updateMutation.mutate({ id: modalState.product.id, values })
              : createMutation.mutate(values)
          }
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

function ProductFormModal({
  product,
  categories,
  units,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  product?: Product;
  categories: { id: string; name: string }[];
  units: { id: string; name: string; abbreviation: string }[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: FormValues) => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: formResolver(schema),
    defaultValues: {
      name: product?.name ?? '',
      sku: product?.sku ?? '',
      barcode: product?.barcode ?? '',
      description: product?.description ?? '',
      categoryId: product?.categoryId ?? '',
      unitId: product?.unitId ?? '',
      minimumStock: product ? Number(product.minimumStock) : 0,
      maximumStock: product?.maximumStock ? Number(product.maximumStock) : undefined,
      costPrice: product ? Number(product.costPrice) : 0,
      sellingPrice: product ? Number(product.sellingPrice) : 0,
      isPerishable: product?.isPerishable ?? false,
      shelfLifeDays: product?.shelfLifeDays ?? undefined,
    },
  });

  const isPerishable = watch('isPerishable');

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={product ? 'Edit product' : 'New product'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="product-form" type="submit" isLoading={isSubmitting}>
            {product ? 'Save changes' : 'Create product'}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Name" error={errors.name?.message} {...register('name')} />
          <Input
            label="SKU (optional)"
            placeholder="Auto-generated if left blank"
            hint="A unique code for barcode scanning and quick lookup."
            error={errors.sku?.message}
            {...register('sku')}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Category" error={errors.categoryId?.message} {...register('categoryId')}>
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select label="Unit" error={errors.unitId?.message} {...register('unitId')}>
            <option value="">Select unit</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.abbreviation})
              </option>
            ))}
          </Select>
        </div>
        <Input label="Barcode (optional)" error={errors.barcode?.message} {...register('barcode')} />
        <Textarea label="Description" rows={2} error={errors.description?.message} {...register('description')} />
        <div className="grid grid-cols-3 gap-3">
          <Input label="Minimum stock" type="number" step="0.01" error={errors.minimumStock?.message} {...register('minimumStock')} />
          <Input label="Maximum stock" type="number" step="0.01" error={errors.maximumStock?.message} {...register('maximumStock')} />
          <Input label="Cost price" type="number" step="0.01" error={errors.costPrice?.message} {...register('costPrice')} />
        </div>
        <Input label="Selling price" type="number" step="0.01" error={errors.sellingPrice?.message} {...register('sellingPrice')} />
        <div className="flex items-center gap-2">
          <input id="isPerishable" type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('isPerishable')} />
          <label htmlFor="isPerishable" className="text-sm text-slate-700">
            This product is perishable
          </label>
        </div>
        {isPerishable && (
          <Input label="Shelf life (days)" type="number" error={errors.shelfLifeDays?.message} {...register('shelfLifeDays')} />
        )}
      </form>
    </Modal>
  );
}
