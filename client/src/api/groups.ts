import apiClient from './client';
import type { Group, GroupInvite, PaginatedResponse } from '../types';

export interface GroupDetail extends Group {
  members: Array<{
    id: string;
    name: string;
    avatarUrl: string | null;
    role: 'admin' | 'member';
    joinedAt: string;
  }>;
  openPostings: Array<any>;
  viewerRole: 'admin' | 'member' | null;
}

export const groupsApi = {
  create: (data: { name: string; description?: string; visibility: 'global' | 'college'; maxMembers?: number }) =>
    apiClient.post<{ group: Group }>('/groups', data),

  getMyGroups: () =>
    apiClient.get<{ data: Group[] }>('/groups/me'),

  getDetail: (id: string) =>
    apiClient.get<{ group: GroupDetail }>(`/groups/${id}`),

  update: (id: string, data: Partial<{ name: string; description: string; status: string; maxMembers: number }>) =>
    apiClient.put<{ group: Group }>(`/groups/${id}`, data),

  removeMember: (groupId: string, userId: string) =>
    apiClient.delete(`/groups/${groupId}/members/${userId}`),

  promoteMember: (groupId: string, userId: string) =>
    apiClient.post(`/groups/${groupId}/members/${userId}/promote`),

  inviteMember: (groupId: string, data: { userId: string; note?: string }) =>
    apiClient.post<{ status: string; data: any }>(`/groups/${groupId}/invites`, data),

  getMyInvites: () =>
    apiClient.get<{ status: string; data: GroupInvite[] }>('/groups/invites/me'),

  acceptInvite: (inviteId: string) =>
    apiClient.post<{ status: string; data: any }>(`/groups/invites/${inviteId}/accept`),

  declineInvite: (inviteId: string) =>
    apiClient.post<{ status: string; data: any }>(`/groups/invites/${inviteId}/decline`),

  deleteGroup: (id: string) =>
    apiClient.delete<{ status: string; message: string }>(`/groups/${id}`),
};
