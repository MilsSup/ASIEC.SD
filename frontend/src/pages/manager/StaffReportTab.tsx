import { useState } from 'react';
import { useGetApiManagerStaffReport } from '../../generated/endpoints/default/default';
import { formatDuration, Skeleton, ReportError } from './helpers';

export const StaffReportTab = () => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const { data: staffReport, isLoading, error } = useGetApiManagerStaffReport({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const periodLabel = (() => {
    const fmt = (d: string) => new Date(d).toLocaleDateString('ru-RU');
    if (dateFrom && dateTo) return `${fmt(dateFrom)} — ${fmt(dateTo)}`;
    if (dateFrom) return `с ${fmt(dateFrom)}`;
    if (dateTo) return `по ${fmt(dateTo)}`;
    return 'за всё время';
  })();

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-black">Отчёт по работе</h2>
        <p className="text-sm text-slate-500 mt-1">Завершённые и отклонённые заявки, время решения · {periodLabel}</p>
      </div>

      {/* Фильтр периода */}
      <div className="flex items-center gap-2 mb-4">
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

      {/* Итоги по отделу */}
      {staffReport && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Завершено</p>
            <p className="text-2xl font-black text-emerald-600">{staffReport.totalCompleted}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Отклонено</p>
            <p className="text-2xl font-black text-red-500">{staffReport.totalRejected}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ср. время</p>
            <p className="text-2xl font-black text-slate-800">{formatDuration(staffReport.overallAvgTimeMs)}</p>
          </div>
        </div>
      )}

      {/* Список сотрудников */}
      {error ? <ReportError message={error instanceof Error ? error.message : 'Ошибка загрузки'} /> : null}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : !staffReport || staffReport.staff.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <p className="font-semibold">Нет данных по сотрудникам</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {staffReport.staff.map(s => {
            const isOpen = expanded.has(s.id);
            const hasActivity = s.completedCount > 0 || s.rejectedCount > 0;
            const ini = s.fullName.split(' ').slice(0, 2).map(w => w[0]).join('');
            return (
              <div key={s.id}>
                <button
                  onClick={() => hasActivity && setExpanded(prev => {
                    const next = new Set(prev);
                    next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                    return next;
                  })}
                  className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${hasActivity ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-sm font-black text-slate-400 shrink-0">{ini}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800 text-sm truncate">{s.fullName}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{s.position}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-5 shrink-0 text-center">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Заверш.</p>
                      <p className="text-base font-black text-emerald-600">{s.completedCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Откл.</p>
                      <p className="text-base font-black text-red-500">{s.rejectedCount}</p>
                    </div>
                    <div className="min-w-[70px]">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Ср. время</p>
                      <p className="text-base font-black text-slate-700">{formatDuration(s.avgTimeMs)}</p>
                    </div>
                  </div>
                  <div className="flex sm:hidden flex-col items-end shrink-0 text-xs">
                    <span className="font-black text-emerald-600">{s.completedCount} ✓</span>
                    <span className="font-black text-red-500">{s.rejectedCount} ✕</span>
                  </div>
                  {hasActivity && (
                    <svg className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 overflow-x-auto">
                    <table className="w-full text-left min-w-[560px]">
                      <thead>
                        <tr>{['Заявка', 'Категория', 'Действие', 'Дата', 'Время'].map(h => (
                          <th key={h} className="py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {s.tickets.map((t, idx) => (
                          <tr key={idx}>
                            <td className="py-2 pr-3 text-sm text-slate-600"><span className="font-bold text-slate-400">#{t.ticketId}</span> {t.description}</td>
                            <td className="py-2 pr-3 text-sm text-slate-500 whitespace-nowrap">{t.category}</td>
                            <td className="py-2 pr-3 whitespace-nowrap">
                              {t.type === 'completed'
                                ? <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Завершена</span>
                                : <span className="text-[11px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded">Отклонена</span>}
                            </td>
                            <td className="py-2 pr-3 text-sm text-slate-500 whitespace-nowrap">{new Date(t.date).toLocaleDateString('ru-RU')}</td>
                            <td className="py-2 text-sm font-semibold text-slate-700 whitespace-nowrap">{t.type === 'completed' ? formatDuration(t.durationMs) : '—'}</td>
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
