import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriorityBadge, normalizePriority, priorityRank, PRIORITY_CONFIG } from './PriorityBadge';

describe('normalizePriority', () => {
  it('пропускает валидные значения, мусор приводит к NORMAL', () => {
    expect(normalizePriority('HIGH')).toBe('HIGH');
    expect(normalizePriority('LOW')).toBe('LOW');
    expect(normalizePriority('NORMAL')).toBe('NORMAL');
    expect(normalizePriority(null)).toBe('NORMAL');
    expect(normalizePriority('СРОЧНО')).toBe('NORMAL');
  });
});

describe('priorityRank', () => {
  it('HIGH > NORMAL > LOW', () => {
    expect(priorityRank('HIGH')).toBeGreaterThan(priorityRank('NORMAL'));
    expect(priorityRank('NORMAL')).toBeGreaterThan(priorityRank('LOW'));
  });
});

describe('PriorityBadge', () => {
  it('рендерит подпись срочности', () => {
    render(<PriorityBadge priority="HIGH" />);
    expect(screen.getByText(PRIORITY_CONFIG.HIGH.label)).toBeTruthy();
  });
});
