import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PlusIcon, UserGroupIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { groupsApi } from '../api/groups';
import { communitiesApi } from '../api/communities';
import { GroupCard } from '../components/shared/GroupCard';
import { CommunityCard } from '../components/communities/CommunityCard';
import { CreateGroupOnlyModal } from '../components/board/CreateGroupOnlyModal';
import { CreateCommunityModal } from '../components/communities/CreateCommunityModal';
import { GroupDetail } from '../components/groups/GroupDetail';
import { CommunityDetail } from '../components/communities/CommunityDetail';
import { Group, Community } from '../types';

export default function HomePage() {
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = React.useState(false);
  const [isCreateCommunityModalOpen, setIsCreateCommunityModalOpen] = React.useState(false);
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null);
  const [selectedCommunityId, setSelectedCommunityId] = React.useState<string | null>(null);

  const { data: groupsData, isLoading: isLoadingGroups } = useQuery({
    queryKey: ['groups', 'me'],
    queryFn: () => groupsApi.getMyGroups(),
  });

  const { data: myCommunitiesData, isLoading: isLoadingCommunities } = useQuery({
    queryKey: ['communities', 'me'],
    queryFn: async () => {
      const res = await communitiesApi.getMyCommunities();
      const body = res.data as any;
      return Array.isArray(body) ? body : body.data || [];
    },
  });

  const groups: Group[] = Array.isArray((groupsData?.data as any)?.data)
    ? (groupsData?.data as any).data
    : Array.isArray(groupsData?.data)
    ? (groupsData?.data as any)
    : [];

  const communities: Community[] = myCommunitiesData || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* My Groups Section */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">#myGroups</h1>
          <p className="mt-1 text-sm text-gray-500">Teams and engineering projects you are actively participating in</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/boards"
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Browse Project Board
          </Link>
          <button
            type="button"
            onClick={() => setIsCreateGroupModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-primary-700 transition-colors cursor-pointer"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Create Group</span>
          </button>
        </div>
      </div>

      {isLoadingGroups ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-gray-200" />
          ))}
        </div>
      ) : groups.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group: Group) => (
            <GroupCard
              key={group.id}
              group={group}
              role={group.userRole || (group as any).role}
              onClick={() => setSelectedGroupId(group.id)}
              pendingRequestsCount={group.pendingRequestCount || parseInt((group as any).pending_request_count || '0', 10)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-700">
            <UserGroupIcon className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-gray-900">No active groups yet</h3>
          <p className="mt-1 text-xs text-gray-500 max-w-md mx-auto">
            Explore open postings on the campus board to find a team matching your skills, or initialize a new group.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link
              to="/boards"
              className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-700 transition-colors cursor-pointer"
            >
              Browse Project Board
            </Link>
            <button
              type="button"
              onClick={() => setIsCreateGroupModalOpen(true)}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Create Group
            </button>
          </div>
        </div>
      )}

      {/* My Communities Section */}
      <div className="mt-16">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">#myCommunities</h2>
            <p className="mt-1 text-sm text-gray-500">
              Permanent global interest networks and student societies you belong to
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/communities"
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Browse All Communities
            </Link>
            <button
              type="button"
              onClick={() => setIsCreateCommunityModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-primary-700 transition-colors cursor-pointer"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Create Community</span>
            </button>
          </div>
        </div>

        {isLoadingCommunities ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        ) : communities.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {communities.map((comm) => (
              <CommunityCard
                key={comm.id}
                community={comm}
                onClick={() => setSelectedCommunityId(comm.id)}
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
              Join permanent global communities with up to 1,000 students to share knowledge and connect across campuses.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <Link
                to="/communities"
                className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-700 transition-colors cursor-pointer"
              >
                Explore Communities
              </Link>
              <button
                type="button"
                onClick={() => setIsCreateCommunityModalOpen(true)}
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Create Community
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateGroupOnlyModal
        open={isCreateGroupModalOpen}
        onClose={() => setIsCreateGroupModalOpen(false)}
      />

      <CreateCommunityModal
        open={isCreateCommunityModalOpen}
        onClose={() => setIsCreateCommunityModalOpen(false)}
        onSuccess={(id) => setSelectedCommunityId(id)}
      />

      {selectedGroupId && (
        <GroupDetail
          groupId={selectedGroupId}
          onClose={() => setSelectedGroupId(null)}
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
