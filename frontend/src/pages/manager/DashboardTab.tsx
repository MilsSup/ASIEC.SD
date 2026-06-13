import { PriorityBadge, normalizePriority } from '../../components/PriorityBadge';
import { Skeleton, StatCard, ReportError } from './helpers';
import { useGetApiManagerStats } from '../../generated/endpoints/default/default';

export const DashboardTab = ({ onNavigate }: { onNavigate: (tab: string) => void }) => {
  // Данные и состояние загрузки даёт сгенерированный хук
  const { data: stats, isLoading, error } = useGetApiManagerStats();

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-black">Сводка по отделу</h2>
        <p className="text-sm text-slate-500 mt-1">Текущее состояние заявок и склада</p>
      </div>
      {error ? <ReportError message={error instanceof Error ? error.message : 'Ошибка загрузки'} /> : null}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading ? Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-28" />) : stats ? (
          <>
            <StatCard label="Всего заявок"   value={stats.totalTickets}       color="text-slate-800" />
            <StatCard label="Срочные"        value={stats.urgentOpenTickets}   color="text-red-500"
              badge={stats.urgentOpenTickets > 0} hint="Открытые с высокой срочностью" />
            <StatCard label="Новые"          value={stats.newTickets}          color="text-slate-600" />
            <StatCard label="В работе"       value={stats.inProgressTickets}   color="text-[#3b82f6]" />
            <StatCard label="На закупке"     value={stats.waitingTickets}      color="text-amber-500"
              badge={stats.waitingTickets > 0} hint="Ждут решения руководителя"
              onClick={() => onNavigate('review')} />
            <StatCard label="Выполнены"      value={stats.completedTickets}    color="text-emerald-500" />
            <StatCard label="Исполнителей"   value={stats.totalUsers}          color="text-slate-600"
              hint="В ИТ-отделе" onClick={() => onNavigate('staff')} />
            <StatCard label="Дефицит склада" value={stats.lowStockCount}       color="text-red-500"
              badge={stats.lowStockCount > 0} hint="Ниже минимального остатка"
              onClick={() => onNavigate('warehouse')} />
            <StatCard label="Сумма по смете" value={`${stats.estimateTotal.toLocaleString()} ₽`} color="text-[#4f46e5]"
              hint="К закупке по одобренным заявкам" onClick={() => onNavigate('estimate')} />
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {isLoading ? (
          <>
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </>
        ) : stats ? (
          <>
            {/* Заявки, ожидающие решения */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-800">Заявки ждут решения</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Последние заявки, отправленные на закупку</p>
                </div>
                {stats.waitingTickets > 0 && (
                  <button onClick={() => onNavigate('review')} className="text-xs font-bold text-[#3b82f6] hover:underline shrink-0">
                    Все ({stats.waitingTickets})
                  </button>
                )}
              </div>
              {stats.pendingReviews.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <svg className="w-8 h-8 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-semibold">Нет заявок, ожидающих решения</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {stats.pendingReviews.map(r => (
                    <button key={r.id} onClick={() => onNavigate('review')}
                      className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[11px] font-black text-[#3b82f6] bg-blue-50 px-1.5 py-0.5 rounded">#{r.id}</span>
                          {normalizePriority(r.priority) !== 'NORMAL' && <PriorityBadge priority={normalizePriority(r.priority)} />}
                          <span className="text-[11px] font-semibold text-slate-400 truncate">{r.category}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-700 truncate">{r.description}</p>
                      </div>
                      <span className="text-sm font-black text-[#4f46e5] shrink-0">{r.total.toLocaleString()} ₽</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Дефицит склада */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-800">Дефицит склада</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Остаток на уровне минимума или ниже</p>
                </div>
                {stats.lowStockItems.length > 0 && (
                  <button onClick={() => onNavigate('warehouse')} className="text-xs font-bold text-[#3b82f6] hover:underline shrink-0">
                    Склад →
                  </button>
                )}
              </div>
              {stats.lowStockItems.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <svg className="w-8 h-8 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-sm font-semibold">Дефицита нет — все позиции в норме</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {stats.lowStockItems.map(item => (
                    <button key={item.id} onClick={() => onNavigate('warehouse')}
                      className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{item.name}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{item.warehouse}</p>
                      </div>
                      <span className={`text-sm font-black shrink-0 ${item.quantity === 0 ? 'text-red-500' : 'text-amber-500'}`}>
                        {item.quantity} / {item.minQuantity} {item.unit}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
