import { useState } from 'react';
import { Modal, ModalHeader } from '../../components/Modal';

interface ModalProps {
  ticketId: number;
  onClose: () => void;
  onConfirm: (ticketId: number, comment: string) => void;
  isSubmitting: boolean;
}

// Завершение заявки исполнителем (комментарий необязателен)
export const CompleteModal = ({ ticketId, onClose, onConfirm, isSubmitting }: ModalProps) => {
  const [comment, setComment] = useState('');

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Завершение заявки" subtitle={`Заявка #${ticketId} · опишите выполненные работы (необязательно)`} onClose={onClose} />

      <div className="p-4 flex-1 overflow-y-auto min-h-0">
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={4}
          placeholder="Например: заменён картридж, перезапущен сервер печати..."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition resize-none"
        />
      </div>

      <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2 shrink-0">
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="flex-1 sm:flex-none px-4 py-2 text-sm font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition disabled:opacity-50"
        >
          Отмена
        </button>
        <button
          onClick={() => onConfirm(ticketId, comment.trim())}
          disabled={isSubmitting}
          className="flex-1 sm:flex-none px-4 py-2 text-sm font-bold text-white bg-[#10b981] rounded-xl hover:bg-[#059669] transition disabled:opacity-50 disabled:cursor-not-allowed sm:ml-auto"
        >
          {isSubmitting ? 'Завершаю...' : 'Завершить заявку'}
        </button>
      </div>
    </Modal>
  );
};

// Отклонение заявки исполнителем (причина обязательна, видна инициатору)
export const RejectModal = ({ ticketId, onClose, onConfirm, isSubmitting }: ModalProps) => {
  const [comment, setComment] = useState('');
  const tooShort = comment.trim().length < 5;

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Отклонение заявки" subtitle={`Заявка #${ticketId} · укажите причину отклонения`} onClose={onClose} />

      <div className="p-4 flex-1 overflow-y-auto min-h-0">
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={4}
          placeholder="Например: заявка дублирует #12 / вне зоны ответственности ИТ-отдела / некорректное описание..."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-400 focus:bg-white transition resize-none"
        />
        <p className="text-[11px] text-slate-400 mt-2">Причина будет видна инициатору заявки.</p>
      </div>

      <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2 shrink-0">
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="flex-1 sm:flex-none px-4 py-2 text-sm font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition disabled:opacity-50"
        >
          Отмена
        </button>
        <button
          onClick={() => onConfirm(ticketId, comment.trim())}
          disabled={isSubmitting || tooShort}
          className="flex-1 sm:flex-none px-4 py-2 text-sm font-bold text-white bg-[#ef4444] rounded-xl hover:bg-red-600 transition disabled:opacity-40 disabled:cursor-not-allowed sm:ml-auto"
        >
          {isSubmitting ? 'Отклоняю...' : 'Отклонить заявку'}
        </button>
      </div>
    </Modal>
  );
};
