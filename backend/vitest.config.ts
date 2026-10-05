import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // index.ts по NODE_ENV не поднимает HTTP-сервер
    env: { NODE_ENV: 'test' },
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      // Исключаем точки входа, бота, тесты и декларативную обвязку
      exclude: [
        'src/**/*.test.ts',
        'src/test/',
        'src/index.ts',
        'src/bot/',
        'src/lib/responseSchemas.ts',
        '**/*.config.ts',
      ],
    },
  },
});
