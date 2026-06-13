import { useState, useEffect, useCallback, useRef } from 'react';
import { getNomenclature, createNomenclatureItem, checkTicketParts } from '../api/tickets';
import { NomenclatureCreateForm, type NomenclatureFormValues } from './NomenclatureCreateForm';
import { Modal, ModalHeader } from './Modal';

export interface NomenclatureItem {
  id: number;
  name: string;
  article: string | null;
  price: number;
  unit: { id: number; shortName: string; fullName: string };
}

export interface PartCheckItem {
  nomenclatureId: number;
  name: string;
  unit: string;
  price: number;
  requested: number;
  writeOffQty: number;
  purchaseQty: number;
  ownAvailable: number;
  otherAvailable: number;
  otherBuilding: number | null;
}

// ─── Модальное окно выбора детали ────────────────────────────────────────────

interface CartLine {
  item: NomenclatureItem;
  quantity: number;
}

interface NomenclatureModalProps {
  ticketId: number;
  onClose: () => void;
  onConfirm: (ticketId: number, items: { nomenclatureId: number; writeOffQty: number; purchaseQty: number }[]) => void;
  isSubmitting: boolean;
  initialItems?: { nomenclatureId: number; quantity: number }[];
}

export const NomenclatureModal = ({ ticketId, onClose, onConfirm, isSubmitting, initialItems }: NomenclatureModalProps) => {
  const [step, setStep] = useState<'select' | 'review'>('select');
  const [isInitializing, setIsInitializing] = useState(!!initialItems && initialItems.length > 0);

  const [items, setItems] = useState<NomenclatureItem[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [cart, setCart] = useState<Record<number, CartLine>>({});

  // Форма создания новой позиции
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newItem, setNewItem] = useState<NomenclatureFormValues>({ name: '', article: '', unitId: 1, price: 0 });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Проверка наличия на складах
  const [checkResult, setCheckResult] = useState<PartCheckItem[]>([]);
  const [writeOffSplits, setWriteOffSplits] = useState<Record<number, number>>({});
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState('');

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadItems = useCallback(async (q?: string) => {
    setIsLoading(true);
    try {
      const data = await getNomenclature(q);
      setItems(data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => loadItems(value), 300);
  };

  const toggleCartItem = (item: NomenclatureItem) => {
    setCart(prev => {
      const next = { ...prev };
      if (next[item.id]) {
        delete next[item.id];
      } else {
        next[item.id] = { item, quantity: 1 };
      }
      return next;
    });
  };

  const setCartQuantity = (itemId: number, quantity: number) => {
    setCart(prev => prev[itemId] ? { ...prev, [itemId]: { ...prev[itemId], quantity: Math.max(1, quantity) } } : prev);
  };

  const handleCreate = async () => {
    if (!newItem.name.trim()) { setCreateError('Введите название'); return; }
    setIsCreating(true);
    setCreateError('');
    try {
      const created = await createNomenclatureItem(newItem.name.trim(), newItem.unitId, newItem.article.trim() || undefined, newItem.price);
      setItems(prev => [created, ...prev]);
      setCart(prev => ({ ...prev, [created.id]: { item: created, quantity: 1 } }));
      setShowCreateForm(false);
      setNewItem({ name: '', article: '', unitId: 1, price: 0 });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Ошибка создания');
    } finally {
      setIsCreating(false);
    }
  };

  const cartLines = Object.values(cart);

  const handleNext = async () => {
    if (cartLines.length === 0) return;
    setIsChecking(true);
    setCheckError('');
    try {
      const data = await checkTicketParts(
        ticketId,
        cartLines.map(line => ({ nomenclatureId: line.item.id, quantity: line.quantity })),
      );
      const resultItems: PartCheckItem[] = data.items;
      setCheckResult(resultItems);
      setWriteOffSplits(Object.fromEntries(resultItems.map(r => [r.nomenclatureId, Math.min(r.writeOffQty, r.requested, r.ownAvailable)])));
      setStep('review');
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'Ошибка проверки наличия');
    } finally {
      setIsChecking(false);
    }
  };

  // Если переданы ранее запрошенные позиции, то сразу проверяем наличие и открываем шаг подтверждения
  useEffect(() => {
    if (!initialItems || initialItems.length === 0) return;
    let cancelled = false;
    setIsChecking(true);
    checkTicketParts(ticketId, initialItems)
      .then(data => {
        if (cancelled) return;
        const resultItems: PartCheckItem[] = data.items;
        setCheckResult(resultItems);
        setWriteOffSplits(Object.fromEntries(resultItems.map(r => [r.nomenclatureId, Math.min(r.writeOffQty, r.requested, r.ownAvailable)])));
        setStep('review');
      })
      .catch(err => {
        if (!cancelled) setCheckError(err instanceof Error ? err.message : 'Ошибка проверки наличия');
      })
      .finally(() => {
        if (!cancelled) {
          setIsChecking(false);
          setIsInitializing(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const setWriteOffQty = (nomenclatureId: number, value: number, max: number) => {
    setWriteOffSplits(prev => ({ ...prev, [nomenclatureId]: Math.min(Math.max(0, value), max) }));
  };

  const handleConfirm = () => {
    const payload = checkResult
      .map(r => {
        const writeOffQty = writeOffSplits[r.nomenclatureId] ?? 0;
        return { nomenclatureId: r.nomenclatureId, writeOffQty, purchaseQty: r.requested - writeOffQty };
      })
      .filter(r => r.writeOffQty > 0 || r.purchaseQty > 0);
    if (payload.length === 0) return;
    onConfirm(ticketId, payload);
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader
        title={step === 'select' && !isInitializing ? 'Нужна деталь со склада' : 'Проверка наличия'}
        subtitle={step === 'select' && !isInitializing
          ? `Заявка #${ticketId} · выберите одну или несколько позиций`
          : `Заявка #${ticketId} · что спишем сразу, а что закажем`}
        onClose={onClose}
      />

        {isInitializing ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <svg className="w-6 h-6 animate-spin text-amber-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>
        ) : step === 'select' ? (
          <>
            {/* Поиск */}
            <div className="p-4 border-b border-slate-100 shrink-0">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Поиск по названию..."
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Список номенклатуры */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <svg className="w-6 h-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <p className="text-sm font-medium">Ничего не найдено</p>
                  <p className="text-xs mt-1">Попробуйте другой запрос или создайте новую позицию</p>
                </div>
              ) : (
                items.map(item => {
                  const inCart = cart[item.id];
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleCartItem(item)}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                        inCart
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${inCart ? 'bg-blue-500' : 'border border-slate-300'}`}>
                            {inCart && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-slate-800 truncate">{item.name}</span>
                        </div>
                        {inCart ? (
                          <input
                            type="number"
                            min={1}
                            value={inCart.quantity}
                            onClick={e => e.stopPropagation()}
                            onChange={e => setCartQuantity(item.id, Number(e.target.value) || 1)}
                            className="w-14 shrink-0 bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                          />
                        ) : (
                          <span className="text-xs text-slate-400 shrink-0">{item.unit.shortName}</span>
                        )}
                      </div>
                      {item.article && (
                        <p className="text-xs text-slate-400 mt-0.5 ml-6 truncate">Арт. {item.article}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Форма создания новой позиции */}
            {showCreateForm && (
              <div className="px-4 pb-2 shrink-0 border-t border-slate-100 pt-4">
                <NomenclatureCreateForm
                  values={newItem}
                  onChange={setNewItem}
                  onSubmit={handleCreate}
                  onCancel={() => { setShowCreateForm(false); setCreateError(''); }}
                  isSubmitting={isCreating}
                  error={createError}
                  submitLabel="Создать и добавить"
                />
              </div>
            )}

            {checkError && (
              <div className="px-4 pt-2 shrink-0">
                <p className="text-xs text-red-500 font-medium">{checkError}</p>
              </div>
            )}

            {/* Футер */}
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
              {!showCreateForm && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Добавить позицию
                </button>
              )}
              <div className="flex items-center gap-2 sm:ml-auto">
                {cartLines.length > 0 && (
                  <span className="text-xs font-bold text-slate-400">Выбрано: {cartLines.length}</span>
                )}
                <button
                  onClick={onClose}
                  className="flex-1 sm:flex-none px-4 py-2 text-sm font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition"
                >
                  Отмена
                </button>
                <button
                  onClick={handleNext}
                  disabled={cartLines.length === 0 || isChecking}
                  className="flex-1 sm:flex-none px-4 py-2 text-sm font-bold text-white bg-amber-500 rounded-xl hover:bg-amber-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isChecking ? 'Проверяю...' : 'Далее'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Шаг проверки наличия */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
              <p className="text-xs text-slate-400 px-1 mb-2">
                Можно скорректировать, сколько списать со своего склада сразу, а сколько заказать.
              </p>
              {checkResult.map(r => {
                const writeOffQty = writeOffSplits[r.nomenclatureId] ?? 0;
                const purchaseQty = r.requested - writeOffQty;
                return (
                  <div key={r.nomenclatureId} className="p-3 rounded-xl border border-slate-200 bg-white space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800 truncate">{r.name}</span>
                      <span className="text-xs font-bold text-slate-400 shrink-0">Требуется: {r.requested} {r.unit}</span>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-xs font-bold text-emerald-600">Списать со склада</span>
                        <input
                          type="number"
                          min={0}
                          max={Math.min(r.ownAvailable, r.requested)}
                          value={writeOffQty}
                          onChange={e => setWriteOffQty(r.nomenclatureId, Number(e.target.value) || 0, Math.min(r.ownAvailable, r.requested))}
                          disabled={r.ownAvailable === 0}
                          className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 transition disabled:opacity-50"
                        />
                        <span className="text-[11px] text-slate-400">из {r.ownAvailable} {r.unit}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs font-bold text-amber-600">Заказать: {purchaseQty} {r.unit}</span>
                      </div>
                    </div>

                    {purchaseQty > 0 && r.otherAvailable > 0 && (
                      <p className="text-[11px] text-amber-600">
                        ⚠ Есть {r.otherAvailable} {r.unit} на складе корпуса {r.otherBuilding}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Футер */}
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3 shrink-0">
              {!(initialItems && initialItems.length > 0) && (
                <button
                  onClick={() => setStep('select')}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none px-4 py-2 text-sm font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition disabled:opacity-50"
                >
                  Назад
                </button>
              )}
              <button
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none px-4 py-2 text-sm font-bold text-white bg-amber-500 rounded-xl hover:bg-amber-600 transition disabled:opacity-40 disabled:cursor-not-allowed sm:ml-auto"
              >
                {isSubmitting ? 'Обрабатываю...' : 'Подтвердить'}
              </button>
            </div>
          </>
        )}
    </Modal>
  );
};
