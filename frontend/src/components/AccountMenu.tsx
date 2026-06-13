import { useState } from 'react';
import { getTelegramStatus, createTelegramLink, unlinkTelegram } from '../api/telegram';

// Правый блок шапки: имя/роль, аватар с выпадающим меню (привязка Telegram) и кнопка выхода.
export const AccountMenu = ({ fullName, roleName, initials, onLogout }: {
  fullName: string;
  roleName: string;
  initials: string;
  onLogout: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [linked, setLinked] = useState<boolean | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [hint, setHint] = useState('');

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    // лениво загружаем статус привязки при первом открытии меню
    if (next && linked === null) {
      try {
        const s = await getTelegramStatus();
        setLinked(s.linked);
      } catch {
        // не критично, кнопка привязки всё равно доступна
      }
    }
  };

  const handleLink = async () => {
    setIsWorking(true);
    setHint('');
    try {
      const data = await createTelegramLink();
      if (data.url) {
        window.open(data.url, '_blank', 'noopener');
        setHint('Откройте бота и нажмите «Старт». После привязки обновите страницу.');
      } else {
        setHint(`Бот недоступен. Код привязки: ${data.code}`);
      }
    } catch (err) {
      setHint(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setIsWorking(false);
    }
  };

  const handleUnlink = async () => {
    setIsWorking(true);
    setHint('');
    try {
      await unlinkTelegram();
      setLinked(false);
      setHint('Telegram отвязан.');
    } catch (err) {
      setHint(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="text-right hidden sm:block">
        <p className="text-sm font-bold text-[#0f172a] leading-tight">{fullName}</p>
        <p className="text-[11px] text-slate-500">{roleName}</p>
      </div>

      <div className="relative">
        <button
          onClick={toggle}
          title="Аккаунт"
          className="w-9 h-9 rounded-full bg-[#0f172a] flex justify-center items-center font-bold text-white text-sm hover:ring-2 hover:ring-slate-300 transition"
        >
          {initials}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 mt-2 w-72 z-20 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-bold text-slate-800 truncate">{fullName}</p>
                <p className="text-xs text-slate-400">{roleName}</p>
              </div>

              <div className="p-2 border-b border-slate-100">
                {linked ? (
                  <>
                    <div className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-emerald-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Telegram привязан
                    </div>
                    <button
                      onClick={handleUnlink}
                      disabled={isWorking}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-red-600 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {isWorking ? 'Отвязываю...' : 'Отвязать Telegram'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleLink}
                    disabled={isWorking}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 text-[#229ED9]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.56 8.21l-1.86 8.77c-.14.62-.51.77-1.03.48l-2.85-2.1-1.37 1.32c-.15.15-.28.28-.57.28l.2-2.9 5.28-4.77c.23-.2-.05-.32-.35-.12L8.2 13.06l-2.81-.88c-.61-.19-.62-.61.13-.9l10.98-4.23c.51-.19.96.12.79.96z" />
                    </svg>
                    {isWorking ? 'Готовлю ссылку...' : 'Привязать Telegram'}
                  </button>
                )}
                {hint && <p className="px-3 pt-1 pb-1 text-[11px] text-slate-500 leading-snug break-words">{hint}</p>}
              </div>

              <div className="p-2">
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-red-600 rounded-lg hover:bg-red-50 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Выйти
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
