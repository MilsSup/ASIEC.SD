import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../index.js';
import { prisma } from '../lib/client.js';
import { sign } from 'hono/jwt';

// Интеграционные тесты маршрутов: номенклатура, создание заявки, смета и
// автоматический возврат заявки в работу после поступления деталей на склад.
// Данные создаются прямо в тесте (с уникальным тегом) и удаляются в afterAll,
// чтобы не зависеть от seed и не засорять базу.

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_for_testing';
const tag = `rt-${Date.now()}`;

const created = {
  tickets: [] as number[],
  nomenclature: [] as number[],
  warehouses: [] as number[],
  units: [] as number[],
  categories: [] as number[],
  users: [] as number[],
};

let managerId: number;
let managerToken: string;
let initiatorId: number;
let initiatorToken: string;
let unitId: number;
let warehouseId: number;
let categoryId: number;

const token = (sub: number, role: string) => sign({ sub, role }, JWT_SECRET);

const authGet = (path: string, jwt: string) =>
  app.request(path, { headers: { Authorization: `Bearer ${jwt}` } });

const authSend = (path: string, method: string, jwt: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

// Создаёт заявку с одной позицией нужной номенклатуры (для сценариев сметы/возврата)
async function makeTicketWithPart(opts: {
  status: 'WAITING_FOR_PURCHASE' | 'IN_PROGRESS';
  nomenclatureId: number;
  quantity: number;
  isApproved: boolean;
  price?: number;
}) {
  const ticket = await prisma.ticket.create({
    data: {
      description: `${tag} автотест заявка`,
      room: '000',
      building: 1,
      status: opts.status,
      categoryId,
      initiatorId,
    },
  });
  created.tickets.push(ticket.id);
  const part = await prisma.ticketPart.create({
    data: {
      ticketId: ticket.id,
      nomenclatureId: opts.nomenclatureId,
      requiredQuantity: opts.quantity,
      price: opts.price ?? 100,
      isApproved: opts.isApproved,
    },
  });
  return { ticket, part };
}

beforeAll(async () => {
  const unit = await prisma.unit.create({ data: { shortName: `${tag}-sh`, fullName: `${tag} единица` } });
  unitId = unit.id;
  created.units.push(unit.id);

  const wh = await prisma.warehouse.create({ data: { name: `${tag} склад`, building: 1 } });
  warehouseId = wh.id;
  created.warehouses.push(wh.id);

  const cat = await prisma.category.create({ data: { name: `${tag} категория`, slaHours: 24 } });
  categoryId = cat.id;
  created.categories.push(cat.id);

  const mgr = await prisma.user.create({ data: { login: `${tag}-mgr`, passwordHash: 'x', fullName: 'Менеджер тест', role: 'MANAGER' } });
  managerId = mgr.id;
  created.users.push(mgr.id);
  managerToken = await token(managerId, 'MANAGER');

  const ini = await prisma.user.create({ data: { login: `${tag}-ini`, passwordHash: 'x', fullName: 'Инициатор тест', role: 'INITIATOR' } });
  initiatorId = ini.id;
  created.users.push(ini.id);
  initiatorToken = await token(initiatorId, 'INITIATOR');
});

afterAll(async () => {
  // Удаляем в порядке, безопасном для внешних ключей (заявки каскадно уносят части/историю/списания)
  for (const id of created.tickets) await prisma.ticket.delete({ where: { id } }).catch(() => {});
  await prisma.stockWriteOff.deleteMany({ where: { nomenclatureId: { in: created.nomenclature } } }).catch(() => {});
  await prisma.ticketPart.deleteMany({ where: { nomenclatureId: { in: created.nomenclature } } }).catch(() => {});
  await prisma.inventory.deleteMany({ where: { nomenclatureId: { in: created.nomenclature } } }).catch(() => {});
  for (const id of created.nomenclature) await prisma.nomenclature.delete({ where: { id } }).catch(() => {});
  for (const id of created.warehouses) await prisma.warehouse.delete({ where: { id } }).catch(() => {});
  for (const id of created.units) await prisma.unit.delete({ where: { id } }).catch(() => {});
  for (const id of created.categories) await prisma.category.delete({ where: { id } }).catch(() => {});
  for (const id of created.users) await prisma.user.delete({ where: { id } }).catch(() => {});
});

describe('Номенклатура: CRUD и защита удаления', () => {
  it('GET /api/nomenclature/units возвращает единицы измерения', async () => {
    const res = await authGet('/api/nomenclature/units', managerToken);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((u: { id: number }) => u.id === unitId)).toBe(true);
  });

  it('POST /api/nomenclature создаёт позицию', async () => {
    const res = await authSend('/api/nomenclature', 'POST', managerToken, {
      name: `${tag} деталь`, article: 'ART-1', unitId, price: 1500,
    });
    expect(res.status).toBe(201);
    const item = await res.json();
    expect(item.id).toBeTypeOf('number');
    expect(item.name).toBe(`${tag} деталь`);
    expect(item.price).toBe(1500);
    created.nomenclature.push(item.id);
  });

  it('PATCH /api/nomenclature/:id обновляет позицию', async () => {
    const nom = await prisma.nomenclature.create({ data: { name: `${tag} правка`, unitId, price: 10 } });
    created.nomenclature.push(nom.id);

    const res = await authSend(`/api/nomenclature/${nom.id}`, 'PATCH', managerToken, {
      name: `${tag} обновлено`, unitId, price: 999,
    });
    expect(res.status).toBe(200);
    const item = await res.json();
    expect(item.name).toBe(`${tag} обновлено`);
    expect(item.price).toBe(999);
  });

  it('DELETE /api/nomenclature/:id удаляет неиспользуемую позицию', async () => {
    const nom = await prisma.nomenclature.create({ data: { name: `${tag} удаляемая`, unitId, price: 5 } });
    const res = await authSend(`/api/nomenclature/${nom.id}`, 'DELETE', managerToken);
    expect(res.status).toBe(200);
    const gone = await prisma.nomenclature.findUnique({ where: { id: nom.id } });
    expect(gone).toBeNull();
  });

  it('DELETE блокируется (409), если позиция используется в смете заявки', async () => {
    const nom = await prisma.nomenclature.create({ data: { name: `${tag} в смете`, unitId, price: 5 } });
    created.nomenclature.push(nom.id);
    await makeTicketWithPart({ status: 'WAITING_FOR_PURCHASE', nomenclatureId: nom.id, quantity: 1, isApproved: false });

    const res = await authSend(`/api/nomenclature/${nom.id}`, 'DELETE', managerToken);
    expect(res.status).toBe(409);
    const still = await prisma.nomenclature.findUnique({ where: { id: nom.id } });
    expect(still).not.toBeNull();
  });

  it('DELETE блокируется (409), если на складе есть остаток', async () => {
    const nom = await prisma.nomenclature.create({ data: { name: `${tag} на складе`, unitId, price: 5 } });
    created.nomenclature.push(nom.id);
    await prisma.inventory.create({ data: { warehouseId, nomenclatureId: nom.id, quantity: 3, minQuantity: 0 } });

    const res = await authSend(`/api/nomenclature/${nom.id}`, 'DELETE', managerToken);
    expect(res.status).toBe(409);
  });
});

describe('Создание заявки и справочник категорий', () => {
  it('POST /api/tickets создаёт заявку с существующей категорией', async () => {
    const res = await authSend('/api/tickets', 'POST', initiatorToken, {
      categoryName: `${tag} категория`, room: '101', description: 'Не работает компьютер', building: 1, priority: 'NORMAL',
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ticketId).toBeTypeOf('number');
    created.tickets.push(body.ticketId);
  });

  it('POST /api/tickets возвращает 400 при несуществующей категории', async () => {
    const res = await authSend('/api/tickets', 'POST', initiatorToken, {
      categoryName: 'Категория-которой-нет', room: '101', description: 'Не работает компьютер', building: 1,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Категория не найдена');
  });

  it('GET /api/tickets/categories возвращает справочник', async () => {
    const res = await authGet('/api/tickets/categories', initiatorToken);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((c: { id: number }) => c.id === categoryId)).toBe(true);
  });
});

describe('Доступ к разделам руководителя', () => {
  it('Инициатор не имеет доступа к смете руководителя (403)', async () => {
    const res = await authGet('/api/manager/estimate', initiatorToken);
    expect(res.status).toBe(403);
  });
});

describe('Сводная смета и автоматический возврат заявки в работу', () => {
  it('В смету попадают только заявки в статусе «Ожидает закупку»', async () => {
    const nomWaiting = await prisma.nomenclature.create({ data: { name: `${tag} смета-ждёт`, unitId, price: 200 } });
    const nomInProgress = await prisma.nomenclature.create({ data: { name: `${tag} смета-вработе`, unitId, price: 200 } });
    created.nomenclature.push(nomWaiting.id, nomInProgress.id);

    const waiting = await makeTicketWithPart({ status: 'WAITING_FOR_PURCHASE', nomenclatureId: nomWaiting.id, quantity: 1, isApproved: true });
    const inProgress = await makeTicketWithPart({ status: 'IN_PROGRESS', nomenclatureId: nomInProgress.id, quantity: 1, isApproved: true });

    const res = await authGet('/api/manager/estimate', managerToken);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ticket: { id: number } }[];

    expect(data.some(p => p.ticket.id === waiting.ticket.id)).toBe(true);
    expect(data.some(p => p.ticket.id === inProgress.ticket.id)).toBe(false);
  });

  it('Одобрение позиций оставляет заявку в «Ожидает закупку», если детали нет на складе', async () => {
    const nom = await prisma.nomenclature.create({ data: { name: `${tag} одобрение`, unitId, price: 300 } });
    created.nomenclature.push(nom.id);
    const { ticket, part } = await makeTicketWithPart({ status: 'WAITING_FOR_PURCHASE', nomenclatureId: nom.id, quantity: 2, isApproved: false });

    const res = await authSend(`/api/manager/review/${ticket.id}/approve`, 'PATCH', managerToken, { approvedPartIds: [part.id] });
    expect(res.status).toBe(200);

    const fresh = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    const freshPart = await prisma.ticketPart.findUnique({ where: { id: part.id } });
    expect(freshPart?.isApproved).toBe(true);
    expect(fresh?.status).toBe('WAITING_FOR_PURCHASE');
  });

  it('Поступление детали на склад возвращает заявку в работу и списывает деталь', async () => {
    const nom = await prisma.nomenclature.create({ data: { name: `${tag} возврат`, unitId, price: 400 } });
    created.nomenclature.push(nom.id);
    const { ticket } = await makeTicketWithPart({ status: 'WAITING_FOR_PURCHASE', nomenclatureId: nom.id, quantity: 2, isApproved: true, price: 400 });

    // Приходуем 5 шт через раздел склада руководителя — должно хватить на потребность (2)
    const res = await authSend('/api/manager/warehouse', 'POST', managerToken, {
      warehouseId, nomenclatureId: nom.id, quantity: 5, minQuantity: 0,
    });
    expect(res.status).toBe(201);

    // Заявка вернулась в работу
    const fresh = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(fresh?.status).toBe('IN_PROGRESS');

    // Деталь списана под заявку (2 шт), на складе осталось 3
    const writeOff = await prisma.stockWriteOff.findFirst({ where: { ticketId: ticket.id, nomenclatureId: nom.id } });
    expect(writeOff?.quantity).toBe(2);

    const inv = await prisma.inventory.findUnique({ where: { warehouseId_nomenclatureId: { warehouseId, nomenclatureId: nom.id } } });
    expect(inv?.quantity).toBe(3);

    // В истории заявки зафиксирован автоматический возврат
    const history = await prisma.ticketHistory.findFirst({
      where: { ticketId: ticket.id, newStatus: 'IN_PROGRESS' },
      orderBy: { id: 'desc' },
    });
    expect(history?.comment).toContain('автоматически');
  });
});

describe('Ручное редактирование сметы заявки', () => {
  it('Добавление, изменение количества и удаление позиции', async () => {
    const nom = await prisma.nomenclature.create({ data: { name: `${tag} ручная`, unitId, price: 50 } });
    created.nomenclature.push(nom.id);
    const ticket = await prisma.ticket.create({
      data: { description: `${tag} правка сметы`, room: '202', building: 1, status: 'WAITING_FOR_PURCHASE', categoryId, initiatorId },
    });
    created.tickets.push(ticket.id);

    // Добавляем позицию
    const addRes = await authSend(`/api/manager/tickets/${ticket.id}/parts`, 'POST', managerToken, {
      nomenclatureId: nom.id, requiredQuantity: 3,
    });
    expect(addRes.status).toBe(201);
    const added = await addRes.json();
    expect(added.requiredQuantity).toBe(3);
    const partId = added.id as number;

    // Меняем количество
    const qtyRes = await authSend(`/api/manager/parts/${partId}/quantity`, 'PATCH', managerToken, { requiredQuantity: 7 });
    expect(qtyRes.status).toBe(200);
    const afterQty = await prisma.ticketPart.findUnique({ where: { id: partId } });
    expect(afterQty?.requiredQuantity).toBe(7);

    // Удаляем позицию
    const delRes = await authSend(`/api/manager/parts/${partId}`, 'DELETE', managerToken);
    expect(delRes.status).toBe(200);
    const gone = await prisma.ticketPart.findUnique({ where: { id: partId } });
    expect(gone).toBeNull();
  });
});
