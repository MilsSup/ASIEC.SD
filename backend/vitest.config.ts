import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // index.ts по NODE_ENV не поднимает HTTP-сервер
    env: { NODE_ENV: 'test' },
    include: ['src/**/*.test.ts'],
  },
});
