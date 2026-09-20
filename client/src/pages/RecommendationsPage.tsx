import { useState, useRef, useEffect } from 'react';
import { recommendationsApi } from '../api/recommendations';
import { searchApi, SearchFilters } from '../api/search';
import { boardsApi } from '../api/boards';
import { RecommendedUser, BoardPosting } from '../types';
import { UserCard } from '../components/shared/UserCard';
import { SkeletonCard } from '../components/shared/SkeletonCard';
import { PostingCard } from '../components/shared/PostingCard';
import { PostingDetailView } from '../components/board/PostingDetailView';
import { JoinRequestModal } from '../components/board/JoinRequestModal';
import { SearchBar } from '../components/shared/SearchBar';
import { FilterPanel } from '../components/shared/FilterPanel';
import { EmptyState } from '../components/shared/EmptyState';
import { InfiniteScrollLoader } from '../components/shared/InfiniteScrollLoader';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { cn } from '../lib/utils';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

export default function RecommendationsPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'board'>('users');
  const [mode, setMode] = useState<'similarity' | 'search'>('similarity');
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>({});
  const [hasSearched, setHasSearched] = useState(false);

  // Personalized Board states
  const [selectedCommunity, setSelectedCommunity] = useState<'project' | 'hackathon' | 'competition'>('project');
  const [selectedPosting, setSelectedPosting] = useState<BoardPosting | null>(null);
  const [viewingPosting, setViewingPosting] = useState<BoardPosting | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  // Preserve scroll position
  const [scrollPositions, setScrollPositions] = useState<{ [key: string]: number }>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        setScrollPositions(prev => ({
          ...prev,
          [`${activeTab}-${mode}`]: scrollContainerRef.current?.scrollTop || 0
        }));
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [activeTab, mode]);

  useEffect(() => {
    if (scrollContainerRef.current && scrollPositions[`${activeTab}-${mode}`] !== undefined) {
      scrollContainerRef.current.scrollTop = scrollPositions[`${activeTab}-${mode}`];
    }
  }, [activeTab, mode, scrollPositions]);

  const isSearchMode = mode === 'search';
  const queryEnabled = activeTab === 'users' && (isSearchMode ? hasSearched : true);

  const queryKey = isSearchMode 
    ? ['search', 'users', appliedFilters, appliedQuery] 
    : ['recommendations', mode];

  const {
    data: users,
    isLoading: isLoadingUsers,
    isFetching: isFetchingUsers,
    isError: isErrorUsers,
    error: errorUsers,
    refetch: refetchUsers,
    hasNextPage: hasNextUsers,
    isFetchingNextPage: isFetchingNextUsers,
    fetchNextPage: fetchNextUsers,
    sentinelRef: usersSentinelRef
  } = useInfiniteScroll<RecommendedUser>({
    queryKey,
    enabled: queryEnabled,
    queryFn: async (cursor) => {
      const normalizeRecs = (resData: any) => {
        if (Array.isArray(resData)) return { data: resData, nextCursor: null };
        if (Array.isArray(resData?.data?.data)) return { ...resData, data: resData.data.data, nextCursor: resData.data.nextCursor ?? null };
        if (Array.isArray(resData?.data)) return resData;
        return resData || { data: [], nextCursor: null };
      };

      if (mode === 'similarity') {
        const res = await recommendationsApi.getSimilarity(cursor, 30);
        return normalizeRecs(res.data);
      }
      const res = await searchApi.searchUsers({ ...appliedFilters, q: appliedQuery }, cursor, 30);
      return normalizeRecs(res.data);
    },
  });

  const normalizePaginated = (resData: any) => {
    if (Array.isArray(resData)) return { data: resData, nextCursor: null };
    if (Array.isArray(resData?.data?.data)) return { data: resData.data.data, nextCursor: resData.data.nextCursor ?? null };
    if (Array.isArray(resData?.data)) return { data: resData.data, nextCursor: resData.nextCursor ?? null };
    return resData || { data: [], nextCursor: null };
  };

  const {
    data: matchedPostings,
    hasNextPage: hasNextMatched,
    isFetchingNextPage: isFetchingNextMatched,
    isLoading: isLoadingMatched,
    fetchNextPage: fetchNextMatched,
    sentinelRef: matchedRef,
  } = useInfiniteScroll<BoardPosting>({
    queryKey: ['board', 'matched', selectedCommunity],
    enabled: activeTab === 'board',
    queryFn: async (cursor) => {
      const res = await boardsApi.getMatched(cursor, 30, selectedCommunity);
      return normalizePaginated(res.data);
    },
  });

  const filterByCommunity = (list: BoardPosting[]) => {
    return list.filter((p) => {
      const comm = ((p.community || (p as any).community || 'project') as string).toLowerCase();
      return comm === selectedCommunity;
    });
  };

  const isSearchLoading = isSearchMode && hasSearched && (isLoadingUsers || (isFetchingUsers && !isFetchingNextUsers));

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

  const filteredMatchedPostings = filterByCommunity(matchedPostings);

  return (
    <div className="flex flex-col h-full bg-gray-50/50" ref={scrollContainerRef}>
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Top Navigation Tabs: Personalized User & Personalized Board */}
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer",
                  activeTab === 'users' ? "bg-white text-primary-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
                )}
              >
                Personalized User
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('board')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer",
                  activeTab === 'board' ? "bg-white text-primary-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
                )}
              >
                Personalized Board
              </button>
            </div>

            {/* Right Action: Search & Filter toggle for Personalized User */}
            {activeTab === 'users' && (
              <button
                type="button"
                onClick={() => setMode(prev => prev === 'search' ? 'similarity' : 'search')}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer self-start sm:self-auto",
                  mode === 'search'
                    ? "bg-primary-600 text-white border-primary-600 shadow-sm"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                )}
              >
                <MagnifyingGlassIcon className="h-3.5 w-3.5" />
                <span>{mode === 'search' ? 'Hide Search & Filter' : 'Search & Filter'}</span>
              </button>
            )}
          </div>

          {/* Personalized Board Community Filter: #all, #project, #hackathon, #competition */}
          {activeTab === 'board' && (
            <div className="flex items-center flex-wrap gap-2 pt-1">
              <span className="text-xs font-semibold text-gray-500 mr-1 uppercase tracking-wider">
                Community:
              </span>
              {[
                { id: 'project', label: '#project' },
                { id: 'hackathon', label: '#hackathon' },
                { id: 'competition', label: '#competition' },
              ].map((c) => {
                const isSelected = selectedCommunity === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCommunity(c.id as any)}
                    className={cn(
                      'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer border',
                      isSelected
                        ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Search Panel when Search & Filter is active in Personalized User */}
          {activeTab === 'users' && mode === 'search' && (
            <div className="flex flex-col space-y-3 pt-1">
              <SearchBar 
                value={searchQuery}
                onChange={setSearchQuery} 
                onSearch={() => {
                  setAppliedQuery(searchQuery);
                  setHasSearched(true);
                }} 
                placeholder="Search students by name, bio, or college..." 
              />
              <FilterPanel 
                filters={appliedFilters} 
                onApply={(newFilters) => {
                  setAppliedFilters(newFilters);
                  setAppliedQuery(searchQuery);
                  setHasSearched(true);
                }} 
                onClear={() => {
                  setAppliedFilters({});
                  setAppliedQuery('');
                  setSearchQuery('');
                  setHasSearched(false);
                }} 
                isSearching={isSearchLoading}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:px-8">
        {activeTab === 'users' ? (
          <>
            {isSearchMode && !hasSearched ? (
              <EmptyState 
                icon={<MagnifyingGlassIcon className="w-12 h-12 text-primary-400" />}
                title="Search for students" 
                description="Select your desired filter options above (college, year, skills, or intent) and click 'Search' to discover students."
              />
            ) : (isLoadingUsers || (isSearchMode && isSearchLoading && users.length === 0)) ? (
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
                description={mode === 'search' ? "No students matched your search criteria. Try broadening your filters or choosing different skills." : "Check back later for more personalized recommendations."}
              />
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {users.map((u) => (
                  <UserCard key={u.id} user={u} mode={mode} />
                ))}
              </div>
            )}

            {users.length > 0 && (
              <InfiniteScrollLoader 
                ref={usersSentinelRef} 
                isFetchingNextPage={isFetchingNextUsers} 
                hasNextPage={hasNextUsers}
                onLoadMore={() => fetchNextUsers()}
                label="Load More Students"
              />
            )}
          </>
        ) : (
          <>
            {isLoadingMatched ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : filteredMatchedPostings.length === 0 ? (
              <EmptyState 
                title={`No matching #${selectedCommunity} postings found`} 
                description="Update your profile skills and interests to get matched with relevant groups and opportunities."
              />
            ) : (
              <div className="flex flex-col gap-6 pb-12">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredMatchedPostings.map((posting: BoardPosting) => (
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
        )}
      </div>

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
