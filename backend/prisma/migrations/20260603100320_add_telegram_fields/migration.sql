/*
  Warnings:

  - A unique constraint covering the columns `[telegramChatId]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[linkCode]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN "linkCode" TEXT;
ALTER TABLE "users" ADD COLUMN "telegramChatId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramChatId_key" ON "users"("telegramChatId");

-- CreateIndex
CREATE UNIQUE INDEX "users_linkCode_key" ON "users"("linkCode");
