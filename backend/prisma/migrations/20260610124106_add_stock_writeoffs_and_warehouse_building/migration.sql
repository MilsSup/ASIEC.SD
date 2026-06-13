-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN "building" INTEGER;

-- CreateTable
CREATE TABLE "stock_write_offs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticketId" INTEGER NOT NULL,
    "nomenclatureId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" REAL NOT NULL DEFAULT 0,
    "writtenOffById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_write_offs_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_write_offs_nomenclatureId_fkey" FOREIGN KEY ("nomenclatureId") REFERENCES "nomenclatures" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_write_offs_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_write_offs_writtenOffById_fkey" FOREIGN KEY ("writtenOffById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "fulfilledFromStock" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ticket_parts_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_parts_nomenclatureId_fkey" FOREIGN KEY ("nomenclatureId") REFERENCES "nomenclatures" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ticket_parts" ("id", "isApproved", "nomenclatureId", "price", "requiredQuantity", "ticketId") SELECT "id", "isApproved", "nomenclatureId", "price", "requiredQuantity", "ticketId" FROM "ticket_parts";
DROP TABLE "ticket_parts";
ALTER TABLE "new_ticket_parts" RENAME TO "ticket_parts";
CREATE UNIQUE INDEX "ticket_parts_ticketId_nomenclatureId_key" ON "ticket_parts"("ticketId", "nomenclatureId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
