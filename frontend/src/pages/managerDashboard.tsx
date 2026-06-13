import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { AccountMenu } from '../components/AccountMenu';
import { DashboardTab } from './manager/DashboardTab';
import { ReviewTab } from './manager/ReviewTab';
import { EstimateTab } from './manager/EstimateTab';
import { PricesTab } from './manager/PricesTab';
import { WarehouseTab } from './manager/WarehouseTab';
import { ConsumptionReportTab } from './manager/ConsumptionReportTab';
import { StaffTab } from './manager/StaffTab';
import { StaffReportTab } from './manager/StaffReportTab';

const navItems = [
  { id: 'dashboard', label: 'Сводка',          icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
  { id: 'review',   label: 'На рассмотрении',  icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { id: 'estimate', label: 'Сводная смета',    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'prices',   label: 'История цен',      icon: 'M3 3v18h18M7 14l3-3 4 4 5-6' },
  { id: 'warehouse',label: 'Склад ИТ',         icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { id: 'report',   label: 'Расход склада',    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'staff',    label: 'Сотрудники',       icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { id: 'staff-report', label: 'Отчёт по работе', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
];

const ManagerDashboard = () => {
  const { fullName, roleName, initials, handleLogout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen font-sans bg-[#f8fafc] text-[#0f172a]">

      {/* Шапка */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-[#0f172a] tracking-wider leading-tight">АПЭК<span className="text-[#3b82f6]">.SD</span></h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Кабинет руководителя</p>
          </div>
          <AccountMenu fullName={fullName} roleName={roleName} initials={initials} onLogout={handleLogout} />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Навигация */}
        <nav className="flex gap-1 sm:gap-2 mb-8 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap flex-1 justify-center
                ${activeTab === item.id ? 'bg-[#3b82f6] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
              </svg>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </nav>

        {activeTab === 'dashboard' && <DashboardTab onNavigate={setActiveTab} />}
        {activeTab === 'review' && <ReviewTab />}
        {activeTab === 'estimate' && <EstimateTab author={fullName} />}
        {activeTab === 'prices' && <PricesTab />}
        {activeTab === 'warehouse' && <WarehouseTab />}
        {activeTab === 'report' && <ConsumptionReportTab />}
        {activeTab === 'staff' && <StaffTab />}
        {activeTab === 'staff-report' && <StaffReportTab />}

      </div>
    </div>
  );
};

export default ManagerDashboard;
