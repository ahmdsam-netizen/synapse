import { useState, useRef, useEffect } from 'react';
import { recommendationsApi } from '../api/recommendations';
import { searchApi, SearchFilters } from '../api/search';
import { RecommendedUser } from '../types';
import { UserCard } from '../components/shared/UserCard';
import { SkeletonCard } from '../components/shared/SkeletonCard';
import { SearchBar } from '../components/shared/SearchBar';
import { FilterPanel } from '../components/shared/FilterPanel';
import { EmptyState } from '../components/shared/EmptyState';
import { InfiniteScrollLoader } from '../components/shared/InfiniteScrollLoader';
import { 
  MagnifyingGlassIcon, 
  XMarkIcon, 
  InformationCircleIcon 
} from '@heroicons/react/24/outline';
import { cn } from '../lib/utils';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

export default function RecommendationsPage() {
  const [mode, setMode] = useState<'similarity' | 'second_degree' | 'search'>('similarity');
  const [previousMode, setPreviousMode] = useState<'similarity' | 'second_degree'>('similarity');
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>({});
  const [hasSearched, setHasSearched] = useState(false);
  const [currentSource, setCurrentSource] = useState<string | undefined>(undefined);

  // Preserve scroll position
  const [scrollPositions, setScrollPositions] = useState<{ [key: string]: number }>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        setScrollPositions(prev => ({
          ...prev,
          [mode]: scrollContainerRef.current?.scrollTop || 0
        }));
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [mode]);

  useEffect(() => {
    if (scrollContainerRef.current && scrollPositions[mode] !== undefined) {
      scrollContainerRef.current.scrollTop = scrollPositions[mode];
    }
  }, [mode, scrollPositions]);

  const toggleSearch = () => {
    if (mode === 'search') {
      setMode(previousMode);
      setHasSearched(false);
      setAppliedFilters({});
      setSearchQuery('');
      setAppliedQuery('');
    } else {
      setPreviousMode(mode as 'similarity' | 'second_degree');
      setMode('search');
      setHasSearched(false);
      setAppliedFilters({});
      setSearchQuery('');
      setAppliedQuery('');
    }
  };

  const isSearchMode = mode === 'search';
  const queryEnabled = isSearchMode ? hasSearched : true;

  const queryKey = isSearchMode 
    ? ['search', 'users', appliedFilters, appliedQuery] 
    : ['recommendations', mode];

  const {
    data: users,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    sentinelRef
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
        setCurrentSource(res.data?.source);
        return normalizeRecs(res.data);
      }
      if (mode === 'second_degree') {
        const res = await recommendationsApi.getSecondDegree(cursor, 30);
        setCurrentSource(res.data?.source);
        return normalizeRecs(res.data);
      }
      const res = await searchApi.searchUsers({ ...appliedFilters, q: appliedQuery }, cursor, 30);
      setCurrentSource(undefined);
      return normalizeRecs(res.data);
    },
  });

  const isSearchLoading = isSearchMode && hasSearched && (isLoading || (isFetching && !isFetchingNextPage));

  // Checking for fallback banners
  const isFallback = mode === 'second_degree' && (currentSource === 'direct_connections' || currentSource === 'similarity');

  return (
    <div className="flex flex-col h-full bg-gray-50/50" ref={scrollContainerRef}>
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setMode('similarity')}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  mode === 'similarity' ? "bg-primary-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
                )}
              >
                Similarity
              </button>
              <button
                onClick={() => setMode('second_degree')}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  mode === 'second_degree' ? "bg-primary-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
                )}
              >
                2nd Degree
              </button>
              <button
                onClick={() => setMode('search')}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer",
                  mode === 'search' ? "bg-primary-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
                )}
              >
                <MagnifyingGlassIcon className="w-4 h-4" />
                <span>Search & Filter</span>
              </button>
            </div>
          </div>

          {mode === 'search' && (
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

      <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:px-8">
        {isFallback && (
          <div className="mb-6 flex items-center p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
            <InformationCircleIcon className="w-5 h-5 mr-3 flex-shrink-0 text-amber-500" />
            <p className="text-sm font-medium">
              {currentSource === 'direct_connections' 
                ? "Showing your connections — no new suggestions right now."
                : "Showing similar students — no 2nd-degree suggestions right now."}
            </p>
          </div>
        )}

        {isSearchMode && !hasSearched ? (
          <EmptyState 
            icon={<MagnifyingGlassIcon className="w-12 h-12 text-primary-400" />}
            title="Search for students" 
            description="Select your desired filter options above (college, year, skills, or intent) and click 'Search' to discover students."
          />
        ) : (isLoading || (isSearchMode && isSearchLoading && users.length === 0)) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : isError ? (
          <EmptyState 
            title="Something went wrong" 
            description={
              (error as any)?.response?.data?.error || 
              (error as any)?.response?.data?.message || 
              (error as any)?.message || 
              "We couldn't load students at this time. Please check your connection and try again."
            }
            action={{
              label: 'Try Again',
              onClick: () => refetch(),
            }}
          />
        ) : users.length === 0 ? (
          <EmptyState 
            title="No students found" 
            description={mode === 'search' ? "No students matched your search criteria. Try broadening your filters or choosing different skills." : "Check back later for more recommendations."}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map((u) => (
              <UserCard key={u.id} user={u} mode={mode} />
            ))}
          </div>
        )}

        {users.length > 0 && (
          <InfiniteScrollLoader 
            ref={sentinelRef} 
            isFetchingNextPage={isFetchingNextPage} 
            hasNextPage={hasNextPage}
            onLoadMore={() => fetchNextPage()}
            label="Load More Students"
          />
        )}
      </div>
    </div>
  );
}
