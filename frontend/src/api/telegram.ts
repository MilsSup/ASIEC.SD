import { apiClient } from './client';

export const getTelegramStatus = (): Promise<{ linked: boolean }> =>
  apiClient.get('/api/telegram/status').then(r => r.data);

export const createTelegramLink = (): Promise<{ code: string; url: string | null; botUsername: string | null }> =>
  apiClient.post('/api/telegram/link-code').then(r => r.data);

export const unlinkTelegram = (): Promise<{ linked: boolean }> =>
  apiClient.delete('/api/telegram/link').then(r => r.data);
