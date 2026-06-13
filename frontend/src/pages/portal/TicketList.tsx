import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetApiTicketsMy, getGetApiTicketsMyQueryKey } from '../../generated/endpoints/default/default';
import { reopenTicket } from '../../api/tickets';
import { PriorityBadge, normalizePriority } from '../../components/PriorityBadge';
import { TicketHistoryModal } from '../../components/TicketHistoryModal';
import type { ToastType } from './Toasts';
import type { Ticket, ApiTicket } from './types';

const STATUS_LABEL: Record<string, string> = {
  NEW:                  'Новая',
  IN_PROGRESS:          'В работе',
  WAITING_FOR_PURCHASE: 'Ожидание закупки',
  COMPLETED:            'Выполнена',
  CANCELED:             'Отменена',
};

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'Новая':            return 'bg-gray-100 text-gray-700 border-gray-200';
    case 'В работе':         return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'Ожидание закупки': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'Выполнена':        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'Отменена':         return 'bg-red-100 text-red-700 border-red-200';
    default:                 return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

const TicketSkeleton = () => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3 animate-pulse">
    <div className="flex justify-between items-center">
      <div className="flex gap-3">
        <div className="h-7 w-12 bg-slate-100 rounded-md" />
        <div className="h-7 w-24 bg-slate-100 rounded-md" />
      </div>
      <div className="h-7 w-28 bg-slate-100 rounded-full" />
    </div>
    <div className="h-5 w-2/3 bg-slate-100 rounded-md" />
    <div className="flex gap-4">
      <div className="h-4 w-20 bg-slate-100 rounded-md" />
      <div className="h-4 w-16 bg-slate-100 rounded-md" />
    </div>
  </div>
);

interface TicketListProps {
  addToast: (message: string, type: ToastType) => void;
}

export const TicketList = ({ addToast }: TicketListProps) => {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useGetApiTicketsMy();
  // Эндпоинт всегда отдаёт заявки с категорией
  const tickets: Ticket[] = ((data ?? []) as unknown as ApiTicket[]).map(t => ({
    id: t.id,
    category: t.category.name,
    room: t.room,
    building: t.building,
    description: t.description,
    status: STATUS_LABEL[t.status] ?? t.status,
    priority: normalizePriority(t.priority),
    date: new Date(t.createdAt).toLocaleDateString('ru-RU'),
  }));

  useEffect(() => {
    if (error) addToast('Не удалось загрузить заявки. Попробуйте позже.', 'error');
  }, [error, addToast]);

  const [reopenTicketId, setReopenTicketId] = useState<number | null>(null);
  const [reopenComment, setReopenComment] = useState('');
  const [isReopening, setIsReopening] = useState(false);
  const [historyTicketId, setHistoryTicketId] = useState<number | null>(null);

  const handleReopen = async (ticketId: number) => {
    if (reopenComment.trim().length < 5) {
      addToast('Опишите проблему подробнее (минимум 5 символов).', 'error');
      return;
    }
    setIsReopening(true);
    try {
      await reopenTicket(ticketId, reopenComment.trim());
      queryClient.invalidateQueries({ queryKey: getGetApiTicketsMyQueryKey() });
      setReopenTicketId(null);
      setReopenComment('');
      addToast('Заявка возвращена в работу.', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Не удалось вернуть заявку в работу', 'error');
    } finally {
      setIsReopening(false);
    }
  };

  return (
    <div className="lg:col-span-2">
      {historyTicketId !== null && (
        <TicketHistoryModal ticketId={historyTicketId} onClose={() => setHistoryTicketId(null)} />
      )}

      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Мои заявки</h2>
          <p className="text-sm text-slate-500 mt-1">Отслеживайте статус ваших обращений</p>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading && (
          <>
            <TicketSkeleton />
            <TicketSkeleton />
            <TicketSkeleton />
          </>
        )}

        {!isLoading && tickets.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center">
            <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-slate-500 font-medium">У вас пока нет заявок</p>
            <p className="text-sm text-slate-400 mt-1">Создайте первое обращение с помощью формы слева</p>
          </div>
        )}

        {!isLoading && tickets.map(ticket => (
          <div key={ticket.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition duration-200">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">#{ticket.id}</span>
                <span className="text-sm font-semibold text-slate-600">{ticket.date}</span>
                <PriorityBadge priority={ticket.priority} />
              </div>
              <div className={`px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider text-center ${statusBadgeClass(ticket.status)}`}>
                {ticket.status}
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-2">{ticket.description}</h3>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 text-sm font-medium text-slate-500 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {ticket.room} (корпус {ticket.building})
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {ticket.category}
                </div>
              </div>
              <button
                onClick={() => setHistoryTicketId(ticket.id)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-blue-600 transition shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.2A7.9 7.9 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Переписка
              </button>
            </div>

            {ticket.status === 'Ожидание закупки' && (
              <div className="mt-4 bg-amber-50 rounded-lg p-3 border border-amber-100 flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-amber-800">
                  <strong>Заявка приостановлена:</strong> ожидается поставка необходимых комплектующих. Вы получите уведомление при возобновлении работ.
                </p>
              </div>
            )}

            {ticket.status === 'Выполнена' && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                {reopenTicketId === ticket.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      placeholder="Опишите, что именно не было исправлено..."
                      value={reopenComment}
                      onChange={e => setReopenComment(e.target.value)}
                      disabled={isReopening}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-red-400 focus:bg-white transition resize-none disabled:opacity-60"
                    />
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => handleReopen(ticket.id)}
                        disabled={isReopening}
                        className="flex-1 bg-red-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-red-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isReopening ? 'Отправляю...' : 'Подтвердить возврат в работу'}
                      </button>
                      <button
                        onClick={() => { setReopenTicketId(null); setReopenComment(''); }}
                        disabled={isReopening}
                        className="flex-1 sm:flex-none px-4 bg-slate-100 text-slate-600 text-sm font-bold py-2.5 rounded-xl hover:bg-slate-200 transition disabled:opacity-60"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setReopenTicketId(ticket.id); setReopenComment(''); }}
                    className="w-full sm:w-auto px-4 py-2 text-sm font-bold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition"
                  >
                    Проблема не решена
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
