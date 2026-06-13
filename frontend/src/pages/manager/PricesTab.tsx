import { useState, useEffect } from 'react';
import { useGetApiManagerPriceHistory } from '../../generated/endpoints/default/default';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Skeleton, ReportError } from './helpers';

const PRICE_PAGE_SIZE = 20;

export const PricesTab = () => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Сброс на первую страницу при смене фильтров
  useEffect(() => { setPage(1); }, [debouncedSearch, dateFrom, dateTo]);

  const { data, isLoading, error } = useGetApiManagerPriceHistory({
    search: debouncedSearch || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page: String(page),
    limit: String(PRICE_PAGE_SIZE),
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-black">История цен</h2>
        <p className="text-sm text-slate-500 mt-1">Цены позиций по заявкам и списаниям со склада</p>
      </div>

      {/* Фильтры */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 min-w-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Поиск по названию..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          <span className="text-slate-400 text-sm">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors px-1"
            >
              Сбросить
            </button>
          )}
        </div>
      </div>

      {error ? <ReportError message={error instanceof Error ? error.message : 'Ошибка загрузки'} /> : null}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <p className="font-semibold">Пока нет данных по ценам</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {items.map(item => {
            const isOpen = expanded.has(item.id);
            const lastPrice = item.history[0]?.price;
            const priceChanged = lastPrice !== undefined && lastPrice !== item.currentPrice;
            return (
              <div key={item.id}>
                <button
                  onClick={() => setExpanded(prev => {
                    const next = new Set(prev);
                    next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                    return next;
                  })}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{item.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{item.history.length} {item.history.length === 1 ? 'запись' : 'записей'}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-800">{item.currentPrice.toLocaleString()} ₽ <span className="text-xs font-normal text-slate-400">/ {item.unit}</span></p>
                      {priceChanged && (
                        <p className="text-[11px] text-slate-400">было {lastPrice!.toLocaleString()} ₽</p>
                      )}
                    </div>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 overflow-x-auto">
                    <table className="w-full text-left min-w-[480px]">
                      <thead>
                        <tr>{['Дата', 'Источник', 'Заявка', 'Цена'].map(h => (
                          <th key={h} className="py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {item.history.map((h, idx) => (
                          <tr key={idx}>
                            <td className="py-2 text-sm text-slate-600">{new Date(h.date).toLocaleDateString('ru-RU')}</td>
                            <td className="py-2 text-sm text-slate-600">{h.source === 'purchase' ? 'Закупка' : 'Списание со склада'}</td>
                            <td className="py-2"><span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded-md">#{h.ticketId}</span></td>
                            <td className="py-2 text-sm font-bold text-slate-800">{h.price.toLocaleString()} ₽</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Пагинация */}
      {total > PRICE_PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-slate-400">
            {(page - 1) * PRICE_PAGE_SIZE + 1}–{Math.min(page * PRICE_PAGE_SIZE, total)} из {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 text-sm font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Назад
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page * PRICE_PAGE_SIZE >= total}
              className="px-4 py-2 text-sm font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Далее
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
