import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { groupsApi } from '../api/groups';
import { boardsApi } from '../api/boards';
import { GroupCard } from '../components/shared/GroupCard';
import { EmptyState } from '../components/shared/EmptyState';
import { StatusBadge } from '../components/shared/StatusBadge';
import { timeAgo } from '../lib/utils';
import { CreateGroupOnlyModal } from '../components/board/CreateGroupOnlyModal';
import { GroupDetail } from '../components/groups/GroupDetail';
import { Group, JoinRequest } from '../types';

export default function HomePage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null);

  const { data: groupsData, isPending: isLoadingGroups } = useQuery({
    queryKey: ['groups', 'me'],
    queryFn: () => groupsApi.getMyGroups(),
  });

  const { data: requestsData, isPending: isLoadingRequests } = useQuery({
    queryKey: ['my-requests'],
    queryFn: () => boardsApi.getMyRequests(),
  });

  const groups: Group[] = Array.isArray((groupsData?.data as any)?.data)
    ? (groupsData?.data as any).data
    : Array.isArray(groupsData?.data)
      ? (groupsData?.data as any)
      : [];
  const requests: JoinRequest[] = Array.isArray((requestsData?.data as any)?.data)
    ? (requestsData?.data as any).data
    : Array.isArray(requestsData?.data)
      ? (requestsData?.data as any)
      : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Groups</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your active collaborations</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          Create Group
        </button>
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
        <EmptyState
          title="You haven't joined any groups yet"
          description="Find a project that matches your skills or create your own group to get started."
          action={{
            label: 'Browse Board',
            onClick: () => window.location.href = '/boards',
          }}
        />
      )}

      <div className="mt-12">
        <h2 className="mb-6 text-xl font-bold text-gray-900">My Join Requests</h2>
        {isLoadingRequests ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-200" />
            ))}
          </div>
        ) : requests.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <ul className="divide-y divide-gray-200">
              {requests.map((request: any) => (
                <li key={request.id} className="p-4 hover:bg-gray-50 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">
                        {request.postingTitle || request.posting_title || request.posting?.title || 'Group Membership'}
                      </h4>
                      <p className="mt-1 text-sm text-gray-500">
                        Group: <span className="font-medium text-gray-700">{request.groupName || request.group_name || request.group?.name || 'Group'}</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge 
                        status={request.status === 'pending' ? 'pending' : request.status === 'approved' ? 'approved' : 'rejected'} 
                      />
                      <span className="text-xs text-gray-400">
                        {timeAgo(request.createdAt || request.created_at)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-500">No outgoing join requests.</p>
          </div>
        )}
      </div>

      <CreateGroupOnlyModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {selectedGroupId && (
        <GroupDetail
          groupId={selectedGroupId}
          onClose={() => setSelectedGroupId(null)}
        />
      )}
    </div>
  );
}
