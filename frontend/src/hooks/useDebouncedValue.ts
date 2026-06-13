import { useState, useEffect } from 'react';

// Возвращает значение с задержкой для текстового поиска,
// чтобы не дёргать запрос на каждый символ.
export const useDebouncedValue = <T>(value: T, delay = 300): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
};
