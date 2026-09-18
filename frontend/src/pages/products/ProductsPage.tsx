import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { formResolver } from '@/lib/zodForm';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Package, Search, Tag } from 'lucide-react';
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
import { listProductForSale } from '@/services/recipe.service';
import { getErrorMessage } from '@/lib/apiClient';
import type { Product } from '@/types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAuth } from '@/hooks/useAuth';

const PRODUCT_TYPES = [
  { value: 'RAW_MATERIAL', label: 'Raw Material' },
  { value: 'FINISHED_PRODUCT', label: 'Finished Product' },
  { value: 'DIRECT_SALE', label: 'Direct Sale' },
  { value: 'PACKAGING', label: 'Packaging' },
] as const;

const PRODUCT_TYPE_LABEL: Record<string, string> = Object.fromEntries(PRODUCT_TYPES.map((t) => [t.value, t.label]));
const PRODUCT_TYPE_TONE: Record<string, 'slate' | 'green' | 'blue' | 'purple'> = {
  RAW_MATERIAL: 'blue',
  FINISHED_PRODUCT: 'green',
  DIRECT_SALE: 'purple',
  PACKAGING: 'slate',
};

const schema = z
  .object({
    name: z.string().min(1, 'Name is required').max(200),
    description: z.string().max(2000).optional(),
    categoryId: z.string().uuid('Select a category'),
    unitId: z.string().uuid('Select a unit'),
    // Optional: products created before this classification existed stay valid unclassified -
    // but once set, it's what Production's Finished Product / Raw Material dropdowns filter on.
    // Kept as a plain string (not z.enum) so the select's blank "Not classified" option ("")
    // passes validation - translated to undefined at the mutation boundary before it's sent.
    type: z.string().optional(),
    // Optional: none of these have to be decided at creation time - minimumStock/costPrice
    // default to 0 (same as the backend) if left blank, exactly like maximumStock/sellingPrice
    // already do.
    minimumStock: z.coerce.number().min(0, 'Cannot be negative').optional(),
    maximumStock: z.coerce.number().min(0, 'Cannot be negative').optional(),
    costPrice: z.coerce.number().min(0, 'Cannot be negative').optional(),
    sellingPrice: z.coerce.number().min(0, 'Cannot be negative').optional(),
    // Optional and freely toggleable at any time, including when editing an already-perishable
    // product back to not-perishable - never locked or required to be set either way.
    isPerishable: z.boolean(),
    // Required (and positive) only when isPerishable is checked - enforced below via .refine().
    shelfLifeDays: z.coerce.number().int().positive('Shelf life must be a positive number of days').max(3650).optional(),
  })
  .refine((v) => v.maximumStock === undefined || v.maximumStock >= (v.minimumStock ?? 0), {
    message: 'Must be greater than or equal to minimum stock',
    path: ['maximumStock'],
  })
  .refine((v) => !v.isPerishable || v.shelfLifeDays !== undefined, {
    message: 'Shelf life (days) is required for perishable products',
    path: ['shelfLifeDays'],
  });
type FormValues = z.infer<typeof schema>;

function totalQty(p: Product): number {
  return (p.inventories ?? []).reduce((sum, inv) => sum + Number(inv.quantity), 0);
}

export default function ProductsPage() {
  const queryClient = useQueryClient();
  // Cost is financial/profit information - staff (who need this page read-only to see what's
  // stocked) shouldn't see it, only roles with reporting access.
  const { hasPermission } = useAuth();
  const canSeeCost = hasPermission('reports.read');
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
    mutationFn: (values: FormValues) =>
      productService.create({
        ...values,
        type: values.type || undefined,
        minimumStock: values.minimumStock ?? 0,
        costPrice: values.costPrice ?? 0,
        shelfLifeDays: values.isPerishable ? values.shelfLifeDays : undefined,
      }),
    onSuccess: () => {
      toast.success('Product created successfully');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setModalState(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: FormValues }) =>
      productService.update(id, {
        ...values,
        type: values.type || null,
        minimumStock: values.minimumStock ?? 0,
        costPrice: values.costPrice ?? 0,
        sellingPrice: values.sellingPrice ?? null,
        shelfLifeDays: values.isPerishable ? values.shelfLifeDays : null,
      }),
    onSuccess: () => {
      toast.success('Product updated successfully');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setModalState(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const listForSaleMutation = useMutation({
    mutationFn: (productId: string) => listProductForSale(productId),
    onSuccess: () => {
      toast.success('Listed for sale - it now appears on the Menu, ready to sell');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['menu'] });
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
      accessor: (p) => <p className="font-medium text-slate-900">{p.name}</p>,
    },
    {
      header: 'Type',
      accessor: (p) =>
        p.type ? (
          <Badge tone={PRODUCT_TYPE_TONE[p.type]}>{PRODUCT_TYPE_LABEL[p.type]}</Badge>
        ) : (
          <span className="text-xs text-slate-400">Not classified</span>
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
    ...(canSeeCost ? [{ header: 'Cost', accessor: (p: Product) => Number(p.costPrice).toLocaleString() }] : []),
    { header: 'Price', accessor: (p) => (p.sellingPrice ? Number(p.sellingPrice).toLocaleString() : '—') },
    {
      header: 'Sale',
      accessor: (p) => {
        if (p.directSaleMenuItem) {
          return (
            <Link to="/menu" className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline">
              <Tag className="h-3.5 w-3.5" /> Listed
            </Link>
          );
        }
        if (!p.sellingPrice) return <span className="text-xs text-slate-400">Set a price first</span>;
        return (
          <Can permission="menu.create">
            <Button
              type="button"
              size="sm"
              variant="outline"
              isLoading={listForSaleMutation.isPending && listForSaleMutation.variables === p.id}
              onClick={(e) => {
                e.stopPropagation();
                listForSaleMutation.mutate(p.id);
              }}
            >
              <Tag className="h-3.5 w-3.5" /> List for Sale
            </Button>
          </Can>
        );
      },
    },
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
              placeholder="Search by name..."
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
          <TableSkeleton cols={9} />
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

const NEW_OPTION_VALUE = '__new__';

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
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: formResolver(schema),
    defaultValues: {
      name: product?.name ?? '',
      description: product?.description ?? '',
      categoryId: product?.categoryId ?? '',
      unitId: product?.unitId ?? '',
      type: product?.type ?? '',
      minimumStock: product?.minimumStock ? Number(product.minimumStock) : undefined,
      maximumStock: product?.maximumStock ? Number(product.maximumStock) : undefined,
      costPrice: product?.costPrice ? Number(product.costPrice) : undefined,
      sellingPrice: product?.sellingPrice ? Number(product.sellingPrice) : undefined,
      isPerishable: product?.isPerishable ?? false,
      shelfLifeDays: product?.shelfLifeDays ?? undefined,
    },
  });

  const isPerishable = watch('isPerishable');

  // Inline "+ Add Category" / "+ Add Unit" - create the reference entity without leaving this
  // form, then auto-select it. Reuses the existing Category/Unit models and their existing
  // uniqueness constraints (the API rejects a duplicate name the same way the Categories/Units
  // pages already do).
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingUnit, setAddingUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitAbbreviation, setNewUnitAbbreviation] = useState('');

  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => categoryService.create({ name }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['categories', 'all'] });
      setValue('categoryId', created.id, { shouldValidate: true });
      setAddingCategory(false);
      setNewCategoryName('');
      toast.success(`Category "${created.name}" created`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const createUnitMutation = useMutation({
    mutationFn: (input: { name: string; abbreviation: string }) => unitService.create(input),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['units', 'all'] });
      setValue('unitId', created.id, { shouldValidate: true });
      setAddingUnit(false);
      setNewUnitName('');
      setNewUnitAbbreviation('');
      toast.success(`Unit "${created.name}" created`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

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
        <Input label="Name" error={errors.name?.message} {...register('name')} />
        <Select
          label="Product type"
          hint="Determines where this product shows up - e.g. only Finished Product items can be produced, only Raw Material items can be used as ingredients."
          error={errors.type?.message}
          {...register('type')}
        >
          <option value="">Not classified</option>
          {PRODUCT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Select
              label="Category"
              error={errors.categoryId?.message}
              {...register('categoryId')}
              onChange={(e) => {
                if (e.target.value === NEW_OPTION_VALUE) {
                  setAddingCategory(true);
                  return;
                }
                register('categoryId').onChange(e);
              }}
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={NEW_OPTION_VALUE}>+ Add Category</option>
            </Select>
            {addingCategory && (
              <div className="mt-2 flex items-end gap-2 rounded-lg border border-slate-200 p-2">
                <Input
                  className="flex-1"
                  label="New category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  isLoading={createCategoryMutation.isPending}
                  disabled={!newCategoryName.trim()}
                  onClick={() => createCategoryMutation.mutate(newCategoryName.trim())}
                >
                  Add
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAddingCategory(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
          <div>
            <Select
              label="Unit"
              error={errors.unitId?.message}
              {...register('unitId')}
              onChange={(e) => {
                if (e.target.value === NEW_OPTION_VALUE) {
                  setAddingUnit(true);
                  return;
                }
                register('unitId').onChange(e);
              }}
            >
              <option value="">Select unit</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.abbreviation})
                </option>
              ))}
              <option value={NEW_OPTION_VALUE}>+ Add Unit</option>
            </Select>
            {addingUnit && (
              <div className="mt-2 flex items-end gap-2 rounded-lg border border-slate-200 p-2">
                <Input className="flex-1" label="Name" placeholder="Kilogram" value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)} />
                <Input
                  className="w-20"
                  label="Abbr."
                  placeholder="KG"
                  value={newUnitAbbreviation}
                  onChange={(e) => setNewUnitAbbreviation(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  isLoading={createUnitMutation.isPending}
                  disabled={!newUnitName.trim() || !newUnitAbbreviation.trim()}
                  onClick={() => createUnitMutation.mutate({ name: newUnitName.trim(), abbreviation: newUnitAbbreviation.trim() })}
                >
                  Add
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAddingUnit(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
        <Textarea label="Description" rows={2} error={errors.description?.message} {...register('description')} />
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Minimum stock (optional)"
            type="number"
            step="0.01"
            placeholder="0"
            hint="Defaults to 0 if left blank."
            error={errors.minimumStock?.message}
            {...register('minimumStock')}
          />
          <Input
            label="Maximum stock (optional)"
            type="number"
            step="0.01"
            error={errors.maximumStock?.message}
            {...register('maximumStock')}
          />
          <Input
            label="Cost price (optional)"
            type="number"
            step="0.01"
            placeholder="0"
            hint="Defaults to 0 if left blank."
            error={errors.costPrice?.message}
            {...register('costPrice')}
          />
        </div>
        <Input
          label="Selling price (optional)"
          type="number"
          step="0.01"
          hint="Only for items sold directly, e.g. bottled drinks. Leave blank otherwise."
          error={errors.sellingPrice?.message}
          {...register('sellingPrice')}
        />
        <div>
          <div className="flex items-center gap-2">
            <input id="isPerishable" type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('isPerishable')} />
            <label htmlFor="isPerishable" className="text-sm text-slate-700">
              This product is perishable
            </label>
          </div>
          <p className="mt-1 text-xs text-slate-500">Optional - leave unchecked if it doesn't expire. Can be switched either way anytime, including when editing later.</p>
        </div>
        {isPerishable && (
          <Input
            label="Shelf life (days)"
            type="number"
            min={1}
            step={1}
            hint="Expiry date is calculated automatically as Received Date + Shelf Life each time stock comes in."
            error={errors.shelfLifeDays?.message}
            {...register('shelfLifeDays')}
          />
        )}
      </form>
    </Modal>
  );
}
