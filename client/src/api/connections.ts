import apiClient from './client';
import type { Connection, User, PaginatedResponse } from '../types';

export const connectionsApi = {
  sendRequest: (receiverId: string) =>
    apiClient.post<{ connection: Connection }>('/connections/request', { receiverId }),

  accept: (id: string) =>
    apiClient.post<{ connection: Connection }>(`/connections/${id}/accept`),

  decline: (id: string) =>
    apiClient.post<{ connection: Connection }>(`/connections/${id}/decline`),

  remove: (id: string) =>
    apiClient.delete(`/connections/${id}`),

  list: (cursor?: string | null, limit: number = 30) =>
    apiClient.get<PaginatedResponse<Connection>>('/connections', { params: { cursor, limit } }),

  pending: () =>
    apiClient.get<{ data: Connection[] }>('/connections/pending'),

  mutual: (userId: string, cursor?: string | null) =>
    apiClient.get<PaginatedResponse<User>>(`/connections/mutual/${userId}`, { params: { cursor } }),
};
