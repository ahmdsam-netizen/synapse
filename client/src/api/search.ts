import apiClient from './client';
import type { RecommendedUser, PaginatedResponse } from '../types';

export interface SearchFilters {
  q?: string;
  skills?: string[];
  interests?: string[];
  matchMode?: 'any' | 'all';
  collegeId?: string;
  college?: string;
  year?: number;
  lookingFor?: string;
}

export const searchApi = {
  searchUsers: (filters: SearchFilters, cursor?: string | null, limit: number = 30) => {
    const params: any = { limit };
    if (cursor) params.cursor = cursor;
    if (filters.q && filters.q.trim()) params.q = filters.q.trim();
    if (filters.college && filters.college.trim()) params.college = filters.college.trim();
    if (filters.collegeId && filters.collegeId.trim()) params.collegeId = filters.collegeId.trim();
    if (filters.year) params.year = filters.year;
    if (filters.lookingFor && filters.lookingFor !== 'any') params.lookingFor = filters.lookingFor;
    if (filters.matchMode) params.matchMode = filters.matchMode;
    if (Array.isArray(filters.skills) && filters.skills.length > 0) {
      params.skills = filters.skills.filter(Boolean).join(',');
    }
    if (Array.isArray(filters.interests) && filters.interests.length > 0) {
      params.interests = filters.interests.filter(Boolean).join(',');
    }
    return apiClient.get<PaginatedResponse<RecommendedUser>>('/search/users', { params });
  },
};
