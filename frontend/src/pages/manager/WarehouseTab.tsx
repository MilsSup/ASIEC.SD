import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetApiManagerWarehouse, getGetApiManagerWarehouseQueryKey } from '../../generated/endpoints/default/default';
import { receiveGoods } from '../../api/manager';
import { ReceiveModal } from '../../components/ReceiveModal';
import { AddStockModal } from '../../components/AddStockModal';
import { getStockStatus, Skeleton, ReportError } from './helpers';
import type { InventoryItem } from './types';

export const WarehouseTab = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useGetApiManagerWarehouse();
  // Эндпоинт всегда отдаёт позиции с включёнными nomenclature/warehouse
  const warehouse = (data ?? []) as unknown as InventoryItem[];

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<number | 'all'>('all');
  // Локальное превью неснижаемого остатка
  const [editingMinQty, setEditingMinQty] = useState<Record<number, number>>({});
  const [receiveItem, setReceiveItem] = useState<InventoryItem | null>(null);
  const [showAddStock, setShowAddStock] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetApiManagerWarehouseQueryKey() });

  const handleReceiveGoods = async (inventoryId: number, qty: number) => {
    await receiveGoods(inventoryId, qty);
    invalidate();
  };

  // Список складов выводим из данных инвентаря — реальные id из БД
  const warehouseOptions = Array.from(
    new Map(warehouse.map(item => [item.warehouse.id, item.warehouse])).values()
  ).sort((a, b) => a.id - b.id);

  const filteredWarehouse = warehouse.filter(item => {
    const matchesSearch = search.trim()
      ? item.nomenclature.name.toLowerCase().includes(search.trim().toLowerCase())
        || (item.nomenclature.article ?? '').toLowerCase().includes(search.trim().toLowerCase())
      : true;
    const matchesBuilding = filter === 'all' || item.warehouse.id === filter;
    return matchesSearch && matchesBuilding;
  });

  return (
    <div>
      {receiveItem && <ReceiveModal item={receiveItem} onClose={() => setReceiveItem(null)} onConfirm={handleReceiveGoods} />}
      {showAddStock && <AddStockModal onClose={() => setShowAddStock(false)} onAdded={() => invalidate()} />}

      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black">Склад ИТ</h2>
          <p className="text-sm text-slate-500 mt-1">Инвентарь и контроль неснижаемых остатков</p>
        </div>
        <button onClick={() => setShowAddStock(true)}
          className="flex items-center gap-2 bg-emerald-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-emerald-600 transition shadow-sm self-start sm:self-auto">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Добавить позиции
        </button>
      </div>

      {/* Фильтры */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 min-w-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Поиск по названию или артикулу..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        >
          <option value="all">Все корпуса</option>
          {warehouseOptions.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {error ? <ReportError message={error instanceof Error ? error.message : 'Ошибка загрузки'} /> : null}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>{['Наименование', 'Склад', 'Остаток', 'Мин. запас', 'Статус', ''].map(h => (
                <th key={h} className="px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="px-5 py-4"><Skeleton className="h-5 w-full" /></td></tr>
              )) : filteredWarehouse.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-slate-400 text-sm font-medium">
                  {warehouse.length === 0 ? 'Нет данных по складу' : 'Ничего не найдено'}
                </td></tr>
              ) : filteredWarehouse.map(item => {
                const minQty = editingMinQty[item.id] ?? item.minQuantity;
                const status = getStockStatus(item.quantity, minQty);
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-800 text-sm">{item.nomenclature.name}</p>
                      {item.nomenclature.article && <p className="text-xs text-slate-400 font-mono">Арт. {item.nomenclature.article}</p>}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500 font-medium">{item.warehouse.name}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`text-lg font-black ${status === 'deficit' ? 'text-red-600' : status === 'empty' ? 'text-slate-400' : 'text-slate-800'}`}>{item.quantity}</span>
                      <span className="text-xs text-slate-400 ml-1">{item.nomenclature.unit.shortName}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <input
                        type="number"
                        min={0}
                        value={minQty}
                        onChange={e => setEditingMinQty(p => ({ ...p, [item.id]: Math.max(0, Number(e.target.value)) }))}
                        className="w-16 text-center text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg py-1 px-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white hover:border-slate-300 transition"
                      />
                    </td>
                    <td className="px-5 py-4 text-center">
                      {status === 'deficit'
                        ? <span className="bg-red-100 text-red-600 px-3 py-1 rounded-md text-xs font-bold">Дефицит</span>
                        : status === 'empty'
                        ? <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-md text-xs font-bold">Нет в наличии</span>
                        : <span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-md text-xs font-bold">В норме</span>}
                    </td>
                    <td className="px-5 py-4">
                      <button onClick={() => setReceiveItem(item)} className="text-xs font-bold text-[#3b82f6] hover:text-blue-800 transition whitespace-nowrap">
                        + Приход
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
