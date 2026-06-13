import { describe, it, expect } from 'vitest';
import {
  getStockStatus,
  priorityRank,
  sortByPriority,
  extractWorkEvents,
  type HistoryLike,
} from '../lib/reports.js';

const MIN = 60_000; // одна минута в мс

// хэлпер для создания записи истории
const h = (
  ticketId: number,
  newStatus: string,
  changedById: number,
  iso: string,
  opts: { category?: string | null; description?: string } = {},
): HistoryLike => ({
  ticketId,
  newStatus,
  changedById,
  createdAt: new Date(iso),
  ticket: {
    description: opts.description ?? `Заявка ${ticketId}`,
    category: opts.category === null ? null : { name: opts.category ?? 'Категория' },
  },
});

describe('getStockStatus — статус позиции на складе', () => {
  it('пусто без минимума (0/0) — нейтральный статус, не дефицит', () => {
    expect(getStockStatus(0, 0)).toBe('empty');
  });

  it('дефицит только при заданном минимуме (>0) и остатке ≤ минимума', () => {
    expect(getStockStatus(0, 3)).toBe('deficit');
    expect(getStockStatus(1, 3)).toBe('deficit');
    expect(getStockStatus(3, 3)).toBe('deficit');
  });

  it('норма, когда остаток выше минимума или минимум не задан', () => {
    expect(getStockStatus(5, 3)).toBe('ok'); // выше минимума
    expect(getStockStatus(5, 0)).toBe('ok'); // минимум не задан, но есть остаток
  });
});

describe('priorityRank / sortByPriority — срочность', () => {
  it('ранг: HIGH > NORMAL > LOW, неизвестное считается NORMAL', () => {
    expect(priorityRank('HIGH')).toBeGreaterThan(priorityRank('NORMAL'));
    expect(priorityRank('NORMAL')).toBeGreaterThan(priorityRank('LOW'));
    expect(priorityRank('???')).toBe(priorityRank('NORMAL'));
    expect(priorityRank(null)).toBe(priorityRank('NORMAL'));
  });

  it('срочные — первыми, порядок внутри одной срочности сохраняется (стабильность)', () => {
    const input = [
      { id: 1, priority: 'NORMAL' },
      { id: 2, priority: 'HIGH' },
      { id: 3, priority: 'LOW' },
      { id: 4, priority: 'HIGH' },
    ];
    const sorted = sortByPriority(input);
    expect(sorted.map(t => t.id)).toEqual([2, 4, 1, 3]);
  });

  it('не мутирует исходный массив', () => {
    const input = [{ id: 1, priority: 'LOW' }, { id: 2, priority: 'HIGH' }];
    const sorted = sortByPriority(input);
    expect(input.map(t => t.id)).toEqual([1, 2]); // исходный порядок цел
    expect(sorted).not.toBe(input);
  });
});

describe('extractWorkEvents — события и время решения', () => {
  it('простое завершение: длительность = завершение − взятие в работу', () => {
    const events = extractWorkEvents([
      h(1, 'IN_PROGRESS', 7, '2026-01-01T10:00:00Z'),
      h(1, 'COMPLETED', 7, '2026-01-01T10:30:00Z'),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ ticketId: 1, type: 'completed', executorId: 7, durationMs: 30 * MIN });
  });

  it('циклы ожидания закупки не сбрасывают старт — время считается от первого IN_PROGRESS', () => {
    const events = extractWorkEvents([
      h(2, 'IN_PROGRESS', 7, '2026-01-01T10:00:00Z'),
      h(2, 'WAITING_FOR_PURCHASE', 7, '2026-01-01T10:10:00Z'),
      h(2, 'IN_PROGRESS', 7, '2026-01-01T10:20:00Z'),
      h(2, 'COMPLETED', 7, '2026-01-01T11:00:00Z'),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].durationMs).toBe(60 * MIN);
  });

  it('повторное открытие: два независимых цикла со своими длительностями', () => {
    const events = extractWorkEvents([
      h(3, 'IN_PROGRESS', 7, '2026-01-01T10:00:00Z'),
      h(3, 'COMPLETED', 7, '2026-01-01T10:20:00Z'),
      h(3, 'IN_PROGRESS', 7, '2026-01-01T11:00:00Z'),
      h(3, 'COMPLETED', 7, '2026-01-01T11:15:00Z'),
    ]);
    expect(events).toHaveLength(2);
    expect(events[0].durationMs).toBe(20 * MIN);
    expect(events[1].durationMs).toBe(15 * MIN);
  });

  it('отклонение заявки — событие rejected без длительности, автор по changedById', () => {
    const events = extractWorkEvents([
      h(4, 'CANCELED', 9, '2026-01-01T09:00:00Z', { category: 'Оргтехника' }),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'rejected', durationMs: null, executorId: 9, category: 'Оргтехника' });
  });

  it('завершение без предшествующего IN_PROGRESS — длительность null', () => {
    const events = extractWorkEvents([
      h(5, 'COMPLETED', 7, '2026-01-01T10:00:00Z'),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].durationMs).toBeNull();
  });

  it('категория отсутствует — подставляется «—»', () => {
    const events = extractWorkEvents([
      h(6, 'IN_PROGRESS', 7, '2026-01-01T10:00:00Z', { category: null }),
      h(6, 'COMPLETED', 7, '2026-01-01T10:05:00Z', { category: null }),
    ]);
    expect(events[0].category).toBe('—');
  });

  it('несколько заявок обрабатываются независимо, порядок внутри заявки восстанавливается', () => {
    const events = extractWorkEvents([
      h(8, 'COMPLETED', 5, '2026-01-02T12:30:00Z'),
      h(7, 'IN_PROGRESS', 7, '2026-01-01T10:00:00Z'),
      h(8, 'IN_PROGRESS', 5, '2026-01-02T12:00:00Z'),
      h(7, 'COMPLETED', 7, '2026-01-01T10:10:00Z'),
    ]);
    const t7 = events.find(e => e.ticketId === 7)!;
    const t8 = events.find(e => e.ticketId === 8)!;
    expect(t7.durationMs).toBe(10 * MIN);
    expect(t8.durationMs).toBe(30 * MIN);
    expect(t7.executorId).toBe(7);
    expect(t8.executorId).toBe(5);
  });
});
