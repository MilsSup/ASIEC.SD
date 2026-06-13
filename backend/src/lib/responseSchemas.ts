// backend/src/lib/responseSchemas.ts
// Схемы ответов API для OpenAPI/Swagger.
import { z } from '@hono/zod-openapi';

// ─── Базовые сущности ─────────────────────────────────────────────────────────

export const ErrorSchema = z.object({ error: z.string() });
export const OkSchema = z.object({ ok: z.boolean() });

export const UnitSchema = z.object({
  id: z.number(), shortName: z.string(), fullName: z.string(),
});

export const CategorySchema = z.object({
  id: z.number(), name: z.string(), slaHours: z.number(),
});

export const NomenclatureSchema = z.object({
  id: z.number(), name: z.string(), article: z.string().nullable(), price: z.number(), unitId: z.number(),
  unit: UnitSchema.optional(),
});

export const TicketPartSchema = z.object({
  id: z.number(), ticketId: z.number(), nomenclatureId: z.number(),
  requiredQuantity: z.number(), price: z.number(), isApproved: z.boolean(), fulfilledFromStock: z.boolean(),
  nomenclature: NomenclatureSchema.optional(),
});

export const TicketSchema = z.object({
  id: z.number(), description: z.string(), room: z.string(), building: z.number(),
  status: z.string(), priority: z.string(),
  categoryId: z.number(), equipmentId: z.number().nullable(),
  initiatorId: z.number().nullable(), executorId: z.number().nullable(),
  createdAt: z.string(), updatedAt: z.string(),
  category: CategorySchema.optional(),
  initiator: z.object({ fullName: z.string() }).nullable().optional(),
  executor: z.object({ fullName: z.string() }).nullable().optional(),
  parts: z.array(TicketPartSchema).optional(),
});

export const InventorySchema = z.object({
  id: z.number(), quantity: z.number(), minQuantity: z.number(),
  warehouseId: z.number(), nomenclatureId: z.number(),
  warehouse: z.object({ id: z.number(), name: z.string(), building: z.number().nullable() }).optional(),
  nomenclature: NomenclatureSchema.optional(),
});

// ─── Ответы-агрегаты ──────────────────────────────────────────────────────────

export const TicketPrioritySchema = z.object({ id: z.number(), priority: z.string() });

export const TicketHistoryEntrySchema = z.object({
  id: z.number(), oldStatus: z.string().nullable(), newStatus: z.string(),
  comment: z.string().nullable(), date: z.string(), author: z.string(), authorRole: z.string().nullable(),
});

export const PartCheckItemSchema = z.object({
  nomenclatureId: z.number(), name: z.string(), unit: z.string(), price: z.number(),
  requested: z.number(), writeOffQty: z.number(), purchaseQty: z.number(),
  ownAvailable: z.number(), otherAvailable: z.number(), otherBuilding: z.number().nullable(),
});
export const PartCheckResponseSchema = z.object({ items: z.array(PartCheckItemSchema) });

export const StatsSchema = z.object({
  totalTickets: z.number(), newTickets: z.number(), inProgressTickets: z.number(),
  waitingTickets: z.number(), completedTickets: z.number(), totalUsers: z.number(),
  lowStockCount: z.number(), estimateTotal: z.number(), urgentOpenTickets: z.number(),
  lowStockItems: z.array(z.object({ id: z.number(), name: z.string(), unit: z.string(), quantity: z.number(), minQuantity: z.number(), warehouse: z.string() })),
  pendingReviews: z.array(z.object({ id: z.number(), description: z.string(), category: z.string(), total: z.number(), priority: z.string() })),
});

export const PartPriceUpdateSchema = TicketPartSchema.extend({
  priceDiffers: z.boolean(),
  nomenclaturePrice: z.number(),
});

export const EstimatePartSchema = z.object({
  id: z.number(), requiredQuantity: z.number(), price: z.number(),
  nomenclature: z.object({ name: z.string(), unit: z.object({ shortName: z.string() }) }),
  ticket: z.object({ id: z.number(), description: z.string() }),
});

export const PriceHistoryResponseSchema = z.object({
  items: z.array(z.object({
    id: z.number(), name: z.string(), unit: z.string(), currentPrice: z.number(),
    history: z.array(z.object({ date: z.string(), price: z.number(), source: z.string(), ticketId: z.number() })),
  })),
  total: z.number(), page: z.number(), pageSize: z.number(),
});

export const ConsumptionReportSchema = z.object({
  totalWriteOffs: z.number(), positionsCount: z.number(), ticketsCount: z.number(),
  byNomenclature: z.array(z.object({
    nomenclatureId: z.number(), name: z.string(), article: z.string().nullable(), unit: z.string(), quantity: z.number(),
    tickets: z.array(z.object({ ticketId: z.number(), description: z.string(), quantity: z.number(), date: z.string(), warehouse: z.string() })),
  })),
  byTicket: z.array(z.object({
    ticketId: z.number(), description: z.string(),
    items: z.array(z.object({ nomenclatureId: z.number(), name: z.string(), unit: z.string(), quantity: z.number(), date: z.string(), warehouse: z.string() })),
  })),
});

export const StaffMemberSchema = z.object({
  id: z.number(), fullName: z.string(), position: z.string(), department: z.string(),
  building: z.number().nullable(), activeTasks: z.number(), closedThisMonth: z.number(), totalClosed: z.number(),
});

export const StaffBuildingSchema = z.object({ id: z.number(), building: z.number().nullable() });

export const StaffReportSchema = z.object({
  totalCompleted: z.number(), totalRejected: z.number(), overallAvgTimeMs: z.number().nullable(),
  staff: z.array(z.object({
    id: z.number(), fullName: z.string(), position: z.string(),
    completedCount: z.number(), rejectedCount: z.number(), avgTimeMs: z.number().nullable(), totalTimeMs: z.number(),
    tickets: z.array(z.object({ ticketId: z.number(), description: z.string(), category: z.string(), type: z.string(), date: z.string(), durationMs: z.number().nullable() })),
  })),
});
