import { useState } from 'react';
import { Modal } from './Modal';
import type { InventoryItem } from '../pages/manager/types';

interface ReceiveModalProps {
  item: InventoryItem;
  onClose: () => void;
  onConfirm: (inventoryId: number, qty: number) => Promise<void>;
}

export const ReceiveModal = ({ item, onClose, onConfirm }: ReceiveModalProps) => {
  const [qty, setQty] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try { await onConfirm(item.id, qty); onClose(); } catch { }
    finally { setIsLoading(false); }
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <div className="p-6">
        <h3 className="text-base font-black text-slate-800 mb-1">Приход товара</h3>
        <p className="text-sm text-slate-500 mb-4">{item.nomenclature.name} · {item.warehouse.name}</p>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-10 h-10 rounded-xl border border-slate-200 text-slate-600 font-bold text-lg hover:bg-slate-50 transition flex items-center justify-center">−</button>
          <input type="number" min={1} value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value)))}
            className="flex-1 text-center text-2xl font-black text-slate-800 border border-slate-200 rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => setQty(q => q + 1)} className="w-10 h-10 rounded-xl border border-slate-200 text-slate-600 font-bold text-lg hover:bg-slate-50 transition flex items-center justify-center">+</button>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition">Отмена</button>
          <button onClick={handleConfirm} disabled={isLoading}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition disabled:opacity-50">
            {isLoading ? 'Сохраняю...' : `Принять ${qty} ${item.nomenclature.unit.shortName}`}
          </button>
        </div>
      </div>
    </Modal>
  );
};
