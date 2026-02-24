/*
  Warnings:

  - You are about to drop the column `currentValuePhp` on the `Investment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Investment"
RENAME COLUMN "currentValuePhp" TO "value";
