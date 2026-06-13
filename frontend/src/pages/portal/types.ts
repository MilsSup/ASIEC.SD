import type { Priority } from '../../components/PriorityBadge';

export interface Ticket {
  id: number;
  category: string;
  room: string;
  building: number;
  description: string;
  status: string;
  priority: Priority;
  date: string;
}

export interface ApiTicket {
  id: number;
  category: { name: string };
  room: string;
  building: number;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
}
