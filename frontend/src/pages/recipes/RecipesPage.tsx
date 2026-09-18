import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { formResolver } from '@/lib/zodForm';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, ChefHat } from 'lucide-react';
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
import { recipeService, menuItemService } from '@/services/recipe.service';
import { productService } from '@/services/catalog.service';
import { getErrorMessage } from '@/lib/apiClient';
import type { Recipe } from '@/types';

const ingredientSchema = z.object({ productId: z.string().uuid('Select a product'), quantity: z.coerce.number().positive('Must be > 0') });
const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  menuItemId: z.string().optional(),
  finishedProductId: z.string().optional(),
  ingredients: z.array(ingredientSchema).min(1, 'Add at least one ingredient'),
});
type FormValues = z.infer<typeof schema>;

export default function RecipesPage() {
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; recipe?: Recipe } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['recipes'], queryFn: () => recipeService.list({ limit: 100 }) });
  const { data: products } = useQuery({ queryKey: ['products', 'all'], queryFn: () => productService.list({ limit: 200 }) });
  const { data: menuItems } = useQuery({ queryKey: ['menu', 'all'], queryFn: () => menuItemService.list({ limit: 200 }) });
  const { data: finishedProducts } = useQuery({
    queryKey: ['products', 'all', 'FINISHED_PRODUCT'],
    queryFn: () => productService.list({ limit: 200, type: 'FINISHED_PRODUCT' }),
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      recipeService.create({ ...values, menuItemId: values.menuItemId || undefined, finishedProductId: values.finishedProductId || undefined }),
    onSuccess: () => {
      toast.success('Recipe created successfully');
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      setModalState(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: FormValues }) =>
      recipeService.update(id, { ...values, menuItemId: values.menuItemId || null, finishedProductId: values.finishedProductId || null }),
    onSuccess: () => {
      toast.success('Recipe updated successfully');
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      setModalState(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => recipeService.remove(id),
    onSuccess: () => {
      toast.success('Recipe deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
      setDeleteTarget(null);
    },
  });

  const columns: Column<Recipe>[] = [
    { header: 'Recipe', accessor: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
    {
      header: 'Linked to',
      accessor: (r) => r.finishedProduct?.name ?? <span className="text-xs text-slate-400">Unlinked</span>,
    },
    {
      header: 'Ingredients',
      accessor: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.ingredients.map((i) => (
            <span key={i.id} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
              {i.product.name} {Number(i.quantity)}
              {i.product.unit.abbreviation}
            </span>
          ))}
        </div>
      ),
    },
    {
      header: '',
      headerClassName: 'w-24',
      accessor: (r) => (
        <div className="flex justify-end gap-1">
          <Can permission="recipes.update">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setModalState({ mode: 'edit', recipe: r });
              }}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </Can>
          <Can permission="recipes.delete">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(r);
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
        title="Recipes"
        description="Define ingredient quantities so sales automatically deduct stock."
        action={
          <Can permission="recipes.create">
            <Button onClick={() => setModalState({ mode: 'create' })}>
              <Plus className="h-4 w-4" /> New Recipe
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
          <EmptyState icon={ChefHat} title="No recipes yet" description="Create a recipe to link ingredients to a menu item." />
        ) : (
          <DataTable columns={columns} data={data.data} rowKey={(r) => r.id} />
        )}
      </Card>

      {modalState && (
        <RecipeFormModal
          recipe={modalState.recipe}
          products={products?.data ?? []}
          menuItems={menuItems?.data ?? []}
          finishedProducts={finishedProducts?.data ?? []}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
          onClose={() => setModalState(null)}
          onSubmit={(values) =>
            modalState.mode === 'edit' && modalState.recipe
              ? updateMutation.mutate({ id: modalState.recipe.id, values })
              : createMutation.mutate(values)
          }
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete recipe"
        message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

function RecipeFormModal({
  recipe,
  products,
  menuItems,
  finishedProducts,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  recipe?: Recipe;
  products: { id: string; name: string }[];
  menuItems: { id: string; name: string }[];
  finishedProducts: { id: string; name: string }[];
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
    defaultValues: {
      name: recipe?.name ?? '',
      description: recipe?.description ?? '',
      menuItemId: recipe?.menuItemId ?? '',
      finishedProductId: recipe?.finishedProductId ?? '',
      ingredients: recipe?.ingredients.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })) ?? [{ productId: '', quantity: 1 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'ingredients' });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={recipe ? 'Edit recipe' : 'New recipe'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="recipe-form" type="submit" isLoading={isSubmitting}>
            {recipe ? 'Save changes' : 'Create recipe'}
          </Button>
        </>
      }
    >
      <form id="recipe-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Recipe name" error={errors.name?.message} {...register('name')} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Linked menu item (optional)" {...register('menuItemId')}>
            <option value="">None</option>
            {menuItems.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          <Select
            label="Linked finished product (optional)"
            hint="Lets Production load this recipe automatically when producing this item."
            {...register('finishedProductId')}
          >
            <option value="">None</option>
            {finishedProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <Textarea label="Description (optional)" rows={2} {...register('description')} />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Ingredients</p>
            <Button type="button" size="sm" variant="outline" onClick={() => append({ productId: '', quantity: 1 })}>
              <Plus className="h-3.5 w-3.5" /> Add ingredient
            </Button>
          </div>
          {errors.ingredients?.message && <p className="mb-2 text-xs text-red-600">{errors.ingredients.message}</p>}
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-2 rounded-lg border border-slate-200 p-2">
                <Select className="flex-[2]" label={index === 0 ? 'Product' : undefined} {...register(`ingredients.${index}.productId` as const)}>
                  <option value="">Select product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <Input
                  className="flex-1"
                  label={index === 0 ? 'Quantity per item' : undefined}
                  type="number"
                  step="0.001"
                  {...register(`ingredients.${index}.quantity` as const)}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} disabled={fields.length === 1}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
