import { useQueryClient } from '@tanstack/react-query';
import { useGetApiManagerStaff, getGetApiManagerStaffQueryKey } from '../../generated/endpoints/default/default';
import { updateStaffBuilding } from '../../api/manager';
import { Skeleton, ReportError } from './helpers';

export const StaffTab = () => {
  const queryClient = useQueryClient();
  const { data: staff = [], isLoading, error } = useGetApiManagerStaff();

  // Сменили корпус - инвалидируем кэш списка, react-query перезагрузит данные
  const handleBuildingChange = async (id: number, value: 1 | 2 | null) => {
    try {
      await updateStaffBuilding(id, value);
      queryClient.invalidateQueries({ queryKey: getGetApiManagerStaffQueryKey() });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка обновления корпуса');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-black">Штат ИТ-отдела</h2>
        <p className="text-sm text-slate-500 mt-1">Нагрузка по исполнителям</p>
      </div>
      {error ? <ReportError message={error instanceof Error ? error.message : 'Ошибка загрузки'} /> : null}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}</div>
      ) : staff.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 font-medium">Нет сотрудников</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {staff.map(s => {
            const ini = s.fullName.split(' ').slice(0, 2).map((w: string) => w[0]).join('');
            const isBusy = s.activeTasks > 3;
            return (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-5 hover:border-blue-300 transition">
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-lg font-black text-slate-400">{ini}</div>
                  <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${isBusy ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2 mb-0.5">
                    <h3 className="font-bold text-slate-800 truncate">{s.fullName}</h3>
                  </div>
                  <p className="text-xs font-semibold text-[#3b82f6] mb-3">{s.position}</p>
                  <div className="flex items-center gap-2 mb-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Корпус</label>
                    <select
                      value={s.building ?? ''}
                      onChange={e => handleBuildingChange(s.id, e.target.value === '' ? null : Number(e.target.value) as 1 | 2)}
                      className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Оба корпуса</option>
                      <option value={1}>Корпус 1</option>
                      <option value={2}>Корпус 2</option>
                    </select>
                  </div>
                  <div className="flex gap-3">
                    <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 flex-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">В работе</p>
                      <p className="font-black text-slate-800 text-lg">{s.activeTasks}</p>
                    </div>
                    <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 flex-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">За месяц</p>
                      <p className="font-black text-emerald-600 text-lg">{s.closedThisMonth}</p>
                    </div>
                    <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 flex-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Всего</p>
                      <p className="font-black text-slate-500 text-lg">{s.totalClosed}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
