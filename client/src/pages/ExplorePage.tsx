import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { recommendationsApi } from '../api/recommendations';
import { dropsApi } from '../api/drops';
import {
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { RecommendedUser, Drop } from '../types';
import { UserCard } from '../components/shared/UserCard';
import { SkeletonCard } from '../components/shared/SkeletonCard';
import { DropCard } from '../components/drops/DropCard';
import { CreateDropBox } from '../components/drops/CreateDropBox';
import { EmptyState } from '../components/shared/EmptyState';
import { InfiniteScrollLoader } from '../components/shared/InfiniteScrollLoader';
import { PageTabButton } from '../components/shared/PageTabButton';
import { getErrorMessage } from '../lib/utils';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

export default function ExplorePage() {
  const [activeTab, setActiveTab] = useState<'users' | 'drops'>('users');
  const queryClient = useQueryClient();

  const normalizePaginated = (resData: any) => {
    if (Array.isArray(resData)) return { data: resData, nextCursor: null };
    if (Array.isArray(resData?.data?.data)) return { data: resData.data.data, nextCursor: resData.data.nextCursor ?? null };
    if (Array.isArray(resData?.data)) return { data: resData.data, nextCursor: resData.nextCursor ?? null };
    return resData || { data: [], nextCursor: null };
  };

  // 1. Recommendations query (peer cosine similarity)
  const {
    data: users,
    isLoading: isLoadingUsers,
    isError: isErrorUsers,
    error: errorUsers,
    refetch: refetchUsers,
    hasNextPage: hasNextUsers,
    isFetchingNextPage: isFetchingNextUsers,
    fetchNextPage: fetchNextUsers,
    sentinelRef: usersSentinelRef,
  } = useInfiniteScroll<RecommendedUser>({
    queryKey: ['recommendations', 'similarity'],
    enabled: activeTab === 'users',
    queryFn: async (cursor) => {
      const res = await recommendationsApi.getSimilarity(cursor, 30);
      return normalizePaginated(res.data);
    },
  });

  // 2. Drops query (tweet-like posts)
  const {
    data: drops,
    hasNextPage: hasNextDrops,
    isFetchingNextPage: isFetchingNextDrops,
    isLoading: isLoadingDrops,
    fetchNextPage: fetchNextDrops,
    sentinelRef: dropsSentinelRef,
  } = useInfiniteScroll<Drop>({
    queryKey: ['drops'],
    enabled: activeTab === 'drops',
    queryFn: async (cursor) => {
      const res = await dropsApi.getDrops(cursor, 20);
      return normalizePaginated(res.data);
    },
  });

  // Vote drop mutation
  const voteMutation = useMutation({
    mutationFn: ({ id, voteType }: { id: string; voteType: 'up' | 'down' }) =>
      dropsApi.voteDrop(id, voteType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drops'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to register vote');
    },
  });

  // Delete drop mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => dropsApi.deleteDrop(id),
    onSuccess: () => {
      toast.success('Drop deleted');
      queryClient.invalidateQueries({ queryKey: ['drops'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to delete drop');
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">#explore</h1>
        <p className="mt-1 text-sm text-gray-500">
          Discover academic peers, collaborators, and live student drops across the network.
        </p>
      </div>

      {/* Navigation Tabs: #recommendation & #drops */}
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
        <PageTabButton
          active={activeTab === 'users'}
          onClick={() => setActiveTab('users')}
          icon={UserGroupIcon}
          title="#recommendation"
          subtitle="Matched peer collaborators"
          count={users.length > 0 ? users.length : null}
        />
        <PageTabButton
          active={activeTab === 'drops'}
          onClick={() => setActiveTab('drops')}
          icon={ChatBubbleLeftRightIcon}
          title="#drops"
          subtitle="Student thoughts & updates"
          count={drops.length > 0 ? drops.length : null}
        />
      </div>

      {/* VIEW 1: DROPS */}
      {activeTab === 'drops' ? (
        <div className="max-w-3xl space-y-6">
          <CreateDropBox />

          {isLoadingDrops ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : drops.length === 0 ? (
            <EmptyState
              title="No drops yet"
              description="Be the first to drop an update, thought, or announcement for the student community!"
            />
          ) : (
            <div className="space-y-4 pb-12">
              {drops.map((drop) => (
                <DropCard
                  key={drop.id}
                  drop={drop}
                  onVote={(id, voteType) => voteMutation.mutate({ id, voteType })}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  isVoting={voteMutation.isPending}
                />
              ))}

              <InfiniteScrollLoader
                ref={dropsSentinelRef}
                hasNextPage={hasNextDrops}
                isFetchingNextPage={isFetchingNextDrops}
                onLoadMore={() => fetchNextDrops()}
                label="Load More Drops"
              />
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: PEER RECOMMENDATIONS */
        <>
          <p className="text-xs text-gray-500 mb-6">
            Ranked by cosine vector similarity between your verified skills and academic peer profiles.
          </p>

          {isLoadingUsers ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : isErrorUsers ? (
            <EmptyState
              title="Something went wrong"
              description={getErrorMessage(errorUsers, "We couldn't load students at this time. Please check your connection and try again.")}
              action={{
                label: 'Try Again',
                onClick: () => refetchUsers(),
              }}
            />
          ) : users.length === 0 ? (
            <EmptyState
              title="No students found"
              description="Check back later for more personalized recommendations or update your skills."
            />
          ) : (
            <div className="flex flex-col gap-6 pb-12">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {users.map((u) => (
                  <UserCard key={u.id} user={u} mode="similarity" />
                ))}
              </div>

              {users.length > 0 && (
                <InfiniteScrollLoader
                  ref={usersSentinelRef}
                  isFetchingNextPage={isFetchingNextUsers}
                  hasNextPage={hasNextUsers}
                  onLoadMore={() => fetchNextUsers()}
                  label="Load More Students"
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export { ExplorePage as RecommendationsPage };
