import { defineConfig } from 'orval';

// Генерация типизированного API-клиента (react-query хуки + типы) из OpenAPI-спеки бэкенда.
// Спека готовится командой "npm run openapi:export" в backend.
export default defineConfig({
  diplom: {
    input: {
      target: '../backend/openapi.json',
    },
    output: {
      mode: 'tags-split',
      target: './src/generated/endpoints',
      schemas: './src/generated/model',
      client: 'react-query',
      override: {
        mutator: {
          path: './src/api/client.ts',
          name: 'customFetch',
        },
        query: {
          useQuery: true,
          useMutation: true,
        },
      },
      clean: true,
    },
  },
});
