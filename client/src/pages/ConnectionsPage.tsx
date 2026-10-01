import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  InformationCircleIcon,
  UserGroupIcon,
  AdjustmentsHorizontalIcon,
  ShareIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { connectionsApi } from '../api/connections';
import { recommendationsApi } from '../api/recommendations';
import { searchApi, SearchFilters } from '../api/search';
import { useAuth } from '../context/AuthContext';
import { RecommendedUser } from '../types';
import { EmptyState } from '../components/shared/EmptyState';
import { UserCard } from '../components/shared/UserCard';
import { SkeletonCard } from '../components/shared/SkeletonCard';
import { SearchBar } from '../components/shared/SearchBar';
import { FilterPanel } from '../components/shared/FilterPanel';
import { InfiniteScrollLoader } from '../components/shared/InfiniteScrollLoader';
import { PageTabButton } from '../components/shared/PageTabButton';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { getErrorMessage } from '../lib/utils';

export default function ConnectionsPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [secondDegreeSource, setSecondDegreeSource] = useState<string | undefined>(undefined);

  // Filter peers directory state
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const [filterAppliedQuery, setFilterAppliedQuery] = useState('');
  const [filterAppliedFilters, setFilterAppliedFilters] = useState<SearchFilters>({});
  const [hasFiltered, setHasFiltered] = useState(false);

  // Fetch filtered users
  const {
    data: filteredUsers,
    isLoading: isLoadingFiltered,
    isFetching: isFetchingFiltered,
    isError: isFilteredError,
    error: filteredError,
    refetch: refetchFiltered,
    hasNextPage: hasNextFiltered,
    isFetchingNextPage: isFetchingNextFiltered,
    fetchNextPage: fetchNextFiltered,
    sentinelRef: filterSentinelRef
  } = useInfiniteScroll<RecommendedUser>({
    queryKey: ['search', 'peers', filterAppliedFilters, filterAppliedQuery],
    enabled: hasFiltered,
    queryFn: async (cursor) => {
      const normalizeRecs = (resData: any) => {
        if (Array.isArray(resData)) return { data: resData, nextCursor: null };
        if (Array.isArray(resData?.data?.data)) return { ...resData, data: resData.data.data, nextCursor: resData.data.nextCursor ?? null };
        if (Array.isArray(resData?.data)) return resData;
        return resData || { data: [], nextCursor: null };
      };
      const res = await searchApi.searchUsers({ ...filterAppliedFilters, q: filterAppliedQuery }, cursor, 30);
      return normalizeRecs(res.data);
    },
  });

  const isFilterLoading = hasFiltered && (isLoadingFiltered || (isFetchingFiltered && !isFetchingNextFiltered));

  // Fetch accepted connections
  const {
    data: connectionsData,
    isLoading: isLoadingConnections,
    isError: isConnectionsError,
    error: connectionsError,
  } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await connectionsApi.list(null, 100);
      const body = res.data as any;
      return body.data || body || [];
    },
  });

  // Fetch 2nd-degree recommendations
  const {
    data: secondDegreeUsers,
    isLoading: isLoadingSecondDegree,
    isError: isSecondDegreeError,
    error: secondDegreeError,
    refetch: refetchSecondDegree,
    hasNextPage: hasNextPageSecondDegree,
    isFetchingNextPage: isFetchingNextPageSecondDegree,
    fetchNextPage: fetchNextPageSecondDegree,
    sentinelRef: secondDegreeSentinelRef,
  } = useInfiniteScroll<RecommendedUser>({
    queryKey: ['connections', 'second-degree'],
    queryFn: async (cursor) => {
      const normalizeRecs = (resData: any) => {
        if (Array.isArray(resData)) return { data: resData, nextCursor: null };
        if (Array.isArray(resData?.data?.data)) return { ...resData, data: resData.data.data, nextCursor: resData.data.nextCursor ?? null };
        if (Array.isArray(resData?.data)) return resData;
        return resData || { data: [], nextCursor: null };
      };

      const res = await recommendationsApi.getSecondDegree(cursor, 30);
      setSecondDegreeSource(res.data?.source);
      return normalizeRecs(res.data);
    },
  });

  const isSecondDegreeFallback =
    secondDegreeSource === 'direct_connections' || secondDegreeSource === 'similarity';

  // Remove connection mutation
  const removeMutation = useMutation({
    mutationFn: (id: string) => connectionsApi.remove(id),
    onSuccess: () => {
      toast.success('Connection removed');
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['connections', 'second-degree'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to remove connection'));
    },
  });

  const connections: any[] = connectionsData || [];

  // Filter connections by search query
  const filteredConnections = useMemo(() => {
    if (!searchQuery.trim()) return connections;
    const q = searchQuery.toLowerCase();
    return connections.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const college = (c.collegeName || c.college_name || '').toLowerCase();
      const branch = (c.branch || '').toLowerCase();
      const skills = (c.skills || []).map((s: any) => (typeof s === 'string' ? s : s.name).toLowerCase()).join(' ');
      return name.includes(q) || college.includes(q) || branch.includes(q) || skills.includes(q);
    });
  }, [connections, searchQuery]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">#peers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Collaborators, direct connections, and verified student directory across institutions.
          </p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <PageTabButton
          active={selectedTabIndex === 0}
          onClick={() => setSelectedTabIndex(0)}
          icon={UserGroupIcon}
          title="#connections"
          subtitle="Verified student peers"
          count={connections.length}
        />
        <PageTabButton
          active={selectedTabIndex === 1}
          onClick={() => setSelectedTabIndex(1)}
          icon={ShareIcon}
          title="#secondDegree"
          subtitle="2nd-degree network"
        />
        <PageTabButton
          active={selectedTabIndex === 2}
          onClick={() => setSelectedTabIndex(2)}
          icon={AdjustmentsHorizontalIcon}
          title="#filter"
          subtitle="Search & filter directory"
        />
      </div>

      {/* TAB 1: ACCEPTED CONNECTIONS */}
      {selectedTabIndex === 0 && (
        <div>
            {/* Search filter */}
            {connections.length > 0 && (
              <div className="mb-6 relative max-w-md">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, college, or skill..."
                  className="block w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 shadow-sm"
                />
              </div>
            )}

            {isLoadingConnections ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : filteredConnections.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredConnections.map((user) => (
                  <UserCard
                    key={user.id || user.friendId}
                    user={user}
                    mode="connection"
                    onDisconnect={(connId) => removeMutation.mutate(connId)}
                    isDisconnecting={removeMutation.isPending}
                  />
                ))}
              </div>
            ) : isConnectionsError ? (
              <EmptyState
                title="Failed to load connections"
                description={getErrorMessage(connectionsError, "Could not retrieve your connection list. Please try again.")}
                action={{
                  label: 'Retry',
                  onClick: () => queryClient.invalidateQueries({ queryKey: ['connections'] }),
                }}
              />
            ) : connections.length > 0 ? (
              <EmptyState
                title="No connections matched your search"
                description={`No connected students found matching "${searchQuery}".`}
                action={{
                  label: 'Clear Search',
                  onClick: () => setSearchQuery(''),
                }}
              />
            ) : (
              <EmptyState
                title="No connections yet"
                description="Expand your student circle by discovering peers through recommendations or browsing the collaborative project boards."
                action={{
                  label: 'Discover Recommendations',
                  onClick: () => (window.location.href = '/recommendations'),
                }}
              />
            )}
        </div>
      )}

      {/* TAB 2: 2ND-DEGREE NETWORK */}
      {selectedTabIndex === 1 && (
        <div>
            {isSecondDegreeFallback && (
              <div className="mb-6 flex items-center p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                <InformationCircleIcon className="w-5 h-5 mr-3 flex-shrink-0 text-amber-500" />
                <p className="text-sm font-medium">
                  {secondDegreeSource === 'direct_connections'
                    ? "Showing your connections: no new suggestions right now."
                    : "Showing similar students: no 2nd-degree suggestions right now."}
                </p>
              </div>
            )}

            {isLoadingSecondDegree ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : isSecondDegreeError ? (
              <EmptyState
                title="Failed to load suggestions"
                description={getErrorMessage(secondDegreeError, "Could not retrieve 2nd-degree network suggestions. Please try again.")}
                action={{
                  label: 'Retry',
                  onClick: () => refetchSecondDegree(),
                }}
              />
            ) : secondDegreeUsers.length > 0 ? (
              <div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {secondDegreeUsers.map((user) => (
                    <UserCard
                      key={user.id}
                      user={user}
                      mode="second_degree"
                      onConnect={() => {
                        queryClient.invalidateQueries({ queryKey: ['connections', 'second-degree'] });
                      }}
                    />
                  ))}
                </div>
                <InfiniteScrollLoader
                  ref={secondDegreeSentinelRef}
                  isFetchingNextPage={isFetchingNextPageSecondDegree}
                  hasNextPage={hasNextPageSecondDegree}
                  onLoadMore={() => fetchNextPageSecondDegree()}
                  label="Load More Suggestions"
                />
              </div>
            ) : (
              <EmptyState
                title="No 2nd-degree connections yet"
                description="Connect with more classmates to expand your network and discover friends of friends."
                action={{
                  label: 'Discover Recommendations',
                  onClick: () => (window.location.href = '/recommendations'),
                }}
              />
            )}
        </div>
      )}

      {/* TAB 3: FILTER PEERS DIRECTORY */}
      {selectedTabIndex === 2 && (
        <div>
            <div className="mb-6 flex flex-col space-y-3">
              <SearchBar 
                value={filterSearchQuery}
                onChange={setFilterSearchQuery} 
                onSearch={() => {
                  setFilterAppliedQuery(filterSearchQuery);
                  setHasFiltered(true);
                }} 
                placeholder="Search students by name, bio, or college..." 
              />
              <FilterPanel 
                filters={filterAppliedFilters} 
                onApply={(newFilters) => {
                  setFilterAppliedFilters(newFilters);
                  setFilterAppliedQuery(filterSearchQuery);
                  setHasFiltered(true);
                }} 
                onClear={() => {
                  setFilterAppliedFilters({});
                  setFilterAppliedQuery('');
                  setFilterSearchQuery('');
                  setHasFiltered(false);
                }} 
                isSearching={isFilterLoading}
              />
            </div>

            {!hasFiltered ? (
              <EmptyState 
                title="Filter student peers" 
                description="Select your desired filter options above (college, year, skills, or intent) and click 'Search' to discover students."
              />
            ) : isFilterLoading && filteredUsers.length === 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : isFilteredError ? (
              <EmptyState 
                title="Something went wrong" 
                description={getErrorMessage(filteredError, "We couldn't load students at this time. Please check your connection and try again.")}
                action={{
                  label: 'Try Again',
                  onClick: () => refetchFiltered(),
                }}
              />
            ) : filteredUsers.length === 0 ? (
              <EmptyState 
                title="No students found" 
                description="No students matched your search criteria. Try broadening your filters or choosing different skills."
              />
            ) : (
              <div className="flex flex-col gap-6 pb-12">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredUsers.map((u) => (
                    <UserCard key={u.id} user={u} mode="search" />
                  ))}
                </div>

                {filteredUsers.length > 0 && (
                  <InfiniteScrollLoader 
                    ref={filterSentinelRef} 
                    isFetchingNextPage={isFetchingNextFiltered} 
                    hasNextPage={hasNextFiltered}
                    onLoadMore={() => fetchNextFiltered()}
                    label="Load More Students"
                  />
                )}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
