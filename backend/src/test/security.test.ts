import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../index.js';
import { prisma } from '../lib/client.js';
import { sign } from 'hono/jwt';

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_for_testing';

describe('Интеграционное тестирование API: Контроль доступа и изоляция данных', () => {
  // Заявка и два исполнителя создаются прямо в тесте, чтобы не зависеть от конкретных id из seed
  let assignedTicketId: number;
  let assignedExecutorId: number;
  let otherExecutorId: number;

  beforeAll(async () => {
    const category = await prisma.category.findFirstOrThrow();
    const [assignedExecutor, otherExecutor] = await Promise.all([
      prisma.user.create({ data: { login: `sec-test-exec-1-${Date.now()}`, passwordHash: 'x', fullName: 'Тестовый исполнитель 1', role: 'EXECUTOR' } }),
      prisma.user.create({ data: { login: `sec-test-exec-2-${Date.now()}`, passwordHash: 'x', fullName: 'Тестовый исполнитель 2', role: 'EXECUTOR' } }),
    ]);
    assignedExecutorId = assignedExecutor.id;
    otherExecutorId = otherExecutor.id;

    const ticket = await prisma.ticket.create({
      data: {
        description: 'Тестовая заявка для проверки контроля доступа',
        room: '000',
        building: 1,
        status: 'IN_PROGRESS',
        categoryId: category.id,
        executorId: assignedExecutorId,
      },
    });
    assignedTicketId = ticket.id;
  });

  afterAll(async () => {
    await prisma.ticket.delete({ where: { id: assignedTicketId } });
    await prisma.user.deleteMany({ where: { id: { in: [assignedExecutorId, otherExecutorId] } } });
  });

  it('Должен возвращать ошибку 403 при попытке Инициатора изменить статус заявки', async () => {
    const userToken = await sign({ sub: 1, role: 'INITIATOR' }, JWT_SECRET);

    const response = await app.request('/api/tickets/15/status', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'IN_PROGRESS' })
    });

    // сервер должен заблокировать запрос (403 Forbidden)
    expect(response.status).toBe(403);
  });

  it('Должен возвращать 403, если исполнитель пытается изменить статус заявки другого исполнителя', async () => {
    // assignedTicketId закреплён за assignedExecutorId, пробуем изменить её от имени otherExecutorId
    const otherExecutorToken = await sign({ sub: otherExecutorId, role: 'EXECUTOR' }, JWT_SECRET);

    const response = await app.request(`/api/tickets/${assignedTicketId}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${otherExecutorToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'COMPLETED' })
    });

    expect(response.status).toBe(403);
  });

  it('Должен возвращать только заявки текущего пользователя, игнорируя параметры URL', async () => {
    const targetUserId = 2;
    const userToken = await sign({ sub: targetUserId, role: 'INITIATOR' }, JWT_SECRET);

    const response = await app.request('/api/tickets/my?userId=1', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      data.forEach((ticket: any) => {
        expect(ticket.initiatorId).toBe(targetUserId);
      });
    }
  });

});