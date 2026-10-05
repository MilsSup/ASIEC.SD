// backend/src/lib/reports.ts
// Функции отчётности и сортировки без обращений к БД.

// ─── Срочность ───────────────────────────────────────────────────────────────

// Вес срочности (чем больше - тем срочнее)
export const PRIORITY_RANK: Record<string, number> = { HIGH: 3, NORMAL: 2, LOW: 1 };

export const priorityRank = (p: string | null | undefined): number => PRIORITY_RANK[p ?? 'NORMAL'] ?? 2;

// Сортировка «срочные первыми» (порядок внутри одной срочности сохраняется)
export const sortByPriority = <T extends { priority: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));

// ─── Категории заявок по должности исполнителя ───────────────────────────────

// название должности → доступные категории заявок.
// Пустой массив (или должность не из списка) - исполнитель видит заявки всех категорий.
// «Другое» добавлено каждому специалисту: такие обращения видны всем исполнителям.
export const positionCategoryMap: Record<string, string[]> = {
  'Техник':                  ['Компьютерная техника', 'Оргтехника', 'Другое'],
  'Системный администратор': ['Сеть и интернет', 'Учётные записи и доступ', 'Другое'],
  'Специалист 1С':           ['Помощь с 1С', 'Другое'],
  'Руководитель отдела':     [],
  'Преподаватель':           [],
  'Лаборант':                [],
};

// ─── Статус позиции на складе ────────────────────────────────────────────────

export type StockStatus = 'deficit' | 'empty' | 'ok';

// Дефицит только если задан минимальный остаток >0 и фактический не превышает его.
// Пустая позиция без минимума - нейтральный статус, а не дефицит.
export const getStockStatus = (quantity: number, minQuantity: number): StockStatus => {
  if (minQuantity > 0 && quantity <= minQuantity) return 'deficit';
  if (quantity === 0) return 'empty';
  return 'ok';
};

// ─── Отчёт по сотрудникам: события завершения/отклонения и время решения ──────

export interface HistoryLike {
  ticketId: number;
  newStatus: string;
  changedById: number;
  createdAt: Date;
  ticket: { description: string; category: { name: string } | null };
}

export interface WorkEvent {
  ticketId: number;
  description: string;
  category: string;
  type: 'completed' | 'rejected';
  date: Date;
  durationMs: number | null;
  executorId: number;
}

// Преобразует историю изменений заявок в события завершения/отклонения.
// Время решения считается от взятия в работу (первый IN_PROGRESS текущего цикла)
export const extractWorkEvents = (histories: HistoryLike[]): WorkEvent[] => {
  // группировка истории по заявкам
  const byTicket = new Map<number, HistoryLike[]>();
  for (const h of histories) {
    const arr = byTicket.get(h.ticketId);
    if (arr) arr.push(h); else byTicket.set(h.ticketId, [h]);
  }

  const events: WorkEvent[] = [];
  for (const entries of byTicket.values()) {
    // сортировка по дате по возрастанию
    const sorted = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    let cycleStart: Date | null = null;
    for (const h of sorted) {
      if (h.newStatus === 'IN_PROGRESS') {
        if (cycleStart === null) cycleStart = h.createdAt;
      } else if (h.newStatus === 'COMPLETED') {
        events.push({
          ticketId: h.ticketId,
          description: h.ticket.description,
          category: h.ticket.category?.name ?? '—',
          type: 'completed',
          date: h.createdAt,
          durationMs: cycleStart ? h.createdAt.getTime() - cycleStart.getTime() : null,
          executorId: h.changedById,
        });
        cycleStart = null;
      } else if (h.newStatus === 'CANCELED') {
        events.push({
          ticketId: h.ticketId,
          description: h.ticket.description,
          category: h.ticket.category?.name ?? '—',
          type: 'rejected',
          date: h.createdAt,
          durationMs: null,
          executorId: h.changedById,
        });
      }
    }
  }
  return events;
};
