import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('возвращает начальное значение сразу', () => {
    const { result } = renderHook(() => useDebouncedValue('a', 300));
    expect(result.current).toBe('a');
  });

  it('обновляет значение только после задержки', () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebouncedValue(v, 300),
      { initialProps: { v: 'a' } },
    );

    rerender({ v: 'b' });
    expect(result.current).toBe('a'); // до истечения задержки старое значение

    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe('b');
  });
});
