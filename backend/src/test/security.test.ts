import { describe, it, expect } from 'vitest';
import { app } from '../index.js';
import { sign } from 'hono/jwt';

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_for_testing';

describe('Интеграционное тестирование API: Контроль доступа и изоляция данных', () => {

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
    // Заявка #6 закреплена за исполнителем #7 (см. seed), пробуем изменить её от имени исполнителя #8
    const otherExecutorToken = await sign({ sub: 8, role: 'EXECUTOR' }, JWT_SECRET);

    const response = await app.request('/api/tickets/6/status', {
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