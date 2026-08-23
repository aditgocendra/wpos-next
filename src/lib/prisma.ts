import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

const globalForPrisma = globalThis as unknown as {
  prisma: InstanceType<typeof PrismaClient> | undefined;
};

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
  });
};

const existingPrisma = globalForPrisma.prisma;
const isStale =
  existingPrisma &&
  (!("product" in existingPrisma) ||
    !("productVariant" in existingPrisma) ||
    !("category" in existingPrisma) ||
    !("stockTransfer" in existingPrisma));

export const prisma =
  !existingPrisma || isStale ? createPrismaClient() : existingPrisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
