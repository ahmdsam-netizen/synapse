import apiClient from './client';
import type { UserProfile, User, Skill, Interest, WorkItem, UserSkill } from '../types';

export const usersApi = {
  getMe: () =>
    apiClient.get<{ user: UserProfile }>('/users/me'),

  getProfile: (id: string) =>
    apiClient.get<{ user: UserProfile }>(`/users/${id}`),

  updateProfile: (data: Partial<Pick<User, 'name' | 'bio' | 'avatarUrl' | 'yearOfStudy' | 'branch' | 'lookingFor'>>) =>
    apiClient.put<{ user: User }>('/users/me', data),

  addSkill: (dataOrId: string | { skillId?: string; name?: string; proficiency: string }, proficiency?: string) => {
    if (typeof dataOrId === 'string') {
      return apiClient.post<{ skill: UserSkill }>('/users/me/skills', { skillId: dataOrId, proficiency });
    }
    return apiClient.post<{ skill: UserSkill }>('/users/me/skills', dataOrId);
  },

  removeSkill: (skillId: string) =>
    apiClient.delete(`/users/me/skills/${skillId}`),

  addInterest: (dataOrId: string | { interestId?: string; name?: string }) => {
    if (typeof dataOrId === 'string') {
      return apiClient.post<{ interest: Interest }>('/users/me/interests', { interestId: dataOrId });
    }
    return apiClient.post<{ interest: Interest }>('/users/me/interests', dataOrId);
  },

  removeInterest: (interestId: string) =>
    apiClient.delete(`/users/me/interests/${interestId}`),

  createWorkItem: (data: Omit<WorkItem, 'id' | 'userId' | 'createdAt'>) =>
    apiClient.post<{ workItem: WorkItem }>('/users/me/work', data),

  updateWorkItem: (id: string, data: Partial<Omit<WorkItem, 'id' | 'userId' | 'createdAt'>>) =>
    apiClient.put<{ workItem: WorkItem }>(`/users/me/work/${id}`, data),

  deleteWorkItem: (id: string) =>
    apiClient.delete(`/users/me/work/${id}`),

  searchSkills: (q: string) =>
    apiClient.get<{ skills: Skill[] }>('/users/skills', { params: { q } }),

  searchInterests: (q: string) =>
    apiClient.get<{ interests: Interest[] }>('/users/interests', { params: { q } }),
};
