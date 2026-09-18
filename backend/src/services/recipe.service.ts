import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../errors/AppError';
import { resolvePagination, buildMeta } from '../utils/pagination';
import { writeAuditLog } from './auditLog.service';

const recipeInclude = {
  menuItem: true,
  finishedProduct: true,
  ingredients: { include: { product: { include: { unit: true } } } },
} satisfies Prisma.RecipeInclude;

export interface RecipeIngredientInput {
  productId: string;
  quantity: number;
}

export async function listRecipes(query: { page?: number; limit?: number; search?: string; finishedProductId?: string }) {
  const { skip, take, page, limit } = resolvePagination(query);
  const where: Prisma.RecipeWhereInput = {
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    ...(query.finishedProductId ? { finishedProductId: query.finishedProductId } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.recipe.findMany({ where, skip, take, orderBy: { name: 'asc' }, include: recipeInclude }),
    prisma.recipe.count({ where }),
  ]);
  return { data, meta: buildMeta(total, page, limit) };
}

export async function getRecipeById(id: string) {
  const recipe = await prisma.recipe.findUnique({ where: { id }, include: recipeInclude });
  if (!recipe) throw AppError.notFound('Recipe not found');
  return recipe;
}

export async function createRecipe(
  input: {
    name: string;
    description?: string;
    menuItemId?: string;
    finishedProductId?: string;
    ingredients: RecipeIngredientInput[];
  },
  actorId: string,
) {
  const recipe = await prisma.recipe.create({
    data: {
      name: input.name,
      description: input.description,
      menuItemId: input.menuItemId,
      finishedProductId: input.finishedProductId,
      ingredients: { create: input.ingredients.map((i) => ({ productId: i.productId, quantity: i.quantity })) },
    },
    include: recipeInclude,
  });
  await writeAuditLog({ userId: actorId, action: 'RECIPE_CREATED', entity: 'Recipe', entityId: recipe.id, newValue: recipe });
  return recipe;
}

export async function updateRecipe(
  id: string,
  input: {
    name?: string;
    description?: string;
    menuItemId?: string | null;
    finishedProductId?: string | null;
    ingredients?: RecipeIngredientInput[];
  },
  actorId: string,
) {
  const existing = await getRecipeById(id);

  const recipe = await prisma.$transaction(async (tx) => {
    if (input.ingredients) {
      await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
      await tx.recipeIngredient.createMany({
        data: input.ingredients.map((i) => ({ recipeId: id, productId: i.productId, quantity: i.quantity })),
      });
    }
    return tx.recipe.update({
      where: { id },
      data: { name: input.name, description: input.description, menuItemId: input.menuItemId, finishedProductId: input.finishedProductId },
      include: recipeInclude,
    });
  });

  await writeAuditLog({ userId: actorId, action: 'RECIPE_UPDATED', entity: 'Recipe', entityId: id, oldValue: existing, newValue: recipe });
  return recipe;
}

export async function deleteRecipe(id: string, actorId: string) {
  const existing = await getRecipeById(id);
  await prisma.recipe.delete({ where: { id } });
  await writeAuditLog({ userId: actorId, action: 'RECIPE_DELETED', entity: 'Recipe', entityId: id, oldValue: existing });
}
