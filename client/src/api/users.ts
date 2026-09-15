import apiClient from './client';
import type { UserProfile, User, Skill, Interest, WorkItem, UserSkill } from '../types';

export const usersApi = {
  getMe: () =>
    apiClient.get<{ user: UserProfile }>('/users/me'),

  getProfile: (id: string) =>
    apiClient.get<{ user: UserProfile }>(`/users/${id}`),

  updateProfile: (data: Partial<Pick<User, 'name' | 'bio' | 'avatarUrl' | 'yearOfStudy' | 'branch' | 'lookingFor'>>) =>
    apiClient.put<{ user: User }>('/users/me', data),

  addSkill: (skillId: string, proficiency: string) =>
    apiClient.post<{ skill: UserSkill }>('/users/me/skills', { skillId, proficiency }),

  removeSkill: (skillId: string) =>
    apiClient.delete(`/users/me/skills/${skillId}`),

  addInterest: (interestId: string) =>
    apiClient.post<{ interest: Interest }>('/users/me/interests', { interestId }),

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
