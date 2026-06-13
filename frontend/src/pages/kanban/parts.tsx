import { useState, type ReactNode } from 'react';
import { PRIORITY_CONFIG, PRIORITY_OPTIONS, type Priority } from '../../components/PriorityBadge';

export const CardSkeleton = () => (
  <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm space-y-3 animate-pulse">
    <div className="flex justify-between">
      <div className="h-6 w-10 bg-slate-100 rounded-md" />
      <div className="h-5 w-16 bg-slate-100 rounded-md" />
    </div>
    <div className="h-4 w-3/4 bg-slate-100 rounded-md" />
    <div className="h-3 w-1/2 bg-slate-100 rounded-md" />
    <div className="h-9 w-full bg-slate-100 rounded-xl" />
  </div>
);

// Бейдж срочности с выпадающим меню. Исполнитель может переклассифицировать заявку
export const PriorityControl = ({ priority, onChange, disabled }: { priority: Priority; onChange: (p: Priority) => void; disabled?: boolean }) => {
  const [open, setOpen] = useState(false);
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        title="Изменить срочность"
        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border transition ${cfg.badgeClass} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-95'}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
        {cfg.label}
        <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1 z-20 bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden w-32">
            {PRIORITY_OPTIONS.map(p => {
              const c = PRIORITY_CONFIG[p];
              return (
                <button
                  key={p}
                  onClick={() => { onChange(p); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition ${p === priority ? 'bg-slate-50' : ''}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dotClass}`} />
                  {c.label}
                  {p === priority && (
                    <svg className="w-3 h-3 ml-auto text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// кнопка открытия переписки/истории по заявке
export const HistoryButton = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-slate-400 hover:text-[#3b82f6] transition">
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.2A7.9 7.9 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
    Переписка
  </button>
);

export const RoomBadge = ({ room, building }: { room: string; building: number }) => (
  <span className="text-[11px] sm:text-xs font-bold text-slate-500 flex items-center gap-1.5 min-w-0 max-w-[55%] shrink-0">
    <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
    <span className="truncate">{room}</span>
    <span className="shrink-0 text-[9px] sm:text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">К{building}</span>
  </span>
);

interface ColumnProps {
  title: string;
  count: number;
  headerClass: string;
  titleClass: string;
  badgeClass: string;
  borderClass: string;
  children: ReactNode;
}

export const Column = ({ title, count, headerClass, titleClass, badgeClass, borderClass, children }: ColumnProps) => (
  <div className={`bg-white rounded-2xl shadow-sm border ${borderClass} w-[85vw] sm:w-auto sm:flex-1 sm:min-w-[300px] sm:max-w-[400px] shrink-0 snap-center sm:snap-align-none flex flex-col h-[calc(100dvh-300px)] sm:h-[calc(100dvh-220px)]`}>
    <div className={`p-3 sm:p-4 border-b border-slate-100 flex justify-between items-center ${headerClass} shrink-0`}>
      <h3 className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${titleClass}`}>{title}</h3>
      <span className={`font-black text-[10px] px-2 py-0.5 rounded-full ${badgeClass}`}>{count}</span>
    </div>
    <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">
      {children}
    </div>
  </div>
);
