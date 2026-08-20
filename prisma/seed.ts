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
      warehouseId: mainWarehouse.id,
    },
    create: {
      email: "cashier@wpos.com",
      name: "Main Cashier",
      password: hashedPassword,
      role: "CASHIER",
      warehouseId: mainWarehouse.id,
    },
  });

  console.log(`✅ Cashier created: ${cashier.email} (${cashier.role})`);
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
