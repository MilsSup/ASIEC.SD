// backend/src/lib/validation.ts
// Источник Zod-схем валидации запросов. Используется и роутами, и тестами.
import { z } from '@hono/zod-openapi';

// Создание заявки инициатором
export const CreateTicketSchema = z.object({
  categoryName: z.string().openapi({ example: 'Железо' }),
  room: z.string().openapi({ example: 'ауд. 302' }),
  description: z.string().min(5, 'Опишите проблему подробнее').openapi({ example: 'Не работает проектор' }),
  building: z.union([z.literal(1), z.literal(2)]).openapi({ example: 1 }),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional().openapi({ example: 'NORMAL' }),
});

// Смена статуса заявки исполнителем
export const UpdateStatusSchema = z.object({
  status: z.enum(['NEW', 'IN_PROGRESS', 'WAITING_FOR_PURCHASE', 'COMPLETED', 'CANCELED']),
  comment: z.string().optional(),
});

// Смена срочности заявки
export const UpdatePrioritySchema = z.object({
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']),
});

// Подтверждение списания/закупки позиций по заявке
export const ConfirmPartsSchema = z.object({
  items: z.array(z.object({
    nomenclatureId: z.number(),
    writeOffQty: z.number().min(0).default(0),
    purchaseQty: z.number().min(0).default(0),
  })).min(1),
});
