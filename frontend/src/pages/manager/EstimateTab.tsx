import { useGetApiManagerEstimate } from '../../generated/endpoints/default/default';
import { exportEstimatePdf } from '../../lib/estimatePdf';
import { Skeleton, ReportError } from './helpers';

export const EstimateTab = ({ author }: { author: string }) => {
  const { data, isLoading, error } = useGetApiManagerEstimate();
  const estimate = data ?? [];

  // Группируем одинаковые позиции из разных заявок
  const groupedEstimate = estimate.reduce<{ name: string; unit: string; qty: number; price: number; tickets: number[] }[]>((acc, part) => {
    const ex = acc.find(i => i.name === part.nomenclature.name);
    if (ex) { ex.qty += part.requiredQuantity; if (!ex.tickets.includes(part.ticket.id)) ex.tickets.push(part.ticket.id); }
    else acc.push({ name: part.nomenclature.name, unit: part.nomenclature.unit.shortName, qty: part.requiredQuantity, price: part.price, tickets: [part.ticket.id] });
    return acc;
  }, []);
  const estimateTotal = groupedEstimate.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black">Сводная смета</h2>
          <p className="text-sm text-slate-500 mt-1">Все одобренные позиции для закупки</p>
        </div>
        {groupedEstimate.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="bg-[#4f46e5]/10 px-4 py-2.5 rounded-xl flex items-center gap-3">
              <span className="text-sm font-bold text-[#4f46e5] uppercase tracking-wider">Итого:</span>
              <span className="text-xl font-black text-[#4f46e5]">{estimateTotal.toLocaleString()} ₽</span>
            </div>
            <button onClick={() => exportEstimatePdf(groupedEstimate, estimateTotal, author)}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-slate-50 transition shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Скачать PDF
            </button>
          </div>
        )}
      </div>
      {error ? <ReportError message={error instanceof Error ? error.message : 'Ошибка загрузки'} /> : null}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>{['Наименование', 'Кол-во', 'Заявки', 'Сумма'].map(h => (
                <th key={h} className="px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}><td colSpan={4} className="px-5 py-4"><Skeleton className="h-5 w-full" /></td></tr>
              )) : groupedEstimate.length === 0 ? (
                <tr><td colSpan={4} className="p-10 text-center text-slate-400 font-medium text-sm">Нет одобренных позиций</td></tr>
              ) : groupedEstimate.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 font-bold text-slate-800 text-sm">{item.name}</td>
                  <td className="px-5 py-4 text-center font-black text-slate-700 text-sm">{item.qty} {item.unit}</td>
                  <td className="px-5 py-4"><div className="flex gap-1.5 flex-wrap">{item.tickets.map(t => (
                    <span key={t} className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded-md">#{t}</span>
                  ))}</div></td>
                  <td className="px-5 py-4 text-right font-black text-slate-800 text-sm">{(item.price * item.qty).toLocaleString()} ₽</td>
                </tr>
              ))}
            </tbody>
            {groupedEstimate.length > 0 && (
              <tfoot className="bg-white border-t-2 border-slate-200">
                <tr>
                  <td colSpan={3} className="px-5 py-5 text-right font-bold text-slate-400 uppercase tracking-wider text-xs">Итого к закупке:</td>
                  <td className="px-5 py-5 text-right font-black text-[#4f46e5] text-xl">{estimateTotal.toLocaleString()} ₽</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
