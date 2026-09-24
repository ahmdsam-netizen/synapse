import { useState } from 'react';
import { recommendationsApi } from '../api/recommendations';
import { boardsApi } from '../api/boards';
import { RecommendedUser, BoardPosting } from '../types';
import { UserCard } from '../components/shared/UserCard';
import { SkeletonCard } from '../components/shared/SkeletonCard';
import { PostingCard } from '../components/shared/PostingCard';
import { PostingDetailView } from '../components/board/PostingDetailView';
import { JoinRequestModal } from '../components/board/JoinRequestModal';
import { EmptyState } from '../components/shared/EmptyState';
import { InfiniteScrollLoader } from '../components/shared/InfiniteScrollLoader';
import { cn } from '../lib/utils';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

export default function RecommendationsPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'board'>('users');

  // Recommended Board states
  const [selectedPosting, setSelectedPosting] = useState<BoardPosting | null>(null);
  const [viewingPosting, setViewingPosting] = useState<BoardPosting | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  // Recommendations query (peer cosine similarity)
  const {
    data: users,
    isLoading: isLoadingUsers,
    isError: isErrorUsers,
    error: errorUsers,
    refetch: refetchUsers,
    hasNextPage: hasNextUsers,
    isFetchingNextPage: isFetchingNextUsers,
    fetchNextPage: fetchNextUsers,
    sentinelRef: usersSentinelRef
  } = useInfiniteScroll<RecommendedUser>({
    queryKey: ['recommendations', 'similarity'],
    enabled: activeTab === 'users',
    queryFn: async (cursor) => {
      const normalizeRecs = (resData: any) => {
        if (Array.isArray(resData)) return { data: resData, nextCursor: null };
        if (Array.isArray(resData?.data?.data)) return { ...resData, data: resData.data.data, nextCursor: resData.data.nextCursor ?? null };
        if (Array.isArray(resData?.data)) return resData;
        return resData || { data: [], nextCursor: null };
      };

      const res = await recommendationsApi.getSimilarity(cursor, 30);
      return normalizeRecs(res.data);
    },
  });

  const normalizePaginated = (resData: any) => {
    if (Array.isArray(resData)) return { data: resData, nextCursor: null };
    if (Array.isArray(resData?.data?.data)) return { data: resData.data.data, nextCursor: resData.data.nextCursor ?? null };
    if (Array.isArray(resData?.data)) return { data: resData.data, nextCursor: resData.nextCursor ?? null };
    return resData || { data: [], nextCursor: null };
  };

  // Recommended board postings query
  const {
    data: matchedPostings,
    hasNextPage: hasNextMatched,
    isFetchingNextPage: isFetchingNextMatched,
    isLoading: isLoadingMatched,
    fetchNextPage: fetchNextMatched,
    sentinelRef: matchedRef,
  } = useInfiniteScroll<BoardPosting>({
    queryKey: ['board', 'matched'],
    enabled: activeTab === 'board',
    queryFn: async (cursor) => {
      const res = await boardsApi.getMatched(cursor, 30);
      return normalizePaginated(res.data);
    },
  });

  // If viewing a single posting detail
  if (viewingPosting) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PostingDetailView
          posting={viewingPosting}
          onBack={() => setViewingPosting(null)}
          onRequestClick={() => {
            setSelectedPosting(viewingPosting);
            setIsJoinModalOpen(true);
          }}
          isMatchedTab={true}
        />

        {selectedPosting && (
          <JoinRequestModal
            open={isJoinModalOpen}
            onClose={() => {
              setIsJoinModalOpen(false);
              setTimeout(() => setSelectedPosting(null), 300);
            }}
            onSuccess={() => {
              setViewingPosting((prev) => (prev ? { ...prev, hasRequested: true } : null));
            }}
            posting={selectedPosting}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">#discover</h1>
        <p className="mt-1 text-sm text-gray-500">
          Discover academic peers, collaborators, and matched opportunities based on verified skill compatibility.
        </p>
      </div>

      {/* Navigation Tabs: #recommendation & #recommendedBoard */}
      <div className="mb-6 flex space-x-1 rounded-xl bg-gray-100 p-1 max-w-sm">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={cn(
            "w-full rounded-lg py-2.5 text-sm font-semibold transition-all cursor-pointer text-center",
            activeTab === 'users'
              ? "bg-white text-primary-700 shadow-xs"
              : "text-gray-600 hover:text-gray-900"
          )}
        >
          #recommendation
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('board')}
          className={cn(
            "w-full rounded-lg py-2.5 text-sm font-semibold transition-all cursor-pointer text-center",
            activeTab === 'board'
              ? "bg-white text-primary-700 shadow-xs"
              : "text-gray-600 hover:text-gray-900"
          )}
        >
          #recommendedBoard
        </button>
      </div>

      {/* View Content */}
      {activeTab === 'board' ? (
        <>
          <p className="text-xs text-gray-500 mb-6">
            Active project postings and team roles matched to your verified skills and academic interests.
          </p>

          {isLoadingMatched ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : matchedPostings.length === 0 ? (
            <EmptyState 
              title="No matched postings found" 
              description="Update your profile skills and interests to get matched with relevant groups and opportunities."
            />
          ) : (
            <div className="flex flex-col gap-6 pb-12">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {matchedPostings.map((posting: BoardPosting) => (
                  <PostingCard
                    key={posting.id}
                    posting={posting}
                    onClick={() => setViewingPosting(posting)}
                    isMatchedTab={true}
                  />
                ))}
              </div>
              <InfiniteScrollLoader
                ref={matchedRef}
                hasNextPage={hasNextMatched}
                isFetchingNextPage={isFetchingNextMatched}
                onLoadMore={() => fetchNextMatched()}
                label="Load More Personalized Postings"
              />
            </div>
          )}
        </>
      ) : (
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
              description={
                (errorUsers as any)?.response?.data?.error || 
                (errorUsers as any)?.response?.data?.message || 
                (errorUsers as any)?.message || 
                "We couldn't load students at this time. Please check your connection and try again."
              }
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

      {selectedPosting && (
        <JoinRequestModal
          open={isJoinModalOpen}
          onClose={() => {
            setIsJoinModalOpen(false);
            setTimeout(() => setSelectedPosting(null), 300);
          }}
          posting={selectedPosting}
        />
      )}
    </div>
  );
}
