// Экспорт OpenAPI-спецификации в файл backend/openapi.json (для Orval-кодогена на фронте).
import 'dotenv/config';
import { writeFileSync } from 'node:fs';

// NODE_ENV=test чтоб импорт app не поднимал HTTP-сервер.
process.env.NODE_ENV = 'test';

const { app } = await import('../src/index.js');

const res = await app.request('/openapi.json');
const spec = await res.text();

const outPath = new URL('../openapi.json', import.meta.url);
writeFileSync(outPath, spec);

console.log(`OpenAPI-спецификация сохранена: ${outPath.pathname} (${(spec.length / 1024).toFixed(1)} КБ)`);
process.exit(0);
