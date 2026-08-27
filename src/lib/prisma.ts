import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

function createExtendedPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const basePrisma = new PrismaClient({
    adapter,
  });

  return basePrisma.$extends({
    query: {
      user: {
        async delete({ args, query }) {
          // Check if the user being deleted is a SUPER_ADMIN
          const userToDelete = await basePrisma.user.findUnique({
            where: args.where,
            select: { role: true },
          });

          if (userToDelete?.role === "SUPER_ADMIN") {
            throw new Error("Cannot delete Super Admin account (blocked by ORM extension)");
          }

          return query(args);
        },
        async deleteMany({ args, query }) {
          // Check if any SUPER_ADMIN would be matched and deleted
          const countSuperAdmins = await basePrisma.user.count({
            where: {
              ...args.where,
              role: "SUPER_ADMIN",
            },
          });

          if (countSuperAdmins > 0) {
            throw new Error("Cannot delete Super Admin account via deleteMany (blocked by ORM extension)");
          }

          return query(args);
        },
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createExtendedPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

const existingPrisma = globalForPrisma.prisma;
const isStale =
  existingPrisma &&
  (!("product" in existingPrisma) ||
    !("productVariant" in existingPrisma) ||
    !("category" in existingPrisma) ||
    !("stockTransfer" in existingPrisma) ||
    !("transaction" in existingPrisma));

export const prisma =
  !existingPrisma || isStale ? createExtendedPrismaClient() : existingPrisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
