import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) {
    return <Navigate to="/login" replace />;
  }

  const user = JSON.parse(userStr);

  // Если роль не входит в разрешённые, то отправляем пользователя на его рабочую страницу
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'EXECUTOR') return <Navigate to="/kanban" replace />;
    if (user.role === 'INITIATOR') return <Navigate to="/portal" replace />;
    if (user.role === 'MANAGER') return <Navigate to="/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
};
