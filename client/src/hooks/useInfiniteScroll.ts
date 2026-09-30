import { useInfiniteQuery, type QueryKey, type InfiniteData } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { useEffect } from 'react';
import type { PaginatedResponse } from '../types';

interface UseInfiniteScrollOptions<T> {
  queryKey: QueryKey;
  queryFn: (cursor: string | null) => Promise<PaginatedResponse<T>>;
  enabled?: boolean;
}

export function useInfiniteScroll<T>({
  queryKey,
  queryFn,
  enabled = true,
}: UseInfiniteScrollOptions<T>) {
  const { ref } = useInView({ threshold: 0, rootMargin: '200px' });

  const query = useInfiniteQuery<PaginatedResponse<T>, Error, InfiniteData<PaginatedResponse<T>>, QueryKey, string | null>({
    queryKey,
    queryFn: ({ pageParam }) => queryFn(pageParam),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    enabled,
  });

  // No auto-trigger on scroll into view: user must click "Load More" button
  const allData = query.data?.pages.flatMap((page) => page?.data ?? []) ?? [];

  return {
    data: allData,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    sentinelRef: ref,
    refetch: query.refetch,
  };
}
