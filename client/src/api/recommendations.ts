import apiClient from './client';
import type { RecommendedUser, BoardPosting, PaginatedResponse } from '../types';

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

  getMatchedBoards: (cursor?: string | null, limit: number = 30, community?: string) =>
    apiClient.get<PaginatedResponse<BoardPosting>>('/recommendations/boards', {
      params: { cursor, limit, community },
    }),
};
