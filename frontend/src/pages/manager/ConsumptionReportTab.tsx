import { useState } from 'react';
import { useGetApiManagerConsumptionReport } from '../../generated/endpoints/default/default';
import { pluralRu, Skeleton, ReportError } from './helpers';

export const ConsumptionReportTab = () => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [building, setBuilding] = useState<number | 'all'>('all');
  const [groupBy, setGroupBy] = useState<'nomenclature' | 'ticket'>('nomenclature');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Данные из сгенерированного react-query хука (рефетч при смене фильтров)
  const { data: report, isLoading, error } = useGetApiManagerConsumptionReport({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    building: building === 'all' ? undefined : String(building),
  });

  const periodLabel = (() => {
    const fmt = (d: string) => new Date(d).toLocaleDateString('ru-RU');
    if (dateFrom && dateTo) return `${fmt(dateFrom)} — ${fmt(dateTo)}`;
    if (dateFrom) return `с ${fmt(dateFrom)}`;
    if (dateTo) return `по ${fmt(dateTo)}`;
    return 'за всё время';
  })();
  const buildingLabel = building === 'all' ? 'все корпуса' : `корпус ${building}`;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-black">Расход склада</h2>
        <p className="text-sm text-slate-500 mt-1">Сколько и каких позиций списано со склада · {periodLabel} · {buildingLabel}</p>
      </div>

      {/* Фильтры: период + разрез */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
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
        <select
          value={building}
          onChange={e => setBuilding(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition self-start"
        >
          <option value="all">Все корпуса</option>
          <option value={1}>Корпус 1</option>
          <option value={2}>Корпус 2</option>
        </select>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 self-start lg:ml-auto">
          {([['nomenclature', 'По позициям'], ['ticket', 'По заявкам']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setGroupBy(key); setExpanded(new Set()); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${groupBy === key ? 'bg-[#3b82f6] text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Итоговые плашки */}
      {report && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Позиций</p>
            <p className="text-2xl font-black text-slate-800">{report.positionsCount}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Заявок</p>
            <p className="text-2xl font-black text-slate-800">{report.ticketsCount}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Операций</p>
            <p className="text-2xl font-black text-slate-800">{report.totalWriteOffs}</p>
          </div>
        </div>
      )}

      {/* Список */}
      {error ? <ReportError message={error instanceof Error ? error.message : 'Ошибка загрузки'} /> : null}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : !report || (groupBy === 'nomenclature' ? report.byNomenclature.length === 0 : report.byTicket.length === 0) ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="font-semibold">За выбранный период списаний не было</p>
          <p className="text-sm mt-1">Измените период или сбросьте фильтр</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {groupBy === 'nomenclature' ? report.byNomenclature.map(row => {
            const isOpen = expanded.has(row.nomenclatureId);
            return (
              <div key={row.nomenclatureId}>
                <button
                  onClick={() => setExpanded(prev => {
                    const next = new Set(prev);
                    next.has(row.nomenclatureId) ? next.delete(row.nomenclatureId) : next.add(row.nomenclatureId);
                    return next;
                  })}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{row.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Списано {row.quantity} {row.unit} · {row.tickets.length} {pluralRu(row.tickets.length, ['заявка', 'заявки', 'заявок'])}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="text-sm font-black text-slate-800 whitespace-nowrap">{row.quantity} {row.unit}</p>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 overflow-x-auto">
                    <table className="w-full text-left min-w-[480px]">
                      <thead>
                        <tr>{['Заявка', 'Дата', 'Склад', 'Кол-во'].map(h => (
                          <th key={h} className="py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {row.tickets.map((t, idx) => (
                          <tr key={idx}>
                            <td className="py-2 pr-3 text-sm text-slate-600"><span className="font-bold text-slate-400">#{t.ticketId}</span> {t.description}</td>
                            <td className="py-2 pr-3 text-sm text-slate-500 whitespace-nowrap">{new Date(t.date).toLocaleDateString('ru-RU')}</td>
                            <td className="py-2 pr-3 text-sm text-slate-500">{t.warehouse}</td>
                            <td className="py-2 text-sm font-bold text-slate-800 whitespace-nowrap">{t.quantity} {row.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          }) : report.byTicket.map(row => {
            const isOpen = expanded.has(row.ticketId);
            return (
              <div key={row.ticketId}>
                <button
                  onClick={() => setExpanded(prev => {
                    const next = new Set(prev);
                    next.has(row.ticketId) ? next.delete(row.ticketId) : next.add(row.ticketId);
                    return next;
                  })}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black text-[#3b82f6] bg-blue-50 px-1.5 py-0.5 rounded shrink-0">#{row.ticketId}</span>
                      <p className="font-bold text-slate-800 text-sm truncate">{row.description}</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {row.items.length} {pluralRu(row.items.length, ['позиция', 'позиции', 'позиций'])}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {row.items[0] && <p className="text-xs font-semibold text-slate-400 whitespace-nowrap">{new Date(row.items[0].date).toLocaleDateString('ru-RU')}</p>}
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 overflow-x-auto">
                    <table className="w-full text-left min-w-[480px]">
                      <thead>
                        <tr>{['Позиция', 'Дата', 'Склад', 'Кол-во'].map(h => (
                          <th key={h} className="py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {row.items.map((it, idx) => (
                          <tr key={idx}>
                            <td className="py-2 pr-3 text-sm text-slate-600">{it.name}</td>
                            <td className="py-2 pr-3 text-sm text-slate-500 whitespace-nowrap">{new Date(it.date).toLocaleDateString('ru-RU')}</td>
                            <td className="py-2 pr-3 text-sm text-slate-500">{it.warehouse}</td>
                            <td className="py-2 text-sm font-bold text-slate-800 whitespace-nowrap">{it.quantity} {it.unit}</td>
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
    </div>
  );
};
