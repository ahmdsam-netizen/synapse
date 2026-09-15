import apiClient from './client';
import type { LoginResponse } from '../types';

export const authApi = {
  signup: (data: { email: string; password: string; name: string }) =>
    apiClient.post<LoginResponse>('/auth/signup', data),

  login: (data: { email: string; password: string }) =>
    apiClient.post<LoginResponse>('/auth/login', data),

  refresh: (refreshToken: string) =>
    apiClient.post<{ tokens: { accessToken: string; refreshToken: string } }>('/auth/refresh', { refreshToken }),

  logout: (refreshToken: string) =>
    apiClient.post('/auth/logout', { refreshToken }),
};
