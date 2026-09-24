import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/react';
import {
  UserGroupIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  XMarkIcon,
  InformationCircleIcon,
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
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { getInitials, timeAgo, cn } from '../lib/utils';

export default function ConnectionsPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [secondDegreeSource, setSecondDegreeSource] = useState<string | undefined>(undefined);
  const [pendingSubFilter, setPendingSubFilter] = useState<'all' | 'received' | 'sent'>('all');

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

  // Fetch pending connection requests
  const {
    data: pendingData,
    isLoading: isLoadingPending,
    isError: isPendingError,
  } = useQuery({
    queryKey: ['connections', 'pending'],
    queryFn: async () => {
      const res = await connectionsApi.pending();
      const body = res.data as any;
      return Array.isArray(body) ? body : body.data || [];
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

  // Mutations for accepting/declining requests
  const acceptMutation = useMutation({
    mutationFn: (id: string) => connectionsApi.accept(id),
    onSuccess: () => {
      toast.success('Connection accepted!');
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['connections', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['connections', 'second-degree'] });
    },
    onError: () => toast.error('Failed to accept connection request'),
  });

  const declineMutation = useMutation({
    mutationFn: (id: string) => connectionsApi.decline(id),
    onSuccess: () => {
      toast.success('Connection request declined');
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['connections', 'pending'] });
    },
    onError: () => toast.error('Failed to decline connection request'),
  });

  // Remove connection mutation
  const removeMutation = useMutation({
    mutationFn: (id: string) => connectionsApi.remove(id),
    onSuccess: () => {
      toast.success('Connection removed');
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['connections', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['connections', 'second-degree'] });
    },
    onError: () => {
      toast.error('Failed to remove connection');
    },
  });

  const cancelRequestMutation = useMutation({
    mutationFn: (id: string) => connectionsApi.remove(id),
    onSuccess: () => {
      toast.success('Connection request cancelled');
      queryClient.invalidateQueries({ queryKey: ['connections', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['connections', 'second-degree'] });
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
    onError: () => {
      toast.error('Failed to cancel connection request');
    },
  });

  const connections: any[] = connectionsData || [];
  
  // Pending requests (both received and sent)
  const allPendingRequests: any[] = pendingData || [];
  const receivedRequests = useMemo(() => {
    return allPendingRequests.filter(
      (req: any) => req.direction === 'received' || (currentUser?.id && (req.receiverId === currentUser.id || req.receiver_id === currentUser.id))
    );
  }, [allPendingRequests, currentUser]);

  const sentRequests = useMemo(() => {
    return allPendingRequests.filter(
      (req: any) => req.direction === 'sent' || (currentUser?.id && (req.requesterId === currentUser.id || req.requester_id === currentUser.id))
    );
  }, [allPendingRequests, currentUser]);

  const displayedPendingRequests = useMemo(() => {
    if (pendingSubFilter === 'received') return receivedRequests;
    if (pendingSubFilter === 'sent') return sentRequests;
    return allPendingRequests;
  }, [allPendingRequests, receivedRequests, sentRequests, pendingSubFilter]);

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
        <Link
          to="/recommendations"
          className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
        >
          #recommendations
        </Link>
      </div>

      <TabGroup>
        <TabList className="mb-8 flex max-w-2xl space-x-1 rounded-xl bg-gray-100 p-1">
          <Tab className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold leading-5 transition-colors focus:outline-none data-[selected]:bg-white data-[selected]:text-primary-700 data-[selected]:shadow text-gray-600 hover:text-gray-900 cursor-pointer">
            <span>#connections</span>
            <span className="ml-1 rounded-md bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700 data-[selected]:bg-primary-100 data-[selected]:text-primary-800">
              {connections.length}
            </span>
          </Tab>
          <Tab className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold leading-5 transition-colors focus:outline-none data-[selected]:bg-white data-[selected]:text-primary-700 data-[selected]:shadow text-gray-600 hover:text-gray-900 cursor-pointer">
            <span>#filter</span>
          </Tab>
          <Tab className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold leading-5 transition-colors focus:outline-none data-[selected]:bg-white data-[selected]:text-primary-700 data-[selected]:shadow text-gray-600 hover:text-gray-900 cursor-pointer">
            <span>#secondDegree</span>
          </Tab>
          <Tab className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold leading-5 transition-colors focus:outline-none data-[selected]:bg-white data-[selected]:text-primary-700 data-[selected]:shadow text-gray-600 hover:text-gray-900 cursor-pointer">
            <span>#pendingRequest</span>
            {allPendingRequests.length > 0 && (
              <span className="ml-1 rounded-md bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                {allPendingRequests.length}
              </span>
            )}
          </Tab>
        </TabList>

        <TabPanels>
          {/* TAB 1: ACCEPTED CONNECTIONS */}
          <TabPanel>
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
                description={(connectionsError as any)?.response?.data?.error || "Could not retrieve your connection list. Please try again."}
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
          </TabPanel>

          {/* TAB 2: FILTER PEERS DIRECTORY */}
          <TabPanel>
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
                description={
                  (filteredError as any)?.response?.data?.error || 
                  (filteredError as any)?.response?.data?.message || 
                  "We couldn't load students at this time. Please check your connection and try again."
                }
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
          </TabPanel>

          {/* TAB 3: 2ND-DEGREE NETWORK */}
          <TabPanel>
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
                description={
                  (secondDegreeError as any)?.response?.data?.error ||
                  (secondDegreeError as any)?.response?.data?.message ||
                  (secondDegreeError as any)?.message ||
                  "Could not retrieve 2nd-degree network suggestions. Please try again."
                }
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
          </TabPanel>
          
          {/* TAB 2: PENDING REQUESTS */}

          <TabPanel>
            {/* Sub-filter tabs: All, Received, Sent */}
            {allPendingRequests.length > 0 && (
              <div className="mb-6 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPendingSubFilter('all')}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer border',
                    pendingSubFilter === 'all'
                      ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  )}
                >
                  All ({allPendingRequests.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPendingSubFilter('received')}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer border',
                    pendingSubFilter === 'received'
                      ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  )}
                >
                  Received ({receivedRequests.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPendingSubFilter('sent')}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer border',
                    pendingSubFilter === 'sent'
                      ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  )}
                >
                  Sent ({sentRequests.length})
                </button>
              </div>
            )}

            {isLoadingPending ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-200" />
                ))}
              </div>
            ) : isPendingError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
                <p className="text-sm font-medium text-red-800">Failed to load pending requests.</p>
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['connections', 'pending'] })}
                  className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Retry
                </button>
              </div>
            ) : displayedPendingRequests.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <ul className="divide-y divide-gray-200">
                  {displayedPendingRequests.map((req: any) => {
                    const isIncoming =
                      req.direction === 'received' ||
                      (currentUser?.id &&
                        (req.receiverId === currentUser.id || req.receiver_id === currentUser.id));
                    const targetProfileId =
                      req.userId ||
                      (isIncoming
                        ? req.requesterId || req.requester_id
                        : req.receiverId || req.receiver_id);

                    return (
                      <li key={req.id} className="p-4 sm:p-6 hover:bg-gray-50/50 transition-colors">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-start gap-4">
                            {req.avatarUrl || req.avatar_url ? (
                              <img
                                src={req.avatarUrl || req.avatar_url}
                                alt={req.name}
                                className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-100 shrink-0"
                              />
                            ) : (
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                                {getInitials(req.name || 'User')}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link
                                  to={`/profile/${targetProfileId}`}
                                  className="text-base font-semibold text-gray-900 hover:text-primary-600 transition-colors"
                                >
                                  {req.name}
                                </Link>
                                {isIncoming ? (
                                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-200">
                                    Received
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200">
                                    Sent Request
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {req.collegeName || req.college_name || 'College Student'} • Year{' '}
                                {req.yearOfStudy || req.year_of_study || 1}
                                {req.branch ? ` • ${req.branch}` : ''}
                              </p>
                              {req.bio && (
                                <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                                  {req.bio}
                                </p>
                              )}
                              <span className="text-[11px] text-gray-400 mt-1 block">
                                {isIncoming ? 'Requested ' : 'Sent '}
                                {timeAgo(req.createdAt || req.created_at)}
                              </span>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-2 self-end sm:self-center">
                            {isIncoming ? (
                              <>
                                <button
                                  onClick={() => acceptMutation.mutate(req.id)}
                                  disabled={acceptMutation.isPending}
                                  className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  <CheckIcon className="h-4 w-4" />
                                  <span>Accept</span>
                                </button>
                                <button
                                  onClick={() => declineMutation.mutate(req.id)}
                                  disabled={declineMutation.isPending}
                                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  <XMarkIcon className="h-4 w-4" />
                                  <span>Decline</span>
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => cancelRequestMutation.mutate(req.id)}
                                disabled={cancelRequestMutation.isPending}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                <XMarkIcon className="h-4 w-4" />
                                <span>{cancelRequestMutation.isPending ? 'Cancelling...' : 'Cancel Request'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center">
                <ClockIcon className="mx-auto h-8 w-8 text-gray-400" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900">
                  {pendingSubFilter === 'sent'
                    ? 'No sent connection requests'
                    : pendingSubFilter === 'received'
                    ? 'No received connection requests'
                    : 'No pending connection requests'}
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  {pendingSubFilter === 'sent'
                    ? "You haven't sent any pending connection requests."
                    : 'When you send or receive connection requests, they will appear here.'}
                </p>
              </div>
            )}
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
}
