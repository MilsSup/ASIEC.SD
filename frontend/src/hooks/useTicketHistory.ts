import { useState, useEffect } from 'react';
import { getTicketHistory } from '../api/tickets';

export interface TicketHistoryEntry {
  id: number;
  oldStatus: string | null;
  newStatus: string;
  comment: string | null;
  date: string;
  author: string;
  authorRole: string | null;
}

// Загружает историю/переписку по заявке с отменой устаревшего запроса
export const useTicketHistory = (ticketId: number) => {
  const [entries, setEntries] = useState<TicketHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getTicketHistory(ticketId)
      .then(data => { if (!cancelled) setEntries(data); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Ошибка загрузки'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [ticketId]);

  return { entries, isLoading, error };
};
