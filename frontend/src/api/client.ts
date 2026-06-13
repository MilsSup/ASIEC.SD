import axios, { type AxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({ baseURL: API_URL });

// JWT-токен добавляется к каждому запросу автоматически
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// достаёт читаемое сообщение об ошибке: строку `error` или ZodError
const extractErrorMessage = (data: unknown): string | null => {
  const err = (data as { error?: unknown })?.error;
  if (typeof err === 'string') return err;
  const issues = (err as { issues?: { message: string }[] })?.issues;
  if (issues?.length) {
    const messages = issues.map(i => i.message).join(', ');
    if (messages) return messages;
  }
  return null;
};

// обработка ответов: 401 - выход на логин; ошибки с читаемым сообщением
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    const message = extractErrorMessage(error.response?.data) || 'Ошибка сети или сервера';
    return Promise.reject(new Error(message));
  },
);

// Мутатор для сгенерированного Orval-клиента (react-query)
export const customFetch = <T>(config: AxiosRequestConfig, options?: AxiosRequestConfig): Promise<T> =>
  apiClient({ ...config, ...options }).then(({ data }) => data as T);
