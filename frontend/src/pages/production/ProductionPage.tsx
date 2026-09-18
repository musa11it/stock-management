import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { formResolver } from '@/lib/zodForm';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Factory, Check, Ban, ChefHat, Tag } from 'lucide-react';
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
import { productionCrud, listProductions, completeProduction, cancelProduction } from '@/services/production.service';
import { productService, warehouseService } from '@/services/catalog.service';
import { recipeService, listProductForSale } from '@/services/recipe.service';
import { getErrorMessage } from '@/lib/apiClient';
import { useProductAssignments, filterProductsForWarehouse } from '@/hooks/useProductAssignments';
import type { Production, ProductionStatus } from '@/types';

const statusTone: Record<ProductionStatus, 'slate' | 'amber' | 'green' | 'red'> = {
  DRAFT: 'amber',
  COMPLETED: 'green',
  CANCELLED: 'red',
};

const materialSchema = z.object({
  productId: z.string().uuid('Select a product'),
  quantity: z.coerce.number().positive('Must be > 0'),
  // Defaults to "Raw materials from" for new rows, but each row can be pointed at a different
  // warehouse - a single run can pull materials from more than one place.
  warehouseId: z.string().uuid('Select a warehouse'),
});
const schema = z.object({
  finishedProductId: z.string().uuid('Select the product being produced'),
  plannedQuantity: z.coerce.number().positive('Must be greater than 0'),
  sourceWarehouseId: z.string().uuid('Select where raw materials come from'),
  // Optional: defaults to Finished Goods Store server-side (see production.service.ts
  // createProduction) if left blank, so the user is never required to pick this.
  destinationWarehouseId: z.string().uuid('Select where the finished product goes').optional().or(z.literal('')),
  notes: z.string().optional(),
  materials: z.array(materialSchema).min(1, 'Add at least one raw material'),
});
type FormValues = z.infer<typeof schema>;

export default function ProductionPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<Production | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Production | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['production', page, status],
    queryFn: () => listProductions({ page, limit: 15, status: status || undefined }),
  });

  // Split by classification (Product.type) so this page never lets a raw material be picked as
  // the thing being produced, or a finished/direct-sale product be picked as an ingredient.
  const { data: finishedProducts } = useQuery({
    queryKey: ['products', 'all', 'FINISHED_PRODUCT'],
    queryFn: () => productService.list({ limit: 200, type: 'FINISHED_PRODUCT' }),
  });
  const { data: rawMaterials } = useQuery({
    queryKey: ['products', 'all', 'RAW_MATERIAL'],
    queryFn: () => productService.list({ limit: 200, type: 'RAW_MATERIAL' }),
  });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses', 'all'], queryFn: () => warehouseService.list({ limit: 100 }) });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['production'] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => productionCrud.create({ ...values, destinationWarehouseId: values.destinationWarehouseId || undefined }),
    onSuccess: () => {
      toast.success('Production run created');
      invalidateAll();
      setIsCreateOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, actualQuantity }: { id: string; actualQuantity?: number }) => completeProduction(id, actualQuantity),
    onSuccess: () => {
      toast.success('Production completed and stock updated');
      invalidateAll();
      setCompleteTarget(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelProduction(id),
    onSuccess: () => {
      toast.success('Production run cancelled');
      invalidateAll();
      setCancelTarget(null);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
      setCancelTarget(null);
    },
  });

  const listForSaleMutation = useMutation({
    mutationFn: (productId: string) => listProductForSale(productId),
    onSuccess: () => {
      toast.success('Listed for sale - it now appears on the Menu, ready to sell');
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['menu'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const columns: Column<Production>[] = [
    { header: 'Production #', accessor: (p) => <span className="font-medium text-slate-900">{p.productionNumber}</span> },
    { header: 'Finished product', accessor: (p) => p.finishedProduct.name },
    {
      header: 'Planned',
      accessor: (p) => `${Number(p.plannedQuantity).toLocaleString()} ${p.finishedProduct.unit.abbreviation}`,
    },
    {
      header: 'Actual',
      accessor: (p) =>
        p.actualQuantity != null ? (
          `${Number(p.actualQuantity).toLocaleString()} ${p.finishedProduct.unit.abbreviation}`
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    { header: 'From → To', accessor: (p) => `${p.sourceWarehouse.name} → ${p.destinationWarehouse.name}` },
    { header: 'Created by', accessor: (p) => `${p.createdBy.firstName} ${p.createdBy.lastName}` },
    { header: 'Date', accessor: (p) => new Date(p.createdAt).toLocaleDateString() },
    { header: 'Status', accessor: (p) => <Badge tone={statusTone[p.status]}>{p.status}</Badge> },
    {
      header: '',
      accessor: (p) => {
        if (p.status === 'DRAFT') {
          return (
            <Can permission="production.complete">
              <div className="flex justify-end gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCompleteTarget(p);
                  }}
                  className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"
                  title="Complete production"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCancelTarget(p);
                  }}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                  title="Cancel"
                >
                  <Ban className="h-4 w-4" />
                </button>
              </div>
            </Can>
          );
        }
        if (p.status === 'COMPLETED') {
          return p.finishedProduct.directSaleMenuItem ? (
            <Link to="/menu" className="flex items-center justify-end gap-1 text-xs font-medium text-emerald-600 hover:underline">
              <Tag className="h-3.5 w-3.5" /> Listed for sale
            </Link>
          ) : (
            <Can permission="menu.create">
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  isLoading={listForSaleMutation.isPending && listForSaleMutation.variables === p.finishedProductId}
                  onClick={(e) => {
                    e.stopPropagation();
                    listForSaleMutation.mutate(p.finishedProductId);
                  }}
                >
                  <Tag className="h-3.5 w-3.5" /> List for Sale
                </Button>
              </div>
            </Can>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Production"
        description="Turn raw materials into finished products - plan a run, then confirm it once you know what actually came out."
        action={
          <Can permission="production.create">
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New Production
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
            <option value="DRAFT">Draft</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>

        {isLoading ? (
          <TableSkeleton cols={9} />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        ) : !data || data.data.length === 0 ? (
          <EmptyState icon={Factory} title="No production runs yet" description="Plan a production run to turn raw materials into a finished product." />
        ) : (
          <>
            <DataTable columns={columns} data={data.data} rowKey={(p) => p.id} />
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>

      {isCreateOpen && (
        <CreateProductionModal
          finishedProducts={finishedProducts?.data ?? []}
          rawMaterials={rawMaterials?.data ?? []}
          warehouses={warehouses?.data ?? []}
          isSubmitting={createMutation.isPending}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={(values) => createMutation.mutate(values)}
        />
      )}

      {completeTarget && (
        <CompleteProductionModal
          production={completeTarget}
          isSubmitting={completeMutation.isPending}
          onClose={() => setCompleteTarget(null)}
          onSubmit={(actualQuantity) => completeMutation.mutate({ id: completeTarget.id, actualQuantity })}
        />
      )}

      <ConfirmDialog
        isOpen={!!cancelTarget}
        title="Cancel production run"
        message={`Cancel "${cancelTarget?.productionNumber}"? No stock has been touched yet, so nothing needs to be reversed.`}
        confirmLabel="Cancel run"
        isLoading={cancelMutation.isPending}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
      />
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

function CreateProductionModal({
  finishedProducts,
  rawMaterials,
  warehouses,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  finishedProducts: ProductOpt[];
  rawMaterials: ProductOpt[];
  warehouses: WarehouseOpt[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: FormValues) => void;
}) {
  // Finished output defaults to Finished Goods Store (created on first use if it doesn't exist
  // yet - see backend warehouse.service.ts getFinishedGoodsWarehouseId) so the user is never
  // required to pick a destination every time; still just a normal, editable Select below for
  // the rare business that wants somewhere else.
  const finishedGoodsWarehouse = warehouses.find((w) => w.name === 'Finished Goods Store');

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: formResolver(schema),
    defaultValues: {
      plannedQuantity: 1,
      materials: [{ productId: '', quantity: 1, warehouseId: '' }],
      destinationWarehouseId: finishedGoodsWarehouse?.id ?? '',
    },
  });
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'materials' });

  const assignments = useProductAssignments();
  const finishedProductId = watch('finishedProductId');
  const sourceWarehouseId = watch('sourceWarehouseId');
  const plannedQuantity = watch('plannedQuantity');
  const materials = watch('materials');

  // If the finished product already has a recipe (Recipe.finishedProductId), offer to load it
  // instead of the user rebuilding the same raw-material list by hand every time.
  const { data: matchingRecipes } = useQuery({
    queryKey: ['recipes', 'for-product', finishedProductId],
    queryFn: () => recipeService.list({ finishedProductId, limit: 1 }),
    enabled: !!finishedProductId,
  });
  const recipe = matchingRecipes?.data?.[0];

  const loadRecipe = () => {
    if (!recipe) return;
    const qty = Number(plannedQuantity) > 0 ? Number(plannedQuantity) : 1;
    replace(
      recipe.ingredients.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) * qty, warehouseId: sourceWarehouseId || '' })),
    );
    toast.success(`Loaded "${recipe.name}" (scaled to ${qty})`);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="New production run"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="production-form" type="submit" isLoading={isSubmitting}>
            Create (planned)
          </Button>
        </>
      }
    >
      <form id="production-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Finished product"
            hint="Only products classified as Finished Product (set on the product form) appear here."
            error={errors.finishedProductId?.message}
            {...register('finishedProductId')}
          >
            <option value="">Select product</option>
            {finishedProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.unit.abbreviation})
              </option>
            ))}
          </Select>
          <Input
            label={`Planned quantity${finishedProductId ? ` (${finishedProducts.find((p) => p.id === finishedProductId)?.unit.abbreviation ?? ''})` : ''}`}
            type="number"
            step="0.01"
            error={errors.plannedQuantity?.message}
            {...register('plannedQuantity')}
          />
        </div>
        {finishedProducts.length === 0 && (
          <p className="text-xs text-amber-600">
            No products are classified as Finished Product yet. Set a product's type from the{' '}
            <Link to="/products" className="font-medium underline">
              Products page
            </Link>{' '}
            first.
          </p>
        )}
        {finishedProductId &&
          (recipe ? (
            <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <div className="flex items-center gap-2 text-emerald-800">
                <ChefHat className="h-4 w-4" />
                <span>
                  Recipe found: <span className="font-medium">{recipe.name}</span> ({recipe.ingredients.length} ingredient
                  {recipe.ingredients.length === 1 ? '' : 's'})
                </span>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={loadRecipe}>
                Load recipe
              </Button>
            </div>
          ) : (
            matchingRecipes && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                No recipe configured for this product. Add raw materials manually below, or{' '}
                <Link to="/recipes" className="font-medium underline">
                  set up a recipe
                </Link>{' '}
                to reuse it next time.
              </div>
            )
          ))}

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Raw materials from"
            hint="Default warehouse for new material rows below - each row can still be pointed at a different one."
            error={errors.sourceWarehouseId?.message}
            {...register('sourceWarehouseId')}
            onChange={(e) => {
              setValue('sourceWarehouseId', e.target.value, { shouldValidate: true });
              // Only fill in rows that haven't been pointed at a warehouse of their own yet -
              // never override an explicit per-row choice.
              materials?.forEach((m, i) => {
                if (!m.warehouseId) setValue(`materials.${i}.warehouseId`, e.target.value);
              });
            }}
          >
            <option value="">Select warehouse</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
          <Select
            label="Finished product goes to"
            hint="Defaults to Finished Goods Store - change only if this run should be stored somewhere else."
            error={errors.destinationWarehouseId?.message}
            {...register('destinationWarehouseId')}
          >
            <option value="">Select warehouse</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Raw materials</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => append({ productId: '', quantity: 1, warehouseId: sourceWarehouseId || '' })}
            >
              <Plus className="h-3.5 w-3.5" /> Add material
            </Button>
          </div>
          {errors.materials?.message && <p className="mb-2 text-xs text-red-600">{errors.materials.message}</p>}
          {rawMaterials.length === 0 && (
            <p className="mb-2 text-xs text-amber-600">
              No products are classified as Raw Material yet. Set a product's type from the{' '}
              <Link to="/products" className="font-medium underline">
                Products page
              </Link>{' '}
              first.
            </p>
          )}
          <div className="space-y-1.5">
            {fields.map((field, index) => {
              const rowWarehouseId = materials?.[index]?.warehouseId || '';
              const rowMaterialOptions = filterProductsForWarehouse(rawMaterials, rowWarehouseId, assignments, false);
              return (
                <div key={field.id}>
                  <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-2">
                    <Select
                      className="min-w-[160px] flex-[2]"
                      label={index === 0 ? 'From' : undefined}
                      {...register(`materials.${index}.warehouseId` as const)}
                    >
                      <option value="">Select warehouse</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </Select>
                    <Select
                      className="min-w-[160px] flex-[2]"
                      label={index === 0 ? 'Product' : undefined}
                      disabled={!rowWarehouseId}
                      {...register(`materials.${index}.productId` as const)}
                    >
                      <option value="">{rowWarehouseId ? 'Select product' : 'Select a warehouse first'}</option>
                      {rowMaterialOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit.abbreviation})
                        </option>
                      ))}
                    </Select>
                    <Input
                      className="min-w-[90px] flex-1"
                      label={index === 0 ? 'Quantity' : undefined}
                      type="number"
                      step="0.01"
                      {...register(`materials.${index}.quantity` as const)}
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} disabled={fields.length === 1}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  {rowWarehouseId && rowMaterialOptions.length === 0 && (
                    <p className="mt-1 pl-1 text-xs text-amber-600">No Raw Material products are stocked in this warehouse yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Textarea label="Notes (optional)" rows={2} error={errors.notes?.message} {...register('notes')} />
        {materials?.length > 0 && (
          <p className="text-xs text-slate-400">
            Nothing is deducted or added to stock yet - complete this run once you know what actually came out.
          </p>
        )}
      </form>
    </Modal>
  );
}

function CompleteProductionModal({
  production,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  production: Production;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (actualQuantity: number) => void;
}) {
  const [actualQuantity, setActualQuantity] = useState(String(Number(production.plannedQuantity)));
  const unit = production.finishedProduct.unit.abbreviation;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Complete production"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            isLoading={isSubmitting}
            onClick={() => {
              const qty = Number(actualQuantity);
              if (!qty || qty <= 0) {
                toast.error('Enter a valid actual quantity');
                return;
              }
              onSubmit(qty);
            }}
          >
            Confirm &amp; update stock
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Confirming <span className="font-medium text-slate-900">{production.productionNumber}</span> will deduct its raw materials from{' '}
          <span className="font-medium">{production.sourceWarehouse.name}</span> and add the finished product to{' '}
          <span className="font-medium">{production.destinationWarehouse.name}</span>.
        </p>
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Planned quantity</span>
            <span>
              {Number(production.plannedQuantity).toLocaleString()} {unit}
            </span>
          </div>
        </div>
        <Input
          label="Actual quantity produced"
          type="number"
          step="0.01"
          hint="If less came out than planned, only this amount is added to stock - the shortfall is simply never inventoried."
          value={actualQuantity}
          onChange={(e) => setActualQuantity(e.target.value)}
        />
      </div>
    </Modal>
  );
}
