import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/react';
import {
  UserGroupIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  UserMinusIcon,
  CheckIcon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { connectionsApi } from '../api/connections';
import { TagChip } from '../components/shared/TagChip';
import { EmptyState } from '../components/shared/EmptyState';
import { getInitials, formatDate, timeAgo, cn } from '../lib/utils';

export default function ConnectionsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

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

  // Mutations for accepting/declining requests
  const acceptMutation = useMutation({
    mutationFn: (id: string) => connectionsApi.accept(id),
    onSuccess: () => {
      toast.success('Connection accepted!');
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['connections', 'pending'] });
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
      setDisconnectingId(null);
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['connections', 'pending'] });
    },
    onError: () => {
      toast.error('Failed to remove connection');
      setDisconnectingId(null);
    },
  });

  const connections: any[] = connectionsData || [];
  const pendingRequests: any[] = pendingData || [];

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
          <h1 className="text-2xl font-bold text-gray-900">My Network</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and manage your student connections and incoming requests
          </p>
        </div>
        <Link
          to="/recommendations"
          className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
        >
          Discover New Peers
        </Link>
      </div>

      <TabGroup>
        <TabList className="mb-8 flex max-w-md space-x-1 rounded-xl bg-gray-100 p-1">
          <Tab className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium leading-5 transition-colors focus:outline-none data-[selected]:bg-white data-[selected]:text-primary-700 data-[selected]:shadow text-gray-600 hover:text-gray-900">
            <UserGroupIcon className="h-4 w-4" />
            <span>Connections</span>
            <span className="ml-1 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700 data-[selected]:bg-primary-100 data-[selected]:text-primary-800">
              {connections.length}
            </span>
          </Tab>
          <Tab className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium leading-5 transition-colors focus:outline-none data-[selected]:bg-white data-[selected]:text-primary-700 data-[selected]:shadow text-gray-600 hover:text-gray-900">
            <ClockIcon className="h-4 w-4" />
            <span>Pending Requests</span>
            {pendingRequests.length > 0 && (
              <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                {pendingRequests.length}
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
                  <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-200" />
                ))}
              </div>
            ) : filteredConnections.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredConnections.map((user) => {
                  const college = user.collegeName || user.college_name || 'College Member';
                  const year = user.yearOfStudy || user.year_of_study || 1;
                  const skills = user.skills || [];
                  const isConfirming = disconnectingId === (user.friendId || user.id);

                  return (
                    <div
                      key={user.id || user.friendId}
                      className="flex flex-col justify-between rounded-xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div>
                        {/* Top: Avatar & Info */}
                        <div className="flex items-start gap-3">
                          {user.avatarUrl || user.avatar_url ? (
                            <img
                              src={user.avatarUrl || user.avatar_url}
                              alt={user.name}
                              className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-100 shrink-0"
                            />
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-base font-semibold text-white ring-2 ring-gray-100">
                              {getInitials(user.name)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <Link
                              to={`/profile/${user.id || user.friendId}`}
                              className="block truncate font-semibold text-gray-900 hover:text-primary-600 transition-colors"
                            >
                              {user.name}
                            </Link>
                            <p className="truncate text-xs text-gray-500">
                              {college} • Year {year}
                            </p>
                            {user.branch && (
                              <p className="truncate text-xs text-gray-400 mt-0.5">
                                {user.branch}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Bio */}
                        {user.bio && (
                          <p className="mt-3 text-xs text-gray-600 line-clamp-2">
                            {user.bio}
                          </p>
                        )}

                        {/* Skills */}
                        {skills.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {skills.slice(0, 4).map((s: any, idx: number) => (
                              <TagChip
                                key={idx}
                                label={typeof s === 'string' ? s : s.name}
                                variant="skill"
                                size="sm"
                              />
                            ))}
                            {skills.length > 4 && (
                              <span className="self-center text-[10px] text-gray-400">
                                +{skills.length - 4} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Bottom Footer: Connected Date & Actions */}
                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-[11px] text-gray-400">
                          {user.connectedAt || user.connected_at
                            ? `Connected ${timeAgo(user.connectedAt || user.connected_at)}`
                            : 'Connected'}
                        </span>

                        <div className="flex items-center gap-2">
                          <Link
                            to={`/profile/${user.id || user.friendId}`}
                            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
                          >
                            <span>Profile</span>
                            <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                          </Link>

                          {isConfirming ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => removeMutation.mutate(user.connectionId || user.connection_id || user.friendId || user.id)}
                                className="rounded px-2 py-1 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDisconnectingId(null)}
                                className="rounded px-1.5 py-1 text-[11px] text-gray-500 hover:bg-gray-100"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDisconnectingId(user.connectionId || user.connection_id || user.friendId || user.id)}
                              title="Disconnect"
                              className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                            >
                              <UserMinusIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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

          {/* TAB 2: PENDING REQUESTS */}
          <TabPanel>
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
            ) : pendingRequests.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <ul className="divide-y divide-gray-200">
                  {pendingRequests.map((req: any) => (
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
                            <Link
                              to={`/profile/${req.requesterId || req.requester_id}`}
                              className="text-base font-semibold text-gray-900 hover:text-primary-600 transition-colors"
                            >
                              {req.name}
                            </Link>
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
                              Requested {timeAgo(req.createdAt || req.created_at)}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            onClick={() => acceptMutation.mutate(req.id)}
                            disabled={acceptMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors disabled:opacity-50"
                          >
                            <CheckIcon className="h-4 w-4" />
                            <span>Accept</span>
                          </button>
                          <button
                            onClick={() => declineMutation.mutate(req.id)}
                            disabled={declineMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                          >
                            <XMarkIcon className="h-4 w-4" />
                            <span>Decline</span>
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center">
                <ClockIcon className="mx-auto h-8 w-8 text-gray-400" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900">No pending connection requests</h3>
                <p className="mt-1 text-xs text-gray-500">
                  When other students request to connect with you, they will appear here.
                </p>
              </div>
            )}
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
}
