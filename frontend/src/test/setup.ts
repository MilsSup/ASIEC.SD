import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// размонтируем отрендеренные компоненты после каждого теста
afterEach(() => cleanup());
