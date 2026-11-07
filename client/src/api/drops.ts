import apiClient from './client';
import type { Drop, PaginatedResponse } from '../types';

export const dropsApi = {
  getDrops: (cursor?: string | null, limit: number = 20) =>
    apiClient.get<PaginatedResponse<Drop>>('/drops', { params: { cursor, limit } }),

  createDrop: (content: string) =>
    apiClient.post<{ status: string; data: Drop }>('/drops', { content }),

  voteDrop: (id: string, voteType: 'up' | 'down') =>
    apiClient.post<{ status: string; data: { dropId: string; userVote: 'up' | 'down' | null; upVotes: number; downVotes: number } }>(
      `/drops/${id}/vote`,
      { voteType }
    ),

  deleteDrop: (id: string) =>
    apiClient.delete<{ status: string; data: { success: boolean } }>(`/drops/${id}`),
};
