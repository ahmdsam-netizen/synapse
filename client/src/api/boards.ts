import apiClient from './client';
import type { BoardPosting, JoinRequest, PaginatedResponse } from '../types';

export const boardsApi = {
  getGlobal: (params: { cursor?: string | null; limit?: number; q?: string; skills?: string[]; interests?: string[]; collegeId?: string }) => {
    const p: any = { ...params };
    if (Array.isArray(params.skills)) p.skills = params.skills.join(',');
    if (Array.isArray(params.interests)) p.interests = params.interests.join(',');
    return apiClient.get<PaginatedResponse<BoardPosting>>('/boards/global', { params: p });
  },

  getCollege: (params: { cursor?: string | null; limit?: number; q?: string; skills?: string[]; interests?: string[] }) => {
    const p: any = { ...params };
    if (Array.isArray(params.skills)) p.skills = params.skills.join(',');
    if (Array.isArray(params.interests)) p.interests = params.interests.join(',');
    return apiClient.get<PaginatedResponse<BoardPosting>>('/boards/college', { params: p });
  },

  getMatched: (cursor?: string | null, limit: number = 30) =>
    apiClient.get<PaginatedResponse<BoardPosting>>('/boards/matched', { params: { cursor, limit } }),

  getMyPostings: (params?: { cursor?: string | null; limit?: number }) =>
    apiClient.get<PaginatedResponse<BoardPosting>>('/boards/my-postings', { params }),

  createPosting: (data: {
    groupId: string;
    title: string;
    description?: string;
    rolesNeeded?: string[];
    requiredSkillIds?: string[];
    requiredInterestIds?: string[];
    slotsTotal?: number;
    expiresInHours?: number;
  }) =>
    apiClient.post<{ posting: BoardPosting }>('/boards/postings', data),

  getPosting: (id: string) =>
    apiClient.get<{ posting: BoardPosting }>(`/boards/postings/${id}`),

  updatePosting: (id: string, data: Partial<any>) =>
    apiClient.put<{ posting: BoardPosting }>(`/boards/postings/${id}`, data),

  closePosting: (id: string) =>
    apiClient.post(`/boards/postings/${id}/close`),

  deletePosting: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/boards/postings/${id}`),

  submitJoinRequest: (postingId: string, message?: string) =>
    apiClient.post<{ request: JoinRequest }>(`/boards/postings/${postingId}/request`, { message }),

  getGroupRequests: (groupId: string, status: string = 'pending') =>
    apiClient.get<{ data: JoinRequest[] }>(`/boards/groups/${groupId}/requests`, { params: { status } }),

  approveRequest: (requestId: string) =>
    apiClient.post(`/boards/join-requests/${requestId}/approve`),

  rejectRequest: (requestId: string) =>
    apiClient.post(`/boards/join-requests/${requestId}/reject`),

  getMyRequests: () =>
    apiClient.get<{ data: JoinRequest[] }>('/boards/my-requests'),
};
