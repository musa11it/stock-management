import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { formResolver } from '@/lib/zodForm';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, UtensilsCrossed } from 'lucide-react';
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
import { menuItemService, recipeService } from '@/services/recipe.service';
import { productService } from '@/services/catalog.service';
import { getErrorMessage } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import type { MenuItem } from '@/types';

const ingredientSchema = z.object({ productId: z.string().uuid('Select a product'), quantity: z.coerce.number().positive('Must be > 0') });
const schema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    price: z.coerce.number().min(0),
    category: z.string().optional(),
    recipeMode: z.enum(['none', 'new', 'existing']),
    existingRecipeId: z.string().optional(),
    ingredients: z.array(ingredientSchema).optional(),
  })
  .refine((v) => v.recipeMode !== 'new' || (v.ingredients && v.ingredients.length > 0), {
    message: 'Add at least one ingredient, or switch to "No recipe"',
    path: ['ingredients'],
  })
  .refine((v) => v.recipeMode !== 'existing' || !!v.existingRecipeId, {
    message: 'Select a recipe to reuse',
    path: ['existingRecipeId'],
  });
type FormValues = z.infer<typeof schema>;

export default function MenuPage() {
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState<{ mode: 'create' | 'edit'; item?: MenuItem } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['menu'], queryFn: () => menuItemService.list({ limit: 100 }) });
  const { data: products } = useQuery({ queryKey: ['products', 'all'], queryFn: () => productService.list({ limit: 200 }) });
  // "Reusable" recipes = ones not already tied to a menu item - avoids ever creating a duplicate.
  const { data: recipes } = useQuery({ queryKey: ['recipes', 'all'], queryFn: () => recipeService.list({ limit: 200 }) });
  const unlinkedRecipes = (recipes?.data ?? []).filter((r) => !r.menuItemId);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['menu'] });
    queryClient.invalidateQueries({ queryKey: ['recipes'] });
    setModalState(null);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const menuItemPayload = { name: values.name, description: values.description, price: values.price, category: values.category };
      const editingItem = modalState?.mode === 'edit' ? modalState.item : undefined;
      const menuItem = editingItem ? await menuItemService.update(editingItem.id, menuItemPayload) : await menuItemService.create(menuItemPayload);

      const existingRecipe = editingItem?.recipe;

      if (values.recipeMode === 'new') {
        const ingredients = values.ingredients!.map((i) => ({ productId: i.productId, quantity: i.quantity }));
        if (existingRecipe) {
          // Same recipe row, new ingredient list - not a second recipe for this item.
          await recipeService.update(existingRecipe.id, { name: menuItem.name, ingredients });
        } else {
          await recipeService.create({ name: menuItem.name, menuItemId: menuItem.id, ingredients });
        }
      } else if (values.recipeMode === 'existing' && values.existingRecipeId) {
        if (existingRecipe && existingRecipe.id !== values.existingRecipeId) {
          await recipeService.update(existingRecipe.id, { menuItemId: null }); // free it up for reuse elsewhere
        }
        await recipeService.update(values.existingRecipeId, { menuItemId: menuItem.id });
      } else if (values.recipeMode === 'none' && existingRecipe) {
        await recipeService.remove(existingRecipe.id);
      }

      return menuItem;
    },
    onSuccess: () => {
      toast.success(modalState?.mode === 'edit' ? 'Menu item updated successfully' : 'Menu item created successfully');
      invalidate();
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
    {
      header: 'Recipe',
      accessor: (m) => (m.recipe ? <Badge tone="blue">{m.recipe.name}</Badge> : <Badge tone="amber">Recipe not configured</Badge>),
    },
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
        description="Items sold to customers - each can optionally have a recipe for automatic stock deduction."
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
          products={products?.data ?? []}
          unlinkedRecipes={unlinkedRecipes}
          isSubmitting={saveMutation.isPending}
          onClose={() => setModalState(null)}
          onSubmit={(values) => saveMutation.mutate(values)}
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

interface ProductOpt {
  id: string;
  name: string;
}
interface RecipeOpt {
  id: string;
  name: string;
}

function MenuItemFormModal({
  item,
  products,
  unlinkedRecipes,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  item?: MenuItem;
  products: ProductOpt[];
  unlinkedRecipes: RecipeOpt[];
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
    defaultValues: {
      name: item?.name ?? '',
      description: item?.description ?? '',
      price: item ? Number(item.price) : 0,
      category: item?.category ?? '',
      recipeMode: item?.recipe ? 'new' : 'none',
      existingRecipeId: '',
      ingredients: item?.recipe?.ingredients.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })) ?? [
        { productId: '', quantity: 1 },
      ],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'ingredients' });
  const recipeMode = watch('recipeMode');

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={item ? 'Edit menu item' : 'New menu item'}
      size="lg"
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

        <div className="rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-sm font-medium text-slate-700">Recipe / Ingredients (optional)</p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(
              [
                { value: 'none', label: 'No recipe' },
                { value: 'new', label: item?.recipe ? 'Edit ingredients' : 'Create recipe' },
                { value: 'existing', label: 'Use existing recipe' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setValue('recipeMode', opt.value)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  recipeMode === opt.value ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {recipeMode === 'none' && (
            <p className="text-xs text-slate-500">
              This item will be sold without any automatic stock deduction. You can add a recipe later from here.
            </p>
          )}

          {recipeMode === 'existing' && (
            <Select label="Existing recipe" error={errors.existingRecipeId?.message} {...register('existingRecipeId')}>
              <option value="">Select a recipe</option>
              {unlinkedRecipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          )}

          {recipeMode === 'new' && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Ingredients</p>
                <Button type="button" size="sm" variant="outline" onClick={() => append({ productId: '', quantity: 1 })}>
                  <Plus className="h-3.5 w-3.5" /> Add ingredient
                </Button>
              </div>
              {errors.ingredients?.message && <p className="mb-2 text-xs text-red-600">{errors.ingredients.message}</p>}
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-end gap-2 rounded-lg border border-slate-200 p-2">
                    <Select
                      className="flex-[2]"
                      label={index === 0 ? 'Product' : undefined}
                      {...register(`ingredients.${index}.productId` as const)}
                    >
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
          )}
        </div>
      </form>
    </Modal>
  );
}
