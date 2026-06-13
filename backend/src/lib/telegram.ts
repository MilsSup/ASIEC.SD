// backend/src/lib/telegram.ts
// Username бота для ссылки t.me/<bot>?start=<code>.
// в приоритете переменная TELEGRAM_BOT_USERNAME (без сетевого вызова), иначе Telegram getMe.

let cachedUsername: string | null = null;

export const getBotUsername = async (): Promise<string | null> => {
  const fromEnv = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '');
  if (fromEnv) return fromEnv;

  if (cachedUsername) return cachedUsername;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json() as { ok: boolean; result?: { username?: string } };
    if (data.ok && data.result?.username) {
      cachedUsername = data.result.username;
      return cachedUsername;
    }
  } catch {
    // Сеть недоступна/неверный токен - возврат null, фронт покажет код вручную
  }
  return null;
};
