import { describe, it, expect } from 'vitest';
import { getStockStatus, pluralRu, formatDuration } from './helpers';

describe('getStockStatus', () => {
  it('пусто без минимума (0/0) — нейтральный статус', () => {
    expect(getStockStatus(0, 0)).toBe('empty');
  });
  it('дефицит только при заданном минимуме (>0) и остатке ≤ минимума', () => {
    expect(getStockStatus(0, 3)).toBe('deficit');
    expect(getStockStatus(3, 3)).toBe('deficit');
  });
  it('норма, когда остаток выше минимума или минимум не задан', () => {
    expect(getStockStatus(5, 3)).toBe('ok');
    expect(getStockStatus(5, 0)).toBe('ok');
  });
});

describe('pluralRu', () => {
  const forms: [string, string, string] = ['заявка', 'заявки', 'заявок'];
  it('склоняет по числу', () => {
    expect(pluralRu(1, forms)).toBe('заявка');
    expect(pluralRu(2, forms)).toBe('заявки');
    expect(pluralRu(5, forms)).toBe('заявок');
    expect(pluralRu(11, forms)).toBe('заявок');
    expect(pluralRu(21, forms)).toBe('заявка');
    expect(pluralRu(102, forms)).toBe('заявки');
  });
});

describe('formatDuration', () => {
  const MIN = 60_000;
  it('форматирует длительность', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(30 * MIN)).toBe('30 мин');
    expect(formatDuration(60 * MIN)).toBe('1 ч');
    expect(formatDuration(90 * MIN)).toBe('1 ч 30 мин');
    expect(formatDuration(25 * 60 * MIN)).toBe('1 д 1 ч');
  });
});
