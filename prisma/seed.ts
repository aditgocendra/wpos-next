import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting database seed...");

  // 1. Create or ensure default warehouse
  const mainWarehouse = await prisma.warehouse.upsert({
    where: { code: "WH-MAIN" },
    update: {},
    create: {
      name: "Main Central Warehouse",
      code: "WH-MAIN",
      address: "Jl. Industri Utama No. 1, Jakarta",
    },
  });

  console.log(`✅ Default Warehouse: ${mainWarehouse.name} (${mainWarehouse.id})`);

  // 2. Hash default password
  const hashedPassword = await bcrypt.hash("password123", 10);

  // 3. Create or ensure Super Admin user
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@wpos.com" },
    update: {
      password: hashedPassword,
      role: "SUPER_ADMIN",
    },
    create: {
      email: "admin@wpos.com",
      name: "Super Admin",
      password: hashedPassword,
      role: "SUPER_ADMIN",
    },
  });

  console.log(`✅ Super Admin created: ${superAdmin.email} (${superAdmin.role})`);

  // 4. Create sample Warehouse Admin for testing/demo
  const warehouseAdmin = await prisma.user.upsert({
    where: { email: "warehouse@wpos.com" },
    update: {
      password: hashedPassword,
      role: "WAREHOUSE_ADMIN",
      warehouseId: mainWarehouse.id,
    },
    create: {
      email: "warehouse@wpos.com",
      name: "Warehouse Admin",
      password: hashedPassword,
      role: "WAREHOUSE_ADMIN",
      warehouseId: mainWarehouse.id,
    },
  });

  console.log(`✅ Warehouse Admin created: ${warehouseAdmin.email} (${warehouseAdmin.role})`);

  // 5. Create sample Cashier for testing/demo
  const cashier = await prisma.user.upsert({
    where: { email: "cashier@wpos.com" },
    update: {
      password: hashedPassword,
      role: "CASHIER",
      warehouseId: null,
    },
    create: {
      email: "cashier@wpos.com",
      name: "Main Cashier",
      password: hashedPassword,
      role: "CASHIER",
      warehouseId: null,
    },
  });

  console.log(`✅ Cashier created: ${cashier.email} (${cashier.role})`);

  // 6. Seed sample multi-level categories
  const elcCategory = await prisma.category.upsert({
    where: { code: "ELC" },
    update: {},
    create: {
      name: "Electronic",
      code: "ELC",
    },
  });

  const audCategory = await prisma.category.upsert({
    where: { code: "AUD" },
    update: { parentId: elcCategory.id },
    create: {
      name: "Audio",
      code: "AUD",
      parentId: elcCategory.id,
    },
  });

  await prisma.category.upsert({
    where: { code: "EAR" },
    update: { parentId: audCategory.id },
    create: {
      name: "Earphone",
      code: "EAR",
      parentId: audCategory.id,
    },
  });

  await prisma.category.upsert({
    where: { code: "SPK" },
    update: { parentId: audCategory.id },
    create: {
      name: "Speaker",
      code: "SPK",
      parentId: audCategory.id,
    },
  });

  const camCategory = await prisma.category.upsert({
    where: { code: "CAM" },
    update: { parentId: elcCategory.id },
    create: {
      name: "Camera",
      code: "CAM",
      parentId: elcCategory.id,
    },
  });

  await prisma.category.upsert({
    where: { code: "LEN" },
    update: { parentId: camCategory.id },
    create: {
      name: "Lensa Kamera",
      code: "LEN",
      parentId: camCategory.id,
    },
  });

  console.log("✅ Multi-level categories seeded: ELC > AUD > EAR, SPK; ELC > CAM > LEN");

  // 7. Seed sample products & variants
  const earphoneProduct = await prisma.product.upsert({
    where: { id: "seed-prod-earphone-wf1" },
    update: {},
    create: {
      id: "seed-prod-earphone-wf1",
      name: "Sony Wireless Earphone WF-1000XM5",
      categoryId: (await prisma.category.findUniqueOrThrow({ where: { code: "EAR" } })).id,
      createdById: superAdmin.id,
      variants: {
        create: [
          {
            variantName: "Black",
            sku: "EAR-SON-WF1-BLK",
            priceCost: 3200000,
            priceSell: 4399000,
            createdById: superAdmin.id,
            warehouseStocks: {
              create: {
                warehouseId: mainWarehouse.id,
                stock: 20,
              }
            }
          },
          {
            variantName: "Silver",
            sku: "EAR-SON-WF1-SLV",
            priceCost: 3200000,
            priceSell: 4399000,
            createdById: superAdmin.id,
            warehouseStocks: {
              create: {
                warehouseId: mainWarehouse.id,
                stock: 15,
              }
            }
          },
        ],
      },
    },
  });

  console.log(`✅ Sample Product created: ${earphoneProduct.name}`);

  console.log("🌱 Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
