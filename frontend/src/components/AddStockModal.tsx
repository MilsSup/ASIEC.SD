import { useState, useRef, useEffect } from 'react';
import { Modal, ModalHeader } from './Modal';
import { NomenclatureCreateForm, type NomenclatureFormValues, type UnitOption } from './NomenclatureCreateForm';
import { getNomenclature, getUnits, createNomenclatureItem } from '../api/tickets';
import { addInventoryItem, getWarehouses } from '../api/manager';
import type { InventoryItem, NomenclatureItem } from '../pages/manager/types';

interface WarehouseOption {
  id: number;
  name: string;
  building: number | null;
}

interface AddStockModalProps {
  onClose: () => void;
  onAdded: (item: InventoryItem) => void;
}

interface StockRow {
  id: string;
  nomenclatureId: number | null;
  nomenclatureName: string;
  warehouseId: number;
  quantity: number;
  minQuantity: number;
}

const newRow = (warehouseId = 0): StockRow => ({
  id: Date.now().toString(), nomenclatureId: null, nomenclatureName: '',
  warehouseId, quantity: 1, minQuantity: 0,
});

export const AddStockModal = ({ onClose, onAdded }: AddStockModalProps) => {
  const [rows, setRows] = useState<StockRow[]>([newRow()]);

  // Поиск номенклатуры
  const [searchQuery, setSearchQuery] = useState<Record<string, string>>({});
  const [searchResults, setSearchResults] = useState<Record<string, NomenclatureItem[]>>({});
  const [showDropdown, setShowDropdown] = useState<Record<string, boolean>>({});
  const [showCreateForm, setShowCreateForm] = useState<Record<string, boolean>>({});
  const [newItem, setNewItem] = useState<Record<string, NomenclatureFormValues>>({});
  const searchTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [units, setUnits] = useState<UnitOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    getUnits().then((data: UnitOption[]) => setUnits(data)).catch(() => {});
    getWarehouses().then((data: WarehouseOption[]) => {
      setWarehouses(data);
      // Проставляем первый реальный склад во все строки, где он ещё не выбран
      if (data.length > 0) {
        setRows(rs => rs.map(r => r.warehouseId === 0 ? { ...r, warehouseId: data[0].id } : r));
      }
    }).catch(() => {});
  }, []);

  const addRow = () => setRows(r => [...r, newRow(warehouses[0]?.id ?? 0)]);
  const removeRow = (id: string) => setRows(r => r.filter(x => x.id !== id));
  const updateRow = (id: string, patch: Partial<StockRow>) =>
    setRows(r => r.map(x => x.id === id ? { ...x, ...patch } : x));

  const handleSearch = (rowId: string, q: string) => {
    setSearchQuery(p => ({ ...p, [rowId]: q }));
    updateRow(rowId, { nomenclatureName: q, nomenclatureId: null });
    if (searchTimeouts.current[rowId]) clearTimeout(searchTimeouts.current[rowId]);
    searchTimeouts.current[rowId] = setTimeout(async () => {
      try {
        const data = await getNomenclature(q);
        setSearchResults(p => ({ ...p, [rowId]: data }));
        setShowDropdown(p => ({ ...p, [rowId]: true }));
      } catch { }
    }, 300);
  };

  const handleFocus = (rowId: string) => {
    if (showCreateForm[rowId]) return;
    setShowDropdown(p => ({ ...p, [rowId]: true }));
    if (!searchResults[rowId]) {
      getNomenclature('').then(data => {
        setSearchResults(p => ({ ...p, [rowId]: data }));
      }).catch(() => {});
    }
  };

  const selectNomenclature = (rowId: string, item: NomenclatureItem) => {
    updateRow(rowId, { nomenclatureId: item.id, nomenclatureName: item.name });
    setShowDropdown(p => ({ ...p, [rowId]: false }));
    setSearchQuery(p => ({ ...p, [rowId]: item.name }));
  };

  const getNewItem = (rowId: string): NomenclatureFormValues => newItem[rowId] ?? { name: '', article: '', unitId: units[0]?.id ?? 0, price: 0 };

  const handleCreateNomenclature = async (rowId: string) => {
    const values = getNewItem(rowId);
    const name = values.name.trim();
    if (!name) return;
    try {
      const created = await createNomenclatureItem(name, values.unitId, values.article.trim() || undefined, values.price);
      selectNomenclature(rowId, created);
      setShowCreateForm(p => ({ ...p, [rowId]: false }));
      setNewItem(p => ({ ...p, [rowId]: { name: '', article: '', unitId: units[0]?.id ?? 0, price: 0 } }));
    } catch (err) {
      setErrors(p => ({ ...p, [rowId]: err instanceof Error ? err.message : 'Ошибка' }));
    }
  };

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    rows.forEach(r => { if (!r.nomenclatureId) errs[r.id] = 'Выберите номенклатуру'; });
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setIsSaving(true);
    try {
      for (const row of rows) {
        const item = await addInventoryItem({
          warehouseId: row.warehouseId,
          nomenclatureId: row.nomenclatureId!,
          quantity: row.quantity,
          minQuantity: row.minQuantity,
        });
        onAdded(item);
      }
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-3xl">
      <ModalHeader title="Добавить позиции на склад" subtitle="Выберите или создайте номенклатуру, укажите количество" onClose={onClose} />

      <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-0">
        {rows.map((row, idx) => (
          <div key={row.id} className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Позиция {idx + 1}</span>
              {rows.length > 1 && (
                <button onClick={() => removeRow(row.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Номенклатура с поиском */}
            <div className="flex flex-col">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Номенклатура *</label>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Начните вводить название..."
                  value={searchQuery[row.id] ?? row.nomenclatureName}
                  onChange={e => handleSearch(row.id, e.target.value)}
                  onFocus={() => handleFocus(row.id)}
                  onBlur={() => {
                    // Задержка, чтобы успел сработать onMouseDown на элементах списка
                    setTimeout(() => setShowDropdown(p => ({ ...p, [row.id]: false })), 150);
                  }}
                  className={`w-full bg-white border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${errors[row.id] ? 'border-red-300' : 'border-slate-200'} ${row.nomenclatureId ? 'border-emerald-300 bg-emerald-50' : ''}`}
                />

                {row.nomenclatureId && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}

                {showDropdown[row.id] && (
                  <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {searchResults[row.id]?.map(item => (
                      <button key={item.id} onMouseDown={() => selectNomenclature(row.id, item)}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors flex justify-between items-center">
                        <span className="font-medium text-slate-800">{item.name}</span>
                        <span className="text-xs text-slate-400">{item.unit.shortName}</span>
                      </button>
                    ))}
                    <button onMouseDown={() => { setShowDropdown(p => ({ ...p, [row.id]: false })); setShowCreateForm(p => ({ ...p, [row.id]: true })); }}
                      className="w-full text-left px-3 py-2.5 text-sm text-[#3b82f6] font-bold hover:bg-blue-50 transition-colors border-t border-slate-100 flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      Создать новую позицию
                    </button>
                  </div>
                )}
              </div>

              {errors[row.id] && <p className="text-xs text-red-500 mt-1">{errors[row.id]}</p>}

              {showCreateForm[row.id] && (
                <div className="mt-2">
                  <NomenclatureCreateForm
                    values={getNewItem(row.id)}
                    units={units}
                    onChange={values => setNewItem(p => ({ ...p, [row.id]: values }))}
                    onSubmit={() => handleCreateNomenclature(row.id)}
                    onCancel={() => setShowCreateForm(p => ({ ...p, [row.id]: false }))}
                    isSubmitting={false}
                  />
                </div>
              )}
            </div>

            {/* Склад и кол-во */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Склад</label>
                <select value={row.warehouseId} onChange={e => updateRow(row.id, { warehouseId: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Количество</label>
                <input type="number" min={0} value={row.quantity}
                  onChange={e => updateRow(row.id, { quantity: Math.max(0, Number(e.target.value)) })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        ))}

        <button onClick={addRow}
          className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm font-bold text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Добавить ещё позицию
        </button>
      </div>

      <div className="p-4 border-t border-slate-100 flex gap-2 justify-end shrink-0">
        <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition">Отмена</button>
        <button onClick={handleSave} disabled={isSaving}
          className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition disabled:opacity-50 flex items-center gap-2">
          {isSaving
            ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>Сохраняю...</>
            : 'Сохранить'}
        </button>
      </div>
    </Modal>
  );
};
