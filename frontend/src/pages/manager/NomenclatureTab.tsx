import { useState, useEffect, useCallback, useRef } from 'react';
import { getNomenclature, getUnits, createNomenclatureItem, updateNomenclatureItem, deleteNomenclatureItem } from '../../api/tickets';
import { NomenclatureCreateForm, type NomenclatureFormValues, type UnitOption } from '../../components/NomenclatureCreateForm';
import type { NomenclatureItem } from '../../components/NomenclatureModal';
import { Skeleton, ReportError } from './helpers';

const emptyForm: NomenclatureFormValues = { name: '', article: '', unitId: 0, price: 0 };

export const NomenclatureTab = () => {
  const [items, setItems] = useState<NomenclatureItem[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Создание
  const [showCreate, setShowCreate] = useState(false);
  const [createValues, setCreateValues] = useState<NomenclatureFormValues>(emptyForm);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Редактирование
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<NomenclatureFormValues>(emptyForm);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState('');

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadItems = useCallback(async (q?: string) => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getNomenclature(q);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
    getUnits().then((data: UnitOption[]) => {
      setUnits(data);
      if (data.length > 0) setCreateValues(v => ({ ...v, unitId: data[0].id }));
    }).catch(() => {});
  }, [loadItems]);

  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => loadItems(value), 300);
  };

  const handleCreate = async () => {
    if (!createValues.name.trim()) { setCreateError('Введите название'); return; }
    setIsCreating(true);
    setCreateError('');
    try {
      const created = await createNomenclatureItem(createValues.name.trim(), createValues.unitId, createValues.article.trim() || undefined, createValues.price);
      setItems(prev => [created, ...prev]);
      setShowCreate(false);
      setCreateValues({ ...emptyForm, unitId: units[0]?.id ?? 0 });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Ошибка создания');
    } finally {
      setIsCreating(false);
    }
  };

  const startEdit = (item: NomenclatureItem) => {
    setEditingId(item.id);
    setEditError('');
    setEditValues({ name: item.name, article: item.article ?? '', unitId: item.unit.id, price: item.price });
  };

  const handleSaveEdit = async () => {
    if (editingId === null) return;
    if (!editValues.name.trim()) { setEditError('Введите название'); return; }
    setIsEditing(true);
    setEditError('');
    try {
      const updated = await updateNomenclatureItem(editingId, {
        name: editValues.name.trim(),
        unitId: editValues.unitId,
        article: editValues.article.trim() || null,
        price: editValues.price,
      });
      setItems(prev => prev.map(it => it.id === editingId ? updated : it));
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDelete = async (item: NomenclatureItem) => {
    if (!window.confirm(`Удалить «${item.name}» из справочника?`)) return;
    setDeletingId(item.id);
    try {
      await deleteNomenclatureItem(item.id);
      setItems(prev => prev.filter(it => it.id !== item.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось удалить позицию');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black">Номенклатура</h2>
          <p className="text-sm text-slate-500 mt-1">Справочник деталей и материалов — создание, редактирование, удаление</p>
        </div>
        {!showCreate && (
          <button onClick={() => { setShowCreate(true); setCreateValues({ ...emptyForm, unitId: units[0]?.id ?? 0 }); }}
            className="flex items-center gap-2 bg-emerald-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-emerald-600 transition shadow-sm self-start sm:self-auto">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Новая позиция
          </button>
        )}
      </div>

      {/* Поиск */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Поиск по названию..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>

      {/* Форма создания */}
      {showCreate && (
        <div className="mb-4">
          <NomenclatureCreateForm
            values={createValues}
            units={units}
            onChange={setCreateValues}
            onSubmit={handleCreate}
            onCancel={() => { setShowCreate(false); setCreateError(''); }}
            isSubmitting={isCreating}
            error={createError}
            submitLabel="Создать"
          />
        </div>
      )}

      {error ? <ReportError message={error} /> : null}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[640px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>{['Наименование', 'Артикул', 'Ед.', 'Цена', ''].map((h, i) => (
                <th key={i} className="px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}><td colSpan={5} className="px-5 py-4"><Skeleton className="h-5 w-full" /></td></tr>
              )) : items.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-slate-400 font-medium text-sm">Нет позиций</td></tr>
              ) : items.map(item => (
                editingId === item.id ? (
                  <tr key={item.id}>
                    <td colSpan={5} className="px-5 py-4 bg-slate-50">
                      <NomenclatureCreateForm
                        values={editValues}
                        units={units}
                        onChange={setEditValues}
                        onSubmit={handleSaveEdit}
                        onCancel={() => { setEditingId(null); setEditError(''); }}
                        isSubmitting={isEditing}
                        error={editError}
                        submitLabel="Сохранить"
                        title="Редактировать позицию"
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 font-bold text-slate-800 text-sm">{item.name}</td>
                    <td className="px-5 py-4 text-slate-500 text-sm">{item.article ?? '—'}</td>
                    <td className="px-5 py-4 text-slate-500 text-sm">{item.unit.shortName}</td>
                    <td className="px-5 py-4 font-bold text-slate-700 text-sm">{item.price.toLocaleString()} ₽</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => startEdit(item)} title="Редактировать"
                          className="text-slate-400 hover:text-blue-500 transition-colors p-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(item)} disabled={deletingId === item.id} title="Удалить"
                          className="text-slate-400 hover:text-red-500 transition-colors p-1.5 disabled:opacity-40">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
