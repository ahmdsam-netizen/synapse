import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  GlobeAltIcon,
  UserGroupIcon,
  XMarkIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { communitiesApi } from '../api/communities';
import { Community } from '../types';
import { CommunityCard } from '../components/communities/CommunityCard';
import { CreateCommunityModal } from '../components/communities/CreateCommunityModal';
import { CommunityDetail } from '../components/communities/CommunityDetail';
import { EmptyState } from '../components/shared/EmptyState';
import { SkeletonCard } from '../components/shared/SkeletonCard';
import { PageTabButton } from '../components/shared/PageTabButton';

type CommunityTab = 'all' | 'me' | 'search';

export default function CommunitiesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<CommunityTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);

  // 1. All Communities
  const { data: allCommunitiesData, isLoading: isLoadingAll } = useQuery({
    queryKey: ['communities', 'all'],
    queryFn: async () => {
      const res = await communitiesApi.list({});
      const body = res.data as any;
      return Array.isArray(body) ? body : body.data || [];
    },
  });

  // 2. My Communities
  const { data: myCommunitiesData, isLoading: isLoadingMy } = useQuery({
    queryKey: ['communities', 'me'],
    queryFn: async () => {
      const res = await communitiesApi.getMyCommunities();
      const body = res.data as any;
      return Array.isArray(body) ? body : body.data || [];
    },
  });

  // 3. Search Communities
  const { data: searchResultsData, isLoading: isLoadingSearch } = useQuery({
    queryKey: ['communities', 'search', searchQuery],
    queryFn: async () => {
      const res = await communitiesApi.list({ q: searchQuery.trim() || undefined });
      const body = res.data as any;
      return Array.isArray(body) ? body : body.data || [];
    },
    enabled: activeTab === 'search' && searchQuery.trim().length > 0,
  });

  const joinMutation = useMutation({
    mutationFn: (commId: string) => communitiesApi.join(commId),
    onSuccess: () => {
      toast.success('Joined community successfully!');
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities', 'me'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to join community');
    },
  });

  const allCommunities: Community[] = allCommunitiesData || [];
  const myCommunities: Community[] = myCommunitiesData || [];
  const searchResults: Community[] = searchResultsData || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">#communities</h1>
          <p className="mt-1 text-sm text-gray-500">
            Permanent global student communities across institutions. Join open networks and societies up to 1,000 members.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-primary-700 transition-colors cursor-pointer"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Create Community</span>
        </button>
      </div>

      {/* Tabs / Switcher Buttons */}
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <PageTabButton
          active={activeTab === 'all'}
          onClick={() => setActiveTab('all')}
          icon={GlobeAltIcon}
          title="#allCommunities"
          subtitle="Global student networks"
          count={allCommunities.length}
        />
        <PageTabButton
          active={activeTab === 'me'}
          onClick={() => setActiveTab('me')}
          icon={UserGroupIcon}
          title="#myCommunities"
          subtitle="Communities you joined"
          count={myCommunities.length}
        />
        <PageTabButton
          active={activeTab === 'search'}
          onClick={() => setActiveTab('search')}
          icon={MagnifyingGlassIcon}
          title="#searchCommunities"
          subtitle="Find by topic or keyword"
        />
      </div>

      {/* VIEW 1: ALL COMMUNITIES */}
      {activeTab === 'all' && (
        <>
          {isLoadingAll ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : allCommunities.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {allCommunities.map((comm) => (
                <CommunityCard
                  key={comm.id}
                  community={comm}
                  onClick={() => setSelectedCommunityId(comm.id)}
                  onJoin={() => joinMutation.mutate(comm.id)}
                  isJoining={joinMutation.isPending && joinMutation.variables === comm.id}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No communities found"
              description="No global communities created yet. Be the first to launch an interest-based student community."
              action={{
                label: 'Create Community',
                onClick: () => setIsCreateModalOpen(true),
              }}
            />
          )}
        </>
      )}

      {/* VIEW 2: MY COMMUNITIES */}
      {activeTab === 'me' && (
        <>
          {isLoadingMy ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : myCommunities.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {myCommunities.map((comm) => (
                <CommunityCard
                  key={comm.id}
                  community={comm}
                  onClick={() => setSelectedCommunityId(comm.id)}
                  onJoin={() => joinMutation.mutate(comm.id)}
                  isJoining={joinMutation.isPending && joinMutation.variables === comm.id}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-xs">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                <GlobeAltIcon className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-gray-900">No joined communities yet</h3>
              <p className="mt-1 text-xs text-gray-500 max-w-md mx-auto">
                You haven&apos;t joined any communities yet. Explore global communities or start your own permanent student network.
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-700 transition-colors cursor-pointer"
                >
                  Explore All Communities
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Create Community
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* VIEW 3: SEARCH COMMUNITIES */}
      {activeTab === 'search' && (
        <div className="space-y-6">
          <div className="max-w-xl">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search communities by name, topic, or keyword..."
                className="block w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 shadow-xs"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {!searchQuery.trim() ? (
            <EmptyState
              title="Search student communities"
              description="Enter keywords, topics (such as AI, Open Source, Robotics, UI/UX, Web3), or university names to search global societies."
            />
          ) : isLoadingSearch ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : searchResults.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {searchResults.map((comm) => (
                <CommunityCard
                  key={comm.id}
                  community={comm}
                  onClick={() => setSelectedCommunityId(comm.id)}
                  onJoin={() => joinMutation.mutate(comm.id)}
                  isJoining={joinMutation.isPending && joinMutation.variables === comm.id}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No communities found"
              description={`No communities matched "${searchQuery}". Try a different keyword or create this community.`}
              action={{
                label: 'Create Community',
                onClick: () => setIsCreateModalOpen(true),
              }}
            />
          )}
        </div>
      )}

      {isCreateModalOpen && (
        <CreateCommunityModal
          open={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(id) => setSelectedCommunityId(id)}
        />
      )}

      {selectedCommunityId && (
        <CommunityDetail
          communityId={selectedCommunityId}
          onClose={() => setSelectedCommunityId(null)}
        />
      )}
    </div>
  );
}
