import { apiClient } from './client';

// Чтение данных кабинета руководителя через сгенерированные react-query хуки
// (src/generated/endpoints). Здесь только мутации.

export const approveTicketParts = (ticketId: number, approvedPartIds: number[]) =>
  apiClient.patch(`/api/manager/review/${ticketId}/approve`, { approvedPartIds }).then(r => r.data);

export const updateTicketPartPrice = (partId: number, price: number, updateNomenclaturePrice?: boolean) =>
  apiClient.patch(`/api/manager/parts/${partId}/price`, updateNomenclaturePrice !== undefined ? { price, updateNomenclaturePrice } : { price }).then(r => r.data);

export const receiveGoods = (inventoryId: number, quantity: number) =>
  apiClient.patch(`/api/manager/warehouse/${inventoryId}/receive`, { quantity }).then(r => r.data);

export const updateStaffBuilding = (userId: number, building: 1 | 2 | null) =>
  apiClient.patch(`/api/manager/staff/${userId}/building`, { building }).then(r => r.data);

export const rejectPurchase = (ticketId: number, comment?: string) =>
  apiClient.patch(`/api/manager/review/${ticketId}/reject`, { comment }).then(r => r.data);

export const addInventoryItem = (data: { warehouseId: number; nomenclatureId: number; quantity: number; minQuantity: number }) =>
  apiClient.post('/api/manager/warehouse', data).then(r => r.data);

export const getWarehouses = () =>
  apiClient.get('/api/manager/warehouses').then(r => r.data);

export const updateTicketPartQuantity = (partId: number, requiredQuantity: number) =>
  apiClient.patch(`/api/manager/parts/${partId}/quantity`, { requiredQuantity }).then(r => r.data);

export const deleteTicketPart = (partId: number) =>
  apiClient.delete(`/api/manager/parts/${partId}`).then(r => r.data);

export const addTicketPart = (ticketId: number, nomenclatureId: number, requiredQuantity: number) =>
  apiClient.post(`/api/manager/tickets/${ticketId}/parts`, { nomenclatureId, requiredQuantity }).then(r => r.data);
