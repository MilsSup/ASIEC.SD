import type { ReactNode } from 'react';

// Общая оболочка модального окна: затемнённый фон + центрированная карточка.
export const Modal = ({ onClose, maxWidth = 'max-w-lg', children }: {
  onClose: () => void;
  maxWidth?: string;
  children: ReactNode;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
    <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${maxWidth} flex flex-col max-h-[92dvh] sm:max-h-[85dvh]`}>
      {children}
    </div>
  </div>
);

// Стандартная шапка модалки: заголовок, подзаголовок и кнопка закрытия.
export const ModalHeader = ({ title, subtitle, onClose }: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
}) => (
  <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
    <div>
      <h3 className="text-base font-black text-slate-800">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
);
