import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query';
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
  const { ref, inView } = useInView({ threshold: 0, rootMargin: '200px' });

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => queryFn(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
  });

  useEffect(() => {
    if (inView && query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [inView, query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);

  const allData = query.data?.pages.flatMap((page) => page.data) ?? [];

  return {
    data: allData,
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    sentinelRef: ref,
    refetch: query.refetch,
  };
}
