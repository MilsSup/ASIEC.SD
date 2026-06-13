import { apiClient } from './client';

export const login = (loginText: string, passwordText: string) =>
  apiClient.post('/api/auth/login', { login: loginText, password: passwordText }).then(r => r.data);
