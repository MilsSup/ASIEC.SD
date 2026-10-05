import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetApiManagerReview, getGetApiManagerReviewQueryKey } from '../../generated/endpoints/default/default';
import { approveTicketParts, rejectPurchase, updateTicketPartPrice, updateTicketPartQuantity, deleteTicketPart, addTicketPart } from '../../api/manager';
import { NomenclaturePicker } from '../../components/NomenclaturePicker';
import { PriorityBadge, normalizePriority } from '../../components/PriorityBadge';
import { Skeleton, ReportError } from './helpers';
import type { ReviewTicket } from './types';

export const ReviewTab = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useGetApiManagerReview();
  // Эндпоинт всегда отдаёт заявки с включёнными связями
  const reviews = (data ?? []) as unknown as ReviewTicket[];

  const [checkedParts, setCheckedParts] = useState<Record<number, Set<number>>>({});
  // Локальная правка цен позиций
  const [priceOverrides, setPriceOverrides] = useState<Record<number, number>>({});
  // Локальная правка количества позиций
  const [qtyOverrides, setQtyOverrides] = useState<Record<number, number>>({});
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectComment, setRejectComment] = useState<Record<number, string>>({});
  const [showRejectForm, setShowRejectForm] = useState<Record<number, boolean>>({});
  // Какой заявке сейчас добавляем позицию
  const [showAddPart, setShowAddPart] = useState<Record<number, boolean>>({});

  // По умолчанию отмечаем одобренные позиции (или все) не затирая уже сделанный выбор
  useEffect(() => {
    if (!data) return;
    setCheckedParts(prev => {
      const next = { ...prev };
      for (const t of (data as unknown as ReviewTicket[])) {
        if (next[t.id]) continue;
        const approved = new Set(t.parts.filter(p => p.isApproved).map(p => p.id));
        next[t.id] = approved.size > 0 ? approved : new Set(t.parts.map(p => p.id));
      }
      return next;
    });
  }, [data]);

  const partPrice = (part: ReviewTicket['parts'][number]) => priceOverrides[part.id] ?? part.price;
  const partQty = (part: ReviewTicket['parts'][number]) => qtyOverrides[part.id] ?? part.requiredQuantity;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetApiManagerReviewQueryKey() });

  const handleQtyInput = (partId: number, qty: number) => {
    setQtyOverrides(prev => ({ ...prev, [partId]: qty }));
  };

  const handleQtyCommit = async (partId: number, qty: number) => {
    const safe = Math.max(1, Math.round(qty) || 1);
    setQtyOverrides(prev => ({ ...prev, [partId]: safe }));
    try {
      await updateTicketPartQuantity(partId, safe);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка обновления количества');
    }
  };

  const handleDeletePart = async (partId: number) => {
    if (!window.confirm('Удалить позицию из сметы заявки?')) return;
    try {
      await deleteTicketPart(partId);
      invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  };

  const handleAddPart = async (ticketId: number, nomenclatureId: number, quantity: number) => {
    await addTicketPart(ticketId, nomenclatureId, quantity);
    setShowAddPart(p => ({ ...p, [ticketId]: false }));
    invalidate();
  };

  const togglePart = (ticketId: number, partId: number) => {
    setCheckedParts(prev => {
      const set = new Set(prev[ticketId] ?? []);
      set.has(partId) ? set.delete(partId) : set.add(partId);
      return { ...prev, [ticketId]: set };
    });
  };

  const handlePartPriceInput = (partId: number, price: number) => {
    setPriceOverrides(prev => ({ ...prev, [partId]: price }));
  };

  const handlePartPriceCommit = async (partId: number, price: number) => {
    try {
      const result = await updateTicketPartPrice(partId, price);
      if (result.priceDiffers) {
        const confirmed = window.confirm(
          `Введённая цена (${price.toLocaleString()} ₽) отличается от цены в справочнике номенклатуры (${result.nomenclaturePrice.toLocaleString()} ₽).\n\nЗафиксировать ${price.toLocaleString()} ₽ как актуальную цену в справочнике?`
        );
        if (confirmed) {
          await updateTicketPartPrice(partId, price, true);
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка обновления цены');
    }
  };

  const handleApprove = async (ticketId: number) => {
    setApprovingId(ticketId);
    try {
      await approveTicketParts(ticketId, Array.from(checkedParts[ticketId] ?? []));
      invalidate();
    } catch (err) { alert(err instanceof Error ? err.message : 'Ошибка'); }
    finally { setApprovingId(null); }
  };

  const handleReject = async (ticketId: number) => {
    setRejectingId(ticketId);
    try {
      await rejectPurchase(ticketId, rejectComment[ticketId] || undefined);
      invalidate();
    } catch (err) { alert(err instanceof Error ? err.message : 'Ошибка'); }
    finally { setRejectingId(null); }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-black">На рассмотрении</h2>
        <p className="text-sm text-slate-500 mt-1">Заявки ожидающие закупки — отметьте нужные позиции и одобрите</p>
      </div>
      {error ? <ReportError message={error instanceof Error ? error.message : 'Ошибка загрузки'} /> : null}
      {isLoading ? (
        <div className="space-y-4">{[1, 2].map(i => <Skeleton key={i} className="h-48" />)}</div>
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-semibold">Нет заявок на рассмотрении</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(ticket => {
            const checked = checkedParts[ticket.id] ?? new Set();
            const total = Array.from(checked).reduce((s, pid) => {
              const p = ticket.parts.find(x => x.id === pid);
              return s + (p ? partPrice(p) * partQty(p) : 0);
            }, 0);

            const allApproved = ticket.parts.length > 0 && ticket.parts.every(p => p.isApproved);

            return (
              <div key={ticket.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${allApproved ? 'border-emerald-200' : 'border-slate-200'}`}>
                {/* Баннер "ожидаем поставки" для уже согласованных заявок */}
                {allApproved && (
                  <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-2.5 flex items-center gap-2 text-emerald-700">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs font-bold">Список согласован — ожидаем поступления деталей на склад</span>
                  </div>
                )}
                {/* Заголовок заявки */}
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-black text-[#3b82f6] bg-blue-50 px-2 py-1 rounded-md">#{ticket.id}</span>
                      {normalizePriority(ticket.priority) !== 'NORMAL' && <PriorityBadge priority={normalizePriority(ticket.priority)} />}
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{ticket.category.name}</span>
                      <span className="text-xs text-slate-400">{ticket.room}</span>
                    </div>
                    <p className="font-bold text-slate-800">{ticket.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Исполнитель: {ticket.executor?.fullName ?? '—'} · Инициатор: {ticket.initiator?.fullName ?? '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-400 mb-0.5">К закупке</p>
                    <p className="text-xl font-black text-[#4f46e5]">{total.toLocaleString()} ₽</p>
                  </div>
                </div>

                {/* Позиции */}
                <div className="p-5">
                  {ticket.parts.length > 0 ? (
                    <>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Позиции</p>
                      <div className="space-y-2 mb-5">
                        {ticket.parts.map(part => (
                          <div key={part.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            checked.has(part.id) ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                            <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                              <input type="checkbox" checked={checked.has(part.id)}
                                onChange={() => togglePart(ticket.id, part.id)}
                                className="w-4 h-4 accent-blue-600 rounded shrink-0" />
                              <span className="flex-1 text-sm font-semibold text-slate-800 truncate">{part.nomenclature.name}</span>
                            </label>
                            {/* Количество (редактируемое) */}
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="number"
                                min={1}
                                value={partQty(part)}
                                onClick={e => e.stopPropagation()}
                                onChange={e => handleQtyInput(part.id, Math.max(1, Number(e.target.value) || 1))}
                                onBlur={e => handleQtyCommit(part.id, Math.max(1, Number(e.target.value) || 1))}
                                className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm text-center font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-xs text-slate-400 w-8">{part.nomenclature.unit.shortName}</span>
                            </div>
                            {/* Цена (редактируемая) */}
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="number"
                                min={0}
                                value={partPrice(part)}
                                onClick={e => e.stopPropagation()}
                                onChange={e => handlePartPriceInput(part.id, Math.max(0, Number(e.target.value) || 0))}
                                onBlur={e => handlePartPriceCommit(part.id, Math.max(0, Number(e.target.value) || 0))}
                                className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm text-right font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-xs text-slate-400">₽/шт</span>
                            </div>
                            <span className="text-sm font-bold text-slate-700 ml-2 w-20 text-right shrink-0">{(partPrice(part) * partQty(part)).toLocaleString()} ₽</span>
                            {/* Удалить позицию */}
                            <button onClick={() => handleDeletePart(part.id)} title="Удалить позицию"
                              className="shrink-0 text-slate-300 hover:text-red-500 transition-colors p-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400 mb-5">Позиции не указаны</p>
                  )}

                  {/* Добавление позиции в смету вручную */}
                  {showAddPart[ticket.id] ? (
                    <div className="mb-5">
                      <NomenclaturePicker
                        onAdd={(nomId, qty) => handleAddPart(ticket.id, nomId, qty)}
                        onCancel={() => setShowAddPart(p => ({ ...p, [ticket.id]: false }))}
                      />
                    </div>
                  ) : (
                    <button onClick={() => setShowAddPart(p => ({ ...p, [ticket.id]: true }))}
                      className="mb-5 flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      Добавить позицию
                    </button>
                  )}

                  {/* Форма комментария при отклонении */}
                  {showRejectForm[ticket.id] && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                      <label className="block text-xs font-bold text-red-700 mb-1.5">Причина отклонения</label>
                      <textarea rows={2} placeholder="Необязательно, но поможет исполнителю..."
                        value={rejectComment[ticket.id] ?? ''}
                        onChange={e => setRejectComment(p => ({ ...p, [ticket.id]: e.target.value }))}
                        className="w-full bg-white border border-red-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400" />
                    </div>
                  )}

                  {/* Кнопки */}
                  <div className="flex flex-col sm:flex-row gap-2 justify-end">
                    {!showRejectForm[ticket.id] ? (
                      <button onClick={() => setShowRejectForm(p => ({ ...p, [ticket.id]: true }))}
                        className="px-5 py-2.5 bg-white border border-red-300 text-red-500 text-sm font-bold rounded-xl hover:bg-red-50 transition">
                        Отклонить закупку
                      </button>
                    ) : (
                      <>
                        <button onClick={() => setShowRejectForm(p => ({ ...p, [ticket.id]: false }))}
                          className="px-5 py-2.5 bg-slate-100 text-slate-500 text-sm font-bold rounded-xl hover:bg-slate-200 transition">
                          Отмена
                        </button>
                        <button onClick={() => handleReject(ticket.id)} disabled={rejectingId === ticket.id}
                          className="px-5 py-2.5 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-2 justify-center">
                          {rejectingId === ticket.id
                            ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>Отклоняю...</>
                            : 'Подтвердить отклонение'}
                        </button>
                      </>
                    )}
                    <button onClick={() => handleApprove(ticket.id)} disabled={approvingId === ticket.id || checked.size === 0}
                      className="px-5 py-2.5 bg-[#4f46e5] text-white text-sm font-bold rounded-xl hover:bg-[#4338ca] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center">
                      {approvingId === ticket.id
                        ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>Одобряю...</>
                        : 'Одобрить и отправить в работу'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
