import { useState, useRef } from 'react';
import { getNomenclature } from '../api/tickets';
import type { NomenclatureItem } from './NomenclatureModal';

interface NomenclaturePickerProps {
  // Добавить позицию: вернуть id номенклатуры и количество
  onAdd: (nomenclatureId: number, quantity: number) => Promise<void> | void;
  onCancel: () => void;
}

// Компактный выбор номенклатуры с поиском + количество — для добавления позиции в смету
export const NomenclaturePicker = ({ onAdd, onCancel }: NomenclaturePickerProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NomenclatureItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<NomenclatureItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = (q: string) => {
    getNomenclature(q).then(setResults).catch(() => {});
  };

  const handleSearch = (value: string) => {
    setQuery(value);
    setSelected(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { runSearch(value); setShowDropdown(true); }, 300);
  };

  const handleFocus = () => {
    setShowDropdown(true);
    if (results.length === 0) runSearch('');
  };

  const select = (item: NomenclatureItem) => {
    setSelected(item);
    setQuery(item.name);
    setShowDropdown(false);
  };

  const handleSubmit = async () => {
    if (!selected) { setError('Выберите позицию из справочника'); return; }
    setError('');
    setIsSaving(true);
    try {
      await onAdd(selected.id, Math.max(1, quantity));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка добавления');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-blue-200 rounded-xl p-3 space-y-2">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Добавить позицию</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            placeholder="Начните вводить название..."
            value={query}
            onChange={e => handleSearch(e.target.value)}
            onFocus={handleFocus}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            className={`w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${selected ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}
          />
          {showDropdown && (
            <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {results.length === 0 ? (
                <p className="px-3 py-2.5 text-xs text-slate-400">Ничего не найдено</p>
              ) : results.map(item => (
                <button key={item.id} onMouseDown={() => select(item)}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors flex justify-between items-center">
                  <span className="font-medium text-slate-800">{item.name}</span>
                  <span className="text-xs text-slate-400">{item.unit.shortName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={e => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          className="w-full sm:w-20 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={isSaving}
          className="flex-1 bg-slate-800 text-white text-xs font-bold py-2 rounded-lg hover:bg-slate-700 transition disabled:opacity-50">
          {isSaving ? 'Добавляю...' : 'Добавить в смету'}
        </button>
        <button onClick={onCancel}
          className="px-4 bg-slate-100 text-slate-600 text-xs font-bold py-2 rounded-lg hover:bg-slate-200 transition">
          Отмена
        </button>
      </div>
    </div>
  );
};
