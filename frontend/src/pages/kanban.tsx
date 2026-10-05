import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getExecutorTickets, updateTicketStatus, updateTicketPriority, confirmTicketParts } from '../api/tickets';
import { PriorityBadge, normalizePriority, priorityRank, type Priority } from '../components/PriorityBadge';
import { TicketHistoryModal } from '../components/TicketHistoryModal';
import { AccountMenu } from '../components/AccountMenu';
import { NomenclatureModal } from '../components/NomenclatureModal';
import { CompleteModal, RejectModal } from './kanban/TicketActionModals';
import { CardSkeleton, PriorityControl, HistoryButton, RoomBadge, Column } from './kanban/parts';

// ─── Типы ────────────────────────────────────────────────────────────────────

type TicketStatus = 'Новая' | 'В работе' | 'Ожидание закупки' | 'Выполнена';

interface Ticket {
  id: number;
  initiator: string;
  category: string;
  room: string;
  building: number;
  description: string;
  status: TicketStatus;
  priority: Priority;
  requestedParts: { nomenclatureId: number; quantity: number }[];
  // true если все позиции уже одобрены и списаны со склада автоматически
  partsWrittenOff: boolean;
}

interface ApiTicket {
  id: number;
  description: string;
  room: string;
  building: number;
  status: string;
  priority: string;
  category: { name: string };
  initiator: { fullName: string } | null;
  parts?: { nomenclatureId: number; requiredQuantity: number; isApproved: boolean }[];
}


// ─── Маппинг статусов ────────────────────────────────────────────────────────

const statusMap: Record<string, TicketStatus> = {
  NEW:                  'Новая',
  IN_PROGRESS:          'В работе',
  WAITING_FOR_PURCHASE: 'Ожидание закупки',
  COMPLETED:            'Выполнена',
};

const statusMapReverse: Record<TicketStatus, string> = {
  'Новая':             'NEW',
  'В работе':          'IN_PROGRESS',
  'Ожидание закупки':  'WAITING_FOR_PURCHASE',
  'Выполнена':         'COMPLETED',
};

// ─── Главный компонент ───────────────────────────────────────────────────────

const Kanban = () => {
  const { fullName, roleName, initials, handleLogout } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingTicketId, setLoadingTicketId] = useState<number | null>(null);

  // Модалка
  const [modalTicketId, setModalTicketId] = useState<number | null>(null);
  const [modalInitialItems, setModalInitialItems] = useState<{ nomenclatureId: number; quantity: number }[] | undefined>(undefined);
  // Модалка завершения заявки
  const [completeModalTicketId, setCompleteModalTicketId] = useState<number | null>(null);
  // Модалка отклонения заявки
  const [rejectModalTicketId, setRejectModalTicketId] = useState<number | null>(null);
  // Модалка истории / переписки по заявке
  const [historyModalTicketId, setHistoryModalTicketId] = useState<number | null>(null);

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data: ApiTicket[] = await getExecutorTickets();
      const formatted: Ticket[] = data.map(t => ({
        id: t.id,
        category: t.category.name,
        room: t.room,
        building: t.building,
        description: t.description,
        initiator: t.initiator?.fullName ?? 'Неизвестный',
        status: statusMap[t.status] ?? 'Новая',
        priority: normalizePriority(t.priority),
        // Неодобренные - предлагаем при ручном возврате в работу через модалку
        requestedParts: (t.parts ?? []).filter(p => !p.isApproved).map(p => ({ nomenclatureId: p.nomenclatureId, quantity: p.requiredQuantity })),
        // Если все позиции одобрены - они уже списаны автоматически; показываем плашку в карточке
        // (кнопка «Нужна деталь» при этом остаётся: в ходе ремонта могут понадобиться доп. детали)
        partsWrittenOff: (t.parts ?? []).length > 0 && (t.parts ?? []).every(p => p.isApproved),
      }));
      setTickets(formatted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const moveTicket = async (id: number, newStatus: TicketStatus) => {
    setLoadingTicketId(id);
    try {
      await updateTicketStatus(id, statusMapReverse[newStatus]);
      const ticket = tickets.find(t => t.id === id);
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
      // При возврате заявки в работу сразу предлагаем исполнителю ранее запрошенные детали
      if (newStatus === 'В работе' && ticket && ticket.requestedParts.length > 0) {
        setModalInitialItems(ticket.requestedParts);
        setModalTicketId(id);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка обновления статуса');
    } finally {
      setLoadingTicketId(null);
    }
  };

  // Вызывается из модалки завершения заявки
  const handleComplete = async (id: number, comment: string) => {
    setLoadingTicketId(id);
    try {
      await updateTicketStatus(id, statusMapReverse['Выполнена'], comment || undefined);
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'Выполнена' } : t));
      setCompleteModalTicketId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка обновления статуса');
    } finally {
      setLoadingTicketId(null);
    }
  };

  // Вызывается из модалки отклонения заявки, переводит её в CANCELED с причиной
  const handleReject = async (id: number, comment: string) => {
    setLoadingTicketId(id);
    try {
      await updateTicketStatus(id, 'CANCELED', comment);
      // Отклонённая заявка уходит с доски исполнителя
      setTickets(prev => prev.filter(t => t.id !== id));
      setRejectModalTicketId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка отклонения заявки');
    } finally {
      setLoadingTicketId(null);
    }
  };

  // Вызывается из модалки после подтверждения выбора детали
  const handleNoPart = async (ticketId: number, items: { nomenclatureId: number; writeOffQty: number; purchaseQty: number }[]) => {
    setLoadingTicketId(ticketId);
    try {
      const updated = await confirmTicketParts(ticketId, items);
      const newStatus = statusMap[updated.status] ?? 'Ожидание закупки';
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus, requestedParts: [] } : t));
      setModalTicketId(null);
      setModalInitialItems(undefined);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка отправки в закупку');
    } finally {
      setLoadingTicketId(null);
    }
  };

  // Смена срочности заявки исполнителем
  const handleChangePriority = async (id: number, priority: Priority) => {
    const prev = tickets.find(t => t.id === id)?.priority;
    if (prev === priority) return;
    // Обновляем UI, при ошибке откатываем
    setTickets(cur => cur.map(t => t.id === id ? { ...t, priority } : t));
    try {
      await updateTicketPriority(id, priority);
    } catch (err) {
      setTickets(cur => cur.map(t => t.id === id ? { ...t, priority: prev ?? 'NORMAL' } : t));
      alert(err instanceof Error ? err.message : 'Не удалось изменить срочность');
    }
  };

  // Заявки одного статуса, отсортированные
  // (сортировка стабильная, поэтому внутри одной срочности сохраняется исходный порядок - новые выше)
  const columnTickets = (status: TicketStatus) =>
    tickets
      .filter(t => t.status === status)
      .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));

  const activeTasksCount = tickets.filter(t => t.status === 'В работе' || t.status === 'Новая').length;

  return (
    <div className="h-dvh flex flex-col overflow-hidden text-[#0f172a] font-sans bg-[#f8fafc]">

      {/* Модальное окно */}
      {modalTicketId !== null && (
        <NomenclatureModal
          ticketId={modalTicketId}
          onClose={() => { setModalTicketId(null); setModalInitialItems(undefined); }}
          onConfirm={handleNoPart}
          isSubmitting={loadingTicketId === modalTicketId}
          initialItems={modalInitialItems}
        />
      )}

      {completeModalTicketId !== null && (
        <CompleteModal
          ticketId={completeModalTicketId}
          onClose={() => setCompleteModalTicketId(null)}
          onConfirm={handleComplete}
          isSubmitting={loadingTicketId === completeModalTicketId}
        />
      )}

      {rejectModalTicketId !== null && (
        <RejectModal
          ticketId={rejectModalTicketId}
          onClose={() => setRejectModalTicketId(null)}
          onConfirm={handleReject}
          isSubmitting={loadingTicketId === rejectModalTicketId}
        />
      )}

      {historyModalTicketId !== null && (
        <TicketHistoryModal
          ticketId={historyModalTicketId}
          onClose={() => setHistoryModalTicketId(null)}
        />
      )}

      {/* Шапка */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shrink-0">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
          <div className="flex flex-col">
            <h1 className="text-lg sm:text-xl font-black text-[#0f172a] tracking-wider leading-tight">
              АПЭК<span className="text-[#3b82f6]">.SD</span>
            </h1>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Кабинет исполнителя</p>
          </div>
          <AccountMenu fullName={fullName} roleName={roleName} initials={initials} onLogout={handleLogout} />
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-hidden min-h-0">
        <div className="max-w-[1600px] mx-auto w-full flex-1 flex flex-col min-h-0">

          {/* Заголовок */}
          <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 shrink-0">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-[#0f172a]">Канбан-доска заявок</h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1">Управление инцидентами по вашим категориям</p>
            </div>
            <div className="bg-white px-4 py-2.5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3 self-start sm:self-auto">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider">Активных задач:</span>
              </div>
              <span className="text-lg sm:text-xl font-black text-[#3b82f6]">{activeTasksCount}</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-4 py-3 rounded-xl flex items-center gap-2 shrink-0">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              {error}
              <button onClick={loadTickets} className="ml-auto underline hover:no-underline">Повторить</button>
            </div>
          )}

          {/* Колонки */}
          <div className="flex gap-4 sm:gap-6 items-start pb-6 overflow-x-auto snap-x snap-mandatory sm:snap-none custom-scrollbar flex-1 min-h-0">

            {/* Новые */}
            <Column title="Новые" count={tickets.filter(t => t.status === 'Новая').length}
              headerClass="bg-slate-50/50 rounded-t-2xl" titleClass="text-slate-500"
              badgeClass="bg-slate-100 text-slate-600" borderClass="border-slate-200">
              {isLoading ? <><CardSkeleton /><CardSkeleton /></> : columnTickets('Новая').map(ticket => (
                <div key={ticket.id} className={`bg-white p-4 sm:p-5 rounded-xl border shadow-sm hover:shadow-md transition-all relative overflow-hidden ${ticket.priority === 'HIGH' ? 'border-red-200' : 'border-slate-200'}`}>
                  {ticket.priority === 'HIGH' && <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />}
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-black text-[#3b82f6] bg-blue-50 px-2 py-1 rounded-md shrink-0">#{ticket.id}</span>
                      <PriorityControl priority={ticket.priority} onChange={p => handleChangePriority(ticket.id, p)} disabled={loadingTicketId === ticket.id} />
                    </div>
                    <RoomBadge room={ticket.room} building={ticket.building} />
                  </div>
                  <p className="font-bold text-sm sm:text-[15px] mb-1 text-[#0f172a] leading-snug line-clamp-3 break-words">{ticket.description}</p>
                  <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 mb-1">{ticket.initiator}</p>
                  <p className="text-[10px] font-semibold text-blue-400 mb-4">{ticket.category}</p>
                  <div className="flex gap-2">
                    <button disabled={loadingTicketId === ticket.id} onClick={() => moveTicket(ticket.id, 'В работе')}
                      className="flex-1 bg-slate-50 text-slate-600 border border-slate-200 text-xs sm:text-sm font-bold py-2 sm:py-2.5 rounded-xl hover:bg-[#3b82f6] hover:text-white hover:border-[#3b82f6] transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                      {loadingTicketId === ticket.id ? 'Загрузка...' : 'Взять в работу'}
                    </button>
                    <button disabled={loadingTicketId === ticket.id} onClick={() => setRejectModalTicketId(ticket.id)}
                      className="px-3 bg-white border border-[#ef4444] text-[#ef4444] text-xs sm:text-sm font-bold py-2 sm:py-2.5 rounded-xl hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
                      Отклонить
                    </button>
                  </div>
                </div>
              ))}
            </Column>

            {/* В работе */}
            <Column title="В работе" count={tickets.filter(t => t.status === 'В работе').length}
              headerClass="bg-blue-50/30 rounded-t-2xl" titleClass="text-[#3b82f6]"
              badgeClass="bg-[#3b82f6] text-white" borderClass="border-[#3b82f6]/30">
              {isLoading ? <><CardSkeleton /><CardSkeleton /></> : columnTickets('В работе').map(ticket => (
                <div key={ticket.id} className="bg-white p-4 sm:p-5 rounded-xl border border-[#3b82f6]/30 shadow-sm relative overflow-hidden">
                  <div className={`absolute top-0 left-0 w-1 h-full ${ticket.priority === 'HIGH' ? 'bg-red-500' : 'bg-[#3b82f6]'}`} />
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-black text-[#3b82f6] bg-blue-50 px-2 py-1 rounded-md shrink-0">#{ticket.id}</span>
                      <PriorityControl priority={ticket.priority} onChange={p => handleChangePriority(ticket.id, p)} disabled={loadingTicketId === ticket.id} />
                    </div>
                    <RoomBadge room={ticket.room} building={ticket.building} />
                  </div>
                  <p className="font-bold text-sm sm:text-[15px] mb-1 text-[#0f172a] leading-snug line-clamp-3 break-words">{ticket.description}</p>
                  <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 mb-1">{ticket.initiator}</p>
                  <p className="text-[10px] font-semibold text-blue-400 mb-2">{ticket.category}</p>
                  {ticket.partsWrittenOff && (
                    <div className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-md mb-3">
                      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                      Детали списаны со склада
                    </div>
                  )}
                  <HistoryButton onClick={() => setHistoryModalTicketId(ticket.id)} />
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                    <button disabled={loadingTicketId === ticket.id} onClick={() => setCompleteModalTicketId(ticket.id)}
                      className="w-full bg-[#10b981] text-white text-[10px] sm:text-[11px] font-bold uppercase tracking-wider py-2.5 rounded-xl hover:bg-[#059669] transition disabled:opacity-50 disabled:cursor-not-allowed">
                      {loadingTicketId === ticket.id ? '...' : 'Завершить'}
                    </button>
                    {/* Кнопку оставляем всегда: в процессе ремонта могут понадобиться доп. детали */}
                    <button disabled={loadingTicketId === ticket.id} onClick={() => { setModalInitialItems(undefined); setModalTicketId(ticket.id); }}
                      className="w-full bg-white border border-[#ef4444] text-[#ef4444] text-[10px] sm:text-[11px] font-bold uppercase tracking-wider py-2.5 rounded-xl hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed">
                      Нужна деталь
                    </button>
                  </div>
                </div>
              ))}
            </Column>

            {/* Ожидание закупки */}
            <Column title="Ждём закупку" count={tickets.filter(t => t.status === 'Ожидание закупки').length}
              headerClass="bg-amber-50/30 rounded-t-2xl" titleClass="text-amber-600"
              badgeClass="bg-amber-100 text-amber-700" borderClass="border-amber-200/60">
              {isLoading ? <CardSkeleton /> : columnTickets('Ожидание закупки').map(ticket => (
                <div key={ticket.id} className="bg-white p-4 sm:p-5 rounded-xl border border-amber-200/60 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-amber-400" />
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-md shrink-0">#{ticket.id}</span>
                      <PriorityBadge priority={ticket.priority} />
                    </div>
                    <RoomBadge room={ticket.room} building={ticket.building} />
                  </div>
                  <p className="font-bold text-sm sm:text-[15px] mb-3 text-slate-400 line-through decoration-2 line-clamp-3 break-words">{ticket.description}</p>
                  <div className="bg-amber-50/50 rounded-lg p-2.5 text-center border border-amber-100">
                    <p className="text-[9px] sm:text-[10px] text-amber-700 font-bold uppercase tracking-wider">В смете у руководителя</p>
                  </div>
                  <div className="mt-3"><HistoryButton onClick={() => setHistoryModalTicketId(ticket.id)} /></div>
                  <button disabled={loadingTicketId === ticket.id} onClick={() => moveTicket(ticket.id, 'В работе')}
                    className="mt-3 w-full bg-white border border-slate-200 text-slate-600 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider py-2.5 rounded-xl hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed">
                    {loadingTicketId === ticket.id ? '...' : 'Вернуть в работу'}
                  </button>
                </div>
              ))}
            </Column>

            {/* Выполнено */}
            <Column title="Выполнено" count={tickets.filter(t => t.status === 'Выполнена').length}
              headerClass="bg-emerald-50/30 rounded-t-2xl" titleClass="text-[#10b981]"
              badgeClass="bg-emerald-100 text-[#10b981]" borderClass="border-emerald-200/60">
              {isLoading ? <CardSkeleton /> : tickets.filter(t => t.status === 'Выполнена').map(ticket => (
                <div key={ticket.id} className="bg-white p-4 sm:p-5 rounded-xl border border-emerald-200/60 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#10b981]" />
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-black text-[#10b981] bg-emerald-50 px-2 py-1 rounded-md">#{ticket.id}</span>
                  </div>
                  <p className="font-bold text-sm sm:text-[15px] mb-2 text-slate-500 leading-snug line-clamp-3 break-words">{ticket.description}</p>
                  <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 mb-3">{ticket.initiator}</p>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <p className="text-[9px] sm:text-[10px] font-bold text-[#10b981] uppercase tracking-wider flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Успешно закрыто
                    </p>
                    <HistoryButton onClick={() => setHistoryModalTicketId(ticket.id)} />
                  </div>
                </div>
              ))}
            </Column>

          </div>
        </div>
      </main>
    </div>
  );
};

export default Kanban;
