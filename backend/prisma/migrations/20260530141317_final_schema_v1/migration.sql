/*
  Warnings:

  - You are about to drop the column `category` on the `tickets` table. All the data in the column will be lost.
  - You are about to drop the column `department` on the `users` table. All the data in the column will be lost.
  - Added the required column `categoryId` to the `tickets` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "positions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "departments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slaHours" INTEGER NOT NULL DEFAULT 24
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "inventoryNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "room" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ticket_history" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticketId" INTEGER NOT NULL,
    "changedById" INTEGER NOT NULL,
    "oldStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_history_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tickets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "description" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "categoryId" INTEGER NOT NULL,
    "equipmentId" INTEGER,
    "initiatorId" INTEGER NOT NULL,
    "executorId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tickets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tickets_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tickets_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tickets_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_tickets" ("createdAt", "description", "executorId", "id", "initiatorId", "room", "status", "updatedAt") SELECT "createdAt", "description", "executorId", "id", "initiatorId", "room", "status", "updatedAt" FROM "tickets";
DROP TABLE "tickets";
ALTER TABLE "new_tickets" RENAME TO "tickets";
CREATE TABLE "new_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'INITIATOR',
    "fullName" TEXT NOT NULL,
    "departmentId" INTEGER,
    "positionId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "users_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_users" ("createdAt", "fullName", "id", "login", "passwordHash", "role", "updatedAt") SELECT "createdAt", "fullName", "id", "login", "passwordHash", "role", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_login_key" ON "users"("login");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "positions_name_key" ON "positions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_inventoryNumber_key" ON "equipment"("inventoryNumber");
