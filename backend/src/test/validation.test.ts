import { describe, it, expect } from 'vitest';
import {
  CreateTicketSchema,
  UpdateStatusSchema,
  UpdatePrioritySchema,
  ConfirmPartsSchema,
} from '../lib/validation.js';

describe('Валидация: создание заявки (CreateTicketSchema)', () => {
  const valid = { categoryName: 'Сеть и интернет', room: 'ауд. 302', description: 'Не работает интернет', building: 1 };

  it('принимает корректную заявку', () => {
    expect(CreateTicketSchema.safeParse(valid).success).toBe(true);
  });

  it('отклоняет слишком короткое описание (<5 символов)', () => {
    const res = CreateTicketSchema.safeParse({ ...valid, description: 'нет' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some(i => i.message === 'Опишите проблему подробнее')).toBe(true);
    }
  });

  it('отклоняет корпус вне {1, 2}', () => {
    expect(CreateTicketSchema.safeParse({ ...valid, building: 3 }).success).toBe(false);
    expect(CreateTicketSchema.safeParse({ ...valid, building: 0 }).success).toBe(false);
  });

  it('отклоняет корпус, переданный строкой', () => {
    expect(CreateTicketSchema.safeParse({ ...valid, building: '1' }).success).toBe(false);
  });

  it('срочность необязательна, но при наличии должна быть из перечня', () => {
    expect(CreateTicketSchema.safeParse(valid).success).toBe(true); // без priority
    expect(CreateTicketSchema.safeParse({ ...valid, priority: 'HIGH' }).success).toBe(true);
    expect(CreateTicketSchema.safeParse({ ...valid, priority: 'СРОЧНО' }).success).toBe(false);
  });

  it('требует обязательные поля', () => {
    expect(CreateTicketSchema.safeParse({ room: 'ауд. 1', description: 'Поломка проектора', building: 1 }).success).toBe(false);
  });
});

describe('Валидация: смена статуса (UpdateStatusSchema)', () => {
  it('принимает допустимые статусы', () => {
    for (const status of ['NEW', 'IN_PROGRESS', 'WAITING_FOR_PURCHASE', 'COMPLETED', 'CANCELED']) {
      expect(UpdateStatusSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it('отклоняет неизвестный статус', () => {
    expect(UpdateStatusSchema.safeParse({ status: 'DONE' }).success).toBe(false);
  });

  it('комментарий необязателен', () => {
    expect(UpdateStatusSchema.safeParse({ status: 'CANCELED', comment: 'дубликат заявки' }).success).toBe(true);
    expect(UpdateStatusSchema.safeParse({ status: 'CANCELED' }).success).toBe(true);
  });
});

describe('Валидация: смена срочности (UpdatePrioritySchema)', () => {
  it('принимает LOW/NORMAL/HIGH', () => {
    for (const priority of ['LOW', 'NORMAL', 'HIGH']) {
      expect(UpdatePrioritySchema.safeParse({ priority }).success).toBe(true);
    }
  });

  it('отклоняет прочие значения и пустой объект', () => {
    expect(UpdatePrioritySchema.safeParse({ priority: 'URGENT' }).success).toBe(false);
    expect(UpdatePrioritySchema.safeParse({}).success).toBe(false);
  });
});

describe('Валидация: подтверждение позиций (ConfirmPartsSchema)', () => {
  it('принимает непустой список позиций', () => {
    const res = ConfirmPartsSchema.safeParse({ items: [{ nomenclatureId: 5, writeOffQty: 2, purchaseQty: 1 }] });
    expect(res.success).toBe(true);
  });

  it('подставляет нули для writeOffQty/purchaseQty по умолчанию', () => {
    const res = ConfirmPartsSchema.safeParse({ items: [{ nomenclatureId: 5 }] });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.items[0].writeOffQty).toBe(0);
      expect(res.data.items[0].purchaseQty).toBe(0);
    }
  });

  it('отклоняет пустой список позиций', () => {
    expect(ConfirmPartsSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it('отклоняет отрицательное количество', () => {
    expect(ConfirmPartsSchema.safeParse({ items: [{ nomenclatureId: 5, writeOffQty: -1, purchaseQty: 0 }] }).success).toBe(false);
  });
});
