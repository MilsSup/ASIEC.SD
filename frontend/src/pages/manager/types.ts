// Типы данных страницы руководителя

export interface DashboardLowStockItem {
  id: number; name: string; unit: string; quantity: number; minQuantity: number; warehouse: string;
}
export interface DashboardPendingReview {
  id: number; description: string; category: string; total: number; priority: string;
}
export interface Stats {
  totalTickets: number; newTickets: number; inProgressTickets: number;
  waitingTickets: number; completedTickets: number; totalUsers: number; lowStockCount: number;
  estimateTotal: number; urgentOpenTickets: number;
  lowStockItems: DashboardLowStockItem[];
  pendingReviews: DashboardPendingReview[];
}
export interface TicketPart {
  id: number; requiredQuantity: number; price: number; isApproved: boolean;
  nomenclature: { id: number; name: string; article: string | null; price: number; unit: { shortName: string } };
}
export interface ReviewTicket {
  id: number; description: string; room: string; priority: string;
  category: { name: string };
  executor: { fullName: string } | null;
  initiator: { fullName: string } | null;
  parts: TicketPart[];
}
export interface EstimatePart {
  id: number; requiredQuantity: number; price: number;
  nomenclature: { name: string; unit: { shortName: string } };
  ticket: { id: number; description: string };
}
export interface InventoryItem {
  id: number; quantity: number; minQuantity: number;
  warehouse: { id: number; name: string };
  nomenclature: { id: number; name: string; article: string | null; unit: { shortName: string } };
}
export interface StaffMember {
  id: number; fullName: string; position: string; department: string;
  building: number | null;
  activeTasks: number; closedThisMonth: number; totalClosed: number;
}
export interface NomenclatureItem {
  id: number; name: string; article: string | null;
  unit: { id: number; shortName: string; fullName: string };
}
export interface PriceHistoryEntry {
  date: string;
  price: number;
  source: 'purchase' | 'writeoff';
  ticketId: number;
}
export interface PriceHistoryItem {
  id: number; name: string; unit: string; currentPrice: number;
  history: PriceHistoryEntry[];
}
// Отчёт по расходу склада
export interface ReportNomenclatureRow {
  nomenclatureId: number; name: string; article: string | null; unit: string;
  quantity: number;
  tickets: { ticketId: number; description: string; quantity: number; date: string; warehouse: string }[];
}
export interface ReportTicketRow {
  ticketId: number; description: string;
  items: { nomenclatureId: number; name: string; unit: string; quantity: number; date: string; warehouse: string }[];
}
export interface ConsumptionReport {
  totalWriteOffs: number; positionsCount: number; ticketsCount: number;
  byNomenclature: ReportNomenclatureRow[];
  byTicket: ReportTicketRow[];
}
// Отчёт по сотрудникам
export interface StaffReportTicket {
  ticketId: number; description: string; category: string;
  type: 'completed' | 'rejected'; date: string; durationMs: number | null;
}
export interface StaffReportRow {
  id: number; fullName: string; position: string;
  completedCount: number; rejectedCount: number; avgTimeMs: number | null; totalTimeMs: number;
  tickets: StaffReportTicket[];
}
export interface StaffReport {
  totalCompleted: number; totalRejected: number; overallAvgTimeMs: number | null;
  staff: StaffReportRow[];
}
