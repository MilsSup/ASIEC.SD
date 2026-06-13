import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createTicket } from '../../api/tickets';
import { getGetApiTicketsMyQueryKey } from '../../generated/endpoints/default/default';
import { PRIORITY_CONFIG, PRIORITY_OPTIONS, type Priority } from '../../components/PriorityBadge';
import type { ToastType } from './Toasts';

interface TicketFormProps {
  addToast: (message: string, type: ToastType) => void;
}

export const TicketForm = ({ addToast }: TicketFormProps) => {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('Компьютеры и перефирия');
  const [building, setBuilding] = useState<1 | 2>(1);
  const [room, setRoom] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room.trim() || !description.trim()) {
      addToast('Заполните все поля формы.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await createTicket(category, room, description, building, priority);
      setCategory('Компьютеры и перефирия');
      setBuilding(1);
      setRoom('');
      setDescription('');
      setPriority('NORMAL');
      addToast('Заявка успешно отправлена в IT-отдел!', 'success');
      queryClient.invalidateQueries({ queryKey: getGetApiTicketsMyQueryKey() });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message
        : (typeof err === 'object' && err !== null && 'message' in err) ? String((err as { message: unknown }).message)
        : 'Неизвестная ошибка';
      addToast(`Ошибка: ${message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="lg:col-span-1">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-28">
        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Новое обращение
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Категория проблемы</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition disabled:opacity-60"
            >
              <option value="Компьютеры и перефирия">Компьютеры и периферия</option>
              <option value="Сеть и интернет">Сеть и интернет</option>
              <option value="Оргтехника">Оргтехника</option>
              <option value="Помощь с 1С">Помощь с 1С</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Корпус</label>
            <select
              value={building}
              onChange={e => setBuilding(Number(e.target.value) as 1 | 2)}
              disabled={isSubmitting}
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition disabled:opacity-60"
            >
              <option value={1}>Корпус 1</option>
              <option value={2}>Корпус 2</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Аудитория / Кабинет</label>
            <input
              type="text"
              placeholder="Например: ауд. 302"
              value={room}
              onChange={e => setRoom(e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Описание проблемы</label>
            <textarea
              rows={4}
              placeholder="Опишите, что именно не работает..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition resize-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Срочность</label>
            <div className="grid grid-cols-3 gap-2">
              {PRIORITY_OPTIONS.map(p => {
                const cfg = PRIORITY_CONFIG[p];
                const active = priority === p;
                return (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPriority(p)}
                    disabled={isSubmitting}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg border text-xs font-bold transition disabled:opacity-60
                      ${active ? `${cfg.badgeClass} ring-2 ring-offset-1 ring-current` : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
            {priority === 'HIGH' && (
              <p className="text-[11px] text-red-500 mt-2 leading-snug">
                Отметьте «Срочная» только если работа кабинета/оборудования полностью остановлена.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 hover:shadow-lg focus:ring-4 focus:ring-blue-200 transition duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Отправляю...
              </>
            ) : (
              'Отправить заявку'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
