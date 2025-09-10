/*
  Warnings:

  - You are about to drop the column `dueDate` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Order` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Order" DROP COLUMN "dueDate",
DROP COLUMN "updatedAt";
