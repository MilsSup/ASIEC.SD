import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as loginApi } from '../api/auth';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError('');

    try {
      const data = await loginApi(username, password);

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      const userRole = data.user.role;
      if (userRole === 'EXECUTOR') {
        navigate('/kanban');
      } else if (userRole === 'INITIATOR') {
        navigate('/portal');
      } else if (userRole === 'MANAGER') {
        navigate('/dashboard');
      } else {
        navigate('/');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Произошла неизвестная ошибка');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-lg">

        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-blue-600">АПЭК.SD</h2>
          <p className="mt-2 text-sm text-gray-600">
            Войдите в систему управления заявками
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>

          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Имя пользователя
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Введите логин"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Пароль
              </label>
              <input
                type="password"
                required
                className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Войти
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
