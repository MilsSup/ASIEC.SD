import { useNavigate } from 'react-router-dom';

export const useAuth = () => {
  const navigate = useNavigate();

  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;

  const fullName = currentUser?.fullName || 'Гость';
  const roleName = currentUser?.role === 'INITIATOR' ? 'Пользователь' :
                   currentUser?.role === 'EXECUTOR' ? 'Исполнитель' :
                   currentUser?.role === 'MANAGER' ? 'Руководитель' : 'Сотрудник';

  const getInitials = (name: string) => {
    if (!name || name === 'Гость') return '??';
    const parts = name.split(' ');
    return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase();
  };

  const initials = getInitials(fullName);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return { currentUser, fullName, roleName, initials, handleLogout };
};
