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

// Проверяет, не пора ли вернуть в работу заявки, ожидающие поступления детали.
// Вызывается после любого пополнения склада (приход на существующую позицию или
// добавление новой). Ищет заявки в статусе WAITING_FOR_PURCHASE с одобренной
// позицией указанной номенклатуры; если ВСЕ одобренные позиции заявки есть на
// складе в нужном количестве — списывает их под заявку и возвращает её в работу.
async function returnTicketsToWorkForNomenclature(nomenclatureId: number, managerId: number) {
  const affectedTickets = await prisma.ticket.findMany({
    where: {
      status: 'WAITING_FOR_PURCHASE',
      parts: { some: { isApproved: true, nomenclatureId } },
    },
    include: { parts: { where: { isApproved: true } } },
  });

  for (const ticket of affectedTickets) {
    const neededIds = ticket.parts.map(p => p.nomenclatureId);

    // Суммируем остатки по каждой нужной номенклатуре across всех складов
    const stocks = await prisma.inventory.groupBy({
      by: ['nomenclatureId'],
      where: { nomenclatureId: { in: neededIds } },
      _sum: { quantity: true },
    });
    const stockMap = new Map(stocks.map(s => [s.nomenclatureId, s._sum.quantity ?? 0]));

    // Возвращаем в работу только если ALL одобренных позиций достаточно на складе
    const allAvailable = ticket.parts.every(
      p => (stockMap.get(p.nomenclatureId) ?? 0) >= p.requiredQuantity,
    );
    if (!allAvailable) continue;

    // Списываем одобренные позиции со склада под эту заявку, чтобы они не ушли
    // на другую заявку до того, как исполнитель их заберёт. Берём порциями
    // (один склад может не покрыть всё количество).
    for (const part of ticket.parts) {
      let remaining = part.requiredQuantity;
      const inventories = await prisma.inventory.findMany({
        where: { nomenclatureId: part.nomenclatureId, quantity: { gt: 0 } },
        orderBy: { quantity: 'desc' },
      });
      for (const inv of inventories) {
        if (remaining <= 0) break;
        const toTake = Math.min(remaining, inv.quantity);
        await prisma.$transaction([
          prisma.inventory.update({
            where: { id: inv.id },
            data: { quantity: { decrement: toTake } },
          }),
          prisma.stockWriteOff.create({
            data: {
              ticketId: ticket.id,
              nomenclatureId: part.nomenclatureId,
              warehouseId: inv.warehouseId,
              quantity: toTake,
              price: part.price,
              writtenOffById: managerId,
            },
          }),
        ]);
        remaining -= toTake;
      }
    }

    await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'IN_PROGRESS' },
      }),
      prisma.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          changedById: managerId,
          oldStatus: 'WAITING_FOR_PURCHASE',
          newStatus: 'IN_PROGRESS',
          comment: 'Заявка возвращена в работу автоматически. Необходимые детали поступили на склад',
        },
      }),
    ]);
  }
}

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
  const payload = c.get('jwtPayload') as { sub: number };

  // Одобряем выбранные позиции, снимаем галочку с остальных.
  // Статус заявки остаётся WAITING_FOR_PURCHASE — вернётся в IN_PROGRESS автоматически,
  // когда руководитель оприходует необходимые детали на склад.
  await prisma.$transaction([
    prisma.ticketPart.updateMany({
      where: { ticketId: id, id: { in: approvedPartIds } },
      data: { isApproved: true },
    }),
    prisma.ticketPart.updateMany({
      where: { ticketId: id, id: { notIn: approvedPartIds } },
      data: { isApproved: false },
    }),
  ]);

  // Если все одобренные детали уже есть на складе (закупка не требуется) —
  // возвращаем заявку в работу сразу, не дожидаясь нового прихода.
  const approvedParts = await prisma.ticketPart.findMany({
    where: { ticketId: id, id: { in: approvedPartIds } },
    select: { nomenclatureId: true },
  });
  for (const nomId of new Set(approvedParts.map(p => p.nomenclatureId))) {
    await returnTicketsToWorkForNomenclature(nomId, payload.sub);
  }

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

// ─── 3.2 ИЗМЕНИТЬ КОЛИЧЕСТВО ПОЗИЦИИ ─────────────────────────────────────────
// PATCH /manager/parts/:partId/quantity
const updatePartQuantityRoute = createRoute({
  method: 'patch', path: '/parts/:partId/quantity',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ partId: z.string() }),
    body: {
      content: { 'application/json': { schema: z.object({ requiredQuantity: z.number().int().min(1) }) } },
    },
  },
  responses: {
    200: { description: 'Количество обновлено', content: { 'application/json': { schema: EstimatePartSchema } } },
    404: { description: 'Позиция не найдена', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
  },
});

managerRouter.openapi(updatePartQuantityRoute, async (c) => {
  const { partId } = c.req.valid('param');
  const { requiredQuantity } = c.req.valid('json');
  const id = Number(partId);

  const part = await prisma.ticketPart.findUnique({ where: { id } });
  if (!part) {
    return c.json({ error: 'Позиция не найдена' }, 404 as const);
  }

  const updated = await prisma.ticketPart.update({
    where: { id },
    data: { requiredQuantity },
    include: { nomenclature: { include: { unit: true } }, ticket: { select: { id: true, description: true } } },
  });
  return c.json(updated, 200 as const);
});

// ─── 3.3 УДАЛИТЬ ПОЗИЦИЮ ИЗ СМЕТЫ ────────────────────────────────────────────
// DELETE /manager/parts/:partId
const deletePartRoute = createRoute({
  method: 'delete', path: '/parts/:partId',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ partId: z.string() }) },
  responses: {
    200: { description: 'Удалено', content: { 'application/json': { schema: OkSchema } } },
    404: { description: 'Позиция не найдена', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
  },
});

managerRouter.openapi(deletePartRoute, async (c) => {
  const { partId } = c.req.valid('param');
  const id = Number(partId);

  const part = await prisma.ticketPart.findUnique({ where: { id } });
  if (!part) {
    return c.json({ error: 'Позиция не найдена' }, 404 as const);
  }

  await prisma.ticketPart.delete({ where: { id } });
  return c.json({ ok: true }, 200 as const);
});

// ─── 3.4 ДОБАВИТЬ ПОЗИЦИЮ В СМЕТУ ЗАЯВКИ ─────────────────────────────────────
// POST /manager/tickets/:ticketId/parts
const addPartRoute = createRoute({
  method: 'post', path: '/tickets/:ticketId/parts',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ ticketId: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({ nomenclatureId: z.number(), requiredQuantity: z.number().int().min(1) }),
        },
      },
    },
  },
  responses: {
    201: { description: 'Добавлено', content: { 'application/json': { schema: EstimatePartSchema } } },
    404: { description: 'Заявка или номенклатура не найдены', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
  },
});

managerRouter.openapi(addPartRoute, async (c) => {
  const { ticketId } = c.req.valid('param');
  const { nomenclatureId, requiredQuantity } = c.req.valid('json');
  const id = Number(ticketId);

  const [ticket, nomenclature] = await Promise.all([
    prisma.ticket.findUnique({ where: { id } }),
    prisma.nomenclature.findUnique({ where: { id: nomenclatureId } }),
  ]);
  if (!ticket) {
    return c.json({ error: 'Заявка не найдена' }, 404 as const);
  }
  if (!nomenclature) {
    return c.json({ error: 'Позиция номенклатуры не найдена' }, 404 as const);
  }

  // Если такая позиция уже есть в заявке — увеличиваем количество, иначе создаём.
  const part = await prisma.ticketPart.upsert({
    where: { ticketId_nomenclatureId: { ticketId: id, nomenclatureId } },
    update: { requiredQuantity: { increment: requiredQuantity } },
    create: { ticketId: id, nomenclatureId, requiredQuantity, price: nomenclature.price, isApproved: false },
    include: { nomenclature: { include: { unit: true } }, ticket: { select: { id: true, description: true } } },
  });
  return c.json(part, 201 as const);
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
    // В смету попадают только одобренные позиции заявок, реально ожидающих закупку.
    // Как только детали поступают на склад, заявка переходит в IN_PROGRESS и её позиции
    // (уже закупленные) автоматически уходят из сметы.
    where: { isApproved: true, ticket: { status: 'WAITING_FOR_PURCHASE' } },
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

// GET /manager/warehouses — список складов (для выбора при добавлении позиций)
const getWarehousesRoute = createRoute({
  method: 'get', path: '/warehouses',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Список складов',
      content: { 'application/json': { schema: z.array(z.object({ id: z.number(), name: z.string(), building: z.number().nullable() })) } },
    },
  },
});

managerRouter.openapi(getWarehousesRoute, async (c) => {
  const warehouses = await prisma.warehouse.findMany({ orderBy: { id: 'asc' } });
  return c.json(warehouses);
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
  const payload = c.get('jwtPayload') as { sub: number };

  const updated = await prisma.inventory.update({
    where: { id: Number(inventoryId) },
    data: { quantity: { increment: quantity } },
    include: { nomenclature: { include: { unit: true } }, warehouse: true },
  });

  // После прихода товара проверяем, не пора ли вернуть заявки в работу
  await returnTicketsToWorkForNomenclature(updated.nomenclatureId, payload.sub);

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
  const payload = c.get('jwtPayload') as { sub: number };

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

  // Пополнение склада могло закрыть потребность заявки, ожидающей закупку
  await returnTicketsToWorkForNomenclature(data.nomenclatureId, payload.sub);

  return c.json(item, 201 as const);
});