/*
  Warnings:

  - You are about to drop the column `warehouseId` on the `products` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_warehouseId_fkey";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "warehouseId";
