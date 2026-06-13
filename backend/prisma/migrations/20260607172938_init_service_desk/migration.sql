/*
  Warnings:

  - You are about to drop the `inventory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `partId` on the `ticket_parts` table. All the data in the column will be lost.
  - Added the required column `nomenclatureId` to the `ticket_parts` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "inventory_partName_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "inventory";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "units" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shortName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "inventories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minQuantity" INTEGER NOT NULL DEFAULT 0,
    "warehouseId" INTEGER NOT NULL,
    "nomenclatureId" INTEGER NOT NULL,
    CONSTRAINT "inventories_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventories_nomenclatureId_fkey" FOREIGN KEY ("nomenclatureId") REFERENCES "nomenclatures" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "nomenclatures" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "article" TEXT,
    "price" REAL NOT NULL DEFAULT 0,
    "unitId" INTEGER NOT NULL,
    CONSTRAINT "nomenclatures_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ticket_parts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticketId" INTEGER NOT NULL,
    "nomenclatureId" INTEGER NOT NULL,
    "requiredQuantity" INTEGER NOT NULL DEFAULT 1,
    "price" REAL NOT NULL DEFAULT 0,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ticket_parts_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_parts_nomenclatureId_fkey" FOREIGN KEY ("nomenclatureId") REFERENCES "nomenclatures" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ticket_parts" ("id", "isApproved", "requiredQuantity", "ticketId") SELECT "id", "isApproved", "requiredQuantity", "ticketId" FROM "ticket_parts";
DROP TABLE "ticket_parts";
ALTER TABLE "new_ticket_parts" RENAME TO "ticket_parts";
CREATE UNIQUE INDEX "ticket_parts_ticketId_nomenclatureId_key" ON "ticket_parts"("ticketId", "nomenclatureId");
CREATE TABLE "new_tickets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "description" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "categoryId" INTEGER NOT NULL,
    "equipmentId" INTEGER,
    "initiatorId" INTEGER,
    "executorId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tickets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tickets_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tickets_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tickets_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_tickets" ("categoryId", "createdAt", "description", "equipmentId", "executorId", "id", "initiatorId", "room", "status", "updatedAt") SELECT "categoryId", "createdAt", "description", "equipmentId", "executorId", "id", "initiatorId", "room", "status", "updatedAt" FROM "tickets";
DROP TABLE "tickets";
ALTER TABLE "new_tickets" RENAME TO "tickets";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "units_shortName_key" ON "units"("shortName");

-- CreateIndex
CREATE UNIQUE INDEX "inventories_warehouseId_nomenclatureId_key" ON "inventories"("warehouseId", "nomenclatureId");
