import { useAuth } from '../hooks/useAuth';
import { AccountMenu } from '../components/AccountMenu';
import { useToasts, ToastContainer } from './portal/Toasts';
import { TicketForm } from './portal/TicketForm';
import { TicketList } from './portal/TicketList';

const UserPortal = () => {
  const { fullName, roleName, initials, handleLogout } = useAuth();
  const { toasts, addToast, removeToast } = useToasts();

  return (
    <div className="min-h-screen font-sans text-slate-800 pb-12 bg-slate-50">

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Шапка */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-[#0f172a] tracking-wider leading-tight">
              АПЭК<span className="text-[#3b82f6]">.SD</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Кабинет пользователя</p>
          </div>
          <AccountMenu fullName={fullName} roleName={roleName} initials={initials} onLogout={handleLogout} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <TicketForm addToast={addToast} />
        <TicketList addToast={addToast} />
      </main>
    </div>
  );
};

export default UserPortal;
