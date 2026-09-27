import apiClient from './client';
import type { Community } from '../types';

export const communitiesApi = {
  list: (params?: { q?: string }) =>
    apiClient.get<Community[]>('/communities', { params }),

  getMyCommunities: () =>
    apiClient.get<Community[]>('/communities/me'),

  getDetail: (id: string) =>
    apiClient.get<Community>(`/communities/${id}`),

  create: (data: { name: string; description?: string }) =>
    apiClient.post<Community>('/communities', data),

  join: (id: string) =>
    apiClient.post<{ success: boolean; message: string }>(`/communities/${id}/join`),

  leave: (id: string) =>
    apiClient.post<{ success: boolean; message: string }>(`/communities/${id}/leave`),

  deleteCommunity: (id: string) =>
    apiClient.delete<{ success: boolean; message: string }>(`/communities/${id}`),
};
