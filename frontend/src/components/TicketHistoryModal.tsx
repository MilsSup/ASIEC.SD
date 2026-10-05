import { useState } from 'react';
import { Modal, ModalHeader } from './Modal';
import { useTicketHistory } from '../hooks/useTicketHistory';

const STATUS_LABEL: Record<string, string> = {
  NEW: 'Новая',
  IN_PROGRESS: 'В работе',
  WAITING_FOR_PURCHASE: 'Ожидание закупки',
  COMPLETED: 'Выполнена',
  CANCELED: 'Отклонена',
};

const ROLE_LABEL: Record<string, string> = {
  INITIATOR: 'Инициатор',
  EXECUTOR: 'Исполнитель',
  MANAGER: 'Руководитель',
};

const ROLE_BADGE: Record<string, string> = {
  INITIATOR: 'bg-slate-100 text-slate-500',
  EXECUTOR: 'bg-blue-50 text-blue-600',
  MANAGER: 'bg-indigo-50 text-indigo-600',
};

const statusDot = (status: string) => {
  switch (status) {
    case 'COMPLETED': return 'bg-emerald-500';
    case 'CANCELED': return 'bg-red-500';
    case 'WAITING_FOR_PURCHASE': return 'bg-amber-400';
    case 'IN_PROGRESS': return 'bg-blue-500';
    default: return 'bg-slate-300';
  }
};

export const TicketHistoryModal = ({ ticketId, onClose }: { ticketId: number; onClose: () => void }) => {
  const { entries, isLoading, error, addComment } = useTicketHistory(ticketId);
  const [comment, setComment] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const handleSend = async () => {
    const text = comment.trim();
    if (!text) return;
    setIsSending(true);
    setSendError('');
    try {
      await addComment(text);
      setComment('');
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Не удалось отправить комментарий');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Переписка по заявке" subtitle={`Заявка #${ticketId} · комментарии и история статусов`} onClose={onClose} />

        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <svg className="w-6 h-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
          ) : error ? (
            <p className="text-sm text-red-500 font-medium text-center py-10">{error}</p>
          ) : entries.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <svg className="w-9 h-9 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.2A7.9 7.9 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm font-semibold">Пока нет записей</p>
              <p className="text-xs mt-1">Здесь появятся комментарии и изменения статуса</p>
            </div>
          ) : (
            <ol className="space-y-4">
              {entries.map(e => (
                <li key={e.id} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <span className={`w-2.5 h-2.5 rounded-full mt-1.5 ${e.oldStatus ? statusDot(e.newStatus) : 'bg-slate-300'}`} />
                    <span className="flex-1 w-px bg-slate-100 mt-1" />
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-700">{e.author}</span>
                      {e.authorRole && (
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${ROLE_BADGE[e.authorRole] ?? 'bg-slate-100 text-slate-500'}`}>
                          {ROLE_LABEL[e.authorRole] ?? e.authorRole}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 ml-auto">{new Date(e.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {e.oldStatus ? `${STATUS_LABEL[e.oldStatus] ?? e.oldStatus} → ${STATUS_LABEL[e.newStatus] ?? e.newStatus}` : 'Комментарий'}
                    </p>
                    {e.comment && (
                      <div className="mt-1.5 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap break-words">
                        {e.comment}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 shrink-0 space-y-2">
          {sendError && <p className="text-xs text-red-500 font-medium">{sendError}</p>}
          <div className="flex gap-2">
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Написать комментарий..."
              rows={1}
              disabled={isSending}
              className="flex-1 resize-none px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isSending || !comment.trim()}
              className="px-4 py-2.5 text-sm font-bold text-white bg-[#3b82f6] rounded-xl hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Отправить
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition"
          >
            Закрыть
          </button>
        </div>
    </Modal>
  );
};
