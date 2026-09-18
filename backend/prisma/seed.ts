import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { PERMISSIONS, ROLE_PERMISSIONS } from '../src/constants/permissions';

const prisma = new PrismaClient();

const SEED_SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@restaurant.com';
const SEED_SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'Admin@12345';
const SEED_MANAGER_EMAIL = process.env.SEED_MANAGER_EMAIL ?? 'manager@restaurant.com';
const SEED_MANAGER_PASSWORD = process.env.SEED_MANAGER_PASSWORD ?? 'Manager@12345';
const SEED_STAFF_EMAIL = process.env.SEED_STAFF_EMAIL ?? 'staff@restaurant.com';
const SEED_STAFF_PASSWORD = process.env.SEED_STAFF_PASSWORD ?? 'Staff@12345';
const SEED_RETAIL_EMAIL = 'customer@restaurant.com';
const SEED_RETAIL_PASSWORD = 'Customer@12345';

async function hash(pwd: string) {
  return bcrypt.hash(pwd, 12);
}

async function main() {
  console.log('Seeding roles & permissions...');

  const roles = await Promise.all(
    (['SUPER_ADMIN', 'MANAGER', 'STAFF', 'RETAIL_USER'] as const).map((name) =>
      prisma.role.upsert({
        where: { name },
        update: {},
        create: { name, description: `${name.replace('_', ' ')} role`, isSystem: true },
      }),
    ),
  );
  const roleByName = new Map(roles.map((r) => [r.name, r]));

  const permissions = await Promise.all(
    PERMISSIONS.map((key) => {
      const [module, action] = key.split('.');
      return prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, module, action, description: `${action} ${module}` },
      });
    }),
  );
  const permissionByKey = new Map(permissions.map((p) => [p.key, p]));

  // Full sync (not just upsert-add) so a permission removed from ROLE_PERMISSIONS in code
  // actually gets unlinked here too, instead of lingering on the role forever.
  for (const [roleName, keys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = roleByName.get(roleName as keyof typeof ROLE_PERMISSIONS)!;
    const desiredIds = new Set(keys.map((key) => permissionByKey.get(key)?.id).filter((id): id is string => !!id));

    const current = await prisma.rolePermission.findMany({ where: { roleId: role.id } });
    const toRemove = current.filter((rp) => !desiredIds.has(rp.permissionId));
    if (toRemove.length > 0) {
      await prisma.rolePermission.deleteMany({ where: { id: { in: toRemove.map((rp) => rp.id) } } });
    }

    for (const permissionId of desiredIds) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }

  console.log('Seeding users...');
  const superAdmin = await prisma.user.upsert({
    where: { email: SEED_SUPER_ADMIN_EMAIL },
    update: {},
    create: {
      firstName: 'System',
      lastName: 'Administrator',
      email: SEED_SUPER_ADMIN_EMAIL,
      passwordHash: await hash(SEED_SUPER_ADMIN_PASSWORD),
      roleId: roleByName.get('SUPER_ADMIN')!.id,
      status: 'ACTIVE',
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: SEED_MANAGER_EMAIL },
    update: {},
    create: {
      firstName: 'Alice',
      lastName: 'Manager',
      email: SEED_MANAGER_EMAIL,
      passwordHash: await hash(SEED_MANAGER_PASSWORD),
      roleId: roleByName.get('MANAGER')!.id,
      status: 'ACTIVE',
    },
  });

  await prisma.user.upsert({
    where: { email: SEED_STAFF_EMAIL },
    update: {},
    create: {
      firstName: 'Bob',
      lastName: 'Staff',
      email: SEED_STAFF_EMAIL,
      passwordHash: await hash(SEED_STAFF_PASSWORD),
      roleId: roleByName.get('STAFF')!.id,
      managerId: manager.id,
      status: 'ACTIVE',
    },
  });

  await prisma.user.upsert({
    where: { email: SEED_RETAIL_EMAIL },
    update: {},
    create: {
      firstName: 'Cathy',
      lastName: 'Customer',
      email: SEED_RETAIL_EMAIL,
      passwordHash: await hash(SEED_RETAIL_PASSWORD),
      roleId: roleByName.get('RETAIL_USER')!.id,
      status: 'ACTIVE',
    },
  });

  console.log('Seeding units, categories, warehouse...');
  const unitDefs = [
    { name: 'Kilogram', abbreviation: 'KG' },
    { name: 'Gram', abbreviation: 'G' },
    { name: 'Litre', abbreviation: 'L' },
    { name: 'Millilitre', abbreviation: 'ML' },
    { name: 'Piece', abbreviation: 'PC' },
    { name: 'Bag', abbreviation: 'BAG' },
  ];
  const units = await Promise.all(
    unitDefs.map((u) => prisma.unit.upsert({ where: { abbreviation: u.abbreviation }, update: {}, create: u })),
  );
  const unitByAbbr = new Map(units.map((u) => [u.abbreviation, u]));

  const categoryDefs = ['Grains & Staples', 'Meat & Poultry', 'Vegetables', 'Dairy', 'Beverages', 'Condiments & Spices'];
  const categories = await Promise.all(
    categoryDefs.map((name) => prisma.category.upsert({ where: { name }, update: {}, create: { name } })),
  );
  const categoryByName = new Map(categories.map((c) => [c.name, c]));

  const warehouse = await prisma.warehouse.upsert({
    where: { name: 'Main Kitchen Store' },
    update: {},
    create: { name: 'Main Kitchen Store', location: 'Ground Floor, Back of House' },
  });
  // The one "sales floor" warehouse - Sales/Orders always fulfill from here, and Production
  // sends its completed output here by default (see warehouse.service.ts getFinishedGoodsWarehouseId).
  await prisma.warehouse.upsert({
    where: { name: 'Finished Goods Store' },
    update: {},
    create: { name: 'Finished Goods Store', location: 'Front of House' },
  });

  console.log('Seeding supplier...');
  const supplier = await prisma.supplier.upsert({
    where: { id: 'a0000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'a0000000-0000-4000-8000-000000000001',
      name: 'Kigali Fresh Foods Ltd',
      contactPerson: 'Jean Baptiste',
      email: 'sales@kigalifresh.rw',
      phone: '+250788000000',
      address: 'Kigali, Rwanda',
    },
  });

  console.log('Seeding products...');
  // sellingPrice is omitted for ingredients that aren't sold directly - only a couple of
  // grab-and-go items (Soft Drinks, Water) have one.
  const productDefs = [
    { name: 'Rice', category: 'Grains & Staples', unit: 'KG', min: 20, max: 500, cost: 900, perishable: false },
    { name: 'Cooking Oil', category: 'Condiments & Spices', unit: 'L', min: 10, max: 200, cost: 2200, perishable: false },
    { name: 'Tomatoes', category: 'Vegetables', unit: 'KG', min: 15, max: 150, cost: 800, perishable: true, shelfLife: 7 },
    { name: 'Milk', category: 'Dairy', unit: 'L', min: 10, max: 100, cost: 700, perishable: true, shelfLife: 5 },
    { name: 'Chicken', category: 'Meat & Poultry', unit: 'KG', min: 15, max: 120, cost: 3500, perishable: true, shelfLife: 3 },
    { name: 'Beef', category: 'Meat & Poultry', unit: 'KG', min: 10, max: 100, cost: 4500, perishable: true, shelfLife: 3 },
    { name: 'Flour', category: 'Grains & Staples', unit: 'KG', min: 20, max: 300, cost: 750, perishable: false },
    { name: 'Sugar', category: 'Grains & Staples', unit: 'KG', min: 10, max: 150, cost: 950, perishable: false },
    { name: 'Salt', category: 'Condiments & Spices', unit: 'KG', min: 5, max: 60, cost: 300, perishable: false },
    { name: 'Soft Drinks', category: 'Beverages', unit: 'PC', min: 50, max: 1000, cost: 400, price: 800, perishable: false },
    { name: 'Water', category: 'Beverages', unit: 'PC', min: 50, max: 1000, cost: 200, price: 500, perishable: false },
    { name: 'Burger Bread', category: 'Grains & Staples', unit: 'PC', min: 30, max: 400, cost: 250, perishable: true, shelfLife: 4 },
    { name: 'Burger Sauce', category: 'Condiments & Spices', unit: 'ML', min: 2000, max: 20000, cost: 5, perishable: false },
  ];

  const products = [];
  for (const p of productDefs) {
    const product = await prisma.product.upsert({
      where: { name: p.name },
      update: {},
      create: {
        name: p.name,
        categoryId: categoryByName.get(p.category)!.id,
        unitId: unitByAbbr.get(p.unit)!.id,
        minimumStock: p.min,
        maximumStock: p.max,
        costPrice: p.cost,
        sellingPrice: p.price,
        isPerishable: p.perishable,
        shelfLifeDays: p.shelfLife,
      },
    });
    products.push(product);
  }
  const productByName = new Map(products.map((p) => [p.name, p]));

  console.log('Seeding opening inventory via stock movements...');
  for (const product of products) {
    const existingInv = await prisma.inventory.findUnique({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
    });
    if (existingInv) continue;

    const openingQty = Number(product.minimumStock) * 3;
    const inventory = await prisma.inventory.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: openingQty,
        averageCost: product.costPrice,
      },
    });
    await prisma.inventoryBatch.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: openingQty,
        unitCost: product.costPrice,
        // Same rule the receiving flow uses: Expiry Date = Received Date + Shelf Life.
        expiryDate:
          product.isPerishable && product.shelfLifeDays
            ? new Date(Date.now() + product.shelfLifeDays * 24 * 60 * 60 * 1000)
            : undefined,
      },
    });
    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'ADJUSTMENT',
        quantity: openingQty,
        unitCost: product.costPrice,
        previousQuantity: 0,
        newQuantity: inventory.quantity,
        reason: 'Opening stock balance (seed)',
        createdById: superAdmin.id,
      },
    });
  }

  console.log('Seeding menu items & recipes...');
  const chickenBurger = await prisma.menuItem.upsert({
    where: { id: 'a0000000-0000-4000-8000-0000000000a1' },
    update: {},
    create: {
      id: 'a0000000-0000-4000-8000-0000000000a1',
      name: 'Chicken Burger',
      description: 'Grilled chicken burger with fresh vegetables',
      price: 4000,
      category: 'Burgers',
    },
  });

  const beefBurger = await prisma.menuItem.upsert({
    where: { id: 'a0000000-0000-4000-8000-0000000000a2' },
    update: {},
    create: {
      id: 'a0000000-0000-4000-8000-0000000000a2',
      name: 'Beef Burger',
      description: 'Juicy beef burger with house sauce',
      price: 4500,
      category: 'Burgers',
    },
  });

  await prisma.menuItem.upsert({
    where: { id: 'a0000000-0000-4000-8000-0000000000a3' },
    update: {},
    create: {
      id: 'a0000000-0000-4000-8000-0000000000a3',
      name: 'Soft Drink',
      description: 'Chilled soft drink',
      price: 1200,
      category: 'Beverages',
    },
  });

  const existingChickenRecipe = await prisma.recipe.findUnique({ where: { menuItemId: chickenBurger.id } });
  if (!existingChickenRecipe) {
    await prisma.recipe.create({
      data: {
        name: 'Chicken Burger Recipe',
        menuItemId: chickenBurger.id,
        ingredients: {
          create: [
            { productId: productByName.get('Burger Bread')!.id, quantity: 1 },
            { productId: productByName.get('Chicken')!.id, quantity: 0.15 },
            { productId: productByName.get('Tomatoes')!.id, quantity: 0.05 },
            { productId: productByName.get('Cooking Oil')!.id, quantity: 0.01 },
            { productId: productByName.get('Burger Sauce')!.id, quantity: 20 },
          ],
        },
      },
    });
  }

  const existingBeefRecipe = await prisma.recipe.findUnique({ where: { menuItemId: beefBurger.id } });
  if (!existingBeefRecipe) {
    await prisma.recipe.create({
      data: {
        name: 'Beef Burger Recipe',
        menuItemId: beefBurger.id,
        ingredients: {
          create: [
            { productId: productByName.get('Burger Bread')!.id, quantity: 1 },
            { productId: productByName.get('Beef')!.id, quantity: 0.18 },
            { productId: productByName.get('Tomatoes')!.id, quantity: 0.05 },
            { productId: productByName.get('Burger Sauce')!.id, quantity: 25 },
          ],
        },
      },
    });
  }

  console.log('\nSeed complete. Development credentials:');
  console.log(`  SUPER_ADMIN  -> ${SEED_SUPER_ADMIN_EMAIL} / ${SEED_SUPER_ADMIN_PASSWORD}`);
  console.log(`  MANAGER      -> ${SEED_MANAGER_EMAIL} / ${SEED_MANAGER_PASSWORD}`);
  console.log(`  STAFF        -> ${SEED_STAFF_EMAIL} / ${SEED_STAFF_PASSWORD}`);
  console.log(`  RETAIL_USER  -> ${SEED_RETAIL_EMAIL} / ${SEED_RETAIL_PASSWORD}`);
  console.log(`  Supplier seeded: ${supplier.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
