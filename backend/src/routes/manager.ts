// backend/src/routes/manager.ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { prisma } from '../lib/client.js';
import { jwt } from 'hono/jwt';
import { getJwtSecret } from '../lib/jwt.js';
import { sortByPriority, extractWorkEvents } from '../lib/reports.js';
import {
  StatsSchema, TicketSchema, OkSchema, PartPriceUpdateSchema, EstimatePartSchema,
  PriceHistoryResponseSchema, InventorySchema, ConsumptionReportSchema,
  StaffMemberSchema, StaffReportSchema, StaffBuildingSchema,
} from '../lib/responseSchemas.js';

export const managerRouter = new OpenAPIHono();

// Доступ в разделы руководителя: валидный токен + роль MANAGER
managerRouter.use('/*', async (c, next) => {
  const secret = getJwtSecret();

  // 1) Проверяем подпись токена middleware'ом hono/jwt
  try {
    let valid = false;
    await jwt({ secret, alg: 'HS256' })(c, async () => { valid = true; });
    if (!valid) return c.json({ error: 'Не авторизован' }, 401);
  } catch {
    return c.json({ error: 'Не авторизован' }, 401);
  }

  // 2) Эндпоинты руководителя доступны только роли MANAGER
  const payload = c.get('jwtPayload') as { role?: string } | undefined;
  if (payload?.role !== 'MANAGER') {
    return c.json({ error: 'Доступ только для руководителя' }, 403);
  }

  await next();
});

// ─── 1. СВОДКА ───────────────────────────────────────────────────────────────
// GET /manager/stats

const getStatsRoute = createRoute({
  method: 'get', path: '/stats',
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: 'Статистика', content: { 'application/json': { schema: StatsSchema } } } },
});

managerRouter.openapi(getStatsRoute, async (c) => {
  const [
    totalTickets, newTickets, inProgressTickets, waitingTickets, completedTickets, totalUsers, lowStockCount,
    estimateParts, lowStockItems, pendingReviews, urgentOpenTickets,
  ] = await Promise.all([
      prisma.ticket.count(),
      prisma.ticket.count({ where: { status: 'NEW' } }),
      prisma.ticket.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.ticket.count({ where: { status: 'WAITING_FOR_PURCHASE' } }),
      prisma.ticket.count({ where: { status: 'COMPLETED' } }),
      prisma.user.count({ where: { role: 'EXECUTOR' } }),
      // Дефицит только если задан минимальный остаток (>0) и фактический не превышает его
      prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*) as count FROM "inventories" WHERE "minQuantity" > 0 AND "quantity" <= "minQuantity"
      `,
      // Сумма по сводной смете (как в /manager/estimate)
      prisma.ticketPart.findMany({
        where: { isApproved: true, ticket: { status: { notIn: ['COMPLETED', 'CANCELED'] } } },
        select: { price: true, requiredQuantity: true },
      }),
      // Несколько позиций с дефицитом склада
      prisma.$queryRaw<{ id: number; quantity: number; minQuantity: number; name: string; unit: string; warehouse: string }[]>`
        SELECT i."id" as "id", i."quantity" as "quantity", i."minQuantity" as "minQuantity",
               n."name" as "name", u."shortName" as "unit", w."name" as "warehouse"
        FROM "inventories" i
        JOIN "nomenclatures" n ON n."id" = i."nomenclatureId"
        JOIN "units" u ON u."id" = n."unitId"
        JOIN "warehouses" w ON w."id" = i."warehouseId"
        WHERE i."minQuantity" > 0 AND i."quantity" <= i."minQuantity"
        ORDER BY i."quantity" ASC
        LIMIT 5
      `,
      // Несколько последних заявок, ожидающих решения руководителя
      prisma.ticket.findMany({
        where: { status: 'WAITING_FOR_PURCHASE' },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        include: {
          category: { select: { name: true } },
          parts: { select: { price: true, requiredQuantity: true } },
        },
      }),
      // Срочные открытые заявки (ещё не закрытые/не отменённые)
      prisma.ticket.count({
        where: { priority: 'HIGH', status: { notIn: ['COMPLETED', 'CANCELED'] } },
      }),
    ]);

  const estimateTotal = estimateParts.reduce((sum, p) => sum + p.price * p.requiredQuantity, 0);

  return c.json({
    totalTickets,
    newTickets,
    inProgressTickets,
    waitingTickets,
    completedTickets,
    totalUsers,
    lowStockCount: Number((lowStockCount as any[])[0]?.count ?? 0),
    estimateTotal,
    urgentOpenTickets,
    lowStockItems,
    pendingReviews: pendingReviews.map(t => ({
      id: t.id,
      description: t.description,
      category: t.category.name,
      priority: t.priority,
      total: t.parts.reduce((sum, p) => sum + p.price * p.requiredQuantity, 0),
    })),
  });
});

// ─── 2. ЗАЯВКИ НА РАССМОТРЕНИИ (WAITING_FOR_PURCHASE) ────────────────────────
// GET /manager/review

const getReviewTicketsRoute = createRoute({
  method: 'get', path: '/review',
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: 'Заявки на рассмотрении', content: { 'application/json': { schema: z.array(TicketSchema) } } } },
});

managerRouter.openapi(getReviewTicketsRoute, async (c) => {
  const tickets = await prisma.ticket.findMany({
    where: { status: 'WAITING_FOR_PURCHASE' },
    orderBy: { updatedAt: 'desc' },
    include: {
      category: true,
      executor: { select: { fullName: true } },
      initiator: { select: { fullName: true } },
      parts: {
        include: { nomenclature: { include: { unit: true } } },
      },
    },
  });
  // срочные заявки — первыми
  return c.json(sortByPriority(tickets));
});

// ─── 3. ОДОБРИТЬ / ОТКЛОНИТЬ ПОЗИЦИИ ЗАЯВКИ ─────────────────────────────────
// PATCH /manager/review/:ticketId/approve

const approvePartsRoute = createRoute({
  method: 'patch', path: '/review/:ticketId/approve',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ ticketId: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            approvedPartIds: z.array(z.number()), // id из ticket_parts которые одобряем
          }),
        },
      },
    },
  },
  responses: { 200: { description: 'Одобрено', content: { 'application/json': { schema: OkSchema } } } },
});

managerRouter.openapi(approvePartsRoute, async (c) => {
  const { ticketId } = c.req.valid('param');
  const { approvedPartIds } = c.req.valid('json');
  const id = Number(ticketId);

  // Одобряем выбранные позиции, снимаем галочку с остальных
  await prisma.$transaction([
    prisma.ticketPart.updateMany({
      where: { ticketId: id, id: { in: approvedPartIds } },
      data: { isApproved: true },
    }),
    prisma.ticketPart.updateMany({
      where: { ticketId: id, id: { notIn: approvedPartIds } },
      data: { isApproved: false },
    }),
    // Возвращаем заявку в IN_PROGRESS
    prisma.ticket.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
    }),
  ]);

  return c.json({ ok: true });
});

// ─── 3.1 ИЗМЕНИТЬ ЦЕНУ ПОЗИЦИИ ЗАЯВКИ ────────────────────────────────────────
// PATCH /manager/parts/:partId/price

const updatePartPriceRoute = createRoute({
  method: 'patch', path: '/parts/:partId/price',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ partId: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({ price: z.number().min(0), updateNomenclaturePrice: z.boolean().optional() }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Цена обновлена', content: { 'application/json': { schema: PartPriceUpdateSchema } } },
    404: { description: 'Позиция не найдена', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
  },
});

managerRouter.openapi(updatePartPriceRoute, async (c) => {
  const { partId } = c.req.valid('param');
  const { price, updateNomenclaturePrice } = c.req.valid('json');
  const id = Number(partId);

  const part = await prisma.ticketPart.findUnique({ where: { id }, include: { nomenclature: true } });
  if (!part) {
    return c.json({ error: 'Позиция не найдена' }, 404 as const);
  }

  // Если указанная цена расходится с актуальной ценой в справочнике номенклатуры, то
  // фронт может предложить редактору зафиксировать её как новую цену справочника
  const priceDiffers = price !== part.nomenclature.price;

  const updated = await prisma.ticketPart.update({ where: { id }, data: { price } });

  if (updateNomenclaturePrice) {
    await prisma.nomenclature.update({ where: { id: part.nomenclatureId }, data: { price } });
  }

  return c.json({ ...updated, priceDiffers, nomenclaturePrice: part.nomenclature.price }, 200 as const);
});

// ─── 4. СВОДНАЯ СМЕТА (все одобренные позиции) ───────────────────────────────
// GET /manager/estimate

const getEstimateRoute = createRoute({
  method: 'get', path: '/estimate',
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: 'Сводная смета', content: { 'application/json': { schema: z.array(EstimatePartSchema) } } } },
});

managerRouter.openapi(getEstimateRoute, async (c) => {
  const parts = await prisma.ticketPart.findMany({
    // Позиции завершённых/отменённых заявок уже закуплены (или не нужны), в смету их не включаем
    where: { isApproved: true, ticket: { status: { notIn: ['COMPLETED', 'CANCELED'] } } },
    include: {
      nomenclature: { include: { unit: true } },
      ticket: { select: { id: true, description: true } },
    },
    orderBy: { nomenclature: { name: 'asc' } },
  });
  return c.json(parts);
});

// ─── 4.1 ИСТОРИЯ ЦЕН ПО НОМЕНКЛАТУРЕ ──────────────────────────────────────────
// GET /manager/price-history

const getPriceHistoryRoute = createRoute({
  method: 'get', path: '/price-history',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      search: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
  },
  responses: { 200: { description: 'История цен по номенклатуре', content: { 'application/json': { schema: PriceHistoryResponseSchema } } } },
});

managerRouter.openapi(getPriceHistoryRoute, async (c) => {
  const { search, dateFrom, dateTo, page, limit } = c.req.valid('query');

  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
  const from = dateFrom ? new Date(dateFrom) : null;
  // Конец дня, чтобы дата до включала весь указанный день
  const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
  const inRange = (date: Date) => (!from || date >= from) && (!to || date <= to);

  const items = await prisma.nomenclature.findMany({
    where: search ? { name: { contains: search } } : undefined,
    include: {
      unit: true,
      // Записи с нулевой ценой не несут информации
      ticketParts: {
        where: { price: { gt: 0 } },
        include: { ticket: { select: { id: true, createdAt: true } } },
      },
      writeOffs: {
        where: { price: { gt: 0 } },
        select: { ticketId: true, price: true, createdAt: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const filtered = items
    .map(item => {
      const history = [
        ...item.ticketParts.map(p => ({
          date: p.ticket.createdAt,
          price: p.price,
          source: 'purchase' as const,
          ticketId: p.ticket.id,
        })),
        ...item.writeOffs.map(w => ({
          date: w.createdAt,
          price: w.price,
          source: 'writeoff' as const,
          ticketId: w.ticketId,
        })),
      ]
        .filter(h => inRange(h.date))
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      return {
        id: item.id,
        name: item.name,
        unit: item.unit.shortName,
        currentPrice: item.price,
        history,
      };
    })
    .filter(item => item.history.length > 0);

  const total = filtered.length;
  const start = (pageNum - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  return c.json({ items: pageItems, total, page: pageNum, pageSize });
});

// ─── 5. СКЛАД (inventories + nomenclature + warehouse) ───────────────────────
// GET /manager/warehouse

const getWarehouseRoute = createRoute({
  method: 'get', path: '/warehouse',
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: 'Складские остатки', content: { 'application/json': { schema: z.array(InventorySchema) } } } },
});

managerRouter.openapi(getWarehouseRoute, async (c) => {
  const items = await prisma.inventory.findMany({
    include: {
      nomenclature: { include: { unit: true } },
      warehouse: true,
    },
    orderBy: { nomenclature: { name: 'asc' } },
  });
  return c.json(items);
});

// ─── 5.1 ОТЧЁТ ПО РАСХОДУ СКЛАДА (списания за период) ────────────────────────
// GET /manager/consumption-report?dateFrom=&dateTo=

const getConsumptionReportRoute = createRoute({
  method: 'get', path: '/consumption-report',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      building: z.string().optional(), // фильтр по корпусу
    }),
  },
  responses: { 200: { description: 'Расход склада за период', content: { 'application/json': { schema: ConsumptionReportSchema } } } },
});

managerRouter.openapi(getConsumptionReportRoute, async (c) => {
  const { dateFrom, dateTo, building } = c.req.valid('query');

  const from = dateFrom ? new Date(dateFrom) : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
  const buildingNum = building ? Number(building) : null;

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = from;
  if (to) dateFilter.lte = to;

  const where: any = {};
  if (from || to) where.createdAt = dateFilter;
  // списания того склада, который относится к выбранному корпусу
  if (buildingNum) where.warehouse = { building: buildingNum };

  const writeOffs = await prisma.stockWriteOff.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    include: {
      nomenclature: { include: { unit: true } },
      ticket: { select: { id: true, description: true } },
      warehouse: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Группировка по позициям: какие позиции и сколько списано, с разрезом по заявкам
  const byNomenclatureMap = new Map<number, {
    nomenclatureId: number; name: string; article: string | null; unit: string;
    quantity: number;
    tickets: { ticketId: number; description: string; quantity: number; date: Date; warehouse: string }[];
  }>();

  // Группировка по заявкам: какая заявка сколько израсходовала, с разрезом по позициям
  const byTicketMap = new Map<number, {
    ticketId: number; description: string;
    items: { nomenclatureId: number; name: string; unit: string; quantity: number; date: Date; warehouse: string }[];
  }>();

  for (const w of writeOffs) {
    const unit = w.nomenclature.unit.shortName;

    // — по позициям —
    let nom = byNomenclatureMap.get(w.nomenclatureId);
    if (!nom) {
      nom = {
        nomenclatureId: w.nomenclatureId, name: w.nomenclature.name, article: w.nomenclature.article,
        unit, quantity: 0, tickets: [],
      };
      byNomenclatureMap.set(w.nomenclatureId, nom);
    }
    nom.quantity += w.quantity;
    nom.tickets.push({ ticketId: w.ticketId, description: w.ticket.description, quantity: w.quantity, date: w.createdAt, warehouse: w.warehouse.name });

    // — по заявкам —
    let tk = byTicketMap.get(w.ticketId);
    if (!tk) {
      tk = { ticketId: w.ticketId, description: w.ticket.description, items: [] };
      byTicketMap.set(w.ticketId, tk);
    }
    tk.items.push({ nomenclatureId: w.nomenclatureId, name: w.nomenclature.name, unit, quantity: w.quantity, date: w.createdAt, warehouse: w.warehouse.name });
  }

  // По позициям - по убыванию списанного количества; по заявкам - свежие сверху
  const byNomenclature = Array.from(byNomenclatureMap.values()).sort((a, b) => b.quantity - a.quantity);
  const byTicket = Array.from(byTicketMap.values()).sort((a, b) => b.ticketId - a.ticketId);

  return c.json({
    totalWriteOffs: writeOffs.length,
    positionsCount: byNomenclature.length,
    ticketsCount: byTicket.length,
    byNomenclature,
    byTicket,
  });
});

// ─── 6. ПРИХОД ТОВАРА (увеличить quantity) ────────────────────────────────────
// PATCH /manager/warehouse/:inventoryId/receive

const receiveGoodsRoute = createRoute({
  method: 'patch', path: '/warehouse/:inventoryId/receive',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ inventoryId: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({ quantity: z.number().min(1) }),
        },
      },
    },
  },
  responses: { 200: { description: 'Обновлено', content: { 'application/json': { schema: InventorySchema } } } },
});

managerRouter.openapi(receiveGoodsRoute, async (c) => {
  const { inventoryId } = c.req.valid('param');
  const { quantity } = c.req.valid('json');

  const updated = await prisma.inventory.update({
    where: { id: Number(inventoryId) },
    data: { quantity: { increment: quantity } },
    include: { nomenclature: { include: { unit: true } }, warehouse: true },
  });

  return c.json(updated);
});

// ─── 7. СОТРУДНИКИ с нагрузкой ────────────────────────────────────────────────
// GET /manager/staff

const getStaffRoute = createRoute({
  method: 'get', path: '/staff',
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: 'Сотрудники', content: { 'application/json': { schema: z.array(StaffMemberSchema) } } } },
});

managerRouter.openapi(getStaffRoute, async (c) => {
  const staff = await prisma.user.findMany({
    where: { role: 'EXECUTOR' },
    include: {
      position: true,
      department: true,
      executedTickets: {
        select: { id: true, status: true, createdAt: true },
      },
    },
    orderBy: { fullName: 'asc' },
  });

  // считаем нагрузку на JS стороне
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const result = staff.map(u => ({
    id: u.id,
    fullName: u.fullName,
    position: u.position?.name ?? '—',
    department: u.department?.name ?? '—',
    building: u.building,
    activeTasks: u.executedTickets.filter(t =>
      t.status === 'IN_PROGRESS' || t.status === 'NEW'
    ).length,
    closedThisMonth: u.executedTickets.filter(t =>
      t.status === 'COMPLETED' && new Date(t.createdAt) >= startOfMonth
    ).length,
    totalClosed: u.executedTickets.filter(t => t.status === 'COMPLETED').length,
  }));

  return c.json(result);
});

// ─── 7.1 ОТЧЁТ ПО СОТРУДНИКАМ (завершено / отклонено / время) ────────────────
// GET /manager/staff-report?dateFrom=&dateTo=

const getStaffReportRoute = createRoute({
  method: 'get', path: '/staff-report',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }),
  },
  responses: { 200: { description: 'Отчёт по сотрудникам', content: { 'application/json': { schema: StaffReportSchema } } } },
});

managerRouter.openapi(getStaffReportRoute, async (c) => {
  const { dateFrom, dateTo } = c.req.valid('query');
  const from = dateFrom ? new Date(dateFrom) : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
  const inRange = (d: Date) => (!from || d >= from) && (!to || d <= to);

  const executors = await prisma.user.findMany({
    where: { role: 'EXECUTOR' },
    include: { position: true },
    orderBy: { fullName: 'asc' },
  });

  const histories = await prisma.ticketHistory.findMany({
    include: {
      ticket: { select: { id: true, description: true, category: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Извлекаем события завершения/отклонения и время решения (чистая логика в ../lib/reports.js)
  const events = extractWorkEvents(histories);

  const execMap = new Map<number, {
    id: number; fullName: string; position: string;
    completedCount: number; rejectedCount: number; totalTimeMs: number; timedCount: number;
    tickets: { ticketId: number; description: string; category: string; type: 'completed' | 'rejected'; date: Date; durationMs: number | null }[];
  }>();
  for (const u of executors) {
    execMap.set(u.id, {
      id: u.id, fullName: u.fullName, position: u.position?.name ?? '—',
      completedCount: 0, rejectedCount: 0, totalTimeMs: 0, timedCount: 0, tickets: [],
    });
  }

  let totalCompleted = 0, totalRejected = 0, overallTimeMs = 0, overallTimedCount = 0;
  for (const e of events) {
    if (!inRange(e.date)) continue;
    const acc = execMap.get(e.executorId);
    if (!acc) continue; // событие не от исполнителя пропускаем
    if (e.type === 'completed') {
      acc.completedCount++; totalCompleted++;
      if (e.durationMs != null) { acc.totalTimeMs += e.durationMs; acc.timedCount++; overallTimeMs += e.durationMs; overallTimedCount++; }
    } else {
      acc.rejectedCount++; totalRejected++;
    }
    acc.tickets.push({ ticketId: e.ticketId, description: e.description, category: e.category, type: e.type, date: e.date, durationMs: e.durationMs });
  }

  const staff = Array.from(execMap.values())
    .map(a => ({
      id: a.id, fullName: a.fullName, position: a.position,
      completedCount: a.completedCount, rejectedCount: a.rejectedCount,
      avgTimeMs: a.timedCount > 0 ? Math.round(a.totalTimeMs / a.timedCount) : null,
      totalTimeMs: a.totalTimeMs,
      tickets: a.tickets.sort((x, y) => y.date.getTime() - x.date.getTime()),
    }))
    .sort((a, b) => b.completedCount - a.completedCount || b.rejectedCount - a.rejectedCount);

  return c.json({
    totalCompleted,
    totalRejected,
    overallAvgTimeMs: overallTimedCount > 0 ? Math.round(overallTimeMs / overallTimedCount) : null,
    staff,
  });
});

// PATCH /manager/staff/:id/building закрепить сотрудника за корпусом
const updateStaffBuildingRoute = createRoute({
  method: 'patch', path: '/staff/:id/building',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({ building: z.union([z.literal(1), z.literal(2), z.null()]) }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Обновлено', content: { 'application/json': { schema: StaffBuildingSchema } } },
    404: { description: 'Сотрудник не найден', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
  },
});

managerRouter.openapi(updateStaffBuildingRoute, async (c) => {
  const { id } = c.req.valid('param');
  const { building } = c.req.valid('json');

  const user = await prisma.user.findUnique({ where: { id: Number(id) } });
  if (!user || user.role !== 'EXECUTOR') {
    return c.json({ error: 'Сотрудник не найден' }, 404 as const);
  }

  const updated = await prisma.user.update({
    where: { id: Number(id) },
    data: { building },
  });

  return c.json({ id: updated.id, building: updated.building }, 200 as const);
});

// PATCH /manager/review/:ticketId/reject отклонить закупку
const rejectPurchaseRoute = createRoute({
  method: 'patch', path: '/review/:ticketId/reject',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ ticketId: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({ comment: z.string().optional() }),
        },
      },
    },
  },
  responses: { 200: { description: 'Отклонено', content: { 'application/json': { schema: OkSchema } } } },
});

managerRouter.openapi(rejectPurchaseRoute, async (c) => {
  const { ticketId } = c.req.valid('param');
  const { comment } = c.req.valid('json');
  const payload = c.get('jwtPayload') as { sub: number };
  const id = Number(ticketId);

  await prisma.$transaction([
    prisma.ticket.update({ where: { id }, data: { status: 'IN_PROGRESS' } }),
    prisma.ticketHistory.create({
      data: {
        ticketId: id,
        changedById: payload.sub,
        oldStatus: 'WAITING_FOR_PURCHASE',
        newStatus: 'IN_PROGRESS',
        comment: comment ?? 'Закупка отклонена руководителем',
      },
    }),
  ]);

  return c.json({ ok: true });
});

// POST /manager/warehouse добавить новую позицию на склад
const addInventoryRoute = createRoute({
  method: 'post', path: '/warehouse',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            warehouseId: z.number(),
            nomenclatureId: z.number(),
            quantity: z.number().min(0),
            minQuantity: z.number().min(0),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: 'Добавлено', content: { 'application/json': { schema: InventorySchema } } },
    404: { description: 'Склад или номенклатура не найдены', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
  },
});

managerRouter.openapi(addInventoryRoute, async (c) => {
  const data = c.req.valid('json');

  const [warehouse, nomenclature] = await Promise.all([
    prisma.warehouse.findUnique({ where: { id: data.warehouseId } }),
    prisma.nomenclature.findUnique({ where: { id: data.nomenclatureId } }),
  ]);

  if (!warehouse) {
    return c.json({ error: 'Склад не найден' }, 404 as const);
  }
  if (!nomenclature) {
    return c.json({ error: 'Позиция номенклатуры не найдена' }, 404 as const);
  }

  const item = await prisma.inventory.upsert({
    where: { warehouseId_nomenclatureId: { warehouseId: data.warehouseId, nomenclatureId: data.nomenclatureId } },
    update: { quantity: { increment: data.quantity }, minQuantity: data.minQuantity },
    create: data,
    include: { nomenclature: { include: { unit: true } }, warehouse: true },
  });

  return c.json(item, 201 as const);
});