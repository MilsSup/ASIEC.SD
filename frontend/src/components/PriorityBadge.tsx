// Срочность заявки. Общие настройки и бейдж,
// используются в портале, канбане и странице руководителя.

export type Priority = 'LOW' | 'NORMAL' | 'HIGH';

interface PriorityMeta {
  label: string;       // отображаемое название
  rank: number;        // вес для сортировки (чем больше тем срочнее)
  badgeClass: string;  // классы бейджа (фон/текст/рамка)
  dotClass: string;    // цвет точки-индикатора
  accentClass: string; // цвет акцентной полосы на карточке
}

export const PRIORITY_CONFIG: Record<Priority, PriorityMeta> = {
  HIGH:   { label: 'Срочная', rank: 3, badgeClass: 'bg-red-100 text-red-700 border-red-200',     dotClass: 'bg-red-500',   accentClass: 'bg-red-500' },
  NORMAL: { label: 'Обычная', rank: 2, badgeClass: 'bg-slate-100 text-slate-500 border-slate-200', dotClass: 'bg-slate-400', accentClass: 'bg-slate-300' },
  LOW:    { label: 'Низкая',  rank: 1, badgeClass: 'bg-sky-50 text-sky-600 border-sky-100',       dotClass: 'bg-sky-400',   accentClass: 'bg-sky-300' },
};

// порядок для выпадающих списков
export const PRIORITY_OPTIONS: Priority[] = ['HIGH', 'NORMAL', 'LOW'];

// приводит значение из API к корректному уровню (на случай отсутствия/мусора)
export const normalizePriority = (p: string | null | undefined): Priority =>
  p === 'LOW' || p === 'HIGH' ? p : 'NORMAL';

export const priorityRank = (p: string | null | undefined): number => PRIORITY_CONFIG[normalizePriority(p)].rank;

export const PriorityBadge = ({ priority, className = '' }: { priority: Priority; className?: string }) => {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${cfg.badgeClass} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
};
