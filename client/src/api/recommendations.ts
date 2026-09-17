import apiClient from './client';
import type { RecommendedUser, PaginatedResponse } from '../types';

export interface RecommendationResponse extends PaginatedResponse<RecommendedUser> {
  source?: 'second_degree' | 'direct_connections' | 'similarity';
}

export const recommendationsApi = {
  getSecondDegree: (cursor?: string | null, limit: number = 30) =>
    apiClient.get<RecommendationResponse>('/recommendations/second-degree', {
      params: { cursor, limit },
    }),

  getSimilarity: (cursor?: string | null, limit: number = 30) =>
    apiClient.get<RecommendationResponse>('/recommendations/similarity', {
      params: { cursor, limit },
    }),
};
