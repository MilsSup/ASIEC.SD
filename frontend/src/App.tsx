import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/login';
import Kanban from './pages/kanban';
import UserPortal from './pages/userPortal';
import ManagerDashboard from './pages/managerDashboard';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/kanban" element={
          <ProtectedRoute allowedRoles={['EXECUTOR', 'MANAGER']}>
            <Kanban />
          </ProtectedRoute>
        } />

        <Route path="/portal" element={
          <ProtectedRoute allowedRoles={['INITIATOR']}>
            <UserPortal />
          </ProtectedRoute>
        } />

        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['MANAGER']}>
            <ManagerDashboard />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
