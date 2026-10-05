import { apiClient } from './client';

type Priority = 'LOW' | 'NORMAL' | 'HIGH';

export const createTicket = (categoryName: string, room: string, description: string, building: 1 | 2, priority: Priority = 'NORMAL') =>
  apiClient.post('/api/tickets', { categoryName, room, description, building, priority }).then(r => r.data);

export const getExecutorTickets = () => apiClient.get('/api/tickets/executor').then(r => r.data);

export const getCategories = () => apiClient.get('/api/tickets/categories').then(r => r.data);

export const updateTicketStatus = (id: number, status: string, comment?: string) =>
  apiClient.patch(`/api/tickets/${id}/status`, { status, comment }).then(r => r.data);

export const updateTicketPriority = (id: number, priority: Priority) =>
  apiClient.patch(`/api/tickets/${id}/priority`, { priority }).then(r => r.data);

export const reopenTicket = (id: number, comment: string) =>
  apiClient.patch(`/api/tickets/${id}/reopen`, { comment }).then(r => r.data);

export const checkTicketParts = (ticketId: number, items: { nomenclatureId: number; quantity: number }[]) =>
  apiClient.post(`/api/tickets/${ticketId}/parts/check`, { items }).then(r => r.data);

export const confirmTicketParts = (ticketId: number, items: { nomenclatureId: number; writeOffQty: number; purchaseQty: number }[]) =>
  apiClient.post(`/api/tickets/${ticketId}/parts/confirm`, { items }).then(r => r.data);

export const getTicketHistory = (id: number) =>
  apiClient.get(`/api/tickets/${id}/history`).then(r => r.data);

export const addTicketComment = (id: number, comment: string) =>
  apiClient.post(`/api/tickets/${id}/comment`, { comment }).then(r => r.data);

export const getNomenclature = (search?: string) =>
  apiClient.get('/api/nomenclature', { params: search ? { search } : undefined }).then(r => r.data);

export const getUnits = () =>
  apiClient.get('/api/nomenclature/units').then(r => r.data);

export const createNomenclatureItem = (name: string, unitId: number, article?: string, price?: number) =>
  apiClient.post('/api/nomenclature', { name, unitId, article, price }).then(r => r.data);

export const updateNomenclatureItem = (id: number, data: { name: string; unitId: number; article?: string | null; price: number }) =>
  apiClient.patch(`/api/nomenclature/${id}`, data).then(r => r.data);

export const deleteNomenclatureItem = (id: number) =>
  apiClient.delete(`/api/nomenclature/${id}`).then(r => r.data);
