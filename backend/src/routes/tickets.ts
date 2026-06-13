// backend/src/routes/tickets.ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { prisma } from '../lib/client.js';
import { jwt } from 'hono/jwt';
import { getJwtSecret } from '../lib/jwt.js';
import { CreateTicketSchema, UpdateStatusSchema, UpdatePrioritySchema, ConfirmPartsSchema } from '../lib/validation.js';
import { sortByPriority, positionCategoryMap } from '../lib/reports.js';
import { TicketSchema, TicketPrioritySchema, TicketHistoryEntrySchema, PartCheckResponseSchema } from '../lib/responseSchemas.js';

export const ticketsRouter = new OpenAPIHono();

// ошибка бизнес-логики с HTTP-статусом пробрасывается из транзакции и маппится в ответ
class AppError extends Error {
  constructor(message: string, public status: 404 | 409) {
    super(message);
  }
}

// Все руты требуют валидный JWT-токен
ticketsRouter.use('/*', (c, next) => {
  const secret = getJwtSecret();
  return jwt({ secret, alg: 'HS256' })(c, next);
});

const createTicketRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Tickets'],
  description: 'Создание новой заявки инициатором',
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: CreateTicketSchema } } },
  },
  responses: {
    201: {
      description: 'Успешно создано',
      content: { 'application/json': { schema: z.object({ message: z.string(), ticketId: z.number() }) } },
    },
    400: { description: 'Ошибка валидации' },
    401: { description: 'Не авторизован (нет токена)' },
  },
});

const getMyTicketsRoute = createRoute({
  method: 'get',
  path: '/my',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Список моих заявок',
      content: { 'application/json': { schema: z.array(TicketSchema) } },
    },
  },
});

ticketsRouter.openapi(getMyTicketsRoute, async (c) => {
  const payload = c.get('jwtPayload') as { sub: number };

  const tickets = await prisma.ticket.findMany({
    where: { initiatorId: payload.sub },
    orderBy: { createdAt: 'desc' },
    include: { category: true },
  });

  return c.json(tickets);
});

ticketsRouter.openapi(createTicketRoute, async (c) => {
  const { categoryName, room, description, building, priority } = c.req.valid('json');
  const payload = c.get('jwtPayload') as { sub: number };

  const category = await prisma.category.findUnique({ where: { name: categoryName } });
  if (!category) {
    return c.json({ error: 'Категория не найдена' }, 400 as const);
  }

  const ticket = await prisma.ticket.create({
    data: {
      description,
      room,
      building,
      categoryId: category.id,
      initiatorId: payload.sub,
      status: 'NEW',
      priority: priority ?? 'NORMAL',
    },
  });

  return c.json({ message: 'Заявка успешно создана', ticketId: ticket.id }, 201 as const);
});

// GET /tickets/executor заявки для исполнителя по его должности
const getExecutorTicketsRoute = createRoute({
  method: 'get',
  path: '/executor',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Заявки по категориям должности',
      content: { 'application/json': { schema: z.array(TicketSchema) } },
    },
  },
});

ticketsRouter.openapi(getExecutorTicketsRoute, async (c) => {
  const payload = c.get('jwtPayload') as { sub: number };

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { position: true },
  });

  const positionName = user?.position?.name ?? '';
  const allowedCategories = positionCategoryMap[positionName] ?? [];

  // Если должность не в маппинге, то возвращаем все заявки (для менеджера/админа)
  const tickets = await prisma.ticket.findMany({
    where: {
      ...(allowedCategories.length > 0
        ? { category: { name: { in: allowedCategories } } }
        : {}),
      // Если за сотрудником закреплён конкретный корпус, то показываем только его заявки
      ...(user?.building ? { building: user.building } : {}),
      // Отклонённые (отменённые) заявки на доску исполнителя не возвращаем
      NOT: { status: 'CANCELED' },
      // Заявка либо ещё свободна (не взята в работу), либо уже взята именно этим сотрудником
      OR: [
        { status: 'NEW' },
        { executorId: payload.sub },
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      category: true,
      initiator: { select: { fullName: true } },
      // Ранее запрошенные, но ещё не одобренные руководителем позиции
      // используются, чтобы предложить исполнителю те же детали при возврате заявки в работу
      parts: {
        where: { isApproved: false },
        include: { nomenclature: { include: { unit: true } } },
      },
    },
  });

  // Срочные заявки идут первыми (внутри одинаковой срочности сохраняется порядок по дате)
  return c.json(sortByPriority(tickets));
});

// PATCH /tickets/:id/priority смена срочности заявки исполнителем/руководителем
const updatePriorityRoute = createRoute({
  method: 'patch',
  path: '/{id}/priority',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().openapi({ example: '15' }) }),
    body: {
      content: {
        'application/json': {
          schema: UpdatePrioritySchema,
        },
      },
    },
  },
  responses: {
    200: { description: 'Срочность обновлена', content: { 'application/json': { schema: TicketPrioritySchema } } },
    403: { description: 'Недостаточно прав' },
    404: { description: 'Заявка не найдена' },
  },
});

ticketsRouter.openapi(updatePriorityRoute, async (c) => {
  const payload = c.get('jwtPayload') as { sub: number; role: string };
  if (payload.role !== 'EXECUTOR' && payload.role !== 'MANAGER') {
    return c.json({ error: 'Менять срочность может только исполнитель или руководитель' }, 403 as const);
  }

  const { id: idParam } = c.req.valid('param');
  const id = Number(idParam);
  const { priority } = c.req.valid('json');

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    return c.json({ error: 'Заявка не найдена' }, 404 as const);
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: { priority },
    select: { id: true, priority: true },
  });

  return c.json(updated, 200 as const);
});

// PATCH /tickets/:id/status смена статуса заявки
const updateStatusRoute = createRoute({
  method: 'patch',
  path: '/{id}/status',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().openapi({ example: '15' }) }),
    body: {
      content: {
        'application/json': {
          schema: UpdateStatusSchema,
        },
      },
    },
  },
  responses: {
    200: { description: 'Статус обновлён' },
    403: { description: 'Доступ запрещен' },
    404: { description: 'Заявка не найдена' },
  },
});

ticketsRouter.openapi(updateStatusRoute, async (c) => {
  const { id } = c.req.valid('param');
  const { status, comment } = c.req.valid('json');
  const payload = c.get('jwtPayload') as { sub: number, role: string };

  // Менять статус заявки могут исполнители (только свои заявки) и руководитель
  if (payload.role !== 'EXECUTOR' && payload.role !== 'MANAGER') {
    return c.json({ error: 'Изменять статус может только IT-специалист или руководитель' }, 403 as const);
  }

  const ticketId = Number(id);
  const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!existing) {
    return c.json({ error: 'Заявка не найдена' }, 404 as const);
  }

  // Исполнитель может менять только свои заявки или брать в работу пока не закреплённые
  const isOwnerOrUnassigned = existing.executorId === null || existing.executorId === payload.sub;
  if (payload.role === 'EXECUTOR' && !isOwnerOrUnassigned) {
    return c.json({ error: 'Заявка закреплена за другим исполнителем' }, 403 as const);
  }

  const [, ticket] = await prisma.$transaction([
    prisma.ticketHistory.create({
      data: {
        ticketId,
        changedById: payload.sub,
        oldStatus: existing.status,
        newStatus: status,
        comment: comment ?? null,
      },
    }),
    prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status,
        executorId: status === 'IN_PROGRESS' && payload.role === 'EXECUTOR' ? payload.sub : undefined,
      },
    }),
  ]);

  return c.json(ticket, 200 as const);
});

// PATCH /tickets/:id/reopen инициатор сообщает, что проблема не решена
const reopenTicketRoute = createRoute({
  method: 'patch',
  path: '/{id}/reopen',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().openapi({ example: '15' }) }),
    body: {
      content: {
        'application/json': {
          schema: z.object({ comment: z.string().min(5, 'Опишите проблему подробнее') }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Заявка возвращена в работу' },
    403: { description: 'Доступ запрещен' },
    404: { description: 'Заявка не найдена' },
  },
});

ticketsRouter.openapi(reopenTicketRoute, async (c) => {
  const { id } = c.req.valid('param');
  const { comment } = c.req.valid('json');
  const payload = c.get('jwtPayload') as { sub: number };
  const ticketId = Number(id);

  const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!existing) {
    return c.json({ error: 'Заявка не найдена' }, 404 as const);
  }

  // Только инициатор заявки может сообщить, что проблема не решена
  if (existing.initiatorId !== payload.sub) {
    return c.json({ error: 'Доступно только автору заявки' }, 403 as const);
  }

  if (existing.status !== 'COMPLETED') {
    return c.json({ error: 'Вернуть в работу можно только выполненную заявку' }, 403 as const);
  }

  const [, ticket] = await prisma.$transaction([
    prisma.ticketHistory.create({
      data: {
        ticketId,
        changedById: payload.sub,
        oldStatus: existing.status,
        newStatus: 'IN_PROGRESS',
        comment: `Проблема не решена: ${comment}`,
      },
    }),
    prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'IN_PROGRESS' },
    }),
  ]);

  return c.json(ticket, 200 as const);
});

// GET /tickets/:id/history переписка/история по заявке (для инициатора, исполнителя и руководителя)
const getTicketHistoryRoute = createRoute({
  method: 'get',
  path: '/{id}/history',
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().openapi({ example: '15' }) }) },
  responses: {
    200: { description: 'История заявки', content: { 'application/json': { schema: z.array(TicketHistoryEntrySchema) } } },
    403: { description: 'Доступ запрещён' },
    404: { description: 'Заявка не найдена' },
  },
});

ticketsRouter.openapi(getTicketHistoryRoute, async (c) => {
  const { id } = c.req.valid('param');
  const payload = c.get('jwtPayload') as { sub: number; role: string };
  const ticketId = Number(id);

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    return c.json({ error: 'Заявка не найдена' }, 404 as const);
  }

  // Доступ только участникам заявки: её автору, назначенному исполнителю или руководителю
  const isParticipant =
    ticket.initiatorId === payload.sub ||
    ticket.executorId === payload.sub ||
    payload.role === 'MANAGER';
  if (!isParticipant) {
    return c.json({ error: 'Нет доступа к этой заявке' }, 403 as const);
  }

  const history = await prisma.ticketHistory.findMany({
    where: { ticketId },
    include: { changedBy: { select: { fullName: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return c.json(history.map(h => ({
    id: h.id,
    oldStatus: h.oldStatus,
    newStatus: h.newStatus,
    comment: h.comment,
    date: h.createdAt,
    author: h.changedBy?.fullName ?? '—',
    authorRole: h.changedBy?.role ?? null,
  })));
});

// POST /tickets/:id/parts/check проверить наличие позиций на складах (свой/другой корпус)
const checkTicketPartsRoute = createRoute({
  method: 'post',
  path: '/{id}/parts/check',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().openapi({ example: '15' }) }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            items: z.array(z.object({
              nomenclatureId: z.number(),
              quantity: z.number().min(1),
            })).min(1),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Доступность позиций по складам', content: { 'application/json': { schema: PartCheckResponseSchema } } },
    403: { description: 'Доступ запрещен', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
    404: { description: 'Заявка или позиция номенклатуры не найдены', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
  },
});

ticketsRouter.openapi(checkTicketPartsRoute, async (c) => {
  const { id } = c.req.valid('param');
  const { items } = c.req.valid('json');
  const payload = c.get('jwtPayload') as { sub: number, role: string };

  if (payload.role !== 'EXECUTOR') {
    return c.json({ error: 'Запрашивать детали может только IT-специалист' }, 403 as const);
  }

  const ticketId = Number(id);
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    return c.json({ error: 'Заявка не найдена' }, 404 as const);
  }

  const ownWarehouse = await prisma.warehouse.findFirst({ where: { building: ticket.building } });
  const otherWarehouse = await prisma.warehouse.findFirst({ where: { building: { not: ticket.building } } });

  const result = [];
  for (const item of items) {
    const nomenclature = await prisma.nomenclature.findUnique({
      where: { id: item.nomenclatureId },
      include: { unit: true },
    });
    if (!nomenclature) {
      return c.json({ error: `Позиция номенклатуры #${item.nomenclatureId} не найдена` }, 404 as const);
    }

    const [ownInventory, otherInventory] = await Promise.all([
      ownWarehouse
        ? prisma.inventory.findUnique({ where: { warehouseId_nomenclatureId: { warehouseId: ownWarehouse.id, nomenclatureId: item.nomenclatureId } } })
        : null,
      otherWarehouse
        ? prisma.inventory.findUnique({ where: { warehouseId_nomenclatureId: { warehouseId: otherWarehouse.id, nomenclatureId: item.nomenclatureId } } })
        : null,
    ]);

    const ownAvailable = ownInventory?.quantity ?? 0;
    const otherAvailable = otherInventory?.quantity ?? 0;
    const writeOffQty = Math.min(item.quantity, ownAvailable);
    const purchaseQty = item.quantity - writeOffQty;

    result.push({
      nomenclatureId: item.nomenclatureId,
      name: nomenclature.name,
      unit: nomenclature.unit.shortName,
      price: nomenclature.price,
      requested: item.quantity,
      writeOffQty,
      purchaseQty,
      ownAvailable,
      otherAvailable: purchaseQty > 0 ? otherAvailable : 0,
      otherBuilding: otherWarehouse?.building ?? null,
    });
  }

  return c.json({ items: result }, 200 as const);
});

// POST /tickets/:id/parts/confirm списать со склада то, что есть, остальное отправить в закупку
const confirmTicketPartsRoute = createRoute({
  method: 'post',
  path: '/{id}/parts/confirm',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().openapi({ example: '15' }) }),
    body: {
      content: {
        'application/json': {
          schema: ConfirmPartsSchema,
        },
      },
    },
  },
  responses: {
    200: { description: 'Заявка обработана', content: { 'application/json': { schema: TicketSchema } } },
    403: { description: 'Доступ запрещен', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
    404: { description: 'Заявка, склад или позиция номенклатуры не найдены', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
    409: { description: 'Недостаточно остатков на складе', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
  },
});

ticketsRouter.openapi(confirmTicketPartsRoute, async (c) => {
  const { id } = c.req.valid('param');
  const { items } = c.req.valid('json');
  const payload = c.get('jwtPayload') as { sub: number, role: string };

  if (payload.role !== 'EXECUTOR') {
    return c.json({ error: 'Запрашивать детали может только IT-специалист' }, 403 as const);
  }

  const ticketId = Number(id);
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    return c.json({ error: 'Заявка не найдена' }, 404 as const);
  }

  const writeOffItems = items.filter(i => i.writeOffQty > 0);
  const purchaseItems = items.filter(i => i.purchaseQty > 0);

  let ownWarehouse = null;
  if (writeOffItems.length > 0) {
    ownWarehouse = await prisma.warehouse.findFirst({ where: { building: ticket.building } });
    if (!ownWarehouse) {
      return c.json({ error: 'Склад для корпуса заявки не найден' }, 404 as const);
    }
  }

  const warehouseId = ownWarehouse?.id ?? 0;
  const newStatus = purchaseItems.length > 0 ? 'WAITING_FOR_PURCHASE' : ticket.status;

  try {
    // Всё в одной интерактивной транзакции: списание со склада защищено условным
    // декрементом (quantity >= нужного), что исключает гонку при параллельных списаниях.
    const updatedTicket = await prisma.$transaction(async (tx) => {
      const writeOffNames: string[] = [];
      const purchaseNames: string[] = [];

      for (const item of writeOffItems) {
        const nomenclature = await tx.nomenclature.findUnique({ where: { id: item.nomenclatureId } });
        if (!nomenclature) throw new AppError(`Позиция номенклатуры #${item.nomenclatureId} не найдена`, 404);

        // атомарно списываем, только если остатка действительно хватает
        const decremented = await tx.inventory.updateMany({
          where: { warehouseId, nomenclatureId: item.nomenclatureId, quantity: { gte: item.writeOffQty } },
          data: { quantity: { decrement: item.writeOffQty } },
        });
        if (decremented.count === 0) {
          const inv = await tx.inventory.findUnique({
            where: { warehouseId_nomenclatureId: { warehouseId, nomenclatureId: item.nomenclatureId } },
          });
          throw new AppError(`Недостаточно "${nomenclature.name}" на складе (доступно ${inv?.quantity ?? 0})`, 409);
        }

        await tx.stockWriteOff.create({
          data: {
            ticketId,
            nomenclatureId: item.nomenclatureId,
            warehouseId,
            quantity: item.writeOffQty,
            price: nomenclature.price,
            writtenOffById: payload.sub,
          },
        });
        writeOffNames.push(`${nomenclature.name} (${item.writeOffQty} шт.)`);
      }

      for (const item of purchaseItems) {
        const nomenclature = await tx.nomenclature.findUnique({ where: { id: item.nomenclatureId } });
        if (!nomenclature) throw new AppError(`Позиция номенклатуры #${item.nomenclatureId} не найдена`, 404);

        await tx.ticketPart.upsert({
          where: { ticketId_nomenclatureId: { ticketId, nomenclatureId: item.nomenclatureId } },
          update: { requiredQuantity: item.purchaseQty, price: nomenclature.price, isApproved: false, fulfilledFromStock: false },
          create: { ticketId, nomenclatureId: item.nomenclatureId, requiredQuantity: item.purchaseQty, price: nomenclature.price, isApproved: false, fulfilledFromStock: false },
        });
        purchaseNames.push(`${nomenclature.name} (${item.purchaseQty} шт.)`);
      }

      const writeOffSummary = writeOffNames.length > 0 ? `Списано со склада: ${writeOffNames.join(', ')}` : null;
      const purchaseSummary = purchaseNames.length > 0 ? `Запрошено в закупку: ${purchaseNames.join(', ')}` : null;

      await tx.ticketHistory.create({
        data: {
          ticketId,
          changedById: payload.sub,
          oldStatus: ticket.status,
          newStatus,
          comment: [writeOffSummary, purchaseSummary].filter(Boolean).join('. '),
        },
      });

      return tx.ticket.update({
        where: { id: ticketId },
        data: { status: newStatus },
        include: { parts: { include: { nomenclature: { include: { unit: true } } } } },
      });
    });

    return c.json(updatedTicket, 200 as const);
  } catch (e) {
    if (e instanceof AppError) {
      return c.json({ error: e.message }, e.status);
    }
    throw e;
  }
});