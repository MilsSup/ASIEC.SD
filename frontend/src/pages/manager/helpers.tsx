import type { ReactNode } from 'react';

// Статус позиции на складе. Дефицит только если задан мин. остаток >0, пусто без минимума - нейтрально
export type StockStatus = 'deficit' | 'empty' | 'ok';
export const getStockStatus = (quantity: number, minQuantity: number): StockStatus => {
  if (minQuantity > 0 && quantity <= minQuantity) return 'deficit';
  if (quantity === 0) return 'empty';
  return 'ok';
};

// Склонение существительного по числу: pluralRu(5, ['заявка','заявки','заявок'])
export const pluralRu = (n: number, forms: [string, string, string]) => {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
};

// Читаемая длительность из миллисекунд
export const formatDuration = (ms: number | null) => {
  if (ms == null) return '—';
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) return '< 1 мин';
  if (totalMin < 60) return `${totalMin} мин`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h < 24) return m ? `${h} ч ${m} мин` : `${h} ч`;
  const d = Math.floor(h / 24);
  const hr = h % 24;
  return hr ? `${d} д ${hr} ч` : `${d} д`;
};

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={`bg-slate-100 rounded-lg animate-pulse ${className}`} />
);

export const ReportError = ({ message }: { message: string }) => (
  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-4 py-3 rounded-xl">{message}</div>
);

export const StatCard = ({ label, value, color, badge, hint, onClick }: {
  label: string; value: ReactNode; color: string; badge?: boolean; hint?: string; onClick?: () => void;
}) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-2xl border shadow-sm p-5 text-left transition
      ${badge ? 'border-amber-200' : 'border-slate-200'}
      ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300' : ''}`}
  >
    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
    <p className={`text-3xl font-black ${color}`}>{value}</p>
    {hint && <p className="text-[11px] text-slate-400 mt-1.5">{hint}</p>}
  </div>
);
