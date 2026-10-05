export interface NomenclatureFormValues {
  name: string;
  article: string;
  unitId: number;
  price: number;
}

export interface UnitOption {
  id: number;
  shortName: string;
  fullName: string;
}

interface NomenclatureCreateFormProps {
  values: NomenclatureFormValues;
  units: UnitOption[];
  onChange: (values: NomenclatureFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string;
  submitLabel?: string;
  title?: string;
}

export const NomenclatureCreateForm = ({ values, units, onChange, onSubmit, onCancel, isSubmitting, error, submitLabel = 'Создать и выбрать', title = 'Новая позиция' }: NomenclatureCreateFormProps) => (
  <div className="bg-white border border-blue-200 rounded-xl p-3 space-y-2">
    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</p>
    <input
      type="text"
      placeholder="Название *"
      value={values.name}
      onChange={e => onChange({ ...values, name: e.target.value })}
      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    <div className="flex gap-2">
      <input
        type="text"
        placeholder="Артикул (необязательно)"
        value={values.article}
        onChange={e => onChange({ ...values, article: e.target.value })}
        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <select
        value={values.unitId}
        onChange={e => onChange({ ...values, unitId: Number(e.target.value) })}
        className="w-1/3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {units.map(u => (
          <option key={u.id} value={u.id}>{u.fullName} ({u.shortName})</option>
        ))}
      </select>
    </div>
    <input
      type="number"
      min={0}
      placeholder="Цена в каталоге (₽)"
      value={values.price || ''}
      onChange={e => onChange({ ...values, price: Math.max(0, Number(e.target.value)) })}
      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    <div className="flex gap-2">
      <button
        onClick={onSubmit}
        disabled={isSubmitting}
        className="flex-1 bg-slate-800 text-white text-xs font-bold py-2 rounded-lg hover:bg-slate-700 transition disabled:opacity-50"
      >
        {isSubmitting ? 'Создаю...' : submitLabel}
      </button>
      <button
        onClick={onCancel}
        className="px-4 bg-slate-100 text-slate-600 text-xs font-bold py-2 rounded-lg hover:bg-slate-200 transition"
      >
        Отмена
      </button>
    </div>
  </div>
);
