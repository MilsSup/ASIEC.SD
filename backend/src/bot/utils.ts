export const translateStatus = (status: string) => {
  const statuses: Record<string, string> = {
    NEW: '🆕 Новая',
    IN_PROGRESS: '⏳ В работе',
    WAITING_FOR_PURCHASE: '🛒 Ожидание закупки',
    COMPLETED: '✅ Решена',
    CANCELED: '❌ Отменена'
  };
  return statuses[status] || status;
};
